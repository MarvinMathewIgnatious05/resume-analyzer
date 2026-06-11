import os
import random
import secrets
import json
import redis
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from rest_framework import status, views, permissions, generics
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User, Profile
from resume_analyzer.apps.core.models import AuditLog
from .serializers import (
    AuthRequestSerializer,
    OTPVerifySerializer,
    MagicLinkVerifySerializer,
    ProfileSerializer,
    SessionSerializer
)

# Connect to Redis with a resilient safety wrapper for local development
class SafeRedisClient:
    def __init__(self, url):
        self._url = url
        self._fallback_db = {}
        try:
            self._client = redis.from_url(url)
            self._client.ping()
            self._functional = True
        except Exception:
            self._functional = False
            import logging
            logging.getLogger("django").warning("Redis connection failed. Using in-memory dictionary fallback.")

    def get(self, key):
        if self._functional:
            try:
                return self._client.get(key)
            except Exception:
                pass
        val = self._fallback_db.get(key)
        if val:
            data, expiry = val
            if timezone.now() < expiry:
                return data if isinstance(data, bytes) else str(data).encode('utf-8')
            else:
                del self._fallback_db[key]
        return None

    def setex(self, key, time, value):
        if self._functional:
            try:
                return self._client.setex(key, time, value)
            except Exception:
                pass
        expiry = timezone.now() + timezone.timedelta(seconds=time)
        self._fallback_db[key] = (value, expiry)
        return True

    def delete(self, key):
        if self._functional:
            try:
                return self._client.delete(key)
            except Exception:
                pass
        if key in self._fallback_db:
            del self._fallback_db[key]
            return 1
        return 0

    def keys(self, pattern):
        if self._functional:
            try:
                return self._client.keys(pattern)
            except Exception:
                pass
        prefix = pattern.replace('*', '')
        matching_keys = []
        for key in list(self._fallback_db.keys()):
            if key.startswith(prefix):
                _, expiry = self._fallback_db[key]
                if timezone.now() < expiry:
                    matching_keys.append(key.encode('utf-8') if isinstance(key, str) else key)
                else:
                    del self._fallback_db[key]
        return matching_keys

redis_client = SafeRedisClient(settings.CELERY_BROKER_URL)

def get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')

def parse_name_from_email(email):
    """
    Extracts first and last name from email address.
    For example:
    - john.doe@example.com -> ("John", "Doe")
    - alice_smith@example.com -> ("Alice", "Smith")
    - bob@example.com -> ("Bob", "")
    - jane.doe.smith@example.com -> ("Jane", "Doe Smith")
    """
    import re
    if not email or '@' not in email:
        return "", ""
    
    local_part = email.split('@')[0]
    # Split by dot, underscore, or dash
    parts = re.split(r'[._-]', local_part)
    parts = [p.capitalize() for p in parts if p]
    
    if len(parts) >= 2:
        first_name = parts[0]
        last_name = " ".join(parts[1:])
        return first_name, last_name
    elif len(parts) == 1:
        return parts[0], ""
    else:
        return "", ""

class RequestAuthView(views.APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'auth'

    def post(self, request):
        serializer = AuthRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email'].lower()
        method = request.data.get('method', 'magic-link')  # 'magic-link' or 'otp'
        
        ip_addr = get_client_ip(request)
        ua = request.META.get('HTTP_USER_AGENT', 'unknown')

        # Rate Limit check: Max 1 request per minute per email
        rate_limit_key = f"auth_rate:{email}"
        if redis_client.get(rate_limit_key):
            return Response(
                {"detail": "Too many requests. Please wait a minute before requesting again."},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )
        
        # Audit Log for login attempt
        AuditLog.objects.create(
            event_type='LOGIN_ATTEMPT',
            description=f"Auth requested via {method} for {email}",
            ip_address=ip_addr,
            user_agent=ua
        )

        # Set rate limit cooldown in Redis
        redis_client.setex(rate_limit_key, 60, "1")

        # Create user if not exists
        user, created = User.objects.get_or_create(email=email)
        if created:
            first_name, last_name = parse_name_from_email(email)
            Profile.objects.create(
                user=user,
                first_name=first_name,
                last_name=last_name
            )

        if method == 'otp':
            # Generate 6-digit OTP
            otp = f"{random.randint(100000, 999999)}"
            redis_client.setex(f"otp:{email}", settings.OTP_EXPIRY_SECONDS, otp)
            # Reset OTP failure attempts counter
            redis_client.delete(f"otp_attempts:{email}")
            
            # Send Email
            email_body = f"Your Resume Analyzer verification code is: {otp}\nIt expires in 5 minutes."
            try:
                send_mail(
                    subject="Your OTP Verification Code",
                    message=email_body,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[email],
                    fail_silently=False
                )
            except Exception as e:
                import sys
                print("\n" + "="*80, file=sys.stderr)
                print("WARNING: SMTP Email Send Failed! Details: " + str(e), file=sys.stderr)
                print(f"OTP VERIFICATION CODE FOR {email}: {otp}", file=sys.stderr)
                print("="*80 + "\n", file=sys.stderr)
                
            return Response({"detail": "OTP sent successfully.", "method": "otp"})
            
        else:
            # Generate magic link token
            token = secrets.token_urlsafe(32)
            redis_client.setex(f"magic_link:{token}", settings.MAGIC_LINK_EXPIRY_SECONDS, email)
            
            # Build Magic Link
            frontend_url = request.data.get('frontend_url', 'http://localhost:5173')
            magic_link = f"{frontend_url}/verify?token={token}"
            
            # Send Email
            email_body = f"Click the link below to sign in to Resume Analyzer:\n\n{magic_link}\n\nThis link expires in 15 minutes."
            try:
                send_mail(
                    subject="Your Magic Sign-in Link",
                    message=email_body,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[email],
                    fail_silently=False
                )
            except Exception as e:
                import sys
                print("\n" + "="*80, file=sys.stderr)
                print("WARNING: SMTP Email Send Failed! Details: " + str(e), file=sys.stderr)
                print(f"MAGIC LINK SIGN-IN FOR {email}: {magic_link}", file=sys.stderr)
                print("="*80 + "\n", file=sys.stderr)
                
            return Response({"detail": "Magic link sent successfully.", "method": "magic-link"})

class VerifyOTPView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = OTPVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email'].lower()
        submitted_otp = serializer.validated_data['otp']
        
        ip_addr = get_client_ip(request)
        ua = request.META.get('HTTP_USER_AGENT', 'unknown')


        # Brute Force Protection: Check consecutive failed attempts
        attempts_key = f"otp_attempts:{email}"
        attempts = int(redis_client.get(attempts_key) or 0)
        if attempts >= 5:
            return Response(
                {"detail": "Too many failed attempts. Please request a new OTP."},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )

        cached_otp = redis_client.get(f"otp:{email}")
        
        if not cached_otp:
            # Increment attempts on miss/expired
            redis_client.setex(attempts_key, 600, attempts + 1)
            AuditLog.objects.create(
                event_type='LOGIN_FAILED',
                description=f"OTP expired or missing for {email}",
                ip_address=ip_addr,
                user_agent=ua
            )
            return Response({"detail": "OTP expired or not found."}, status=status.HTTP_400_BAD_REQUEST)
            
        if cached_otp.decode('utf-8') != submitted_otp:
            # Increment attempts on wrong OTP
            redis_client.setex(attempts_key, 600, attempts + 1)
            AuditLog.objects.create(
                event_type='LOGIN_FAILED',
                description=f"Invalid OTP submitted for {email}",
                ip_address=ip_addr,
                user_agent=ua
            )
            return Response({"detail": "Invalid OTP code."}, status=status.HTTP_400_BAD_REQUEST)

        # Successful Login
        user = User.objects.get(email=email)
        # Clear verification states
        redis_client.delete(f"otp:{email}")
        redis_client.delete(attempts_key)

        return self.issue_tokens(user, request)

    def issue_tokens(self, user, request):
        refresh = RefreshToken.for_user(user)
        access_token = refresh.access_token

        ip_addr = get_client_ip(request)
        ua = request.META.get('HTTP_USER_AGENT', 'unknown')
        device_hash = request.headers.get('X-Device-Fingerprint', 'unknown_device')

        # Log session metadata in Redis
        session_key = f"user_sessions:{user.id}:{device_hash}"
        session_data = {
            'device_hash': device_hash,
            'ip': ip_addr,
            'user_agent': ua,
            'last_active': timezone.now().isoformat(),
            'jti': access_token['jti']
        }
        redis_client.setex(session_key, 604800, json.dumps(session_data))

        # Security Audit Log
        AuditLog.objects.create(
            user=user,
            event_type='LOGIN_SUCCESS',
            description=f"Successful login for {user.email}",
            ip_address=ip_addr,
            user_agent=ua
        )

        return Response({
            'access': str(access_token),
            'refresh': str(refresh),
            'user': {
                'id': user.id,
                'email': user.email,
            }
        })

class VerifyMagicLinkView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = MagicLinkVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.validated_data['token']

        ip_addr = get_client_ip(request)
        ua = request.META.get('HTTP_USER_AGENT', 'unknown')

        cached_email = redis_client.get(f"magic_link:{token}")
        if not cached_email:
            AuditLog.objects.create(
                event_type='LOGIN_FAILED',
                description="Invalid or expired magic link token",
                ip_address=ip_addr,
                user_agent=ua
            )
            return Response({"detail": "Link is invalid or has expired."}, status=status.HTTP_400_BAD_REQUEST)

        email = cached_email.decode('utf-8')
        user = User.objects.get(email=email)
        
        # Revoke/Delete token from Redis
        redis_client.delete(f"magic_link:{token}")

        return VerifyOTPView().issue_tokens(user, request)

class ProfileView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ProfileSerializer

    def get_object(self):
        profile, created = Profile.objects.get_or_create(user=self.request.user)
        return profile

class SessionsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user_id = request.user.id
        current_device = request.headers.get('X-Device-Fingerprint', 'unknown_device')
        
        # Fetch all keys matching this user's active sessions in Redis
        session_keys = redis_client.keys(f"user_sessions:{user_id}:*")
        sessions = []
        
        for key in session_keys:
            data = redis_client.get(key)
            if data:
                session_data = json.loads(data.decode('utf-8'))
                session_data['is_current'] = session_data.get('device_hash') == current_device
                sessions.append(session_data)
                
        serializer = SessionSerializer(sessions, many=True)
        return Response(serializer.data)

class RevokeSessionView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        device_hash = request.data.get('device_hash')
        if not device_hash:
            return Response({"detail": "Device fingerprint hash required."}, status=400)
            
        user_id = request.user.id
        session_key = f"user_sessions:{user_id}:{device_hash}"
        data = redis_client.get(session_key)
        
        if data:
            session_data = json.loads(data.decode('utf-8'))
            jti = session_data.get('jti')
            
            # Blacklist this session token in Redis
            if jti:
                redis_client.setex(f"blacklist:jti:{jti}", 86400, "revoked")
                
            # Remove session registry from Redis
            redis_client.delete(session_key)
            
            AuditLog.objects.create(
                user=request.user,
                event_type='LOGOUT',
                description=f"Session revoked for device: {device_hash}",
                ip_address=get_client_ip(request),
                user_agent=request.META.get('HTTP_USER_AGENT', 'unknown')
            )
            
            return Response({"detail": "Session revoked successfully."})
        return Response({"detail": "Session not found."}, status=404)

class LogoutAllView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user_id = request.user.id
        session_keys = redis_client.keys(f"user_sessions:{user_id}:*")
        
        for key in session_keys:
            data = redis_client.get(key)
            if data:
                session_data = json.loads(data.decode('utf-8'))
                jti = session_data.get('jti')
                if jti:
                    redis_client.setex(f"blacklist:jti:{jti}", 86400, "revoked")
            redis_client.delete(key)
            
        AuditLog.objects.create(
            user=request.user,
            event_type='LOGOUT',
            description="Logged out from all devices",
            ip_address=get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', 'unknown')
        )
        
        return Response({"detail": "Successfully logged out from all devices."})

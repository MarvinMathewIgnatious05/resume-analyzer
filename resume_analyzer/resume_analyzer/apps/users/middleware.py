import json
from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin
from django.conf import settings
from resume_analyzer.apps.users.views import redis_client

class SessionTrackingMiddleware(MiddlewareMixin):
    def process_request(self, request):
        # We only track sessions if user is authenticated (which happens after AuthenticationMiddleware)
        # Note: DRF authentication runs during the view stage, not middleware stage,
        # but we can also extract information during process_view or process_response,
        # or read simple JWT token manually if present in header.
        pass

    def process_view(self, request, view_func, view_args, view_kwargs):
        # If the request has an authorization header, we can quickly extract the token
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            try:
                # We can verify blacklist in Redis for this specific JWT JTI (JWT ID)
                # SimpleJWT handles basic blacklisting, but we can do custom device-level revocation here.
                from rest_framework_simplejwt.tokens import AccessToken
                access_token = AccessToken(token)
                jti = access_token.get('jti')
                user_id = access_token.get('user_id')
                
                # Check if this specific JTI is marked as blacklisted in Redis
                if redis_client.get(f"blacklist:jti:{jti}"):
                    return JsonResponse({'detail': 'Session has been revoked.'}, status=401)
                
                # Update session activity in Redis
                device_hash = request.headers.get('X-Device-Fingerprint', 'unknown_device')
                ip_addr = self.get_client_ip(request)
                user_agent = request.META.get('HTTP_USER_AGENT', 'unknown_agent')
                
                session_key = f"user_sessions:{user_id}:{device_hash}"
                session_data = {
                    'ip': ip_addr,
                    'user_agent': user_agent,
                    'last_active': request.META.get('HTTP_DATE', 'now'),  # or update dynamically
                    'jti': jti
                }
                # Store session metadata for 7 days
                redis_client.setex(session_key, 604800, json.dumps(session_data))
                
            except Exception:
                # Token is invalid or expired, let DRF handle the 401 response normally
                pass
        return None

    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip

import hashlib
from django.db.models import Avg, Count
from django.utils import timezone
from rest_framework import viewsets, permissions, status, views
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from .models import Resume, ResumeVersion, ResumeAnalysis, JobDescription, JobMatch, AuditLog, Notification
from .serializers import (
    ResumeSerializer,
    ResumeVersionSerializer,
    JobDescriptionSerializer,
    JobMatchSerializer,
    AuditLogSerializer,
    NotificationSerializer
)
from .tasks import async_analyze_resume

class ResumeViewSet(viewsets.ModelViewSet):
    serializer_class = ResumeSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [FormParser, MultiPartParser]

    def get_queryset(self):
        return Resume.objects.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        file_obj = request.FILES.get('file')
        title = request.data.get('title', 'My Resume')
        
        if not file_obj:
            return Response({"detail": "File is required."}, status=status.HTTP_400_BAD_REQUEST)
        
        # 1. Size Validation (5MB Limit)
        if file_obj.size > 5 * 1024 * 1024:
            return Response({"detail": "File size exceeds 5MB limit."}, status=status.HTTP_400_BAD_REQUEST)
        
        # 2. Magic Bytes Header Check
        header = file_obj.read(4)
        file_obj.seek(0)
        
        is_pdf = header.startswith(b'%PDF')
        is_docx = header.startswith(b'PK\x03\x04')
        
        if not (is_pdf or is_docx):
            # Log suspicious upload attempt in audit logs
            AuditLog.objects.create(
                user=request.user,
                event_type='VIRUS_SCAN_FLAGGED',
                description=f"Rejected upload of invalid file type with headers {header.hex()}",
                ip_address=request.META.get('REMOTE_ADDR'),
                user_agent=request.META.get('HTTP_USER_AGENT')
            )
            return Response({"detail": "Invalid file format. Only PDF and DOCX files are allowed."}, status=status.HTTP_400_BAD_REQUEST)

        # 3. Generate SHA-256 Hash
        sha256 = hashlib.sha256()
        for chunk in file_obj.chunks():
            sha256.update(chunk)
        file_hash = sha256.hexdigest()

        # 4. Save Resume and Initial Version
        resume = Resume.objects.create(user=request.user, title=title)
        
        version = ResumeVersion.objects.create(
            resume=resume,
            version_number=1,
            file=file_obj,
            file_name=file_obj.name,
            file_size=file_obj.size,
            file_hash=file_hash,
            virus_scanned=False,
            virus_scan_clean=False
        )

        # Create Initial Pending Analysis
        ResumeAnalysis.objects.create(resume_version=version, status='PENDING')

        # Log upload event
        AuditLog.objects.create(
            user=request.user,
            event_type='FILE_UPLOAD',
            description=f"Uploaded initial version for resume: {title} ({file_obj.name})",
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT')
        )

        # Trigger Celery Task asynchronously
        async_analyze_resume.delay(version.id)

        serializer = self.get_serializer(resume)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class ResumeVersionUploadView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [FormParser, MultiPartParser]

    def post(self, request, resume_id):
        try:
            resume = Resume.objects.get(id=resume_id, user=request.user)
        except Resume.DoesNotExist:
            return Response({"detail": "Resume not found."}, status=status.HTTP_404_NOT_FOUND)

        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({"detail": "File is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Size Validation (5MB Limit)
        if file_obj.size > 5 * 1024 * 1024:
            return Response({"detail": "File size exceeds 5MB limit."}, status=status.HTTP_400_BAD_REQUEST)
        
        # Magic Bytes Header Check
        header = file_obj.read(4)
        file_obj.seek(0)
        
        is_pdf = header.startswith(b'%PDF')
        is_docx = header.startswith(b'PK\x03\x04')
        
        if not (is_pdf or is_docx):
            AuditLog.objects.create(
                user=request.user,
                event_type='VIRUS_SCAN_FLAGGED',
                description=f"Rejected upload of invalid version with headers {header.hex()}",
                ip_address=request.META.get('REMOTE_ADDR'),
                user_agent=request.META.get('HTTP_USER_AGENT')
            )
            return Response({"detail": "Invalid file format. Only PDF and DOCX files are allowed."}, status=status.HTTP_400_BAD_REQUEST)

        # Generate SHA-256 Hash
        sha256 = hashlib.sha256()
        for chunk in file_obj.chunks():
            sha256.update(chunk)
        file_hash = sha256.hexdigest()

        # Get next version number
        latest_version = resume.versions.first()
        next_ver_num = (latest_version.version_number + 1) if latest_version else 1

        version = ResumeVersion.objects.create(
            resume=resume,
            version_number=next_ver_num,
            file=file_obj,
            file_name=file_obj.name,
            file_size=file_obj.size,
            file_hash=file_hash,
            virus_scanned=False,
            virus_scan_clean=False
        )

        ResumeAnalysis.objects.create(resume_version=version, status='PENDING')

        AuditLog.objects.create(
            user=request.user,
            event_type='FILE_UPLOAD',
            description=f"Uploaded version {next_ver_num} for resume: {resume.title}",
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT')
        )

        # Trigger Celery Task asynchronously
        async_analyze_resume.delay(version.id)

        serializer = ResumeVersionSerializer(version)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class JobDescriptionViewSet(viewsets.ModelViewSet):
    serializer_class = JobDescriptionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return JobDescription.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        # Initial saving of Job Description
        serializer.save(user=self.request.user)

class JobMatchView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        resume_version_id = request.data.get('resume_version_id')
        job_description_id = request.data.get('job_description_id')

        if not (resume_version_id and job_description_id):
            return Response({"detail": "Both resume_version_id and job_description_id are required."}, status=400)

        try:
            version = ResumeVersion.objects.get(id=resume_version_id, resume__user=request.user)
            job_desc = JobDescription.objects.get(id=job_description_id, user=request.user)
        except (ResumeVersion.DoesNotExist, JobDescription.DoesNotExist):
            return Response({"detail": "Resource not found."}, status=404)

        # Check if match already exists
        match, created = JobMatch.objects.get_or_create(
            resume_version=version,
            job_description=job_desc
        )

        # Dispatch Celery Task to evaluate match in background, or run synchronously if requested
        # We will process it in Celery, but update the user.
        # For instant UI experience, Celery will call the FastAPI '/job-match' and update the JobMatch record.
        # Here we trigger it
        async_analyze_resume.delay(version.id, job_desc.id)

        return Response({
            "detail": "Job matching analysis triggered successfully.",
            "match_id": match.id
        })

    def get(self, request, pk):
        try:
            match = JobMatch.objects.get(id=pk, resume_version__resume__user=request.user)
        except JobMatch.DoesNotExist:
            return Response({"detail": "Job match details not found."}, status=404)
        
        serializer = JobMatchSerializer(match)
        return Response(serializer.data)

class DashboardStatsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user_resumes = Resume.objects.filter(user=request.user)
        total_uploaded = user_resumes.count()
        
        # Calculate Average ATS Score
        avg_ats = ResumeAnalysis.objects.filter(
            resume_version__resume__user=request.user,
            status='COMPLETED'
        ).aggregate(Avg('ats_score'))['ats_score__avg'] or 0
        
        # Get ATS score history over time
        history = ResumeAnalysis.objects.filter(
            resume_version__resume__user=request.user,
            status='COMPLETED'
        ).order_by('created_at').values('created_at', 'ats_score', 'resume_version__resume__title')
        
        # Latest job matches
        matches = JobMatch.objects.filter(
            resume_version__resume__user=request.user
        ).order_by('-created_at')[:5]
        
        return Response({
            "total_resumes": total_uploaded,
            "average_ats_score": round(avg_ats, 1),
            "score_history": list(history),
            "recent_matches": JobMatchSerializer(matches, many=True).data
        })

class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

    def mark_all_read(self, request):
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({"detail": "All notifications marked as read."})

class AdminMetricsView(views.APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        # Gather aggregate statistics for Admin dashboard
        total_users = User.objects.count()
        active_users_today = User.objects.filter(last_login__date=timezone.now().date()).count()
        total_resumes_uploaded = ResumeVersion.objects.count()
        
        # Virus scan metrics
        scanned_count = ResumeVersion.objects.filter(virus_scanned=True).count()
        clean_count = ResumeVersion.objects.filter(virus_scan_clean=True).count()
        flagged_count = ResumeVersion.objects.filter(virus_scanned=True, virus_scan_clean=False).count()
        
        # Recent security logs
        recent_logs = AuditLog.objects.all()[:50]
        
        return Response({
            "total_users": total_users,
            "active_users_today": active_users_today,
            "total_resumes_uploaded": total_resumes_uploaded,
            "virus_scan_metrics": {
                "total_scanned": scanned_count,
                "clean": clean_count,
                "flagged": flagged_count
            },
            "recent_audit_logs": AuditLogSerializer(recent_logs, many=True).data
        })

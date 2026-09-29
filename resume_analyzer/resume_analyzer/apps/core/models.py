from django.db import models
from django.conf import settings

class Resume(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='resumes')
    title = models.CharField(max_length=255, default="My Resume")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.title} ({self.user.email})"

class ResumeVersion(models.Model):
    resume = models.ForeignKey(Resume, on_delete=models.CASCADE, related_name='versions')
    version_number = models.PositiveIntegerField(default=1)
    file = models.FileField(upload_to='resumes/')
    file_name = models.CharField(max_length=255)
    file_size = models.PositiveIntegerField()  # in bytes
    file_hash = models.CharField(max_length=64)  # SHA-256 for integrity check
    virus_scanned = models.BooleanField(default=False)
    virus_scan_clean = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('resume', 'version_number')
        ordering = ['resume', '-version_number']

    def __str__(self):
        return f"{self.resume.title} - v{self.version_number}"

def upload_file_to(instance, filename):
    # Custom upload helper to put files in subdirectories by user ID
    return f"resumes/user_{instance.resume.user.id}/{filename}"

# Update the FileField to use the helper function
ResumeVersion.file.field.upload_to = upload_file_to

class ResumeAnalysis(models.Model):
    STATUS_CHOICES = (
        ('PENDING', 'Pending Scan/Analysis'),
        ('PROCESSING', 'Processing NLP'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
    )
    resume_version = models.OneToOneField(ResumeVersion, on_delete=models.CASCADE, related_name='analysis')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    error_message = models.TextField(blank=True, null=True)
    
    # Extracted data
    extracted_name = models.CharField(max_length=150, blank=True, null=True)
    extracted_email = models.EmailField(blank=True, null=True)
    extracted_phone = models.CharField(max_length=30, blank=True, null=True)
    extracted_skills = models.JSONField(default=list, blank=True)
    extracted_education = models.JSONField(default=list, blank=True)
    extracted_experience = models.JSONField(default=list, blank=True)
    extracted_certifications = models.JSONField(default=list, blank=True)
    
    # ATS and Analysis results
    ats_score = models.IntegerField(default=0)  # 0 to 100
    formatting_score = models.IntegerField(default=0)  # 0 to 100
    keyword_coverage_score = models.IntegerField(default=0)  # 0 to 100
    
    # Feedback & recommendations from Llama 3
    strengths = models.JSONField(default=list, blank=True)
    weaknesses = models.JSONField(default=list, blank=True)
    improvement_suggestions = models.JSONField(default=list, blank=True)
    career_guidance = models.TextField(blank=True, null=True)
    
    # Raw JSON response from FastAPI
    raw_ai_payload = models.JSONField(default=dict, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Analysis for {self.resume_version.resume.title} (v{self.resume_version.version_number})"

class JobDescription(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='job_descriptions')
    title = models.CharField(max_length=255)
    company = models.CharField(max_length=255, blank=True, null=True)
    raw_text = models.TextField()
    extracted_skills = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} at {self.company or 'Unknown'}"

class JobMatch(models.Model):
    resume_version = models.ForeignKey(ResumeVersion, on_delete=models.CASCADE, related_name='job_matches')
    job_description = models.ForeignKey(JobDescription, on_delete=models.CASCADE, related_name='matches')
    
    match_percentage = models.FloatField(default=0.0)
    missing_skills = models.JSONField(default=list, blank=True)
    missing_keywords = models.JSONField(default=list, blank=True)
    skill_gap_analysis = models.JSONField(default=dict, blank=True)
    optimization_suggestions = models.JSONField(default=list, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('resume_version', 'job_description')

    def __str__(self):
        return f"Match: {self.resume_version.resume.title} <-> {self.job_description.title} ({self.match_percentage}%)"

class AuditLog(models.Model):
    EVENT_TYPES = (
        ('LOGIN_ATTEMPT', 'Login Attempt'),
        ('LOGIN_SUCCESS', 'Login Success'),
        ('LOGIN_FAILED', 'Login Failed'),
        ('LOGOUT', 'Logout'),
        ('FILE_UPLOAD', 'File Upload'),
        ('VIRUS_SCAN_CLEAN', 'Virus Scan Clean'),
        ('VIRUS_SCAN_FLAGGED', 'Virus Scan Flagged'),
        ('DOWNLOAD_REPORT', 'Download Report'),
        ('RECOVERY_LINK', 'Recovery Link Created'),
        ('ADMIN_ACTION', 'Admin Action'),
    )
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_logs')
    event_type = models.CharField(max_length=50, choices=EVENT_TYPES)
    description = models.TextField()
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.created_at} - {self.event_type} - {self.user or 'Anonymous'}"

class Notification(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=255)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} for {self.user.email}"

class CoverLetter(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='cover_letters')
    resume_version = models.ForeignKey(ResumeVersion, on_delete=models.CASCADE, related_name='cover_letters', null=True, blank=True)
    job_title = models.CharField(max_length=255, default="Software Engineer")
    company = models.CharField(max_length=255, default="Target Company")
    job_description = models.TextField(blank=True, default="")
    tone = models.CharField(max_length=50, default="Professional")
    content = models.TextField()
    key_highlights = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Cover Letter for {self.job_title} at {self.company}"


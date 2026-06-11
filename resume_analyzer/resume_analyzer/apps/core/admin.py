from django.contrib import admin
from .models import Resume, ResumeVersion, ResumeAnalysis, JobDescription, JobMatch, AuditLog, Notification

@admin.register(Resume)
class ResumeAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'created_at', 'updated_at')
    search_fields = ('title', 'user__email')

@admin.register(ResumeVersion)
class ResumeVersionAdmin(admin.ModelAdmin):
    list_display = ('resume', 'version_number', 'file_name', 'file_size', 'virus_scanned', 'virus_scan_clean', 'created_at')
    list_filter = ('virus_scanned', 'virus_scan_clean')
    search_fields = ('file_name', 'resume__title', 'resume__user__email')

@admin.register(ResumeAnalysis)
class ResumeAnalysisAdmin(admin.ModelAdmin):
    list_display = ('resume_version', 'status', 'ats_score', 'created_at')
    list_filter = ('status', 'ats_score')
    search_fields = ('resume_version__resume__title', 'resume_version__resume__user__email')

@admin.register(JobDescription)
class JobDescriptionAdmin(admin.ModelAdmin):
    list_display = ('title', 'company', 'user', 'created_at')
    search_fields = ('title', 'company', 'user__email')

@admin.register(JobMatch)
class JobMatchAdmin(admin.ModelAdmin):
    list_display = ('resume_version', 'job_description', 'match_percentage', 'created_at')
    list_filter = ('match_percentage',)
    search_fields = ('resume_version__resume__title', 'job_description__title')

@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'event_type', 'user', 'ip_address')
    list_filter = ('event_type',)
    search_fields = ('user__email', 'description', 'ip_address')
    readonly_fields = ('created_at', 'event_type', 'user', 'description', 'ip_address', 'user_agent')

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'is_read', 'created_at')
    list_filter = ('is_read',)
    search_fields = ('title', 'user__email')

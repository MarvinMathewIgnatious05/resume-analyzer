import hashlib
from rest_framework import serializers
from .models import Resume, ResumeVersion, ResumeAnalysis, JobDescription, JobMatch, AuditLog, Notification

class ResumeAnalysisSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResumeAnalysis
        fields = [
            'id', 'status', 'error_message', 'extracted_name', 'extracted_email',
            'extracted_phone', 'extracted_skills', 'extracted_education',
            'extracted_experience', 'extracted_certifications', 'ats_score',
            'formatting_score', 'keyword_coverage_score', 'strengths',
            'weaknesses', 'improvement_suggestions', 'career_guidance', 'created_at'
        ]
        read_only_fields = ['id', 'status', 'created_at']

class ResumeVersionSerializer(serializers.ModelSerializer):
    analysis = ResumeAnalysisSerializer(read_only=True)
    
    class Meta:
        model = ResumeVersion
        fields = [
            'id', 'version_number', 'file', 'file_name', 'file_size',
            'file_hash', 'virus_scanned', 'virus_scan_clean', 'created_at', 'analysis'
        ]
        read_only_fields = ['id', 'version_number', 'file_hash', 'virus_scanned', 'virus_scan_clean', 'created_at']

class ResumeSerializer(serializers.ModelSerializer):
    versions = ResumeVersionSerializer(many=True, read_only=True)
    latest_version = serializers.SerializerMethodField()
    
    class Meta:
        model = Resume
        fields = ['id', 'title', 'created_at', 'updated_at', 'latest_version', 'versions']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_latest_version(self, obj):
        latest = obj.versions.first()
        if latest:
            return ResumeVersionSerializer(latest).data
        return None

class JobDescriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobDescription
        fields = ['id', 'title', 'company', 'raw_text', 'extracted_skills', 'created_at']
        read_only_fields = ['id', 'extracted_skills', 'created_at']

class JobMatchSerializer(serializers.ModelSerializer):
    job_description = JobDescriptionSerializer(read_only=True)
    
    class Meta:
        model = JobMatch
        fields = [
            'id', 'job_description', 'match_percentage', 'missing_skills',
            'missing_keywords', 'skill_gap_analysis', 'optimization_suggestions', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

class AuditLogSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source='user.email', read_only=True, default='Anonymous')
    
    class Meta:
        model = AuditLog
        fields = ['id', 'email', 'event_type', 'description', 'ip_address', 'user_agent', 'created_at']
        read_only_fields = ['id', 'created_at']

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'title', 'message', 'is_read', 'created_at']
        read_only_fields = ['id', 'created_at']

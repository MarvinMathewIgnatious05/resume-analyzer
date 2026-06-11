from rest_framework import serializers
from .models import User, Profile

class AuthRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

class OTPVerifySerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(max_length=6, min_length=6)

class MagicLinkVerifySerializer(serializers.Serializer):
    token = serializers.CharField()

class ProfileSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source='user.email', read_only=True)
    
    class Meta:
        model = Profile
        fields = ['id', 'email', 'first_name', 'last_name', 'phone', 'bio', 
                  'target_job_title', 'experience_level', 'skills', 'avatar_url', 
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

class SessionSerializer(serializers.Serializer):
    device_hash = serializers.CharField()
    ip = serializers.CharField()
    user_agent = serializers.CharField()
    last_active = serializers.CharField()
    is_current = serializers.BooleanField()

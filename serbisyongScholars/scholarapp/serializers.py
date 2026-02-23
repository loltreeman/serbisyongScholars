from rest_framework import serializers
from .models import User, ScholarProfile

class SignUpSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)
    student_id = serializers.CharField(max_length=6)
    
    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password_confirm', 'first_name', 'last_name', 'student_id']
    
    def validate_email(self, value):
        if not value.endswith('@ateneo.edu') and not value.endswith('@student.ateneo.edu'):
            raise serializers.ValidationError("Must use Ateneo email")
        return value
    
    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError("Passwords don't match")
        return data
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        student_id = validated_data.pop('student_id')
        
        # This is when we will create user
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            role='SCHOLAR',
            is_email_verified=False
        )
        
        # This is when we will create scholar profile
        ScholarProfile.objects.create(
            user=user,
            student_id=student_id,
            program_course='',
            scholar_grant='',
        )
        
        return user

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role']
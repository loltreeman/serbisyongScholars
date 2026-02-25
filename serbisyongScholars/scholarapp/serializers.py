from rest_framework import serializers
from django.contrib.auth.models import Group
from .models import User, ScholarProfile


class RegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ['email', 'password', 'first_name', 'last_name']

    def validate_email(self, value):
        if not value.endswith('@ateneo.edu') and not value.endswith('@student.ateneo.edu'):
            raise serializers.ValidationError("Must use Ateneo email")
        return value.lower()

    def _generate_unique_username(self, base_username):
        normalized_base = ''.join((base_username or '').split()).lower()
        if not normalized_base:
            normalized_base = 'user'

        candidate = normalized_base
        suffix = 2

        while User.objects.filter(username__iexact=candidate).exists():
            candidate = f"{normalized_base}{suffix}"
            suffix += 1

        return candidate

    def create(self, validated_data):
        first_name = validated_data.get('first_name', '')
        last_name = validated_data.get('last_name', '')
        email = validated_data.get('email', '')

        base_username = f"{first_name or ''}{last_name or ''}".strip() or (email.split('@')[0] if email else '')
        username = self._generate_unique_username(base_username)

        user = User.objects.create_user(
            username=username,
            email=email,
            password=validated_data['password'],
            first_name=first_name,
            last_name=last_name,
            is_active=False,
        )

        scholar_group, _ = Group.objects.get_or_create(name='Scholar')
        user.groups.add(scholar_group)
        return user

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
            is_active=False,
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
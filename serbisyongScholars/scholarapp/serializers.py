from rest_framework import serializers
from django.contrib.auth.models import Group
from .models import User, ScholarProfile, ServiceLog, Announcement, Voucher, VoucherApplication, Penalty
from datetime import date

class RegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    student_id = serializers.CharField(max_length=6, required=False)

    class Meta:
        model = User
        fields = ['email', 'password', 'first_name', 'last_name', 'student_id']

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
        student_id = validated_data.pop('student_id', None)

        base_username = f"{first_name or ''}{last_name or ''}".strip() or (email.split('@')[0] if email else '')
        username = self._generate_unique_username(base_username)

        user = User.objects.create_user(
            username=username,
            email=email,
            password=validated_data['password'],
            first_name=first_name,
            last_name=last_name,
            is_active=False,
            role='SCHOLAR'
        )

        # Create ScholarProfile if student_id provided
        if student_id:
            ScholarProfile.objects.create(
                user=user,
                student_id=student_id,
                program_course='',
                scholar_grant='',
                is_dormer=False
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


class ServiceLogSerializer(serializers.ModelSerializer):
    student_id = serializers.CharField(write_only=True)

    class Meta:
        model = ServiceLog
        fields = ['student_id', 'date_rendered', 'hours', 'office_name', 'activity_description']

    def validate_date_rendered(self, value):
        if value > date.today():
            raise serializers.ValidationError("Date cannot be in the future.")
        return value

    def validate_hours(self, value):
        if value < 0.5:
            raise serializers.ValidationError("Minimum loggable hours is 0.5.")
        if value > 24:
            raise serializers.ValidationError("A single log cannot exceed 24 hours.")
        return value

    def validate_student_id(self, value):
        try:
            scholar = ScholarProfile.objects.get(student_id=value)
            if scholar.user.role != 'SCHOLAR':
                raise serializers.ValidationError(f"Cannot encode hours for a {scholar.user.get_role_display()}. Only scholars can have service logs.")
        except ScholarProfile.DoesNotExist:
            raise serializers.ValidationError("No scholar found with that student ID.")
        return value
    
    def create(self, validated_data):
        student_id = validated_data.pop('student_id')
        scholar = ScholarProfile.objects.get(student_id=student_id)
        return ServiceLog.objects.create(
            scholar=scholar,
            created_by=self.context['request'].user,
            **validated_data
        )

class AnnouncementSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source='author.get_full_name', read_only=True)
    author_username = serializers.CharField(source='author.username', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Announcement
        fields = [
            'id', 'title', 'content', 'category', 'status', 'status_display',
            'author_name', 'author_username', 'created_at', 'updated_at', 'external_link', 'rejection_reason'
        ]
        read_only_fields = ['author', 'created_at', 'updated_at', 'status']

class VoucherSerializer(serializers.ModelSerializer):
    is_available = serializers.BooleanField(read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    
    class Meta:
        model = Voucher
        fields = [
            'id', 'title', 'description', 'category', 'provider',
            'total_slots', 'remaining_slots', 'status', 'expiry_date',
            'created_at', 'created_by_name', 'image_url', 'is_available'
        ]
        read_only_fields = ['remaining_slots', 'created_by']


class VoucherApplicationSerializer(serializers.ModelSerializer):
    voucher_title = serializers.CharField(source='voucher.title', read_only=True)
    voucher_category = serializers.CharField(source='voucher.category', read_only=True)
    voucher_expiry_date = serializers.DateField(source='voucher.expiry_date', read_only=True)
    scholar_name = serializers.CharField(source='scholar.get_full_name', read_only=True)
    scholar_id = serializers.CharField(source='scholar.scholar_profile.student_id', read_only=True)

    class Meta:
        model = VoucherApplication
        fields = [
            'id', 'voucher', 'voucher_title', 'voucher_category', 'voucher_expiry_date',
            'scholar', 'scholar_name', 'scholar_id', 'applied_at', 'status', 'notes', 'admin_notes'
        ]
        read_only_fields = ['scholar', 'applied_at', 'status']


class PenaltySerializer(serializers.ModelSerializer):
    scholar_name = serializers.CharField(source='scholar.get_full_name', read_only=True)
    scholar_username = serializers.CharField(source='scholar.username', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Penalty
        fields = [
            'id', 'scholar', 'scholar_name', 'scholar_username',
            'reason', 'status', 'status_display',
            'created_by', 'created_by_name', 'created_at', 'updated_at', 'notes'
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']
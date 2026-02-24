from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator

class User(AbstractUser):
    ROLE_CHOICES = [
        ('SCHOLAR', 'Scholar'),
        ('MODERATOR', 'Moderator'),
        ('ADMIN', 'Admin'),
    ]
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='SCHOLAR')
    is_email_verified = models.BooleanField(default=False)
    verification_token = models.CharField(max_length=100, blank=True, null=True)
    
    def __str__(self):
        return f"{self.username} ({self.role})"
        
class ScholarProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='scholar_profile')
    student_id = models.CharField(max_length=6, unique=True)
    program_course = models.CharField(max_length=100)
    scholar_grant = models.CharField(max_length=50)
    is_dormer = models.BooleanField(default=False)
    
    # Service hours
    required_hours = models.FloatField(default=15.0)
    total_hours_rendered = models.FloatField(default=0.0)
    carry_over_hours = models.FloatField(default=0.0)
    
    def __str__(self):
        return f"{self.student_id} - {self.user.username}"

class ServiceLog(models.Model):
    scholar = models.ForeignKey(ScholarProfile, on_delete=models.CASCADE, related_name='service_logs')
    date_rendered = models.DateField()
    hours = models.FloatField(validators=[MinValueValidator(0.5)])
    office_name = models.CharField(max_length=200)
    activity_description = models.TextField()
    
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-date_rendered']
    
    def __str__(self):
        return f"{self.scholar.student_id} - {self.hours}hrs"
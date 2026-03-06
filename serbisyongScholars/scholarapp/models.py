from django.db import models
from django.db.models import Sum, F, Q
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone

class User(AbstractUser):
    ROLE_CHOICES = [
        ('SCHOLAR', 'Scholar'),
        ('MODERATOR', 'Moderator'),
        ('ADMIN', 'Admin'),
    ]
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='SCHOLAR', db_index=True)
    is_email_verified = models.BooleanField(default=False, db_index=True)
    verification_token = models.CharField(max_length=100, blank=True, null=True, unique=True)
   
    class Meta:
        indexes = [
            models.Index(fields=['role', 'is_email_verified']),
        ]

    def __str__(self):
        return f"{self.username} ({self.role})"

class ScholarProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='scholar_profile')
    student_id = models.CharField(max_length=6, unique=True, db_index=True)
    program_course = models.CharField(max_length=100)
    scholar_grant = models.CharField(max_length=50)
    is_dormer = models.BooleanField(default=False)
   
    # Service hours
    required_hours = models.FloatField(default=15.0, validators=[MinValueValidator(0.0)])
    total_hours_rendered = models.FloatField(default=0.0, validators=[MinValueValidator(0.0)])
    carry_over_hours = models.FloatField(default=0.0, validators=[MinValueValidator(0.0)])


    SCHOOL_CHOICES = [
        ('SOSE', 'School of Science and Engineering'),
        ('SOH', 'School of Humanities'),
        ('JGSOM', 'John Gokongwei School of Management'),
        ('RGLSOSS', 'Dr. Rosita G. Leong School of Social Sciences'),
        ('GBSEALD', 'Gokongwei Brothers School of Education and Learning Design'),
    ]
    
    school = models.CharField(max_length=10, choices=SCHOOL_CHOICES, blank=True, null=True)
    class Meta:
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['student_id']),
        ]

    def __str__(self):
        return f"{self.student_id} - {self.user.username}"

class ServiceLog(models.Model):
    scholar = models.ForeignKey(ScholarProfile, on_delete=models.CASCADE, related_name='service_logs', db_index=True)
    date_rendered = models.DateField(db_index=True)
    hours = models.FloatField(validators=[MinValueValidator(0.5), MaxValueValidator(24.0)])
    office_name = models.CharField(max_length=200)
    activity_description = models.TextField()
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='service_logs_created')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date_rendered']
        indexes = [
            models.Index(fields=['scholar', '-date_rendered']),
            models.Index(fields=['created_by']),
        ]

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.date_rendered > timezone.now().date():
            raise ValidationError("Service date cannot be in the future.")
        
    def __str__(self):
        return f"{self.scholar.student_id} - {self.hours}hrs"

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

        # Recalculate total hours atomically
        total = ServiceLog.objects.filter(scholar=self.scholar).aggregate(Sum('hours'))['hours__sum'] or 0
        ScholarProfile.objects.filter(pk=self.scholar.pk).update(total_hours_rendered=total)

    def delete(self, *args, **kwargs):
        scholar = self.scholar
        super().delete(*args, **kwargs)

        # Recalculate total hours atomically
        total = ServiceLog.objects.filter(scholar=scholar).aggregate(Sum('hours'))['hours__sum'] or 0
        ScholarProfile.objects.filter(pk=scholar.pk).update(total_hours_rendered=total)


class Announcement(models.Model):
    CATEGORY_CHOICES = [
        ('GENERAL', 'General'),
        ('URGENT', 'Urgent'),
        ('VOLUNTEER', 'Volunteer Work'),
        ('OPPORTUNITY', 'Scholarship Opportunity'),
    ]

    title = models.CharField(max_length=255)
    content = models.TextField()
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='GENERAL', db_index=True)

    # Who posted it (usually an Admin or Moderator)
    author = models.ForeignKey(User, on_delete=models.CASCADE, limit_choices_to={'role__in': ['ADMIN', 'MODERATOR']}, related_name='announcements')

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Optional: Link to an external form or PDF
    external_link = models.URLField(blank=True, null=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['category', '-created_at']),
            models.Index(fields=['author']),
        ]

    def __str__(self):
        return f"[{self.category}] {self.title}"

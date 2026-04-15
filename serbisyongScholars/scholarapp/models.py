from django.db import models
from django.db.models import Sum, F, Q
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone

class Office(models.Model):
    name = models.CharField(max_length=200, unique=True, db_index=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

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
    required_hours = models.FloatField(validators=[MinValueValidator(0.0)], blank=True)
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
    
    def save(self, *args, **kwargs):
        
        # Dormer logic
        if self.is_dormer:
            self.required_hours = 15.0
        else:
            self.required_hours = 10.0

        # Carry over calculation
        if ((self.total_hours_rendered-self.required_hours) >= 0):
            self.carry_over_hours = self.total_hours_rendered-self.required_hours
        else: 
            self.carry_over_hours = 0
            
        super().save(*args, **kwargs)

class ModeratorProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='moderator_profile')
    office_name = models.CharField(max_length=200) # Matches the office_name format in ServiceLog

    class Meta:
        indexes = [
            models.Index(fields=['user']),
        ]

    def __str__(self):
        return f"Moderator: {self.user.username}"
    
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
        ('OPPORTUNITY', 'Opportunity'),
        ('FOODSTUBS', 'Food Stubs'),
    ]
    
    STATUS_CHOICES = [
        ('PENDING', 'Pending Approval'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    ]
    
    title = models.CharField(max_length=200)
    content = models.TextField()
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='GENERAL')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='APPROVED')  # ✅ default='APPROVED' for existing records
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='announcements')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    external_link = models.URLField(blank=True, null=True)
    rejection_reason = models.TextField(blank=True, null=True)
    
    def __str__(self):
        return f"{self.title} ({self.get_status_display()})"
    
    class Meta:
        ordering = ['-created_at']

class Voucher(models.Model):
    CATEGORY_CHOICES = [
        ('FOODSTUB', 'Food Stub'),
        ('ENTERTAINMENT', 'Entertainment'),
        ('TRANSPORT', 'Transport'),
        ('WELLNESS', 'Wellness'),
        ('ACADEMIC', 'Academic'),
    ]
    
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('EXPIRED', 'Expired'),
        ('FULL', 'Full'),
    ]
    
    title = models.CharField(max_length=200)
    description = models.TextField()
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    provider = models.CharField(max_length=100)  # e.g., "EBAIS", "Kitchen City"
    total_slots = models.IntegerField()
    remaining_slots = models.IntegerField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    expiry_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_vouchers')
    image_url = models.URLField(blank=True, null=True)  # Optional voucher image
    
    def __str__(self):
        return f"{self.title} - {self.remaining_slots}/{self.total_slots} slots"
    
    class Meta:
        ordering = ['-created_at']
    
    def is_available(self):
        """Check if voucher is still available"""
        from datetime import date
        return self.remaining_slots > 0 and self.expiry_date >= date.today() and self.status == 'ACTIVE'


class VoucherApplication(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('CLAIMED', 'Claimed'),
    ]
    
    voucher = models.ForeignKey(Voucher, on_delete=models.CASCADE, related_name='applications')
    scholar = models.ForeignKey(User, on_delete=models.CASCADE, related_name='voucher_applications')
    applied_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    notes = models.TextField(blank=True, null=True)  
    admin_notes = models.TextField(blank=True, null=True) 
    
    class Meta:
        unique_together = ['voucher', 'scholar'] 
        ordering = ['-applied_at']
    
    def __str__(self):
        return f"{self.scholar.username} - {self.voucher.title} ({self.status})"


class Penalty(models.Model):
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('RESOLVED', 'Resolved'),
        ('WAIVED', 'Waived'),
    ]

    scholar = models.ForeignKey(User, on_delete=models.CASCADE, related_name='penalties')
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_penalties')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.scholar.username} - {self.reason[:50]} ({self.status})"
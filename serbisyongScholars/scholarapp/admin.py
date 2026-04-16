from django.contrib import admin
from .models import User, ScholarProfile, ServiceLog, Announcement

from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

class ScholarProfileInline(admin.StackedInline):
    model = ScholarProfile
    can_delete = False
    verbose_name_plural = 'Scholar Profile'
    fk_name = 'user'

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    inlines = (ScholarProfileInline, )
    list_display = ('username', 'email', 'first_name', 'last_name', 'role', 'is_staff')
    list_filter = ('role', 'is_staff', 'is_superuser', 'is_active', 'groups')
    
    # Add 'role' to the user editing forms in admin
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Role Information', {'fields': ('role',)}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Role Information', {'fields': ('role',)}),
    )

# admin.site.register(ScholarProfile) # Removed because it's now an Inline inside User
admin.site.register(ServiceLog)

@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'created_at', 'author')
    list_filter = ('category', 'created_at')
    search_fields = ('title', 'content')

from django.contrib import admin
from .models import Voucher, VoucherApplication, Penalty

@admin.register(Voucher)
class VoucherAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'provider', 'remaining_slots', 'total_slots', 'status', 'expiry_date')
    list_filter = ('category', 'status', 'provider', 'created_at')
    search_fields = ('title', 'description', 'provider')
    readonly_fields = ('created_at',)
    
    # Automatically set 'created_by' to the logged-in admin user in the admin panel
    def save_model(self, request, obj, form, change):
        if not change:  # Only if creating a new object
            obj.created_by = request.user
            if not obj.remaining_slots:
                obj.remaining_slots = obj.total_slots
        super().save_model(request, obj, form, change)

@admin.register(VoucherApplication)
class VoucherApplicationAdmin(admin.ModelAdmin):
    list_display = ('scholar', 'voucher', 'status', 'applied_at')
    list_filter = ('status', 'applied_at', 'voucher__category')
    search_fields = ('scholar__username', 'scholar__first_name', 'scholar__last_name', 'voucher__title')
    readonly_fields = ('applied_at',)
    list_editable = ('status',)


@admin.register(Penalty)
class PenaltyAdmin(admin.ModelAdmin):
    list_display = ('scholar', 'reason', 'status', 'created_by', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('scholar__username', 'scholar__first_name', 'reason')
    readonly_fields = ('created_at', 'updated_at')
    list_editable = ('status',)
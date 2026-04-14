from django.contrib import admin
from .models import User, ScholarProfile, ServiceLog, Announcement

admin.site.register(User)
admin.site.register(ScholarProfile)
admin.site.register(ServiceLog)

@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'created_at', 'author')
    list_filter = ('category', 'created_at')
    search_fields = ('title', 'content')

from django.contrib import admin
from .models import Voucher, VoucherApplication

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
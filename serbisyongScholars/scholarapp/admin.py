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
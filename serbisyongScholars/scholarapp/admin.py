from django.contrib import admin
from .models import User, ScholarProfile, ServiceLog

admin.site.register(User)
admin.site.register(ScholarProfile)
admin.site.register(ServiceLog)
from django.urls import path
from . import views
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('signup/', views.signup, name='api_signup'),
    path('auth/login/', views.MyTokenObtainPairView.as_view(), name='api_token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='api_token_refresh'),
    path('verify/', views.verify_email, name='api_verify_email'),
    path('scholar/dashboard/', views.get_scholar_dashboard, name='api_dashboard'),
    path('admin/dashboard/', views.admin_dashboard_view, name='admin_dashboard'),
    path('admin/scholars/', views.admin_scholars_list, name='admin_scholars_list'),
    path('announcements/', views.get_recent_announcements, name='api_announcements'),
    path('admin/assign-moderator/', views.assign_moderator, name='assign_moderator'),
    path('service-logs/<int:log_id>/', views.manage_service_log, name='api_manage_service_log'),
]
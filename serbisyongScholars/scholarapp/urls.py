from django.urls import path
from . import views
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('signup/', views.signup, name='api_signup'),
    path('auth/login/', views.MyTokenObtainPairView.as_view(), name='api_token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='api_token_refresh'),
    path('verify/', views.verify_email, name='api_verify_email'),
    path('scholar/dashboard/', views.get_scholar_dashboard, name='api_dashboard'),
    path('dashboard/admin/', views.admin_dashboard_view, name='admin_dashboard'),
    path('admin/scholars/', views.admin_scholars_list, name='admin_scholars_list'),
    path('profile/', views.user_profile, name='api_profile'),
    path('profile-page/', views.profile_page, name='profile_page'),
    path('announcements/', views.announcements_list, name='announcements_list'),  
    path('announcements-page/', views.announcements_page, name='announcements_page'),  
    path('recent-announcements/', views.get_recent_announcements, name='api_recent_announcements'),  
    path('admin/assign-moderator/', views.assign_moderator, name='assign_moderator'),
    path('admin/search-users/', views.search_users, name='search_users'),
    path('logs/create/', views.create_service_log, name='api_create_log'),
]
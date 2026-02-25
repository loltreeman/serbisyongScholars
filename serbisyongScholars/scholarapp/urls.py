from django.urls import path
from . import views
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('signup/', views.signup, name='api_signup'),
    path('auth/login/', views.MyTokenObtainPairView.as_view(), name='api_token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='api_token_refresh'),
    path('scholar/dashboard/', views.get_scholar_dashboard, name='api_dashboard'),
    path('verify/', views.verify_email, name='api_verify_email'),
]
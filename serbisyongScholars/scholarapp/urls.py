from django.urls import path
from . import views

urlpatterns = [
    path('auth/signup/', views.signup, name='signup'),
    path('auth/login/', views.login, name='login'),
    path('scholar/dashboard/', views.get_scholar_dashboard, name='dashboard'),
]
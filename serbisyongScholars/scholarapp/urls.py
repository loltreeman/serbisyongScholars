from django.urls import path
from . import views

urlpatterns = [
    path('api/signup/', views.signup, name='signup'),
    path('api/login/', views.login, name='login'),
    path('api/verify/', views.verify_email, name='verify_email'),
    path('api/dashboard/', views.get_scholar_dashboard, name='dashboard'),
]
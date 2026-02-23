from django.contrib.auth.models import User, Group
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.status import status
from django.core.mail import send_mail
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.contrib.auth.tokens import default_token_generator
from django.conf import settings


from django.shortcuts import render

# Register a new user by default it is a scholar
# -- SignUp View -- #
@api_view(['POST'])
def register(request):
    email = request.data.get('email')
    password = request.data.get('password')
    first_name = request.data.get('first_name')
    last_name = request.data.get('last_name')
    
    if not email.endswith('@student.ateneo.edu') and not email.endswith('@ateneo.edu'):
        return Response({'error': 'Must use a valid Ateneo email.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.create_user(
            username=first_name + last_name,
            email=email, 
            password=password, 
            first_name=first_name, 
            last_name=last_name,
            is_active=False
        )
        scholar_group, created = Group.objects.get_or_create(name='Scholar')
        user.groups.add(scholar_group)

        send_confirmation_email(user)
        return Response({'message': 'Registration successful. Please check your email to confirm your account.'}, status=status.HTTP_201_CREATED)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        
        
    
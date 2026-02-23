from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.contrib.auth import authenticate, get_user_model
from .serializers import SignUpSerializer
from .models import ScholarProfile, ServiceLog

User = get_user_model()

@api_view(['POST'])
@permission_classes([AllowAny])
def signup(request):
    serializer = SignUpSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        
        return Response({
            'message': 'User created successfully!',
            'user': {
                'username': user.username,
                'email': user.email,
            }
        }, status=status.HTTP_201_CREATED)
    
    # This prints the exact reason why signup failed to your VS Code terminal
    print(f"SIGNUP ERROR: {serializer.errors}")
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    username = request.data.get('username')
    password = request.data.get('password')
    
    # This just checks if the username and password match the database
    user = authenticate(username=username, password=password)
    
    if user:
        return Response({
            'message': 'Login successful!',
            'user': {
                'username': user.username,
                'email': user.email,
            }
        })
    
    return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

@api_view(['GET'])
@permission_classes([AllowAny]) # Changed to AllowAny
def get_scholar_dashboard(request):
    # Because there is no authentication, Django doesn't know who "request.user" is.
    # We have to pass the username in the URL to know whose dashboard to load.
    username = request.GET.get('username')
    
    if not username:
        return Response({'error': 'Please provide a username in the URL'}, status=400)

    try:
        user = User.objects.get(username=username)
        scholar = user.scholar_profile
        service_logs = ServiceLog.objects.filter(scholar=scholar)
        
        return Response({
            'student_id': scholar.student_id,
            'name': f"{user.first_name} {user.last_name}",
            'program': scholar.program_course,
            'is_dormer': scholar.is_dormer,
            'required_hours': scholar.required_hours,
            'rendered_hours': scholar.total_hours_rendered,
            'carry_over': scholar.carry_over_hours,
            'service_logs': [
                {
                    'date': log.date_rendered,
                    'hours': log.hours,
                    'office': log.office_name,
                    'activity': log.activity_description
                }
                for log in service_logs
            ]
        })
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=404)
    except ScholarProfile.DoesNotExist:
        return Response({'error': 'Scholar profile not found for this user'}, status=404)
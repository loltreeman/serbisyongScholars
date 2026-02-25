from django.contrib.auth.models import Group
from django.contrib.auth import get_user_model
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.core.mail import send_mail
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.contrib.auth.tokens import default_token_generator
from django.conf import settings
from .serializers import RegistrationSerializer
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from .models import ScholarProfile, ServiceLog

User = get_user_model()


# Register a new user by default it is a scholar
# -- SignUp View -- #
@api_view(['POST'])
def signup(request):
    serializer = RegistrationSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        send_confirmation_email(user)
        return Response({'message': 'Registration successful. Please check your email to confirm your account.'}, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# -- Send Verification Email -- #
def send_confirmation_email(user):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    
    #Point this to the React frontend route
    frontend_url = f"http://localhost:3000/verify"
    verification_link = f"{frontend_url}?uid={uid}&token={token}"

    # Send the email
    subject = "Confirm your serbisyonScholar Account"
    message = f"""
    Hi {user.first_name} {user.last_name},

    Thank you for registering for an account on the Serbisyong Scholar Portal.

    Please click the link below to verify your email address and activate your account:

    {verification_link}

    If you did not create this account, please disregard this email.

    Thank you,
    The Serbisyong Scholar Team
    """
    send_mail(
        subject,
        message,
        settings.EMAIL_HOST_USER,
        [user.email],
        fail_silently=False,
    )

# -- Verify Email View -- #
@api_view(['POST'])
def verify_email(request):
    uidb64 = request.data.get('uid')
    token = request.data.get('token')
   
    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = User.objects.get(pk=uid)
    except:
        user = None
    
    if user is not None and default_token_generator.check_token(user, token):
        user.is_active = True
        user.save()
        return Response({'message': 'Email verified successfully.'}, status=status.HTTP_200_OK)
    else:
        return Response({'error': 'Invalid verification link.'}, status=status.HTTP_400_BAD_REQUEST) 
# Custom Token serializer/view to include user data in token response
class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)

        data['user'] = {
            'username': self.user.username,
            'email': self.user.email,
            'first_name': getattr(self.user, 'first_name', ''),
            'last_name': getattr(self.user, 'last_name', ''),
            'is_active': self.user.is_active,
        }

        return data


class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer


# -- Scholar Dashboard View -- #
@api_view(['GET'])
def get_scholar_dashboard(request):
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


# @api_view(['POST'])
# @permission_classes([AllowAny])
# def login(request):
#     username = request.data.get('username')
#     password = request.data.get('password')
    
#     # This just checks if the username and password match the database
#     user = authenticate(username=username, password=password)
    
#     if user:
#         return Response({
#             'message': 'Login successful!',
#             'user': {
#                 'username': user.username,
#                 'email': user.email,
#             }
#         })
    
#     return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

# if not username:
#         return Response({'error': 'Please provide a username in the URL'}, status=400)

#     try:
#         user = User.objects.get(username=username)
#         scholar = user.scholar_profile
#         service_logs = ServiceLog.objects.filter(scholar=scholar)
        
#         return Response({
#             'student_id': scholar.student_id,
#             'name': f"{user.first_name} {user.last_name}",
#             'program': scholar.program_course,
#             'is_dormer': scholar.is_dormer,
#             'required_hours': scholar.required_hours,
#             'rendered_hours': scholar.total_hours_rendered,
#             'carry_over': scholar.carry_over_hours,
#             'service_logs': [
#                 {
#                     'date': log.date_rendered,
#                     'hours': log.hours,
#                     'office': log.office_name,
#                     'activity': log.activity_description
#                 }
#                 for log in service_logs
#             ]
#         })
#     except User.DoesNotExist:
#         return Response({'error': 'User not found'}, status=404)
#     except ScholarProfile.DoesNotExist:
#         return Response({'error': 'Scholar profile not found for this user'}, status=404)# @api_view(['GET'])
# @permission_classes([AllowAny]) # Changed to AllowAny
# def get_scholar_dashboard(request):
#     # Because there is no authentication, Django doesn't know who "request.user" is.
#     # We have to pass the username in the URL to know whose dashboard to load.
#     username = request.GET.get('username')
    
#     if not username:
#         return Response({'error': 'Please provide a username in the URL'}, status=400)

#     try:
#         user = User.objects.get(username=username)
#         scholar = user.scholar_profile
#         service_logs = ServiceLog.objects.filter(scholar=scholar)
        
#         return Response({
#             'student_id': scholar.student_id,
#             'name': f"{user.first_name} {user.last_name}",
#             'program': scholar.program_course,
#             'is_dormer': scholar.is_dormer,
#             'required_hours': scholar.required_hours,
#             'rendered_hours': scholar.total_hours_rendered,
#             'carry_over': scholar.carry_over_hours,
#             'service_logs': [
#                 {
#                     'date': log.date_rendered,
#                     'hours': log.hours,
#                     'office': log.office_name,
#                     'activity': log.activity_description
#                 }
#                 for log in service_logs
#             ]
#         })
#     except User.DoesNotExist:
#         return Response({'error': 'User not found'}, status=404)
#     except ScholarProfile.DoesNotExist:
#         return Response({'error': 'Scholar profile not found for this user'}, status=404)
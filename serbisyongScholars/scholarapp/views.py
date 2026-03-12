import threading
from django.contrib.auth.models import Group
from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.core.mail import send_mail
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.http import HttpResponseForbidden
from django.utils.encoding import force_bytes, force_str
from django.contrib.auth.tokens import default_token_generator
from django.conf import settings
from django.shortcuts import render
from .serializers import RegistrationSerializer
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.db.models import Avg, Q, Sum
from .models import User, ScholarProfile, ServiceLog
from django.http import JsonResponse
from .models import Announcement

User = get_user_model()


# Register a new user by default it is a scholar
# -- SignUp View -- #
@api_view(['POST'])
def signup(request):
    serializer = RegistrationSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        # Send email in background so the response is instant
        thread = threading.Thread(target=send_confirmation_email, args=(user,))
        thread.daemon = True
        thread.start()
        return Response({'message': 'Registration successful. Please check your email to confirm your account.'}, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# -- Send Verification Email -- #
def send_confirmation_email(user):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)

    frontend_url = f"{settings.SITE_URL}/verify"
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
        user.is_email_verified = True
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
            'role': self.user.role,
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

            # reuse shape for profile
        return Response({
            'username': user.username,
            'name': f"{user.first_name} {user.last_name}",
            'email': user.email,
            'role': user.role,
            'student_id': getattr(scholar, 'student_id', None),
            'program': getattr(scholar, 'program_course', None),
            'grant_type': getattr(scholar, 'scholar_grant', None),
            'is_dormer': getattr(scholar, 'is_dormer', None),
            'required_hours': getattr(scholar, 'required_hours', None),
            'rendered_hours': getattr(scholar, 'total_hours_rendered', None),
            'carry_over': getattr(scholar, 'carry_over_hours', None),
            'service_logs': [
                {
                    'date': log.date_rendered,
                    'hours': log.hours,
                    'office': log.office_name,
                    'activity': log.activity_description,
                    # assume all logs are approved currently
                    'status': 'Approved'
                }
                for log in service_logs
            ]
        })
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=404)
    except ScholarProfile.DoesNotExist:
        return Response({'error': 'Scholar profile not found for this user'}, status=404)

def get_recent_announcements(request):
    # Get 2 latest announcements
    announcements = Announcement.objects.all().order_by('-created_at')[:2]
    data = [{
        "id": a.id,
        "title": a.title,
        "content": a.content[:100], 
        "tag_name": a.category,    
        "tag_color": "red" if a.category == "Urgent" else "amber"
    } for a in announcements]
    
    return JsonResponse(data, safe=False)

@login_required
def admin_dashboard_view(request):
    """Render admin dashboard page; only accessible by admins."""
    if request.user.role != 'ADMIN':
        return HttpResponseForbidden('Admin access required')
    return render(request, 'admin_dashboard.html')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_scholars_list(request):
    """
    Get all scholars for admin dashboard
    API endpoint: /api/admin/scholars/
    """
    # Check if user is admin
    if request.user.role != 'ADMIN':
        return Response({'error': 'Admin access required'}, status=403)
    
    # Get filter parameters
    status_filter = request.GET.get('status', 'all')
    search_query = request.GET.get('search', '')
    
    # Get all scholar profiles
    profiles = ScholarProfile.objects.select_related('user').all()
    
    # Apply search filter
    if search_query:
        profiles = profiles.filter(
            Q(student_id__icontains=search_query) |
            Q(user__first_name__icontains=search_query) |
            Q(user__last_name__icontains=search_query)
        )
    
    # Build scholar list
    scholars = []
    complete_count = 0
    on_track_count = 0
    behind_count = 0
    
    for profile in profiles:
        rendered = profile.total_hours_rendered
        required = profile.required_hours
        percentage = (rendered / required * 100) if required > 0 else 0
        
        # Determine status
        if percentage >= 100:
            status = 'complete'
            complete_count += 1
        elif percentage >= 70:
            status = 'on-track'
            on_track_count += 1
        else:
            status = 'behind'
            behind_count += 1
        
        # Apply status filter
        if status_filter != 'all' and status != status_filter:
            continue
        
        scholars.append({
            'student_id': profile.student_id,
            'name': f"{profile.user.first_name} {profile.user.last_name}",
            'email': profile.user.email,
            'program': profile.program_course,
            'is_dormer': profile.is_dormer,
            'rendered_hours': rendered,
            'required_hours': required,
            'carry_over': profile.carry_over_hours,
            'status': status
        })
    
    # Calculate stats
    total_scholars = len(scholars)
    completion_rate = (complete_count / total_scholars * 100) if total_scholars > 0 else 0
    average_hours = profiles.aggregate(Avg('total_hours_rendered'))['total_hours_rendered__avg'] or 0
    
    return Response({
        'total': total_scholars,
        'complete': complete_count,
        'on_track': on_track_count,
        'behind': behind_count,
        'completion_rate': completion_rate,
        'average_hours': average_hours,
        'scholars': scholars
    })


# --- Profile API and page ---
@api_view(['GET', 'PUT'])
@permission_classes([AllowAny])
def user_profile(request):
    """Retrieve or update a user's profile information.

    GET parameters:
        username - required, identifies the user whose profile is requested.

    PUT body (JSON):
        username (required) and any of the editable fields. Only admins may
        change the ``role`` field; users may update their own ``first_name``
        and ``last_name``. Other fields may be ignored or validated.
    """
    username = request.GET.get('username') if request.method == 'GET' else request.data.get('username')
    if not username:
        return Response({'error': 'Please provide a username.'}, status=400)

    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=404)

    scholar = getattr(user, 'scholar_profile', None)

    if request.method == 'GET':
        data = {
            'username': user.username,
            'name': f"{user.first_name} {user.last_name}",
            'email': user.email,
            'role': user.role,
            'student_id': getattr(scholar, 'student_id', None),
            'course_department': getattr(scholar, 'program_course', None),
            'grant_type': getattr(scholar, 'scholar_grant', None),
            'service_logs': []
        }
        if scholar:
            logs = ServiceLog.objects.filter(scholar=scholar)
            data['service_logs'] = [
                {
                    'date': log.date_rendered,
                    'hours': log.hours,
                    'office': log.office_name,
                    'activity': log.activity_description,
                    'status': 'Approved',
                }
                for log in logs
            ]
        return Response(data)

    # PUT: update profile
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required to update profile.'}, status=401)

    # Only admin can change role, or user can update their own name
    payload = request.data
    updated = False
    if 'role' in payload:
        if request.user.role != 'ADMIN':
            return Response({'error': 'Admin access required to change role.'}, status=403)
        new_role = payload.get('role')
        if new_role in dict(User.ROLE_CHOICES):
            user.role = new_role
            updated = True
    if 'first_name' in payload and request.user == user:
        user.first_name = payload.get('first_name')
        updated = True
    if 'last_name' in payload and request.user == user:
        user.last_name = payload.get('last_name')
        updated = True

    if updated:
        user.save()
        return Response({'message': 'Profile updated successfully.'})
    else:
        return Response({'message': 'No changes made.'}, status=400)


def profile_page(request):
    """Render the profile HTML page."""
    return render(request, 'profile.html')

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
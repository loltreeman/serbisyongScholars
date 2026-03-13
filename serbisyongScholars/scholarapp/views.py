import threading
from django.contrib.auth.models import Group
from django.contrib.auth import get_user_model
from django.contrib.auth import login as django_login
from django.contrib.auth.decorators import login_required
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.core.mail import send_mail
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.http import HttpResponseForbidden
from django.utils.encoding import force_bytes, force_str
from django.contrib.auth.tokens import default_token_generator
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from django.shortcuts import render
from .serializers import RegistrationSerializer, ServiceLogSerializer
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.db.models import Avg, Q, Sum
from .models import User, ScholarProfile, ServiceLog, Announcement, ModeratorProfile
from django.http import JsonResponse


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
    subject = "Confirm your serbisyongScholar Account"
    message = f"""
    Hi {user.first_name} {user.last_name},

    Thank you for registering for an account on the Serbisyong Scholar Portal. Your assigned username is: {user.username}

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
@csrf_exempt
@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
@authentication_classes([])
def verify_email(request):
    # Check both POST data and GET (URL) parameters
    uidb64 = request.data.get('uid') or request.GET.get('uid')
    token = request.data.get('token') or request.GET.get('token')
    
    if not uidb64 or not token:
        return Response({'error': 'Missing credentials'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = User.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        user = None
    
    if user is not None and default_token_generator.check_token(user, token):
        user.is_active = True
        user.is_email_verified = True
        user.save()
        return Response({'message': 'Email verified successfully! You can now login.'}, status=status.HTTP_200_OK)
    else:
        return Response({'error': 'Invalid or expired verification link.'}, status=status.HTTP_400_BAD_REQUEST)
    
class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        # 1. Capture the input (which might be an email)
        login_id = attrs.get(self.username_field)
        password = attrs.get('password')

        # 2. Check if the input is an email and map it to the real username
        if login_id and '@' in login_id:
            try:
                user = User.objects.get(email__iexact=login_id)
                attrs[self.username_field] = user.username
            except User.DoesNotExist:
                # If email not found, let the parent class handle the error
                pass

        # 3. Call the parent validate (which now has the correct username)
        data = super().validate(attrs)

        # 4. Add your custom user data to the response
        data['user'] = {
            'username': self.user.username,
            'email': self.user.email,
            'first_name': getattr(self.user, 'first_name', ''),
            'last_name': getattr(self.user, 'last_name', ''),
            'role': self.user.role,
            'is_active': self.user.is_active,
        }

        return data
    
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

    def post(self, request, *args, **kwargs):
        # 1. Get whatever they typed in the 'username' box
        login_id = request.data.get('username') 
        password = request.data.get('password')

        # 2. If they typed an email, find the actual generated username
        if login_id and '@' in login_id:
            try:
                user_obj = User.objects.get(email__iexact=login_id)
                # Overwrite the 'username' in request data with the REAL username
                request.data['username'] = user_obj.username
            except User.DoesNotExist:
                pass # Let authenticate handle the failure

        # 3. Now call the standard JWT/Django login logic
        response = super().post(request, *args, **kwargs)
        
        if response.status_code == 200:
            from django.contrib.auth import authenticate
            # Use the (potentially updated) username from request.data
            user = authenticate(
                username=request.data.get('username'),
                password=password
            )
            if user:
                django_login(request, user)
                
        return response

    serializer_class = MyTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        # 1. First, let the JWT library do its job (generate tokens)
        response = super().post(request, *args, **kwargs)
        
        if response.status_code == 200:
            # 2. Extract credentials from request
            username = request.data.get('username')
            password = request.data.get('password')
            
            # 3. Use the Django authenticate system
            from django.contrib.auth import authenticate
            user = authenticate(username=username, password=password)
            
            if user is not None:
                if user.is_active:
                    django_login(request, user)
                else:
                    # This shouldn't happen if JWT gave a 200, but good for safety
                    return Response({'error': 'Account is inactive.'}, status=status.HTTP_401_UNAUTHORIZED)
            else:
                # If JWT worked but authenticate failed, there's a backend config mismatch
                print(f"Auth failed for user: {username}") 
                
        return response

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

@login_required(login_url='/login/')
def admin_dashboard_view(request):
    """Render admin dashboard page"""
    # Check if user is admin
    if request.user.role != 'ADMIN':
        return HttpResponseForbidden("Admin access required")
    
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
    
    # Get office statistics for charts
    office_stats = ServiceLog.objects.values('office_name').annotate(
        total_hours=Sum('hours')
    ).order_by('-total_hours')[:5]  # Top 5 offices
    
    return Response({
        'total': total_scholars,
        'complete': complete_count,
        'on_track': on_track_count,
        'behind': behind_count,
        'completion_rate': completion_rate,
        'average_hours': average_hours,
        'scholars': scholars,
        'office_stats': list(office_stats) 
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

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def search_users(request):
    """
    Search users by username, first name, or last name.
    Returns a list of matching users with basic info.
    Query param: ?q=<search term>
    """
    if request.user.role != 'ADMIN':
        return Response({'error': 'Admin access required'}, status=403)

    query = request.GET.get('q', '').strip()
    if len(query) < 2:
        return Response([], status=200)

    users = User.objects.filter(
        Q(username__icontains=query) |
        Q(first_name__icontains=query) |
        Q(last_name__icontains=query)
    ).exclude(role='ADMIN').values('username', 'first_name', 'last_name', 'email', 'role')[:10]

    return Response(list(users), status=200)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def assign_moderator(request):
    """
    Render assign moderator page (GET) and assign moderator (POST)
    API endpoint: /api/admin/assign-moderator/
    Allows OAA (ADMIN) to assign moderator access to an office.
    """
    
    # Check if user is admin
    if request.user.role != 'ADMIN':
        return Response({'error': 'Admin access required'}, status=403)

    # Serve the HTML page when user opens the Assign link.
    if request.method == 'GET':
        return render(request, 'assign_moderator.html')
    
    # Get moderator username and office name from request
    moderator_username = request.data.get('moderator_username')
    office_name = request.data.get('office_name')
    
    if not moderator_username or not office_name:
        return Response({'error': 'Moderator username and office name are required'}, status=400)
    
    # Find the user and update their status to moderator, and create/update their ModeratorProfile
    try:
        target_user = User.objects.get(username=moderator_username)

        # Prevent duplicate moderator assignment.
        if target_user.role == 'MODERATOR':
            return Response({'error': f'User {moderator_username} is already a moderator.'}, status=400)

        target_user.role = 'MODERATOR'
        target_user.save()
        
        #Link them to the office by creating/updating their ModeratorProfile
        ModeratorProfile.objects.update_or_create(
            user=target_user,
            defaults={'office_name': office_name}
        )
        return Response({'message': f'Moderator {moderator_username} assigned to {office_name}'})
    except User.DoesNotExist:
        return Response({'error': 'Moderator user not found'}, status=404)
    except Exception as e:
            return Response({'error': str(e)}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_service_log(request):

    # Checks if user is either ADMIN or MOD, the only people allowed to encode
    if request.user.role not in ['ADMIN', 'MODERATOR']:
        return Response(
            {'error': 'Only admins and moderators can create service logs.'},
            status=status.HTTP_403_FORBIDDEN
        )
    serializer = ServiceLogSerializer(data=request.data, context={'request': request})
    if serializer.is_valid():
        serializer.save()
        return Response(
            {'message': 'Service log created successfully.'},
            status=status.HTTP_201_CREATED
        )
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

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
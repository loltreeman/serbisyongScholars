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
from django.shortcuts import render, redirect
from .serializers import RegistrationSerializer, ServiceLogSerializer, AnnouncementSerializer
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.db.models import Avg, Q, Sum
from .models import User, ScholarProfile, ServiceLog, Announcement, ModeratorProfile, Office, Voucher, VoucherApplication, Penalty
from .serializers import VoucherSerializer, VoucherApplicationSerializer, PenaltySerializer
from django.http import JsonResponse
from datetime import date
from django.db.models import Q


User = get_user_model()

ANNOUNCEMENT_CATEGORY_STYLES = {
    'GENERAL': {
        'badge_classes': 'bg-blue-100 text-blue-800',
        'tag_color': 'blue',
    },
    'URGENT': {
        'badge_classes': 'bg-red-100 text-red-800',
        'tag_color': 'red',
    },
    'VOLUNTEER': {
        'badge_classes': 'bg-green-100 text-green-800',
        'tag_color': 'green',
    },
    'OPPORTUNITY': {
        'badge_classes': 'bg-yellow-100 text-yellow-800',
        'tag_color': 'yellow',
    },
    'FOOD STUBS': {
        'badge_classes': 'bg-orange-100 text-orange-800',
        'tag_color': 'orange',
    },
}


def get_announcement_category_info(category):
    valid_categories = dict(Announcement.CATEGORY_CHOICES)
    category_value = category if category in valid_categories else 'GENERAL'

    return {
        'value': category_value,
        'label': valid_categories[category_value],
        **ANNOUNCEMENT_CATEGORY_STYLES.get(
            category_value,
            ANNOUNCEMENT_CATEGORY_STYLES['GENERAL'],
        ),
    }


def get_announcement_category_options():
    return [
        get_announcement_category_info(value)
        for value, _label in Announcement.CATEGORY_CHOICES
    ]


def get_scholar_status(rendered, required):
    percentage = (rendered / required * 100) if required > 0 else 0

    if percentage >= 100:
        return 'complete'
    if percentage >= 70:
        return 'on-track'
    return 'behind'


def get_available_offices():
    # Deprecated fallback since we have an Office model now, but kept for legacy UI compatibility 
    # anywhere it's still specifically imported. Now it prefers Office model.
    offices = set(Office.objects.values_list('name', flat=True))
    return sorted(offices, key=str.casefold)


# Register a new user by default it is a scholar
@api_view(['POST'])
@permission_classes([AllowAny])
@authentication_classes([])
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
    
def is_oaa_mod(user):
    """Returns True if the user is a moderator for the OAA office."""
    if user.role != 'MODERATOR':
        return False
    try:
        office = user.moderator_profile.office_name.lower()
        return 'oaa' in office or 'admission and aid' in office
    except Exception:
        return False


class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        # Handle Email login by finding the actual username
        login_id = attrs.get(self.username_field)
        if login_id and '@' in login_id:
            try:
                user = User.objects.get(email__iexact=login_id)
                attrs[self.username_field] = user.username
            except User.DoesNotExist:
                pass

        # Standard JWT validation
        data = super().validate(attrs)

        office_name = None
        try:
            office_name = self.user.moderator_profile.office_name
        except Exception:
            pass

        # Add user info for the frontend
        data['user'] = {
            'username': self.user.username,
            'email': self.user.email,
            'role': self.user.role,
            'office_name': office_name,
            'is_oaa_mod': is_oaa_mod(self.user),
        }
        return data

class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        login_id = request.data.get('username')
        password = request.data.get('password')

        # Map email to actual username before JWT validation
        if login_id and '@' in login_id:
            try:
                user_obj = User.objects.get(email__iexact=login_id)
                request.data['username'] = user_obj.username
            except User.DoesNotExist:
                pass

        response = super().post(request, *args, **kwargs)

        # Create a Django session so @login_required template views work
        if response.status_code == 200:
            from django.contrib.auth import authenticate
            user = authenticate(
                username=request.data.get('username'),
                password=password,
            )
            if user:
                django_login(request, user)

        return response

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
    # Only show approved announcements to the general public/dashboard
    announcements = Announcement.objects.filter(status='APPROVED').order_by('-created_at')[:2]
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
    status_filter = (request.GET.get('status', 'all') or 'all').strip().lower()
    school_filter = (request.GET.get('school', 'all') or 'all').strip().upper()
    search_query = (request.GET.get('search', '') or '').strip()

    valid_status_filters = {'all', 'complete', 'on-track', 'behind'}
    valid_school_filters = {value for value, _label in ScholarProfile.SCHOOL_CHOICES}

    if status_filter not in valid_status_filters:
        return Response({'error': 'Invalid status filter.'}, status=400)

    if school_filter != 'ALL' and school_filter not in valid_school_filters:
        return Response({'error': 'Invalid school filter.'}, status=400)
    
    profiles = ScholarProfile.objects.select_related('user').filter(
        user__role='SCHOLAR' 
    )

    if school_filter != 'ALL':
        profiles = profiles.filter(school=school_filter)
    
    # Apply search filter
    if search_query:
        profiles = profiles.filter(
            Q(student_id__icontains=search_query) |
            Q(user__first_name__icontains=search_query) |
            Q(user__last_name__icontains=search_query) |
            Q(user__email__icontains=search_query) |
            Q(program_course__icontains=search_query)
        )
    
    # Build scholar list
    scholars = []
    complete_count = 0
    on_track_count = 0
    behind_count = 0
    rendered_hours_total = 0
    filtered_profile_ids = []
    
    for profile in profiles:
        rendered = profile.total_hours_rendered
        required = profile.required_hours
        status = get_scholar_status(rendered, required)
        
        # Apply status filter
        if status_filter != 'all' and status != status_filter:
            continue

        if status == 'complete':
            complete_count += 1
        elif status == 'on-track':
            on_track_count += 1
        else:
            behind_count += 1

        rendered_hours_total += rendered
        filtered_profile_ids.append(profile.pk)
        
        scholars.append({
            'student_id': profile.student_id,
            'name': f"{profile.user.first_name} {profile.user.last_name}",
            'email': profile.user.email,
            'program': profile.program_course,
            'school': profile.school,
            'school_display': profile.get_school_display() if profile.school else 'Not Set',
            'is_dormer': profile.is_dormer,
            'rendered_hours': rendered,
            'required_hours': required,
            'carry_over': profile.carry_over_hours,
            'status': status
    })
    
    # Calculate stats
    total_scholars = len(scholars)
    completion_rate = (complete_count / total_scholars * 100) if total_scholars > 0 else 0
    average_hours = (rendered_hours_total / total_scholars) if total_scholars > 0 else 0

    filtered_profiles = ScholarProfile.objects.filter(pk__in=filtered_profile_ids)
    dormer_count = filtered_profiles.filter(is_dormer=True).count()
    non_dormer_count = filtered_profiles.filter(is_dormer=False).count()

    # Get office statistics for charts
    office_stats = ServiceLog.objects.filter(
        scholar_id__in=filtered_profile_ids
    ).values('office_name').annotate(
        total_hours=Sum('hours')
    ).order_by('-total_hours')[:5]
    
    return Response({
        'total': total_scholars,
        'complete': complete_count,
        'on_track': on_track_count,
        'behind': behind_count,
        'completion_rate': completion_rate,
        'average_hours': average_hours,
        'scholars': scholars,
        'office_stats': list(office_stats),
        'dormer_count': dormer_count,
        'non_dormer_count': non_dormer_count,
        'applied_filters': {
            'status': status_filter,
            'school': school_filter if school_filter != 'ALL' else 'all',
            'search': search_query,
        },
    })

@api_view(['GET', 'PUT'])
@permission_classes([AllowAny])
def user_profile(request):
    """Retrieve or update a user's profile information.

    GET parameters:
        username - identifies the user by username
        student_id - identifies the user by student ID (for scholars)

    PUT body (JSON):
        username (required) and any of the editable fields.
    """
    if request.method == 'GET':
        username = request.GET.get('username')
        student_id = request.GET.get('student_id')
        
        if not username and not student_id:
            return Response({'error': 'Please provide a username or student_id.'}, status=400)

        try:
            if student_id:
                # Find user by student_id
                scholar_profile = ScholarProfile.objects.select_related('user').get(student_id=student_id)
                user = scholar_profile.user
            else:
                # Find user by username
                user = User.objects.get(username=username)
        except ScholarProfile.DoesNotExist:
            return Response({'error': 'Scholar not found'}, status=404)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=404)
    else:  # PUT
        username = request.data.get('username')
        if not username:
            return Response({'error': 'Please provide a username.'}, status=400)
        
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=404)

    scholar = getattr(user, 'scholar_profile', None)
    moderator = getattr(user, 'moderator_profile', None)

    if request.method == 'GET':
        data = {
            'username': user.username,
            'name': f"{user.first_name} {user.last_name}",
            'email': user.email,
            'role': user.role,
            'student_id': getattr(scholar, 'student_id', None),
            'course_department': getattr(scholar, 'program_course', None),
            'grant_type': getattr(scholar, 'scholar_grant', None),
            'total_hours_rendered': getattr(scholar, 'total_hours_rendered', 0),
            'required_hours': getattr(scholar, 'required_hours', 10),
            'carry_over_hours': getattr(scholar, 'carry_over_hours', 0),
            'is_dormer': getattr(scholar, 'is_dormer', False),
            'assigned_office': getattr(moderator, 'office_name', None),
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

@login_required(login_url='/login/')
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
        return render(request, 'assign_moderator.html', {
            'office_choices': get_available_offices(),
        })
    
    # Get moderator username and office name from request
    moderator_username = request.data.get('moderator_username')
    office_name = (request.data.get('office_name') or '').strip()
    
    if not moderator_username or not office_name:
        return Response({'error': 'Moderator username and office name are required'}, status=400)
    
    # Find the user and update their status to moderator, and create/update their ModeratorProfile
    try:
        target_user = User.objects.get(username=moderator_username)

        already_moderator = target_user.role == 'MODERATOR'

        if not already_moderator:
            target_user.role = 'MODERATOR'
            target_user.save()

        ModeratorProfile.objects.update_or_create(
            user=target_user,
            defaults={'office_name': office_name}
        )

        action = 'updated office for' if already_moderator else 'assigned'
        return Response({'message': f'Successfully {action} moderator {moderator_username} → {office_name}'})
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

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_dormer_status(request):
    # Checks if user is ADMIN
    if request.user.role not in ['ADMIN']:
        return Response({'error': 'Admin access required'}, status=403)

    student_id = request.data.get('student_id')
    is_dormer = request.data.get('is_dormer')

    if student_id is None or is_dormer is None:
        return Response({'error': 'student_id and is_dormer are required'}, status=400)

    try:
        scholar = ScholarProfile.objects.get(student_id=student_id)
        scholar.is_dormer = is_dormer
        scholar.save()
        # Update dormer status and required hours to match
        return Response({
            'message': 'Dormer status updated successfully.',
            'is_dormer': scholar.is_dormer,
            'required_hours': scholar.required_hours
        })
    except ScholarProfile.DoesNotExist:
        return Response({'error': 'Scholar not found'}, status=404)

@api_view(['GET', 'POST', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def announcements_list(request):
    """List, create, update, or delete announcements"""
    
    if request.method == 'GET':
        # Scholars: Only see APPROVED announcements
        # Moderators: See APPROVED + their own PENDING/REJECTED announcements
        # Admins: See ALL announcements
        if request.user.role == 'ADMIN':
            announcements = Announcement.objects.all().order_by('-created_at')
        elif request.user.role == 'MODERATOR':
            # Moderators see: approved announcements + ALL their own announcements (pending/rejected)
            announcements = Announcement.objects.filter(
                Q(status='APPROVED') | Q(author=request.user)
            ).order_by('-created_at')
        else:  # SCHOLAR
            announcements = Announcement.objects.filter(status='APPROVED').order_by('-created_at')
        
        serializer = AnnouncementSerializer(announcements, many=True)
        return Response(serializer.data)
    
    elif request.method == 'POST':
        # Both ADMIN and MODERATOR can create announcements
        if request.user.role not in ['ADMIN', 'MODERATOR']:
            return Response({'error': 'Only admins and moderators can create announcements'}, status=403)
        
        serializer = AnnouncementSerializer(data=request.data)
        if serializer.is_valid():
            # ADMIN posts go live immediately, MODERATOR posts need approval
            if request.user.role == 'ADMIN':
                serializer.save(author=request.user, status='APPROVED')
            else:  # MODERATOR
                serializer.save(author=request.user, status='PENDING')
            
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)
    
    elif request.method == 'PUT':
        announcement_id = request.data.get('id')
        if not announcement_id:
            return Response({'error': 'Announcement ID required'}, status=400)
        
        try:
            announcement = Announcement.objects.get(id=announcement_id)
        except Announcement.DoesNotExist:
            return Response({'error': 'Announcement not found'}, status=404)
        
        # MODERATOR can only edit their own PENDING or REJECTED announcements
        # ADMIN can edit any announcement
        if request.user.role == 'MODERATOR':
            if announcement.author != request.user:
                return Response({'error': 'You can only edit your own announcements'}, status=403)
            if announcement.status not in ('PENDING', 'REJECTED'):
                return Response({'error': 'You can only edit pending or rejected announcements'}, status=403)
        elif request.user.role != 'ADMIN':
            return Response({'error': 'Unauthorized'}, status=403)

        serializer = AnnouncementSerializer(announcement, data=request.data, partial=True)
        if serializer.is_valid():
            # Editing a rejected announcement resubmits it for approval
            if request.user.role == 'MODERATOR' and announcement.status == 'REJECTED':
                serializer.save(status='PENDING', rejection_reason='')
            else:
                serializer.save()
            return Response(serializer.data, status=200)
        return Response(serializer.errors, status=400)
    
    elif request.method == 'DELETE':
        announcement_id = request.data.get('id') or request.GET.get('id')
        if not announcement_id:
            return Response({'error': 'Announcement ID required'}, status=400)
        
        try:
            announcement = Announcement.objects.get(id=announcement_id)
        except Announcement.DoesNotExist:
            return Response({'error': 'Announcement not found'}, status=404)
        
        # MODERATOR can only delete their own PENDING announcements
        # ADMIN can delete any announcement
        if request.user.role == 'MODERATOR':
            if announcement.author != request.user:
                return Response({'error': 'You can only delete your own announcements'}, status=403)
            if announcement.status != 'PENDING':
                return Response({'error': 'You can only delete pending announcements'}, status=403)
        elif request.user.role != 'ADMIN':
            return Response({'error': 'Unauthorized'}, status=403)
        
        announcement.delete()
        return Response({'message': 'Announcement deleted successfully'}, status=200)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def approve_announcement(request, announcement_id):
    """Admin approves or rejects a pending announcement"""
    if request.user.role != 'ADMIN':
        return Response({'error': 'Admin only'}, status=403)
    
    action = request.data.get('action')  
    rejection_reason = request.data.get('rejection_reason', '')
    
    try:
        announcement = Announcement.objects.get(id=announcement_id)
    except Announcement.DoesNotExist:
        return Response({'error': 'Announcement not found'}, status=404)
    
    if action == 'approve':
        announcement.status = 'APPROVED'
        announcement.save()
        return Response({'message': 'Announcement approved'}, status=200)
    elif action == 'reject':
        announcement.status = 'REJECTED'
        announcement.rejection_reason = rejection_reason
        announcement.save()
        return Response({'message': 'Announcement rejected'}, status=200)
    else:
        return Response({'error': 'Invalid action'}, status=400)
  
def announcements_page(request):
    """Render announcements page"""
    return render(request, 'announcements.html', {
        'announcement_categories': get_announcement_category_options(),
    })

@login_required(login_url='/login/')
def announcement_detail_view(request, announcement_id):
    """Render single announcement detail page"""
    try:
        announcement = Announcement.objects.get(id=announcement_id)
        return render(request, 'announcement_detail.html', {
            'announcement': announcement,
            'announcement_categories': get_announcement_category_options(),
            'category_info': get_announcement_category_info(announcement.category),
        })
    except Announcement.DoesNotExist:
        return render(request, 'announcement_detail.html', {
            'error': 'Announcement not found'
        })

@login_required(login_url='/login/')
def dashboard_router(request):
    """Route users to appropriate dashboard based on role"""
    if request.user.role == 'ADMIN':
        return redirect('admin_dashboard')
    elif request.user.role == 'MODERATOR':
        return redirect('moderator_dashboard')  
    else:  
        return redirect('scholar_dashboard')

@login_required(login_url='/login/')
def manage_announcements_view(request):
    """Render the management page for Admins/Moderators"""
    if request.user.role not in ['ADMIN', 'MODERATOR']:
        return HttpResponseForbidden("You do not have permission to manage announcements.")
    
    return render(request, 'manage_announcements.html')


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def offices_list_create(request):
    """List or create offices (Admin only for POST)"""
    if request.method == 'GET':
        offices = Office.objects.all().values('id', 'name')
        return Response(list(offices))
    
    if request.method == 'POST':
        if request.user.role != 'ADMIN':
            return Response({'error': 'Admin access required'}, status=403)
        
        name = request.data.get('name', '').strip()
        if not name:
            return Response({'error': 'Office name is required'}, status=400)
        
        office, created = Office.objects.get_or_create(name=name)
        if not created:
            return Response({'error': 'Office already exists'}, status=400)
        
        return Response({'id': office.id, 'name': office.name}, status=201)


@api_view(['PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def office_detail(request, office_id):
    """Update or delete an office (Admin only)"""
    if request.user.role != 'ADMIN':
        return Response({'error': 'Admin access required'}, status=403)
    
    try:
        office = Office.objects.get(id=office_id)
    except Office.DoesNotExist:
        return Response({'error': 'Office not found'}, status=404)
    
    if request.method == 'PUT':
        new_name = request.data.get('name', '').strip()
        if not new_name:
            return Response({'error': 'Office name is required'}, status=400)
        
        if Office.objects.filter(name=new_name).exclude(id=office_id).exists():
            return Response({'error': 'An office with this name already exists'}, status=400)
        
        old_name = office.name
        office.name = new_name
        office.save()
        
        # Cascade update existing logs and profiles (as requested)
        ServiceLog.objects.filter(office_name=old_name).update(office_name=new_name)
        ModeratorProfile.objects.filter(office_name=old_name).update(office_name=new_name)
        
        return Response({'id': office.id, 'name': office.name})
    
    if request.method == 'DELETE':
        # Note: We don't delete historical logs, they just keep the old name string
        office.delete()
        return Response({'message': 'Office deleted successfully'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def remove_moderator(request):
    """Demote a moderator back to a scholar (Admin only)"""
    if request.user.role != 'ADMIN':
        return Response({'error': 'Admin access required'}, status=403)
    
    username = request.data.get('username')
    if not username:
        return Response({'error': 'Username is required'}, status=400)
    
    try:
        user = User.objects.get(username=username)
        if user.role != 'MODERATOR':
            return Response({'error': 'User is not a moderator'}, status=400)
        
        user.role = 'SCHOLAR'
        user.save()
        
        # Delete moderator profile if it exists
        ModeratorProfile.objects.filter(user=user).delete()
        
        return Response({'message': f'User {username} demoted to Scholar successfully'})
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=404)
    
@login_required(login_url='/login/')
def add_log_page(request):
    return render(request, 'add_log.html')

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def vouchers_list(request):
    """
    GET: List all active vouchers
    POST: Create voucher (ADMIN only)
    """
    if request.method == 'GET':
        # Scholars see only active, available vouchers
        # Admins see all vouchers
        if request.user.role == 'ADMIN':
            vouchers = Voucher.objects.all()
        else:
            vouchers = Voucher.objects.filter(
                status='ACTIVE',
                expiry_date__gte=date.today(),
                remaining_slots__gt=0
            )
        
        # Filter by category if provided
        category = request.GET.get('category')
        if category:
            vouchers = vouchers.filter(category=category)
        
        serializer = VoucherSerializer(vouchers, many=True)
        return Response(serializer.data)
    
    elif request.method == 'POST':
        # Only ADMIN or OAA moderators can create vouchers
        if not (request.user.role == 'ADMIN' or is_oaa_mod(request.user)):
            return Response({'error': 'Only OAA moderators and admins can create vouchers'}, status=403)
        
        serializer = VoucherSerializer(data=request.data)
        if serializer.is_valid():
            # Set remaining_slots = total_slots initially
            total_slots = serializer.validated_data.get('total_slots')
            serializer.save(
                created_by=request.user,
                remaining_slots=total_slots
            )
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def voucher_detail(request, voucher_id):
    """
    GET: Get voucher details
    PUT: Update voucher (ADMIN only)
    DELETE: Delete voucher (ADMIN only)
    """
    try:
        voucher = Voucher.objects.get(id=voucher_id)
    except Voucher.DoesNotExist:
        return Response({'error': 'Voucher not found'}, status=404)
    
    if request.method == 'GET':
        serializer = VoucherSerializer(voucher)
        return Response(serializer.data)
    
    elif request.method == 'PUT':
        if not (request.user.role == 'ADMIN' or is_oaa_mod(request.user)):
            return Response({'error': 'Only OAA moderators and admins can edit vouchers'}, status=403)

        serializer = VoucherSerializer(voucher, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    elif request.method == 'DELETE':
        if not (request.user.role == 'ADMIN' or is_oaa_mod(request.user)):
            return Response({'error': 'Only OAA moderators and admins can delete vouchers'}, status=403)
        
        voucher.delete()
        return Response({'message': 'Voucher deleted successfully'}, status=200)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def apply_voucher(request, voucher_id):
    """
    Scholar applies for a voucher
    """
    if request.user.role != 'SCHOLAR':
        return Response({'error': 'Only scholars can apply for vouchers'}, status=403)
    
    try:
        voucher = Voucher.objects.get(id=voucher_id)
    except Voucher.DoesNotExist:
        return Response({'error': 'Voucher not found'}, status=404)
    
    # Check if voucher is available
    if not voucher.is_available():
        return Response({'error': 'Voucher is no longer available'}, status=400)
    
    # Check if scholar already applied
    existing_application = VoucherApplication.objects.filter(
        voucher=voucher,
        scholar=request.user
    ).first()
    
    if existing_application:
        return Response({
            'error': 'You have already applied for this voucher',
            'status': existing_application.status
        }, status=400)
    
    # Create application
    notes = request.data.get('notes', '')
    
    application = VoucherApplication.objects.create(
        voucher=voucher,
        scholar=request.user,
        notes=notes,
        status='PENDING'
    )
    
    # Decrement remaining slots
    voucher.remaining_slots -= 1
    if voucher.remaining_slots == 0:
        voucher.status = 'FULL'
    voucher.save()
    
    serializer = VoucherApplicationSerializer(application)
    return Response(serializer.data, status=201)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_voucher_applications(request):
    """
    Get current scholar's voucher applications
    """
    if request.user.role != 'SCHOLAR':
        return Response({'error': 'Scholars only'}, status=403)
    
    applications = VoucherApplication.objects.filter(scholar=request.user)
    serializer = VoucherApplicationSerializer(applications, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def voucher_applications_list(request):
    """
    List voucher applications.
    - Admin / OAA mod: see all applications.
    - Other mods: see only applications for vouchers they created or
      whose provider matches their office name.
    """
    user = request.user

    if user.role == 'ADMIN' or is_oaa_mod(user):
        applications = VoucherApplication.objects.all()
    elif user.role == 'MODERATOR':
        try:
            office = user.moderator_profile.office_name
            applications = VoucherApplication.objects.filter(
                Q(voucher__created_by=user) |
                Q(voucher__provider__icontains=office)
            )
        except Exception:
            applications = VoucherApplication.objects.none()
    else:
        return Response({'error': 'Moderator or Admin access required'}, status=403)

    # Filter by status
    filter_status = request.GET.get('status')
    if filter_status:
        applications = applications.filter(status=filter_status)

    # Filter by voucher
    voucher_id = request.GET.get('voucher_id')
    if voucher_id:
        applications = applications.filter(voucher_id=voucher_id)

    serializer = VoucherApplicationSerializer(applications, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def approve_voucher_application(request, application_id):
    """
    Approve or reject a voucher application.
    Allowed: Admin, OAA moderators, or the moderator who created the voucher.
    """
    try:
        application = VoucherApplication.objects.get(id=application_id)
    except VoucherApplication.DoesNotExist:
        return Response({'error': 'Application not found'}, status=404)

    user = request.user
    can_approve = (
        user.role == 'ADMIN' or
        is_oaa_mod(user) or
        (user.role == 'MODERATOR' and application.voucher.created_by == user)
    )
    if not can_approve:
        return Response({'error': 'Not authorized to approve applications for this voucher'}, status=403)
    
    action = request.data.get('action')  # 'approve' or 'reject'
    admin_notes = request.data.get('admin_notes', '')
    
    if action == 'approve':
        application.status = 'APPROVED'
        application.admin_notes = admin_notes
        application.save()
        return Response({'message': 'Application approved'}, status=200)
    
    elif action == 'reject':
        application.status = 'REJECTED'
        application.admin_notes = admin_notes
        application.save()
        
        # Return slot to voucher
        voucher = application.voucher
        voucher.remaining_slots += 1
        if voucher.status == 'FULL':
            voucher.status = 'ACTIVE'
        voucher.save()
        
        return Response({'message': 'Application rejected'}, status=200)
    
    else:
        return Response({'error': 'Invalid action'}, status=400)
    
@login_required
def vouchers_page(request):
    user = request.user
    can_create = user.role == 'ADMIN' or is_oaa_mod(user)
    can_manage = user.role in ('ADMIN', 'MODERATOR')

    # Non-OAA mods can see applications for their office but not approve them
    is_readonly_mod = user.role == 'MODERATOR' and not is_oaa_mod(user)

    return render(request, 'vouchers.html', {
        'can_create_voucher': can_create,
        'can_manage_applications': can_manage,
        'is_oaa_mod': is_oaa_mod(user),
        'is_readonly_mod': is_readonly_mod,
    })


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def penalties_list(request):
    """GET: Admin lists all penalties; Scholar lists own. POST: Admin creates a penalty."""
    if request.method == 'GET':
        if request.user.role == 'ADMIN':
            penalties = Penalty.objects.all()
        elif request.user.role == 'SCHOLAR':
            penalties = Penalty.objects.filter(scholar=request.user)
        else:
            return Response({'error': 'Unauthorized'}, status=403)
        serializer = PenaltySerializer(penalties, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        if request.user.role != 'ADMIN':
            return Response({'error': 'Admin only'}, status=403)
        serializer = PenaltySerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(created_by=request.user)
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def penalty_detail(request, penalty_id):
    """GET: view a penalty. PUT: Admin updates status (resolve/waive)."""
    try:
        penalty = Penalty.objects.get(id=penalty_id)
    except Penalty.DoesNotExist:
        return Response({'error': 'Penalty not found'}, status=404)

    if request.user.role == 'SCHOLAR' and penalty.scholar != request.user:
        return Response({'error': 'Unauthorized'}, status=403)
    if request.user.role == 'MODERATOR':
        return Response({'error': 'Unauthorized'}, status=403)

    if request.method == 'GET':
        serializer = PenaltySerializer(penalty)
        return Response(serializer.data)

    elif request.method == 'PUT':
        if request.user.role != 'ADMIN':
            return Response({'error': 'Admin only'}, status=403)
        serializer = PenaltySerializer(penalty, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)
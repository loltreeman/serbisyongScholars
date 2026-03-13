from rest_framework.test import APIClient, APITestCase
from rest_framework import status
from django.test import TestCase, Client  
from django.contrib.auth import get_user_model
from django.urls import reverse
from datetime import date
from .models import User, ScholarProfile, ServiceLog, ModeratorProfile

User = get_user_model()

class AdminDashboardTests(TestCase):
    """Tests for Admin Dashboard page"""
    
    def setUp(self):
        """Create test data"""
        # Create admin user
        self.admin = User.objects.create_user(
            username='testadmin',
            email='admin@ateneo.edu',
            password='TestPass123!',
            role='ADMIN',
            is_email_verified=True
        )

        # create test scholars
        for i in range(5):
            user = User.objects.create_user(
                username=f'scholar{i}',
                email=f'scholar{i}@student.ateneo.edu',
                password='TestPass123!',
                role='SCHOLAR',
                first_name=f'Scholar{i}',
                last_name='TestUser',
                is_email_verified=True
            )

            profile = ScholarProfile.objects.create(
                user=user,
                student_id=f'12345{i}',
                program_course='BS Computer Science',
                scholar_grant='FULL',
                is_dormer=(i % 2 == 0),
                required_hours=25.0 if (i % 2 == 0) else 15.0
            )

            hours = 10.0 if i < 3 else 5.0
            ServiceLog.objects.create(
                scholar=profile,
                date_rendered=date(2026, 2, 15),
                hours=hours,
                office_name='Test Office',
                activity_description='Test activity'
            )
            profile.total_hours_rendered = hours
            profile.save()
        
        # Use regular Client for HTML views
        self.client = Client()
        # Use APIClient for API endpoints
        self.api_client = APIClient()
    
    def test_admin_dashboard_page_loads(self):
        self.client.force_login(self.admin)
        url = reverse('admin_dashboard')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Admin Dashboard')
        self.assertContains(response, 'Total Scholars')

    def test_admin_dashboard_shows_correct_stats(self):
        """Test if dashboard shows correct scholar statistics"""
        self.api_client.force_authenticate(user=self.admin)
        
        # Use API client for API endpoint
        url = reverse('admin_scholars_list')
        response = self.api_client.get(url)
        
        # Should return 200 now
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['total'], 5)
        self.assertIn('complete', data)
        self.assertIn('behind', data)
        self.assertIn('average_hours', data)

    def test_scholar_filtering_by_status(self):
        """Test if filtering by completion status works"""
        self.api_client.force_authenticate(user=self.admin)
        
        # Filter for complete scholars
        url = reverse('admin_scholars_list')
        response = self.api_client.get(url, {'status': 'complete'})
        
        # Check if response is JSON
        if response.status_code == 200:
            data = response.json()
            for scholar in data['scholars']:
                percentage = (scholar['rendered_hours'] / scholar['required_hours']) * 100
                self.assertGreaterEqual(percentage, 100)

    def test_scholar_search_functionality(self):
        """Test if search by student ID works"""
        self.api_client.force_authenticate(user=self.admin)
        
        url = reverse('admin_scholars_list')
        response = self.api_client.get(url, {'search': '123450'})
        
        # Check if response is JSON
        if response.status_code == 200:
            data = response.json()
            self.assertGreater(len(data['scholars']), 0)
            self.assertEqual(data['scholars'][0]['student_id'], '123450')

    def test_admin_dashboard_requires_auth(self):
        """Test if dashboard requires authentication"""
        # Try to access without login - use regular client
        url = reverse('admin_dashboard')
        response = self.client.get(url)
        
        # Should redirect to login (302)
        self.assertEqual(response.status_code, 302)

    def test_admin_dashboard_requires_admin_role(self):
        """Test if non-admin users are blocked"""
        # Login as scholar (not admin) - use regular client
        scholar = User.objects.filter(role='SCHOLAR').first()
        self.client.force_login(scholar)
        url = reverse('admin_dashboard')
        response = self.client.get(url)
        
        # Should be forbidden (403)
        self.assertEqual(response.status_code, 403)

class ProgressVisualizationTests(TestCase):
    """Tests for progress bar components"""
    
    def setUp(self):
        """Create test data"""
        user = User.objects.create_user(
            username='testscholar',
            email='test@student.ateneo.edu',
            password='TestPass123!',
            role='SCHOLAR',
            first_name='Test',
            last_name='Scholar',
            is_email_verified=True
        )
        
        self.profile = ScholarProfile.objects.create(
            user=user,
            student_id='123456',
            program_course='BS CS',
            scholar_grant='FULL',
            is_dormer=False,
            required_hours=15.0
        )
        
        self.client = Client()  # Changed to Client
    
    def test_progress_calculation_80_percent(self):
        """Test if progress calculates 80% correctly"""
        # Add 12 hours (80% of 15)
        ServiceLog.objects.create(
            scholar=self.profile,
            date_rendered=date(2026, 2, 15),
            hours=12.0,
            office_name='Library',
            activity_description='Test'
        )
        
        # Update total
        self.profile.total_hours_rendered = 12.0
        self.profile.save()
        
        # Calculate percentage
        percentage = (self.profile.total_hours_rendered / self.profile.required_hours) * 100
        self.assertEqual(percentage, 80.0)
    
    def test_progress_calculation_complete(self):
        """Test if progress shows 100% when complete"""
        # Add 15 hours (100% of 15)
        ServiceLog.objects.create(
            scholar=self.profile,
            date_rendered=date(2026, 2, 15),
            hours=15.0,
            office_name='Library',
            activity_description='Test'
        )
        
        # Update total
        self.profile.total_hours_rendered = 15.0
        self.profile.save()
        
        # Calculate percentage
        percentage = (self.profile.total_hours_rendered / self.profile.required_hours) * 100
        self.assertEqual(percentage, 100.0)
    
    def test_progress_bar_handles_overflow(self):
        """Test if system handles hours over 100%"""
        # Add 20 hours (133% of 15)
        ServiceLog.objects.create(
            scholar=self.profile,
            date_rendered=date(2026, 2, 15),
            hours=20.0,
            office_name='Library',
            activity_description='Test'
        )
        
        # Update total
        self.profile.total_hours_rendered = 20.0
        self.profile.save()
        
        # Percentage should be > 100
        percentage = (self.profile.total_hours_rendered / self.profile.required_hours) * 100
        self.assertGreater(percentage, 100)

class ResponsiveDesignTests(TestCase):
    """Tests for mobile responsiveness"""
    
    def setUp(self):
        """Create test data"""
        self.client = Client()  # ← Changed from APIClient
    
    def test_admin_dashboard_has_viewport(self):
        """Test if admin dashboard has viewport meta tag"""
        admin = User.objects.create_user(
            username='admin',
            password='test',
            role='ADMIN',
            is_email_verified=True
        )
        
        self.client.force_login(admin)
        url = reverse('admin_dashboard')
        response = self.client.get(url)
        
        # Check that mobile-friendly meta tag is present
        self.assertContains(response, 'viewport')
        self.assertContains(response, 'width=device-width')
    
    def test_admin_dashboard_is_responsive(self):
        """Test if admin dashboard has responsive CSS"""
        admin = User.objects.create_user(
            username='admin',
            password='test',
            role='ADMIN',
            is_email_verified=True
        )
        
        self.client.force_login(admin)
        url = reverse('admin_dashboard')
        response = self.client.get(url)
        
        # Check for responsive CSS classes (Tailwind)
        self.assertContains(response, 'overflow-x-auto')


class AuthenticationTests(APITestCase):
    def test_signup_successful(self):
        """Test that a user can sign up with a valid Ateneo email"""
        url = reverse('api_signup') # Make sure this matches the 'name' in urls.py
        data = {
            "email": "test.scholar@student.ateneo.edu",
            "password": "SecurePassword123!",
            "first_name": "Test",
            "last_name": "Scholar"
        }
        response = self.client.post(url, data, format='json')
        
        # Check that it returns 201 Created
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Check that the user was actually created in the database
        self.assertTrue(User.objects.filter(email="test.scholar@student.ateneo.edu").exists())
        
        # Check that the user is initially inactive (waiting for email verification)
        user = User.objects.get(email="test.scholar@student.ateneo.edu")
        self.assertFalse(user.is_active)
        self.assertEqual(user.role, 'SCHOLAR')

    def test_signup_invalid_email(self):
        """Test that non-Ateneo emails are rejected"""
        url = reverse('api_signup')
        data = {
            "email": "hacker@gmail.com",
            "password": "SecurePassword123!",
            "first_name": "Bad",
            "last_name": "Actor"
        }
        response = self.client.post(url, data, format='json')
        
        # Should return 400 Bad Request
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # Verify no user was created
        self.assertFalse(User.objects.filter(email="hacker@gmail.com").exists())


class AdminModeratorTests(APITestCase):
    def setUp(self):
        """Set up dummy data to use in the tests below"""
        # Create an Admin User
        self.admin_user = User.objects.create_user(
            username="admin1",
            email="admin@ateneo.edu",
            password="adminpassword",
            role="ADMIN",
            is_active=True
        )
        
        # Create a regular Scholar User
        self.scholar_user = User.objects.create_user(
            username="scholar1",
            email="regular@student.ateneo.edu",
            password="scholarpassword",
            role="SCHOLAR",
            is_active=True
        )
        
        # The URL for the assign moderator endpoint
        self.assign_url = reverse('assign_moderator')

        ServiceLog.objects.create(
            scholar=ScholarProfile.objects.create(
                user=User.objects.create_user(
                    username="scholar2",
                    email="second@student.ateneo.edu",
                    password="scholarpassword",
                    role="SCHOLAR",
                    is_active=True
                ),
                student_id="654321",
                program_course="",
                scholar_grant="",
            ),
            date_rendered=date.today(),
            hours=1,
            office_name='Rizal Library',
            activity_description='Shelving books',
            created_by=self.admin_user,
        )

    def test_admin_can_assign_moderator(self):
        """Test that an OAA Admin can successfully make someone a moderator"""
        # 1. Authenticate the test client as the Admin
        self.client.force_authenticate(user=self.admin_user)
        
        # 2. Send the POST request to assign the scholar to an office
        data = {
            "moderator_username": self.scholar_user.username,
            "office_name": "Office of Admission and Aid"
        }
        response = self.client.post(self.assign_url, data, format='json')
        
        # 3. Check for success response
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # 4. Refresh the scholar user from the database and verify changes
        self.scholar_user.refresh_from_db()
        self.assertEqual(self.scholar_user.role, 'MODERATOR')
        self.assertTrue(ModeratorProfile.objects.filter(user=self.scholar_user).exists())
        self.assertEqual(self.scholar_user.moderator_profile.office_name, "Office of Admission and Aid")

    def test_scholar_cannot_assign_moderator(self):
        """Test that a regular student cannot use the assign moderator endpoint"""
        # 1. Authenticate the test client as a regular Scholar
        self.client.force_authenticate(user=self.scholar_user)
        
        # 2. Try to perform the admin action
        data = {
            "moderator_username": self.scholar_user.username,
            "office_name": "Hacker Office"
        }
        response = self.client.post(self.assign_url, data, format='json')
        
        # 3. Should return 403 Forbidden
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
        # 4. Verify their role did NOT change
        self.scholar_user.refresh_from_db()
        self.assertEqual(self.scholar_user.role, 'SCHOLAR')

    def test_assign_moderator_page_includes_office_choices(self):
        """Test that the assign moderator page shows dropdown office choices."""
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(self.assign_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertContains(response, '<option value="Rizal Library">Rizal Library</option>', html=True)
        self.assertContains(response, '<option value="Office of Admission and Aid">Office of Admission and Aid</option>', html=True)

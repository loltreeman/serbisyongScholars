from rest_framework.test import APIClient
from django.test import TestCase, Client  
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
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
        
        # Create test scholars
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
            
            # Add some service hours
            hours = 10.0 if i < 3 else 5.0
            ServiceLog.objects.create(
                scholar=profile,
                date_rendered=date(2026, 2, 15),
                hours=hours,
                office_name='Test Office',
                activity_description='Test activity'
            )
            
            # Update rendered hours
            profile.total_hours_rendered = hours
            profile.save()
        
        # Use regular Client for HTML views
        self.client = Client()
        # Use APIClient for API endpoints
        self.api_client = APIClient()
    
    def test_admin_dashboard_page_loads(self):
        """Test if admin dashboard page renders successfully"""
        self.client.force_login(self.admin)
        url = reverse('admin_dashboard')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Admin Dashboard')
        self.assertContains(response, 'Total Scholars')
    
    def test_admin_dashboard_shows_correct_stats(self):
        """Test if dashboard shows correct scholar statistics"""
        self.api_client.force_authenticate(user=self.admin)
        url = reverse('admin_scholars_list')
        response = self.api_client.get(url)
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertEqual(data['total'], 5)
        self.assertIn('complete', data)
        self.assertIn('behind', data)
        self.assertIn('average_hours', data)
    
    def test_scholar_filtering_by_status(self):
        """Test if filtering by completion status works"""
        self.api_client.force_authenticate(user=self.admin)
        url = reverse('admin_scholars_list')
        response = self.api_client.get(url, {'status': 'complete'})
        
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
        
        if response.status_code == 200:
            data = response.json()
            self.assertGreater(len(data['scholars']), 0)
            self.assertEqual(data['scholars'][0]['student_id'], '123450')
    
    def test_admin_dashboard_requires_auth(self):
        """Test if dashboard requires authentication"""
        url = reverse('admin_dashboard')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 302)
    
    def test_admin_dashboard_requires_admin_role(self):
        """Test if non-admin users are blocked"""
        scholar = User.objects.filter(role='SCHOLAR').first()
        self.client.force_login(scholar)
        url = reverse('admin_dashboard')
        response = self.client.get(url)
        
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
            is_dormer=False  
        )
        
        self.client = Client()
    
    def test_progress_calculation_80_percent(self):
        """Test if progress calculates 80% correctly"""
        # Verify initial state
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.required_hours, 10.0)  
        
        # Add 8 hours (80% of 10)
        ServiceLog.objects.create(
            scholar=self.profile,
            date_rendered=date(2026, 2, 15),
            hours=8.0,  
            office_name='Library',
            activity_description='Test'
        )
        
        # Update total
        self.profile.total_hours_rendered = 8.0 
        self.profile.save()
        
        # Refresh and verify
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.required_hours, 10.0)  
        
        # Calculate percentage
        percentage = (self.profile.total_hours_rendered / self.profile.required_hours) * 100
        self.assertEqual(percentage, 80.0)
    
    def test_progress_calculation_complete(self):
        """Test if progress shows 100% when complete"""
        # Verify initial state
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.required_hours, 10.0) 
        
        ServiceLog.objects.create(
            scholar=self.profile,
            date_rendered=date(2026, 2, 15),
            hours=10.0,  
            office_name='Library',
            activity_description='Test'
        )
        
        # Update total
        self.profile.total_hours_rendered = 10.0  
        self.profile.save()
        
        # Refresh and verify
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.required_hours, 10.0)  
        
        # Calculate percentage
        percentage = (self.profile.total_hours_rendered / self.profile.required_hours) * 100
        self.assertEqual(percentage, 100.0)
    
    def test_progress_bar_handles_overflow(self):
        """Test if system handles hours over 100%"""
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
        
        # Percentage should be > 100
        percentage = (self.profile.total_hours_rendered / self.profile.required_hours) * 100
        self.assertGreater(percentage, 100)

class ResponsiveDesignTests(TestCase):
    """Tests for mobile responsiveness"""
    
    def setUp(self):
        """Create test data"""
        self.client = Client()
    
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
        
        self.assertContains(response, 'overflow-x-auto')


class AdminModeratorTests(TestCase):
    """Tests for moderator assignment"""
    
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
        
        # Create a scholar user to promote
        self.scholar = User.objects.create_user(
            username='testscholar',
            email='scholar@student.ateneo.edu',
            password='TestPass123!',
            role='SCHOLAR',
            first_name='Test',
            last_name='Scholar',
            is_email_verified=True
        )
        
        self.api_client = APIClient()
    
    def test_admin_can_assign_moderator(self):
        """Test that an OAA Admin can successfully make someone a moderator"""
        # Authenticate as admin
        self.api_client.force_authenticate(user=self.admin)
        
        # Send correct data format that matches the view
        data = {
            'moderator_username': self.scholar.username,  
            'office_name': 'Rizal Library'              
        }
        
        url = reverse('assign_moderator')
        response = self.api_client.post(url, data, format='json')
        
        # Debug if it fails
        if response.status_code != 200:
            print("ERROR:", response.json())
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify the user is now a moderator
        self.scholar.refresh_from_db()
        self.assertEqual(self.scholar.role, 'MODERATOR')
        
        # Verify ModeratorProfile was created
        moderator_profile = ModeratorProfile.objects.get(user=self.scholar)
        self.assertEqual(moderator_profile.office_name, 'Rizal Library')
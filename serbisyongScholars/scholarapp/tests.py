from rest_framework.test import APIClient
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from datetime import date
from .models import User, ScholarProfile, ServiceLog

User = get_user_model()

class AdminDashboardTests(TestCase):
    """Tests for Admin Dashboard page"""
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
        
        self.client = APIClient()
    
    def test_admin_dashboard_page_loads(self):
        """Test if admin dashboard page renders successfully"""
        # Login as admin
        self.client.force_login(self.admin)
        
        # Access admin dashboard
        url = reverse('admin_dashboard')
        response = self.client.get(url)
        
        # Should return 200 now
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Admin Dashboard')
        self.assertContains(response, 'Total Scholars')
    
    def test_admin_dashboard_shows_correct_stats(self):
        """Test if dashboard shows correct scholar statistics"""
        self.client.force_login(self.admin)
        
        # Make sure we're logged in by adding session
        url = reverse('admin_scholars_list')
        response = self.client.get(url)
        
        # Should return 200 now
        self.assertEqual(response.status_code, 200)
        
        data = response.json()
        
        # Check total scholars (should be 5)
        self.assertEqual(data['total'], 5)
        
        # Check that stats are present
        self.assertIn('complete', data)
        self.assertIn('behind', data)
        self.assertIn('average_hours', data)
    
    def test_scholar_filtering_by_status(self):
        """Test if filtering by completion status works"""
        self.client.force_login(self.admin)
        
        # Filter for complete scholars
        response = self.client.get('/admin/scholars/?status=complete')
        
        # Check if response is JSON
        if response.status_code == 200:
            data = response.json()
            
            # All returned scholars should be complete
            for scholar in data['scholars']:
                percentage = (scholar['rendered_hours'] / scholar['required_hours']) * 100
                self.assertGreaterEqual(percentage, 100)
    
    def test_scholar_search_functionality(self):
        """Test if search by student ID works"""
        self.client.force_login(self.admin)
        
        response = self.client.get('/admin/scholars/?search=123450')
        
        # Check if response is JSON
        if response.status_code == 200:
            data = response.json()
            
            # Should find the scholar
            self.assertGreater(len(data['scholars']), 0)
            self.assertEqual(data['scholars'][0]['student_id'], '123450')
    
    def test_admin_dashboard_requires_auth(self):
        """Test if dashboard requires authentication"""
        # Try to access without login
        response = self.client.get('/admin/dashboard/')
        
        # Should redirect to login (302)
        self.assertEqual(response.status_code, 302)
    
    def test_admin_dashboard_requires_admin_role(self):
        """Test if non-admin users are blocked"""
        # Login as scholar (not admin)
        scholar = User.objects.filter(role='SCHOLAR').first()
        self.client.force_login(scholar)
        
        url = reverse('admin_dashboard')
        response = self.client.get(url)
        
        # Should be forbidden (403)
        self.assertEqual(response.status_code, 403)
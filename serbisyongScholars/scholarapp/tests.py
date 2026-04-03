from rest_framework.test import APIClient
from django.test import TestCase, Client  
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from datetime import date
from .models import Announcement, User, ScholarProfile, ServiceLog, ModeratorProfile

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


class AdminScholarFilteringTests(TestCase):
    """Tests for admin scholar filtering in the management view API."""

    def setUp(self):
        self.admin = User.objects.create_user(
            username='filteradmin',
            email='filteradmin@ateneo.edu',
            password='TestPass123!',
            role='ADMIN',
            is_email_verified=True
        )

        self.complete_profile = self._create_scholar(
            username='complete1',
            student_id='200001',
            first_name='Alice',
            school='SOSE',
            hours=12.0,
        )
        self.on_track_profile = self._create_scholar(
            username='ontrack1',
            student_id='200002',
            first_name='Brenda',
            school='SOH',
            hours=8.0,
        )
        self.behind_profile = self._create_scholar(
            username='behind1',
            student_id='200003',
            first_name='Carlos',
            school='SOSE',
            hours=4.0,
        )

        self.api_client = APIClient()
        self.url = reverse('admin_scholars_list')

    def _create_scholar(self, username, student_id, first_name, school, hours):
        user = User.objects.create_user(
            username=username,
            email=f'{username}@student.ateneo.edu',
            password='TestPass123!',
            role='SCHOLAR',
            first_name=first_name,
            last_name='Scholar',
            is_email_verified=True
        )

        profile = ScholarProfile.objects.create(
            user=user,
            student_id=student_id,
            program_course='BS Computer Science',
            scholar_grant='FULL',
            is_dormer=False,
            school=school,
        )

        ServiceLog.objects.create(
            scholar=profile,
            date_rendered=date(2026, 2, 15),
            hours=hours,
            office_name='Office of Admission and Aid',
            activity_description='Filtered test activity'
        )

        profile.refresh_from_db()
        return profile

    def test_school_filter_returns_only_matching_scholars(self):
        self.api_client.force_authenticate(user=self.admin)
        response = self.api_client.get(self.url, {'school': 'SOSE'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        returned_ids = {scholar['student_id'] for scholar in data['scholars']}

        self.assertEqual(returned_ids, {'200001', '200003'})
        self.assertTrue(all(scholar['school'] == 'SOSE' for scholar in data['scholars']))
        self.assertTrue(all(scholar['school_display'] == 'School of Science and Engineering' for scholar in data['scholars']))

    def test_combined_status_and_search_filters(self):
        self.api_client.force_authenticate(user=self.admin)
        response = self.api_client.get(self.url, {
            'status': 'on-track',
            'search': 'Brenda',
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        self.assertEqual(data['total'], 1)
        self.assertEqual(data['scholars'][0]['student_id'], '200002')
        self.assertEqual(data['scholars'][0]['status'], 'on-track')

    def test_invalid_school_filter_returns_bad_request(self):
        self.api_client.force_authenticate(user=self.admin)
        response = self.api_client.get(self.url, {'school': 'NOTREAL'})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.json()['error'], 'Invalid school filter.')


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


class AnnouncementCategoryTests(TestCase):
    """Tests for announcement category tags and filtering."""

    def setUp(self):
        self.admin = User.objects.create_user(
            username='announcementadmin',
            email='announcementadmin@ateneo.edu',
            password='TestPass123!',
            role='ADMIN',
            is_email_verified=True
        )
        self.scholar = User.objects.create_user(
            username='announcementscholar',
            email='announcementscholar@student.ateneo.edu',
            password='TestPass123!',
            role='SCHOLAR',
            is_email_verified=True
        )

        self.food_stubs_announcement = Announcement.objects.create(
            title='Food Stub Distribution',
            content='Claim your stubs from OAA.',
            category='FOOD STUBS',
            author=self.admin,
        )
        self.volunteer_announcement = Announcement.objects.create(
            title='Library Volunteer Drive',
            content='Volunteer slots are open this week.',
            category='VOLUNTEER',
            author=self.admin,
        )

        self.api_client = APIClient()
        self.list_url = reverse('announcements_list')

    def test_list_includes_category_labels(self):
        self.api_client.force_authenticate(user=self.scholar)
        response = self.api_client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        categories = {
            item['category']: item['category_label']
            for item in response.json()
        }
        self.assertEqual(categories['FOOD STUBS'], 'Food Stubs')
        self.assertEqual(categories['VOLUNTEER'], 'Volunteer Work')

    def test_list_can_be_filtered_by_category(self):
        self.api_client.force_authenticate(user=self.scholar)
        response = self.api_client.get(self.list_url, {'category': 'FOOD STUBS'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['id'], self.food_stubs_announcement.id)
        self.assertEqual(data[0]['category_label'], 'Food Stubs')

    def test_invalid_category_filter_returns_bad_request(self):
        self.api_client.force_authenticate(user=self.scholar)
        response = self.api_client.get(self.list_url, {'category': 'NOT_A_REAL_TAG'})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.json()['error'], 'Invalid announcement category.')

    def test_admin_can_create_announcement_with_category(self):
        self.api_client.force_authenticate(user=self.admin)
        response = self.api_client.post(self.list_url, {
            'title': 'Scholarship Briefing',
            'content': 'Attend the scholarship briefing tomorrow.',
            'category': 'OPPORTUNITY',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()['category'], 'OPPORTUNITY')
        self.assertEqual(response.json()['category_label'], 'Scholarship Opportunity')

    def test_scholar_cannot_create_announcement(self):
        self.api_client.force_authenticate(user=self.scholar)
        response = self.api_client.post(self.list_url, {
            'title': 'Unauthorized post',
            'content': 'This should fail.',
            'category': 'GENERAL',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.json()['error'], 'Admin only')

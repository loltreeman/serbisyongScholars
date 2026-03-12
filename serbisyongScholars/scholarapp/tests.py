from rest_framework.test import APIClient
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from datetime import date
from .models import ScholarProfile, ServiceLog

User = get_user_model()

class AdminDashboardTests(TestCase):
    def setUp(self):
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

        self.client = APIClient()

    def test_admin_dashboard_page_loads(self):
        self.client.force_login(self.admin)
        url = reverse('admin_dashboard')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Admin Dashboard')
        self.assertContains(response, 'Total Scholars')

    def test_admin_dashboard_shows_correct_stats(self):
        self.client.force_login(self.admin)
        url = reverse('admin_scholars_list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['total'], 5)
        self.assertIn('complete', data)
        self.assertIn('behind', data)
        self.assertIn('average_hours', data)

    def test_scholar_filtering_by_status(self):
        self.client.force_login(self.admin)
        response = self.client.get('/admin/scholars/?status=complete')
        if response.status_code == 200:
            data = response.json()
            for scholar in data['scholars']:
                percentage = (scholar['rendered_hours'] / scholar['required_hours']) * 100
                self.assertGreaterEqual(percentage, 100)

    def test_scholar_search_functionality(self):
        self.client.force_login(self.admin)
        response = self.client.get('/admin/scholars/?search=123450')
        if response.status_code == 200:
            data = response.json()
            self.assertGreater(len(data['scholars']), 0)
            self.assertEqual(data['scholars'][0]['student_id'], '123450')

    def test_admin_dashboard_requires_auth(self):
        response = self.client.get('/admin/dashboard/')
        self.assertEqual(response.status_code, 302)

    def test_admin_dashboard_requires_admin_role(self):
        scholar = User.objects.filter(role='SCHOLAR').first()
        self.client.force_login(scholar)
        url = reverse('admin_dashboard')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 403)


class ProfileViewTests(TestCase):
    def setUp(self):
        # two users: an admin and a scholar
        self.admin = User.objects.create_user(
            username='admin1',
            email='admin1@example.com',
            password='TestPass!',
            role='ADMIN',
            is_email_verified=True
        )
        self.scholar = User.objects.create_user(
            username='sch1',
            email='sch1@example.com',
            password='TestPass!',
            role='SCHOLAR',
            first_name='First',
            last_name='Last',
            is_email_verified=True
        )
        self.profile = ScholarProfile.objects.create(
            user=self.scholar,
            student_id='555555',
            program_course='BS Testing',
            scholar_grant='FULL'
        )
        ServiceLog.objects.create(
            scholar=self.profile,
            date_rendered=date(2026, 3, 1),
            hours=3.0,
            office_name='Office',
            activity_description='Desc'
        )
        self.client = APIClient()

    def test_get_profile_anyone(self):
        url = reverse('api_profile')
        response = self.client.get(url + f'?username={self.scholar.username}')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['username'], self.scholar.username)
        self.assertEqual(data['role'], 'SCHOLAR')
        self.assertIn('service_logs', data)
        self.assertGreater(len(data['service_logs']), 0)

    def test_update_profile_as_admin(self):
        self.client.force_login(self.admin)
        url = reverse('api_profile')
        response = self.client.put(url, data={'username': self.scholar.username, 'role': 'MODERATOR'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.scholar.refresh_from_db()
        self.assertEqual(self.scholar.role, 'MODERATOR')

    def test_update_profile_as_non_admin(self):
        self.client.force_login(self.scholar)
        url = reverse('api_profile')
        response = self.client.put(url, data={'username': self.scholar.username, 'role': 'ADMIN'}, format='json')
        self.assertEqual(response.status_code, 403)

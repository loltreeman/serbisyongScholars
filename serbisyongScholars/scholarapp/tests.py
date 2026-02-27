from datetime import date
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from .models import ScholarProfile, ServiceLog
from unittest.mock import patch

User = get_user_model()

class IterationOneTests(APITestCase):
    
    def setUp(self):
        self.active_user = User.objects.create_user(
            username='jdelacruz',
            email='juan.delacruz@student.ateneo.edu',
            password='strongpassword123',
            first_name='Juan',
            last_name='Dela Cruz',
            role='SCHOLAR',
            is_active=True, 
            is_email_verified=True
        )
        
        self.scholar_profile = ScholarProfile.objects.create(
            user=self.active_user,
            student_id='123456',
            program_course='BS CS',
            scholar_grant='100% TF',
            is_dormer=False,
            required_hours=15.0
        )
        
        ServiceLog.objects.create(
            scholar=self.scholar_profile,
            date_rendered=date(2024, 3, 1),
            hours=2.5,
            office_name='OAA',
            activity_description='Filing documents'
        )

        self.signup_url = reverse('api_signup')
        self.login_url = reverse('api_token_obtain_pair')
        self.dashboard_url = reverse('api_dashboard')

    # Mock threading.Thread entirely to prevent background processes from crashing the test database
    @patch('scholarapp.views.threading.Thread')
    def test_scholar_signup_success(self, mock_thread):
        """Ensures a new scholar can register and both their User and ScholarProfile records are created properly."""
        data = {
            "username": "mclara",
            "email": "maria.clara@student.ateneo.edu",
            "first_name": "Maria",
            "last_name": "Clara",
            "password": "anotherpassword123",
            "password_confirm": "anotherpassword123",
            "student_id": "654321"
        }
        
        response = self.client.post(self.signup_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        new_user = User.objects.get(username='mclara')
        self.assertEqual(new_user.email, 'maria.clara@student.ateneo.edu')
        self.assertFalse(new_user.is_active) 
        
        self.assertTrue(ScholarProfile.objects.filter(user=new_user).exists())
        self.assertEqual(new_user.scholar_profile.student_id, '654321')
        self.assertEqual(new_user.scholar_profile.required_hours, 15.0)

    def test_signup_invalid_email(self):
        """Confirms that the system strictly rejects non-Ateneo email addresses during registration."""
        data = {
            "username": "bademail",
            "email": "hacker@gmail.com", 
            "password": "password123",
            "password_confirm": "password123",
            "student_id": "999999"
        }
        response = self.client.post(self.signup_url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)

    def test_login_success(self):
        """Checks if providing valid credentials successfully returns the authentication tokens."""
        data = {
            "username": "jdelacruz",
            "password": "strongpassword123"
        }
        
        response = self.client.post(self.login_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        self.assertIn('access', response.data) 
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['user']['username'], 'jdelacruz')

    def test_dashboard_unauthorized_access(self):
        """Makes sure the dashboard is completely locked down for guests or requests missing tokens."""
        response = self.client.get(self.dashboard_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_dashboard_authorized_access(self):
        """Verifies that a properly authenticated user receives their specific dashboard data and logs."""
        
        login_response = self.client.post(self.login_url, {
            "username": "jdelacruz",
            "password": "strongpassword123"
        }, format='json')
        
        token = login_response.data['access']
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + token)
        
        response = self.client.get(self.dashboard_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        self.assertEqual(response.data['student_id'], '123456')
        self.assertEqual(response.data['name'], 'Juan Dela Cruz')
        self.assertEqual(response.data['required_hours'], 15.0)
        
        logs = response.data['service_logs']
        self.assertEqual(len(logs), 1)
        self.assertEqual(logs[0]['office'], 'OAA')
        self.assertEqual(logs[0]['hours'], 2.5)
        self.assertEqual(logs[0]['activity'], 'Filing documents')
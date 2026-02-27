from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from scholarapp.models import ScholarProfile
from unittest.mock import patch

User = get_user_model()

class SimpleIterationOneTests(APITestCase):
    
    def setUp(self):
        self.client = APIClient()

        self.user = User.objects.create_user(
            username='neilbiason',
            email='neil.biason@student.ateneo.edu',
            password='testpassword123',
            first_name='Neil',
            last_name='Biason',
            role='SCHOLAR',
            is_active=True,
            is_email_verified=True
        )
        
        self.profile = ScholarProfile.objects.create(
            user=self.user,
            student_id='230940',
            program_course='BS CS',
            scholar_grant='100%',
            required_hours=15.0
        )

    def test_database_models_created(self):
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(ScholarProfile.objects.count(), 1)
        
        saved_profile = ScholarProfile.objects.get(user=self.user)
        self.assertEqual(saved_profile.student_id, '123456')

    def test_login_returns_token(self):
        url = reverse('api_token_obtain_pair')
        data = {'username': 'neilbiason', 'password': 'testpassword123'}
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.json())

    def test_dashboard_blocks_guests(self):
        url = reverse('api_dashboard')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_dashboard_allows_scholars(self):
        login_res = self.client.post(
            reverse('api_token_obtain_pair'), 
            {'username': 'neilbiason', 'password': 'testpassword123'}, 
            format='json'
        )
        token = login_res.json()['access']
        url = reverse('api_dashboard')
        
        response = self.client.get(url, HTTP_AUTHORIZATION='Bearer ' + token)
        
        url = reverse('api_dashboard')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['student_id'], '123456')
        self.assertEqual(response.json()['name'], 'Neil Biason')

    @patch('scholarapp.views.threading.Thread')
    def test_signup_creates_account(self, mock_thread):
        url = reverse('api_signup')
        data = {
            "username": "newscholar",
            "email": "new@student.ateneo.edu",
            "password": "newpassword123",
            "password_confirm": "newpassword123",
            "first_name": "New",
            "last_name": "Scholar",
            "student_id": "999999"
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username="newscholar").exists())
        self.assertTrue(ScholarProfile.objects.filter(student_id="999999").exists())
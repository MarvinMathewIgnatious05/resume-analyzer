from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
import redis
from unittest.mock import patch

User = get_user_model()

class PasswordlessAuthTests(APITestCase):
    def setUp(self):
        self.email = "candidate@gmail.com"
        self.request_url = reverse('auth-request')
        self.verify_otp_url = reverse('verify-otp')
        self.verify_link_url = reverse('verify-link')

    @patch('resume_analyzer.apps.users.views.redis_client')
    @patch('resume_analyzer.apps.users.views.send_mail')
    def test_request_magic_link_success(self, mock_send_mail, mock_redis):
        # Setup mock redis to bypass rate limit
        mock_redis.get.return_value = None
        
        data = {
            "email": self.email,
            "method": "magic-link"
        }
        
        response = self.client.post(self.request_url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['method'], 'magic-link')
        
        user = User.objects.filter(email=self.email).first()
        self.assertIsNotNone(user)
        self.assertEqual(user.profile.first_name, "Candidate")
        self.assertEqual(user.profile.last_name, "")
        self.assertTrue(mock_send_mail.called)

    @patch('resume_analyzer.apps.users.views.redis_client')
    @patch('resume_analyzer.apps.users.views.send_mail')
    def test_request_otp_success(self, mock_send_mail, mock_redis):
        mock_redis.get.return_value = None
        
        data = {
            "email": self.email,
            "method": "otp"
        }
        
        response = self.client.post(self.request_url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['method'], 'otp')
        self.assertTrue(mock_send_mail.called)

    @patch('resume_analyzer.apps.users.views.redis_client')
    def test_verify_otp_success(self, mock_redis):
        # Create user
        User.objects.create_user(email=self.email)
        
        # Mock Redis returning the correct OTP
        mock_redis.get.side_effect = lambda k: b"123456" if k.startswith("otp:") else None
        
        data = {
            "email": self.email,
            "otp": "123456"
        }
        
        response = self.client.post(self.verify_otp_url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    @patch('resume_analyzer.apps.users.views.redis_client')
    @patch('resume_analyzer.apps.users.views.send_mail')
    def test_profile_name_extraction_from_email(self, mock_send_mail, mock_redis):
        mock_redis.get.return_value = None
        
        test_cases = [
            ("john.doe@example.com", "John", "Doe"),
            ("alice_smith@example.com", "Alice", "Smith"),
            ("bob-jones@example.com", "Bob", "Jones"),
            ("jane.doe.smith@example.com", "Jane", "Doe Smith"),
            ("jane@example.com", "Jane", ""),
        ]
        
        for email, expected_first, expected_last in test_cases:
            data = {
                "email": email,
                "method": "magic-link"
            }
            response = self.client.post(self.request_url, data, format='json')
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            
            user = User.objects.filter(email=email).first()
            self.assertIsNotNone(user)
            self.assertEqual(user.profile.first_name, expected_first)
            self.assertEqual(user.profile.last_name, expected_last)

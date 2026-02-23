from django.contrib.auth.models import User, Group
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.status import status
from django.core.mail import send_mail
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.contrib.auth.tokens import default_token_generator
from django.conf import settings


from django.shortcuts import render

# Create your views here.

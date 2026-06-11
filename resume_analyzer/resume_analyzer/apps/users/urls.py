from django.urls import path
from .views import (
    RequestAuthView,
    VerifyOTPView,
    VerifyMagicLinkView,
    ProfileView,
    SessionsView,
    RevokeSessionView,
    LogoutAllView
)

urlpatterns = [
    path('auth/request/', RequestAuthView.as_view(), name='auth-request'),
    path('auth/verify-otp/', VerifyOTPView.as_view(), name='verify-otp'),
    path('auth/verify-link/', VerifyMagicLinkView.as_view(), name='verify-link'),
    
    path('profile/', ProfileView.as_view(), name='user-profile'),
    path('auth/sessions/', SessionsView.as_view(), name='user-sessions'),
    path('auth/sessions/revoke/', RevokeSessionView.as_view(), name='revoke-session'),
    path('auth/sessions/revoke-all/', LogoutAllView.as_view(), name='revoke-all-sessions'),
]

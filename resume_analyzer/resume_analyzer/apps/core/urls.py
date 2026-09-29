from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ResumeViewSet,
    ResumeVersionUploadView,
    JobDescriptionViewSet,
    JobMatchView,
    DashboardStatsView,
    NotificationViewSet,
    AdminMetricsView,
    CoverLetterViewSet,
    CoverLetterGenerateView,
    JobScrapeView
)

router = DefaultRouter()
router.register(r'resumes', ResumeViewSet, basename='resume')
router.register(r'jobs', JobDescriptionViewSet, basename='job')
router.register(r'cover-letters', CoverLetterViewSet, basename='cover-letter')

urlpatterns = [
    path('jobs/scrape/', JobScrapeView.as_view(), name='job-scrape'),
    path('cover-letters/generate/', CoverLetterGenerateView.as_view(), name='cover-letter-generate'),
    path('resumes/<int:resume_id>/upload-version/', ResumeVersionUploadView.as_view(), name='upload-version'),
    path('match/', JobMatchView.as_view(), name='job-match-trigger'),
    path('match/<int:pk>/', JobMatchView.as_view(), name='job-match-detail'),
    path('dashboard/', DashboardStatsView.as_view(), name='dashboard-stats'),
    path('admin/metrics/', AdminMetricsView.as_view(), name='admin-metrics'),
    
    path('', include(router.urls)),
    
    path('notifications/', NotificationViewSet.as_view({'get': 'list'}), name='notifications-list'),
    path('notifications/read-all/', NotificationViewSet.as_view({'post': 'mark_all_read'}), name='notifications-read-all'),
]

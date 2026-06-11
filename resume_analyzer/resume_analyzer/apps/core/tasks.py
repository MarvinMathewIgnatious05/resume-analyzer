import os
import requests
import pdfplumber
import docx
from celery import shared_task
from django.conf import settings
from django.core.files.base import ContentFile
from django.utils import timezone
from .models import ResumeVersion, ResumeAnalysis, JobDescription, JobMatch, AuditLog, Notification

# EICAR standard anti-virus test signature
EICAR_SIGNATURE = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"

def run_virus_scan(file_path):
    """
    Mock enterprise virus scanner. Checks for EICAR signature and malicious patterns.
    """
    if not os.path.exists(file_path):
        return False, "File does not exist"
        
    try:
        with open(file_path, 'rb') as f:
            content = f.read()
            
        # Check for EICAR test string
        if EICAR_SIGNATURE in content or b"EICAR-STANDARD" in content:
            return False, "EICAR Test Virus Signature Detected"
            
        # Simple structural threat validation (e.g. check for javascript embedded in PDF)
        if file_path.endswith('.pdf') and b'/JS' in content or b'/JavaScript' in content:
            return False, "Embedded executable scripts (JavaScript) detected in PDF"
            
        # Success
        return True, "No threat found"
    except Exception as e:
        return False, f"Scan failed: {str(e)}"

def extract_text_from_pdf(file_path):
    text = ""
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        return text.strip()
    except Exception as e:
        raise ValueError(f"Failed to parse PDF file: {str(e)}")

def extract_text_from_docx(file_path):
    try:
        doc = docx.Document(file_path)
        text = [paragraph.text for paragraph in doc.paragraphs]
        return "\n".join(text).strip()
    except Exception as e:
        raise ValueError(f"Failed to parse DOCX file: {str(e)}")

@shared_task(bind=True, max_retries=3)
def async_analyze_resume(self, resume_version_id, job_desc_id=None):
    try:
        version = ResumeVersion.objects.get(id=resume_version_id)
    except ResumeVersion.DoesNotExist:
        return f"Resume version {resume_version_id} not found."

    analysis, _ = ResumeAnalysis.objects.get_or_create(resume_version=version)
    analysis.status = 'PROCESSING'
    analysis.save()

    file_path = version.file.path

    # 1. Execute Virus Scan
    clean, message = run_virus_scan(file_path)
    version.virus_scanned = True
    version.virus_scan_clean = clean
    version.save()

    if not clean:
        analysis.status = 'FAILED'
        analysis.error_message = f"Security Violation: {message}"
        analysis.save()

        # Audit Log threat
        AuditLog.objects.create(
            user=version.resume.user,
            event_type='VIRUS_SCAN_FLAGGED',
            description=f"Malicious file blocked: {version.file_name}. Threat detail: {message}",
            ip_address="0.0.0.0"
        )
        # Create alert notification
        Notification.objects.create(
            user=version.resume.user,
            title="Upload Security Alert",
            message=f"Your file {version.file_name} failed our safety inspection and was deleted."
        )
        # Delete file safely
        if os.path.exists(file_path):
            os.remove(file_path)
        return f"Scan failed for version {resume_version_id}: {message}"

    # Audit log success
    AuditLog.objects.create(
        user=version.resume.user,
        event_type='VIRUS_SCAN_CLEAN',
        description=f"File {version.file_name} passed safety inspection.",
        ip_address="0.0.0.0"
    )

    # 2. Extract Text
    try:
        if file_path.endswith('.pdf'):
            resume_text = extract_text_from_pdf(file_path)
        elif file_path.endswith('.docx'):
            resume_text = extract_text_from_docx(file_path)
        else:
            raise ValueError("Unsupported format.")
            
        if not resume_text:
            raise ValueError("Resume file appears to have no readable text content.")
            
    except Exception as e:
        analysis.status = 'FAILED'
        analysis.error_message = f"Text extraction failed: {str(e)}"
        analysis.save()
        return f"Extraction failed for version {resume_version_id}: {str(e)}"

    # 3. Call FastAPI AI microservice endpoints
    fastapi_url = settings.FASTAPI_SERVICE_URL
    
    try:
        # Request Skill/Name Extraction
        skills_resp = requests.post(f"{fastapi_url}/extract-skills", json={"text": resume_text}, timeout=30)
        skills_resp.raise_for_status()
        skills_data = skills_resp.json()
        
        # Request formatting & layouts check
        layout_resp = requests.post(f"{fastapi_url}/analyze-resume", json={"text": resume_text}, timeout=30)
        layout_resp.raise_for_status()
        layout_data = layout_resp.json()
        
        # Request ATS metric calculations
        ats_resp = requests.post(f"{fastapi_url}/calculate-ats", json={"text": resume_text}, timeout=30)
        ats_resp.raise_for_status()
        ats_data = ats_resp.json()
        
        # Request generative feedback from Llama 3
        feedback_resp = requests.post(f"{fastapi_url}/generate-feedback", json={"text": resume_text}, timeout=60)
        feedback_resp.raise_for_status()
        feedback_data = feedback_resp.json()

        # Update Analysis Model details
        analysis.extracted_name = skills_data.get('name')
        analysis.extracted_email = skills_data.get('email')
        analysis.extracted_phone = skills_data.get('phone')
        analysis.extracted_skills = skills_data.get('skills', [])
        analysis.extracted_education = skills_data.get('education', [])
        analysis.extracted_experience = skills_data.get('experience', [])
        analysis.extracted_certifications = skills_data.get('certifications', [])
        
        analysis.ats_score = ats_data.get('ats_score', 0)
        analysis.formatting_score = layout_data.get('formatting_score', 0)
        analysis.keyword_coverage_score = ats_data.get('keyword_coverage_score', 0)
        
        analysis.strengths = feedback_data.get('strengths', [])
        analysis.weaknesses = feedback_data.get('weaknesses', [])
        analysis.improvement_suggestions = feedback_data.get('improvements', [])
        analysis.career_guidance = feedback_data.get('career_guidance', "")
        
        analysis.raw_ai_payload = {
            "skills": skills_data,
            "layout": layout_data,
            "ats": ats_data,
            "feedback": feedback_data
        }
        
        analysis.status = 'COMPLETED'
        analysis.save()

        # Push Notification
        Notification.objects.create(
            user=version.resume.user,
            title="Resume Analyzed Successfully",
            message=f"Analysis for '{version.resume.title}' (v{version.version_number}) has finished. ATS Score: {analysis.ats_score}/100."
        )

    except Exception as e:
        # Handle failures connecting to microservice
        analysis.status = 'FAILED'
        analysis.error_message = f"AI microservice communication error: {str(e)}"
        analysis.save()
        return f"AI Microservice failed for version {resume_version_id}: {str(e)}"

    # 4. Handle Job Description Matching if job_desc_id is provided
    if job_desc_id:
        try:
            job_desc = JobDescription.objects.get(id=job_desc_id)
            match = JobMatch.objects.get(resume_version=version, job_description=job_desc)
            
            # Call FastAPI /job-match endpoint
            match_resp = requests.post(f"{fastapi_url}/job-match", json={
                "resume_text": resume_text,
                "job_text": job_desc.raw_text
            }, timeout=45)
            match_resp.raise_for_status()
            match_data = match_resp.json()
            
            # Save matching results
            match.match_percentage = match_data.get('match_percentage', 0.0)
            match.missing_skills = match_data.get('missing_skills', [])
            match.missing_keywords = match_data.get('missing_keywords', [])
            match.skill_gap_analysis = match_data.get('skill_gap_analysis', {})
            match.optimization_suggestions = match_data.get('suggestions', [])
            match.save()
            
            Notification.objects.create(
                user=version.resume.user,
                title="Job Match Completed",
                message=f"Job matching with '{job_desc.title}' completed. Match Percentage: {match.match_percentage}%"
            )
        except Exception as e:
            # Match failed but don't fail core analysis
            return f"Job Match failed for version {resume_version_id}: {str(e)}"

    return f"Completed analysis for version {resume_version_id} successfully."

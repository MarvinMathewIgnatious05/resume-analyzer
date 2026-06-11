from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from app.services.nlp import NLPService
from app.services.ollama_client import OllamaClient

app = FastAPI(
    title="AI Resume Analyzer Microservice",
    description="Microservice for parsing, formatting check, ATS scoring, and LLM advice.",
    version="1.0.0"
)

ollama_client = OllamaClient()

# Request/Response Schemas
class TextRequest(BaseModel):
    text: str

class MatchRequest(BaseModel):
    resume_text: str
    job_text: str

class SkillExtractionResponse(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    skills: List[str] = []
    education: List[str] = []
    experience: List[str] = []
    certifications: List[str] = []

class LayoutAnalysisResponse(BaseModel):
    formatting_score: int
    has_contact_info: bool
    has_skills_section: bool
    has_experience_section: bool
    has_education_section: bool
    suggestions: List[str] = []

class ATSResponse(BaseModel):
    ats_score: int
    keyword_coverage_score: int
    critical_keywords_found: List[str]
    missing_critical_keywords: List[str]

class JobMatchResponse(BaseModel):
    match_percentage: float
    missing_skills: List[str]
    missing_keywords: List[str]
    skill_gap_analysis: dict
    suggestions: List[str]

class FeedbackResponse(BaseModel):
    strengths: List[str]
    weaknesses: List[str]
    improvements: List[str]
    career_guidance: str


@app.get("/")
async def root():
    return {"status": "AI Resume Analyzer service is running."}

@app.post("/extract-skills", response_model=SkillExtractionResponse)
async def extract_skills(request: TextRequest):
    try:
        text = request.text
        contact = NLPService.extract_contact_info(text)
        skills = NLPService.extract_skills(text)
        edu_exp = NLPService.parse_education_and_experience(text)
        
        # Simple extraction of certifications
        certs = []
        cert_keywords = ["certified", "certification", "aws certified", "pmp", "scrum master", "ccna"]
        for line in text.split('\n'):
            if any(kw in line.lower() for kw in cert_keywords) and len(line) < 100:
                certs.append(line.strip())
                
        return SkillExtractionResponse(
            name=contact.get("name"),
            email=contact.get("email"),
            phone=contact.get("phone"),
            skills=skills,
            education=edu_exp.get("education"),
            experience=edu_exp.get("experience"),
            certifications=list(set(certs))[:5]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze-resume", response_model=LayoutAnalysisResponse)
async def analyze_layout(request: TextRequest):
    try:
        text_lower = request.text.lower()
        
        # Heuristics for formatting assessment
        has_contact = "@" in text_lower
        has_skills = any(k in text_lower for k in ["skill", "expertise", "competenc"])
        has_exp = any(k in text_lower for k in ["experience", "employment", "history", "work"])
        has_edu = any(k in text_lower for k in ["education", "university", "college", "degree"])
        
        # Score calculation
        score = 100
        suggestions = []
        
        if not has_contact:
            score -= 25
            suggestions.append("Add contact information (email, phone number) visibly at the top.")
        if not has_skills:
            score -= 25
            suggestions.append("Create a dedicated 'Skills' or 'Technical Skills' section.")
        if not has_exp:
            score -= 25
            suggestions.append("Add a detailed 'Work Experience' or 'Employment History' section.")
        if not has_edu:
            score -= 25
            suggestions.append("Add an 'Education' section stating degrees and colleges.")
            
        return LayoutAnalysisResponse(
            formatting_score=max(score, 10),
            has_contact_info=has_contact,
            has_skills_section=has_skills,
            has_experience_section=has_exp,
            has_education_section=has_edu,
            suggestions=suggestions
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/calculate-ats", response_model=ATSResponse)
async def calculate_ats(request: TextRequest):
    try:
        text = request.text
        skills = NLPService.extract_skills(text)
        
        # Simple ATS keyword assessment
        critical_keywords = ["Docker", "Kubernetes", "PostgreSQL", "Redis", "Django", "FastAPI", "React", "TypeScript", "CI/CD", "Git"]
        found = [kw for kw in critical_keywords if kw.lower() in text.lower()]
        missing = [kw for kw in critical_keywords if kw.lower() not in text.lower()]
        
        kw_score = int((len(found) / len(critical_keywords)) * 100) if critical_keywords else 0
        
        # Combine formatting score indicators
        formatting_resp = await analyze_layout(request)
        formatting_score = formatting_resp.formatting_score
        
        # Combine final ATS Score (weighted average)
        ats_score = int((kw_score * 0.6) + (formatting_score * 0.4))
        
        return ATSResponse(
            ats_score=max(ats_score, 10),
            keyword_coverage_score=kw_score,
            critical_keywords_found=found,
            missing_critical_keywords=missing
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/job-match", response_model=JobMatchResponse)
async def job_match(request: MatchRequest):
    try:
        r_text = request.resume_text
        j_text = request.job_text
        
        match_pct = NLPService.calculate_similarity(r_text, j_text)
        
        # Extract skills from both
        r_skills = set([s.lower() for s in NLPService.extract_skills(r_text)])
        j_skills = set([s.lower() for s in NLPService.extract_skills(j_text)])
        
        missing = list(j_skills - r_skills)
        found = list(j_skills.intersection(r_skills))
        
        # suggestions
        suggestions = []
        for s in missing:
            suggestions.append(f"Consider adding details about your experience with '{s.title()}' to your resume.")
            
        if not suggestions:
            suggestions.append("Excellent match! Your resume covers all key skills highlighted in the job post.")
            
        return JobMatchResponse(
            match_percentage=match_pct,
            missing_skills=[s.title() for s in missing],
            missing_keywords=[s.title() for s in missing][:10],
            skill_gap_analysis={
                "found_skills": [s.title() for s in found],
                "missing_skills": [s.title() for s in missing]
            },
            suggestions=suggestions
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate-feedback", response_model=FeedbackResponse)
async def generate_feedback(request: TextRequest):
    try:
        feedback = ollama_client.generate_feedback(request.text)
        return FeedbackResponse(
            strengths=feedback.get('strengths', []),
            weaknesses=feedback.get('weaknesses', []),
            improvements=feedback.get('improvements', []),
            career_guidance=feedback.get('career_guidance', "Keep building projects!")
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

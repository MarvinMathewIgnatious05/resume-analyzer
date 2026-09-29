import os
import json
import requests
import logging

logger = logging.getLogger("fastapi_service")

class OllamaClient:
    def __init__(self):
        self.host = os.getenv("OLLAMA_HOST", "http://localhost:11434").rstrip("/")
        self.model = "llama3"

    def generate_feedback(self, resume_text: str) -> dict:
        """
        Request Llama 3 feedback via Ollama. Falls back to smart rule-based mock feedback if Ollama is unreachable.
        """
        url = f"{self.host}/api/chat"
        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are an expert ATS optimizer and career coach. Analyze the resume text provided "
                        "and return a JSON object with keys: 'strengths' (list of strings), 'weaknesses' "
                        "(list of strings), 'improvements' (list of strings), and 'career_guidance' (string)."
                    )
                },
                {
                    "role": "user",
                    "content": f"Analyze this resume text:\n\n{resume_text}"
                }
            ],
            "stream": False,
            "format": "json"
        }
        
        try:
            logger.info("Connecting to Ollama model Llama 3...")
            response = requests.post(url, json=payload, timeout=25)
            response.raise_for_status()
            
            content = response.json().get('message', {}).get('content', '{}')
            return json.loads(content)
            
        except Exception as e:
            logger.warning(f"Ollama connection failed: {str(e)}. Triggering local heuristic-based feedback fallback.")
            return self._generate_heuristic_feedback(resume_text)

    def _generate_heuristic_feedback(self, resume_text: str) -> dict:
        """
        Generates realistic, tailored feedback based on text keyword indicators when Ollama is offline.
        """
        text_lower = resume_text.lower()
        
        strengths = []
        weaknesses = []
        improvements = []
        
        # 1. Evaluate Strengths
        if "django" in text_lower or "fastapi" in text_lower:
            strengths.append("Strong proficiency in modern backend development frameworks (Django, FastAPI).")
        if "react" in text_lower or "typescript" in text_lower:
            strengths.append("Frontend capability with React and typed TypeScript components.")
        if "docker" in text_lower or "kubernetes" in text_lower:
            strengths.append("DevOps and containerization awareness for microservice scalability.")
        if "postgres" in text_lower or "redis" in text_lower:
            strengths.append("Experience in handling relational databases and fast Redis cache layers.")
            
        if len(strengths) < 2:
            strengths.append("Clear structural layout presenting professional career progression.")
            strengths.append("Indication of technical software engineering foundations.")

        # 2. Evaluate Weaknesses
        if "promotheus" not in text_lower and "grafana" not in text_lower:
            weaknesses.append("Lack of observability metrics (Prometheus, Grafana, ELK stack).")
        if "test" not in text_lower and "pytest" not in text_lower:
            weaknesses.append("Missing explicit testing methodologies or coverage ratios (PyTest, Jest).")
        if "ci/cd" not in text_lower and "jenkins" not in text_lower:
            weaknesses.append("Automated CI/CD deployment pipelines are not highlighted.")
        if len(resume_text) < 1000:
            weaknesses.append("Short profile description; details about project impacts are brief.")

        # 3. Formulate Improvement Pointers
        if "pytest" not in text_lower:
            improvements.append("Incorporate Python unit-testing frameworks like unittest/pytest under project details.")
        if "docker" not in text_lower:
            improvements.append("Mention Docker container deployment experience to highlight cloud-native architecture readiness.")
        improvements.append("Use action verbs (e.g., 'Engineered', 'Optimized', 'Scaled') to lead performance bullet points.")
        improvements.append("Quantify achievements (e.g., 'Reduced latency by 40%', 'Supported 10k concurrent users').")

        # 4. Formulate Career Guidance
        if "senior" in text_lower or "lead" in text_lower:
            career_guidance = (
                "Based on your senior profile indicators, you should focus on leadership, architecture patterns, "
                "system design, and cross-functional project delivery. Adding system design certifications "
                "and showcasing cloud infrastructure ownership (AWS/GCP, Kubernetes) will accelerate lead roles."
            )
        else:
            career_guidance = (
                "Your profile aligns well with software engineering roles. To stand out, expand your portfolio with "
                "completed end-to-end full-stack projects using React, Django, and PostgreSQL. Familiarize yourself with "
                "CI/CD workflows, automated testing, and basic cloud deployment models (Docker)."
            )

        return {
            "strengths": strengths,
            "weaknesses": weaknesses,
            "improvements": improvements,
            "career_guidance": career_guidance
        }

    def generate_cover_letter(self, resume_text: str, job_title: str = "Software Engineer", job_company: str = "Target Company", job_description: str = "", tone: str = "Professional") -> dict:
        """
        Generates a tailored cover letter via Ollama (Llama 3) or falls back to heuristic generation.
        """
        url = f"{self.host}/api/chat"
        system_prompt = (
            f"You are an expert career consultant. Generate a highly tailored cover letter in a {tone} tone. "
            "Return a JSON object with keys: 'cover_letter' (formatted string with line breaks), "
            "and 'key_highlights' (list of 3-4 bullet points summarizing top matching strengths)."
        )
        
        user_prompt = (
            f"Candidate Resume Details:\n{resume_text}\n\n"
            f"Target Position: {job_title}\n"
            f"Target Company: {job_company}\n"
            f"Job Description / Requirements:\n{job_description or 'Standard requirements for ' + job_title}\n"
        )
        
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "stream": False,
            "format": "json"
        }
        
        try:
            logger.info(f"Generating AI Cover Letter for '{job_title}' at '{job_company}'...")
            response = requests.post(url, json=payload, timeout=35)
            response.raise_for_status()
            
            content = response.json().get('message', {}).get('content', '{}')
            parsed = json.loads(content)
            return {
                "cover_letter": parsed.get('cover_letter', ''),
                "key_highlights": parsed.get('key_highlights', []),
                "tone_used": tone
            }
        except Exception as e:
            logger.warning(f"Ollama Cover Letter generation failed ({str(e)}). Using heuristic template engine.")
            return self._generate_heuristic_cover_letter(resume_text, job_title, job_company, job_description, tone)

    def _generate_heuristic_cover_letter(self, resume_text: str, job_title: str, job_company: str, job_description: str, tone: str) -> dict:
        """
        Smart fallback template engine for generating customized cover letters offline.
        """
        text_lower = resume_text.lower()
        
        # Extract candidate name if available
        name_match = None
        for line in resume_text.split('\n'):
            line_str = line.strip()
            if line_str and len(line_str) < 40 and not any(kw in line_str.lower() for kw in ['resume', 'cv', 'experience']):
                name_match = line_str
                break
        candidate_name = name_match or "Candidate"

        # Identify key skills present in resume
        tech_skills = []
        for skill in ["Python", "Django", "FastAPI", "React", "TypeScript", "PostgreSQL", "Docker", "AWS", "Redis"]:
            if skill.lower() in text_lower:
                tech_skills.append(skill)
        
        if not tech_skills:
            tech_skills = ["Software Engineering", "Full-Stack Development", "Problem Solving"]
            
        skills_str = ", ".join(tech_skills[:4])

        # Formulate highlights based on tone
        highlights = [
            f"Proven expertise in {skills_str}.",
            f"Strong alignment with {job_company}'s mission and technical requirements.",
            f"Demonstrated background in scalable architecture and modern development standards."
        ]

        # Salutation & Opening based on tone
        if tone.lower() in ["enthusiastic & high energy", "enthusiastic"]:
            salutation = f"Dear Hiring Team at {job_company},"
            opening = f"I was thrilled to see the opening for the {job_title} role at {job_company}! With a strong foundation in {skills_str}, I am genuinely excited about the prospect of bringing my energy and technical drive to your team."
            closing_val = "Best regards and enthusiasm,"
        elif tone.lower() in ["executive & leadership", "executive"]:
            salutation = f"Dear Leadership Team,"
            opening = f"I am writing to express my interest in the {job_title} position at {job_company}. Throughout my career, I have prioritized driving technical strategy, system resilience, and scalable architecture."
            closing_val = "Sincerely,"
        elif tone.lower() in ["concise & direct", "concise"]:
            salutation = f"Dear Hiring Manager,"
            opening = f"I am submitting my candidacy for the {job_title} position at {job_company}. My background in {skills_str} directly matches your core technical requirements."
            closing_val = "Regards,"
        else:
            salutation = f"Dear Hiring Manager,"
            opening = f"I am writing to express my strong interest in the {job_title} position at {job_company}. Having reviewed your requirements, I am confident that my technical expertise in {skills_str} makes me a well-matched candidate for your team."
            closing_val = "Sincerely,"

        body = (
            f"{salutation}\n\n"
            f"{opening}\n\n"
            f"In my previous work, I have focused on engineering robust applications and delivering high-quality solutions. "
            f"My technical toolset includes hands-on experience with {skills_str}, enabling me to build end-to-end features efficiently and collaborate seamlessly across engineering teams.\n\n"
            f"What particularly draws me to {job_company} is your commitment to technical innovation and quality. "
            f"I am eager to leverage my skills in {tech_skills[0] if tech_skills else 'software development'} to contribute to your upcoming projects and help accelerate key team objectives.\n\n"
            f"Thank you for your time and consideration. I welcome the opportunity to discuss how my background aligns with the goals of {job_company}.\n\n"
            f"{closing_val}\n"
            f"{candidate_name}"
        )

        return {
            "cover_letter": body,
            "key_highlights": highlights,
            "tone_used": tone
        }


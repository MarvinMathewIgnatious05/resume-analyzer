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

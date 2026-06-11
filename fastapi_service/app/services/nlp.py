import re
import logging

# Configure logger
logger = logging.getLogger("fastapi_service")

# Initialize models globally with lazy loading and fallback strategies
nlp_model = None
embedding_model = None

# Fallback Skill Dictionary for parsing in case spaCy/models fail
COMMON_TECH_SKILLS = [
    "python", "django", "fastapi", "flask", "react", "vue", "angular", "typescript",
    "javascript", "html", "css", "postgresql", "mysql", "mongodb", "sqlite", "redis",
    "celery", "docker", "kubernetes", "nginx", "aws", "gcp", "azure", "git", "ci/cd",
    "scikit-learn", "tensorflow", "pytorch", "pandas", "numpy", "java", "springboot",
    "c++", "golang", "rust", "rest api", "graphql", "devops", "prometheus", "grafana",
    "jira", "agile", "scrum", "linux", "bash", "jenkins", "terraform", "ansible"
]

def load_spacy():
    global nlp_model
    if nlp_model is not None:
        return nlp_model
    try:
        import spacy
        # Try loading standard English model
        nlp_model = spacy.load("en_core_web_sm")
        logger.info("Successfully loaded spaCy 'en_core_web_sm' model.")
    except Exception as e:
        logger.warning(f"Could not load spaCy model: {str(e)}. Using regex & pattern matching fallback.")
        nlp_model = None
    return nlp_model

def load_sentence_transformer():
    global embedding_model
    if embedding_model is not None:
        return embedding_model
    try:
        from sentence_transformers import SentenceTransformer
        # Load lightweight embeddings model
        embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("Successfully loaded SentenceTransformer 'all-MiniLM-L6-v2' model.")
    except Exception as e:
        logger.warning(f"Could not load SentenceTransformer: {str(e)}. Using Jaccard similarity fallback.")
        embedding_model = None
    return embedding_model


class NLPService:
    @staticmethod
    def extract_contact_info(text: str):
        """
        Extract name, email, phone from raw text using regex (as a fast, robust primary strategy).
        """
        email_pattern = r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+'
        phone_pattern = r'(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}'
        
        email_match = re.search(email_pattern, text)
        phone_match = re.search(phone_pattern, text)
        
        email = email_match.group(0) if email_match else None
        phone = phone_match.group(0) if phone_match else None
        
        # Name extraction strategy:
        # Check first line or use spaCy NER PERSON tag if model is loaded
        name = None
        spacy_nlp = load_spacy()
        if spacy_nlp:
            doc = spacy_nlp(text[:500])  # limit search to header
            for ent in doc.ents:
                if ent.label_ == "PERSON":
                    name = ent.text.strip()
                    break
        
        if not name:
            # Fallback: Clean the first line of the resume text
            lines = [l.strip() for l in text.split('\n') if l.strip()]
            if lines:
                first_line = lines[0]
                if len(first_line) < 50 and not any(kw in first_line.lower() for kw in ['resume', 'cv', 'profile']):
                    name = first_line

        return {
            "name": name,
            "email": email,
            "phone": phone
        }

    @staticmethod
    def extract_skills(text: str) -> list:
        """
        Match words in text against dictionary of known tech skills.
        """
        extracted = []
        text_lower = text.lower()
        
        # Exact word boundaries match for skills
        for skill in COMMON_TECH_SKILLS:
            pattern = r'\b' + re.escape(skill) + r'\b'
            if re.search(pattern, text_lower):
                # Format skill name cleanly
                extracted.append(skill.title() if len(skill) > 3 else skill.upper())
                
        # Additional spaCy matching if available
        spacy_nlp = load_spacy()
        if spacy_nlp:
            doc = spacy_nlp(text)
            # Find entities labeled as Org/Product/WorkOfArt that might be skills
            for ent in doc.ents:
                if ent.label_ in ["ORG", "PRODUCT"] and len(ent.text) < 30:
                    val = ent.text.strip()
                    if val.lower() not in [s.lower() for s in extracted] and len(val) > 2:
                        extracted.append(val)
                        
        return list(set(extracted))

    @staticmethod
    def parse_education_and_experience(text: str):
        """
        Identify educational qualifications and companies.
        """
        education = []
        experience = []
        
        edu_keywords = ["bachelor", "master", "phd", "b.s", "m.s", "b.tech", "m.tech", "university", "college", "degree"]
        exp_keywords = ["experience", "employment", "history", "work", "job", "position", "intern", "engineer", "developer"]
        
        lines = text.split('\n')
        for line in lines:
            line_lower = line.lower()
            if any(kw in line_lower for kw in edu_keywords) and len(line) < 150:
                education.append(line.strip())
            if any(kw in line_lower for kw in exp_keywords) and len(line) < 150 and not any(kw in line_lower for kw in edu_keywords):
                experience.append(line.strip())
                
        return {
            "education": list(set(education))[:5],
            "experience": list(set(experience))[:8]
        }

    @staticmethod
    def calculate_similarity(resume_text: str, job_text: str) -> float:
        """
        Calculate semantic similarity between resume and job description.
        Uses SentenceTransformers if loaded, otherwise falls back to Jaccard word-set similarity.
        """
        model = load_sentence_transformer()
        
        if model:
            try:
                import numpy as np
                # Generate embeddings
                embeddings = model.encode([resume_text, job_text])
                # Cosine Similarity
                vec1 = embeddings[0]
                vec2 = embeddings[1]
                similarity = np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))
                return round(float(similarity) * 100, 1)
            except Exception as e:
                logger.error(f"Error calculating embedding similarity: {str(e)}")
                
        # Jaccard similarity fallback
        r_words = set(re.findall(r'\w+', resume_text.lower()))
        j_words = set(re.findall(r'\w+', job_text.lower()))
        intersection = r_words.intersection(j_words)
        union = r_words.union(j_words)
        if not union:
            return 0.0
        return round((len(intersection) / len(union)) * 100, 1)

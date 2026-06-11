import pytest
from app.services.nlp import NLPService

def test_contact_info_extraction():
    text = "John Doe\nEmail: johndoe@gmail.com\nPhone: (123) 456-7890\nSoftware Developer"
    info = NLPService.extract_contact_info(text)
    
    assert info['name'] == "John Doe"
    assert info['email'] == "johndoe@gmail.com"
    assert info['phone'] == "(123) 456-7890"

def test_skills_extraction():
    text = "Experienced software engineer with skills in Python, Django, Docker, and Kubernetes."
    skills = NLPService.extract_skills(text)
    
    assert "Python" in skills
    assert "Django" in skills
    assert "Docker" in skills
    assert "Kubernetes" in skills

def test_similarity_calculation():
    resume = "Expert engineer in Python, Django, Postgres, Redis."
    job = "Looking for a Python Developer experienced in Django and Postgres."
    
    similarity = NLPService.calculate_similarity(resume, job)
    assert similarity > 0
    assert similarity <= 100

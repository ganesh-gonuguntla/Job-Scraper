"""Agent 1 — Resume Intelligence (Phase 3)."""

import os
import json
import app.database as database
from bson import ObjectId
import google.generativeai as genai
from app.config import settings

def generate_embedding(text: str) -> list[float]:
    """Generate embeddings with retry logic and exponential backoff."""
    if not text or not text.strip():
        return [0.0] * settings.embedding_dimensions
    
    import time
    for attempt in range(settings.max_gemini_retries):
        try:
            genai.configure(api_key=settings.gemini_api_key)
            result = genai.embed_content(
                model=settings.embedding_model,
                content=text[:10000],
                task_type="retrieval_document"
            )
            return result['embedding']
        except Exception as e:
            if attempt < settings.max_gemini_retries - 1:
                delay = settings.gemini_retry_delay * (2 ** attempt)  # exponential backoff
                print(f"[RETRY {attempt + 1}] Gemini embedding failed: {str(e)}. Retrying in {delay}s...")
                time.sleep(delay)
            else:
                print(f"[FAILED] Gemini embedding failed after {settings.max_gemini_retries} attempts: {str(e)}")
                return [0.0] * settings.embedding_dimensions

def extract_text(file_path: str) -> str:
    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".pdf":
        import fitz  # PyMuPDF
        doc = fitz.open(file_path)
        text = ""
        for page in doc:
            text += page.get_text()
        return text
    elif ext in [".docx", ".doc"]:
        import docx
        doc = docx.Document(file_path)
        return "\n".join([p.text for p in doc.paragraphs])
    else:
        # Fallback to reading as text
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()

async def analyze_resume(user_id: str, resume_id: str | None = None) -> dict:
    if not resume_id:
        # If no resume_id, find the most recent resume for the user
        resume_doc = await database.db.resumes.find_one(
            {"user_id": ObjectId(user_id)},
            sort=[("created_at", -1)]
        )
    else:
        resume_doc = await database.db.resumes.find_one({"_id": ObjectId(resume_id)})

    if not resume_doc:
        return {"success": False, "message": "No resume found to analyze."}

    source = resume_doc.get("source", "uploaded")
    parsed_data = {}
    raw_text = ""

    if source == "uploaded":
        resume_url = resume_doc.get("resume_url", "")
        if not resume_url:
            return {"success": False, "message": "Resume URL is missing."}

        # Determine path to file
        # Workspace root is the parent of the ai-service directory
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        file_path = os.path.join(base_dir, "server", resume_url.lstrip("/"))

        if not os.path.exists(file_path):
            # Try workspace folder directly if server path fails
            file_path = os.path.join(base_dir, resume_url.lstrip("/"))

        if not os.path.exists(file_path):
            return {"success": False, "message": f"Resume file not found at {file_path}"}

        try:
            raw_text = extract_text(file_path)
        except Exception as e:
            return {"success": False, "message": f"Failed to extract text from file: {str(e)}"}

        if not raw_text.strip():
            return {"success": False, "message": "Resume file is empty."}

        # Parse text using Gemini
        try:
            genai.configure(api_key=settings.gemini_api_key)
            model = genai.GenerativeModel("gemini-2.5-flash")
            
            prompt = f"""
You are an expert Resume Parsing System.
Analyze the following raw resume text and extract the details as structured JSON.
Do not fabricate any details. Extract only what is present in the text.

Raw Resume Text:
---
{raw_text}
---

Your response must be a valid JSON object matching the following structure:
{{
  "name": "Full name of the candidate (string)",
  "skills": ["List of skills, technologies, languages, databases, frameworks (array of strings)"],
  "projects": [
    {{
      "name": "Project name (string)",
      "description": "Brief description of what was built and technologies used (string)"
    }}
  ],
  "education": [
    {{
      "degree": "Degree/Certification name (string)",
      "institution": "University/School/Issuer (string)",
      "year": "Graduation year or completion date (string)"
    }}
  ],
  "experience": [
    {{
      "role": "Job title/Role (string)",
      "company": "Company name (string)",
      "duration": "Dates of employment, e.g. Jan 2020 - Present (string)",
      "description": "Details of accomplishments and responsibilities (string)"
    }}
  ],
  "achievements": ["List of honors, awards, or major achievements (array of strings)"]
}}
"""
            response = model.generate_content(
                prompt,
                generation_config={"response_mime_type": "application/json"}
            )
            parsed_data = json.loads(response.text)
        except Exception as e:
            return {"success": False, "message": f"Gemini parsing failed: {str(e)}"}
    else:
        # manual_skills
        parsed_resume = resume_doc.get("parsed_resume", {})
        skills = parsed_resume.get("skills", [])
        experience = parsed_resume.get("experience", [])
        exp_summary = " ".join([e.get("summary", "") for e in experience]) if isinstance(experience, list) else str(experience)
        
        parsed_data = {
            "name": "",
            "skills": skills,
            "projects": [],
            "education": [],
            "experience": [{"role": "Candidate", "company": "Self-Employed", "duration": "", "description": exp_summary}],
            "achievements": []
        }
        raw_text = f"Skills: {', '.join(skills)}. Experience: {exp_summary}"

    # Generate Embeddings
    try:
        embedding_text = f"{parsed_data.get('name', '')} {', '.join(parsed_data.get('skills', []))} "
        for p in parsed_data.get("projects", []):
            embedding_text += f"{p.get('name', '')} {p.get('description', '')} "
        for exp in parsed_data.get("experience", []):
            embedding_text += f"{exp.get('role', '')} {exp.get('company', '')} {exp.get('description', '')} "
            
        embedding = generate_embedding(embedding_text)
    except Exception as e:
        return {"success": False, "message": f"Embedding generation failed: {str(e)}"}

    # Update database
    await database.db.resumes.update_one(
        {"_id": resume_doc["_id"]},
        {"$set": {
            "parsed_resume": parsed_data,
            "embedding": embedding
        }}
    )

    # Sync to Profile
    skills = parsed_data.get("skills", [])
    experience_desc = ""
    for exp in parsed_data.get("experience", []):
        experience_desc += f"{exp.get('role', '')} at {exp.get('company', '')} ({exp.get('duration', '')}): {exp.get('description', '')}\n"

    await database.db.profiles.update_one(
        {"user_id": ObjectId(user_id)},
        {"$set": {
            "skills": skills,
            "experience": experience_desc.strip(),
        }},
        upsert=True
    )

    import datetime
    # Log action
    await database.db.agent_logs.insert_one({
        "user_id": ObjectId(user_id),
        "agent_name": "resume_intelligence",
        "action": "parse_resume",
        "status": "completed",
        "details": {"source": source, "skills_count": len(skills)},
        "timestamp": datetime.datetime.utcnow()
    })

    return {
        "status": "completed",
        "agent": "resume_intelligence",
        "message": "Resume successfully analyzed and embedded.",
        "skills": skills,
        "name": parsed_data.get("name", "")
    }

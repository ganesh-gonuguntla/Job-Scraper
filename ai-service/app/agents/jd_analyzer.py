"""Agent 3 — JD Analyzer (Phase 4)."""

import re
import datetime
import app.database as database
from bson import ObjectId
import google.generativeai as genai
from app.config import settings
from app.agents.resume_intelligence import generate_embedding

async def analyze_jd(job_id: str) -> dict:
    job = await database.db.jobs.find_one({"_id": ObjectId(job_id)})
    if not job:
        return {"success": False, "message": f"Job not found: {job_id}"}

    jd_text = job.get("jd_text", "")
    title = job.get("title", "")
    company = job.get("company", "")

    # Extract info via Gemini
    parsed_jd = {}
    try:
        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel("gemini-2.5-flash")
        
        prompt = f"""
You are an expert Job Description Analyzer.
Analyze the following job description and extract key features.
Identify if there are any explicit recruiter/HR names, contact emails, or specific apply instructions mentioned in the text.

Job Title: {title}
Company: {company}
Job Description:
---
{jd_text}
---

Your response must be a valid JSON object matching this structure:
{{
  "role_summary": "Brief summary of the role (string)",
  "skills_required": ["List of core skills, languages, tools required (array of strings)"],
  "experience_level": "E.g. Senior / Mid / Junior (string)",
  "experience_years": 3, // Estimated number of years of experience required (integer or null)
  "responsibilities": ["Key responsibilities (array of strings)"],
  "contact": {{
    "found": true, // (boolean)
    "hr_name": "Name of contact if found, or null",
    "designation": "E.g. Technical Recruiter or null",
    "email": "hr@company.com or null",
    "apply_instructions": "E.g. Send resume to email or null"
  }}
}}
"""
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        import json
        parsed_jd = json.loads(response.text)
    except Exception as e:
        print(f"Gemini JD analysis failed: {str(e)}")
        # Simple fallback
        parsed_jd = {
            "role_summary": title,
            "skills_required": job.get("skills_required", []),
            "experience_level": "Mid",
            "experience_years": 2,
            "responsibilities": [],
            "contact": {"found": False, "hr_name": None, "designation": None, "email": None, "apply_instructions": None}
        }

    # Extract email using Regex as a fallback / verification step
    extracted_emails = re.findall(r'[\w\.-]+@[\w\.-]+\.\w+', jd_text)
    contact_info = parsed_jd.get("contact", {})
    
    if extracted_emails and not contact_info.get("email"):
        contact_info["found"] = True
        contact_info["email"] = extracted_emails[0]
        contact_info["hr_name"] = contact_info.get("hr_name") or "Hiring Team"
        contact_info["designation"] = contact_info.get("designation") or "Recruiter"

    # Create job contact if found
    if contact_info.get("found") and contact_info.get("email"):
        hr_name = contact_info.get("hr_name") or "Hiring Team"
        designation = contact_info.get("designation") or "HR Representative"
        email = contact_info.get("email")
        
        # Save to job_contacts
        await database.db.job_contacts.update_one(
            {"job_id": ObjectId(job_id)},
            {"$set": {
                "hr_name": hr_name,
                "designation": designation,
                "email": email.strip(),
                "email_source": "job_description",
                "confidence_score": 95 if contact_info.get("hr_name") else 80
            }},
            upsert=True
        )

    # Generate Embeddings of the JD
    try:
        embedding_text = f"{title} {company} {parsed_jd.get('role_summary', '')} {', '.join(parsed_jd.get('skills_required', []))} {parsed_jd.get('experience_level', '')}"
        embedding = generate_embedding(embedding_text)
    except Exception as e:
        print(f"JD embedding generation failed: {str(e)}")
        embedding = []

    # Update job with embedding and skills
    update_fields = {
        "embedding": embedding
    }
    if parsed_jd.get("skills_required"):
        update_fields["skills_required"] = parsed_jd.get("skills_required")
        
    await database.db.jobs.update_one(
        {"_id": ObjectId(job_id)},
        {"$set": update_fields}
    )

    return {
        "status": "completed",
        "agent": "jd_analyzer",
        "message": "Job description parsed and embedded.",
        "skills_required": parsed_jd.get("skills_required", []),
        "contact_found": contact_info.get("found", False)
    }

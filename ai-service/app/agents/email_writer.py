"""Agent 7 — Email Writer (Phase 8)."""

import datetime
import json
import app.database as database
from bson import ObjectId
import google.generativeai as genai
from app.config import settings
from app.utils import retry_gemini_call, handle_gemini_error

async def create_email(user_id: str, match_id: str) -> dict:
    match_doc = await database.db.matches.find_one({"_id": ObjectId(match_id)})
    if not match_doc:
        return {"success": False, "message": "Match not found."}

    job_id = match_doc.get("job_id")
    match_score = match_doc.get("score")

    profile = await database.db.profiles.find_one({"user_id": ObjectId(user_id)})
    resume = await database.db.resumes.find_one(
        {"user_id": ObjectId(user_id)},
        sort=[("created_at", -1)]
    )
    job = await database.db.jobs.find_one({"_id": ObjectId(job_id)})
    contact = await database.db.job_contacts.find_one({"job_id": ObjectId(job_id)})

    if not profile or not resume or not job:
        return {"success": False, "message": "Missing required data to write email."}

    candidate_name = profile.get("name") or resume.get("parsed_resume", {}).get("name", "Applicant")
    candidate_skills = ", ".join(profile.get("skills", []))
    candidate_exp = profile.get("experience", "")
    
    job_title = job.get("title", "Position")
    company = job.get("company", "Company")
    
    recruiter_name = contact.get("hr_name", "Hiring Team") if contact else "Hiring Team"
    recruiter_title = contact.get("designation", "Recruiter") if contact else "Recruiter"
    recruiter_email = contact.get("email", "") if contact else ""

    # Generate via Gemini with retry logic
    email_data = {}
    try:
        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel("gemini-2.5-flash")
        
        prompt = f"""
You are an expert Cover Letter and Recruitment Outreach Writer.
Write a highly compelling, personalized email to a recruiter for a job application.

CONTEXT:
- Candidate: {candidate_name}
- Skills: {candidate_skills}
- Experience summary: {candidate_exp}
- Position: {job_title}
- Company: {company}
- Recruiter Name: {recruiter_name}
- Recruiter Title: {recruiter_title}
- Match score achieved: {match_score}%

INSTRUCTIONS:
1. Max 150 words. Keep it professional, warm, and highly focused.
2. Adapt the tone: if a recruiter name is specified (not just "Hiring Team"), make it personal and reference their role. If generic, make it formal.
3. Highlight 2 key skills or experiences that align directly with the position.
4. Conclude with a clear request to review the attached resume.
5. Do not write filler.

Return your response as a valid JSON object matching this structure:
{{
  "subject": "Subject of the email",
  "body": "Body of the email (use standard newlines \\n)"
}}
"""
        response = await retry_gemini_call(
            "EmailWriter",
            "generate_email",
            lambda: model.generate_content(
                prompt,
                generation_config={"response_mime_type": "application/json"}
            )
        )
        if response:
            email_data = json.loads(response.text)
        else:
            email_data = {
            "subject": f"Application for {job_title} - {candidate_name}",
            "body": f"Dear {recruiter_name},\n\nI am writing to express my strong interest in the {job_title} role at {company}.\n\nWith my background in {candidate_skills.split(',')[0]} and related technologies, I believe I can make a strong contribution to your team.\n\nPlease find my optimized resume attached.\n\nBest regards,\n{candidate_name}"
        }

    # Save to generated_emails
    email_doc = {
        "job_id": ObjectId(job_id),
        "match_id": ObjectId(match_id),
        "recipient_email": recruiter_email,
        "subject": email_data.get("subject", ""),
        "body": email_data.get("body", ""),
        "generation_context": {
            "candidate_name": candidate_name,
            "job_title": job_title,
            "company": company,
            "recruiter_name": recruiter_name
        }
    }
    
    existing = await database.db.generated_emails.find_one({"match_id": ObjectId(match_id)})
    if existing:
        await database.db.generated_emails.update_one(
            {"_id": existing["_id"]},
            {"$set": {"recipient_email": recruiter_email, "subject": email_doc["subject"], "body": email_doc["body"]}}
        )
        email_id = existing["_id"]
    else:
        res = await database.db.generated_emails.insert_one(email_doc)
        email_id = res.inserted_id

    # Log action
    await database.db.agent_logs.insert_one({
        "user_id": ObjectId(user_id),
        "job_id": ObjectId(job_id),
        "agent_name": "email_writer",
        "action": "create_email",
        "status": "completed",
        "details": {"email_id": str(email_id)},
        "timestamp": datetime.datetime.utcnow()
    })

    return {
        "status": "completed",
        "agent": "email_writer",
        "message": "Dynamic outreach email drafted and saved.",
        "email_id": str(email_id),
        "subject": email_doc["subject"],
        "body": email_doc["body"],
        "recipient": recruiter_email
    }

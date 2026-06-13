"""Agent 6 — Resume Optimization (Phase 7)."""

import datetime
import json
import app.database as database
from bson import ObjectId
import google.generativeai as genai
from app.config import settings
from app.utils import retry_gemini_call, handle_gemini_error

async def optimize_resume(match_id: str) -> dict:
    match_doc = await database.db.matches.find_one({"_id": ObjectId(match_id)})
    if not match_doc:
        return {"success": False, "message": "Match not found."}

    user_id = match_doc.get("user_id")
    job_id = match_doc.get("job_id")

    # Fetch resume and job details
    resume = await database.db.resumes.find_one(
        {"user_id": ObjectId(user_id)},
        sort=[("created_at", -1)]
    )
    job = await database.db.jobs.find_one({"_id": ObjectId(job_id)})

    if not resume or not job:
        return {"success": False, "message": "Resume or Job not found."}

    parsed_resume = resume.get("parsed_resume", {})
    jd_text = job.get("jd_text", "")
    title = job.get("title", "")
    company = job.get("company", "")

    # Optimization call using Gemini with retry logic
    optimized_text = ""
    try:
        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel("gemini-2.5-flash")
        
        prompt = f"""
You are an expert Resume Optimization Specialist.
Your goal is to customize the candidate's resume to match the target Job Description (JD).

CRITICAL INSTRUCTIONS:
1. NEVER fabricate skills, projects, degrees, certificates, dates, or companies.
2. DO NOT add any experiences, jobs, or technologies the candidate has not actually worked with.
3. You should reword existing bullet points, emphasize relevant skills, and reorder experiences/projects to show the most relevant items first.
4. Ensure the output is formatted as clean, professional Markdown.

Candidate Resume Data (JSON format):
---
{json.dumps(parsed_resume, indent=2)}
---

Target Job Title: {title}
Target Company: {company}
Target Job Description:
---
{jd_text}
---

Generate the optimized resume in Markdown. Start directly with the Candidate's Name (from the resume) as the header, then a professional summary, core technical skills (matching skills listed first), professional experience, projects, and education. Do not output conversational filler.
"""
        response = await retry_gemini_call(
            "ResumeOptimizer",
            "optimize_resume",
            lambda: model.generate_content(prompt)
        )
        if response:
            optimized_text = response.text.strip()
        else:
            # Fallback text
            skills_str = ", ".join(parsed_resume.get("skills", []))
            optimized_text = f"""# {parsed_resume.get('name', 'Candidate')}
Skills: {skills_str}

## Objective
To apply my experience to the {title} role at {company}.

## Professional Experience
(Please see original resume for detailed timeline. Tailored for compatibility.)
"""
    except Exception as e:
        print(f"Resume optimization failed: {str(e)}")
        # Simple fallback text
        skills_str = ", ".join(parsed_resume.get("skills", []))
        optimized_text = f"""# {parsed_resume.get('name', 'Candidate')}
Skills: {skills_str}

## Objective
To apply my experience to the {title} role at {company}.

## Professional Experience
(Please see original resume for detailed timeline. Tailored for compatibility.)
"""

    # Save to generated_resumes
    await database.db.generated_resumes.update_one(
        {"match_id": ObjectId(match_id)},
        {"$set": {
            "resume_text": optimized_text,
            "resume_file_url": resume.get("resume_url", "")
        }},
        upsert=True
    )

    # Log action
    await database.db.agent_logs.insert_one({
        "user_id": ObjectId(user_id),
        "job_id": ObjectId(job_id),
        "agent_name": "resume_optimization",
        "action": "optimize_resume",
        "status": "completed",
        "details": {"match_id": match_id},
        "timestamp": datetime.datetime.utcnow()
    })

    return {
        "status": "completed",
        "agent": "resume_optimization",
        "message": "Resume tailored and saved.",
        "match_id": match_id,
        "preview_length": len(optimized_text)
    }

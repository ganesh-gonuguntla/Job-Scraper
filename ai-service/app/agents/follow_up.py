"""Agent 9 — Follow-Up (Phase 9)."""

import datetime
import json
import app.database as database
from bson import ObjectId
import google.generativeai as genai
from app.config import settings
from app.agents.apply_sender import send_smtp_email
from app.utils import retry_gemini_call, handle_gemini_error

async def run_followups(user_id: str | None = None) -> dict:
    # Get all users if user_id is None
    users = []
    if user_id:
        users = [ObjectId(user_id)]
    else:
        cursor = database.db.profiles.find({}, {"user_id": 1})
        async for doc in cursor:
            users.append(doc["user_id"])

    followup_count = 0
    followup_details = []

    for uid in users:
        profile = await database.db.profiles.find_one({"user_id": uid})
        if not profile:
            continue

        follow_up_days = profile.get("preferences", {}).get("follow_up_days", 7)
        cutoff_date = datetime.datetime.utcnow() - datetime.timedelta(days=follow_up_days)

        # Find emailed applications older than follow_up_days
        cursor = database.db.applications.find({
            "user_id": uid,
            "status": "emailed",
            "applied_at": {"$lte": cutoff_date}
        })
        
        async for app_doc in cursor:
            job_id = app_doc["job_id"]
            job = await database.db.jobs.find_one({"_id": job_id})
            contact = await database.db.job_contacts.find_one({"job_id": job_id})
            
            if not job or not contact:
                continue

            # Check if there is a match to retrieve generated email
            match_doc = await database.db.matches.find_one({
                "user_id": uid,
                "job_id": job_id
            })
            if not match_doc:
                continue

            orig_email = await database.db.generated_emails.find_one({"match_id": match_doc["_id"]})
            orig_subject = orig_email.get("subject", "Application") if orig_email else "Application"

            # Generate follow up email via Gemini
            candidate_name = profile.get("name") or "Applicant"
            company = job.get("company", "Company")
            job_title = job.get("title", "Position")
            recruiter_name = contact.get("hr_name", "Hiring Team")
            recruiter_email = contact.get("email")

            if not recruiter_email:
                continue

            followup_data = {}
            try:
                genai.configure(api_key=settings.gemini_api_key)
                model = genai.GenerativeModel("gemini-2.5-flash")
                
                prompt = f"""
You are an expert Professional Outreach Assistant.
Draft a polite, short, and professional follow-up email to the recruiter.

CONTEXT:
- Candidate: {candidate_name}
- Position: {job_title}
- Company: {company}
- Recruiter Name: {recruiter_name}
- Original Subject: {orig_subject}
- Days Elapsed: {follow_up_days}

INSTRUCTIONS:
1. Max 80 words. Keep it extremely brief and courteous.
2. Politely check in on the status of your application.
3. Express continued interest.
4. Do not output any conversational filler.

Return your response as a valid JSON object matching this structure:
{{
  "subject": "Follow-up: [Subject line]",
  "body": "Body of follow-up email"
}}
"""
                response = await retry_gemini_call(
                    "FollowUp",
                    "generate_followup",
                    lambda: model.generate_content(
                        prompt,
                        generation_config={"response_mime_type": "application/json"}
                    )
                )
                
                if response:
                    followup_data = json.loads(response.text)
                else:
                    followup_data = {
                        "subject": f"Following up: Application for {job_title} - {candidate_name}",
                        "body": f"Dear {recruiter_name},\n\nI hope you are well.\n\nI am writing to check in briefly on my application for the {job_title} position.\n\nI remain very interested in the opportunity at {company}. Please let me know if you require any further information.\n\nBest regards,\n{candidate_name}"
                    }
            except Exception as e:
                print(f"Follow-up generation failed: {str(e)}")
                followup_data = {
                    "subject": f"Following up: Application for {job_title} - {candidate_name}",
                    "body": f"Dear {recruiter_name},\n\nI hope you are well.\n\nI am writing to check in briefly on my application for the {job_title} position.\n\nI remain very interested in the opportunity at {company}. Please let me know if you require any further information.\n\nBest regards,\n{candidate_name}"
                }

            # Retrieve user email and SMTP details
            user_doc = await database.db.users.find_one({"_id": uid})
            from_email = user_doc.get("email") if user_doc else None
            smtp_pass = profile.get("preferences", {}).get("smtp_pass", "").strip()

            # Send email
            subject = followup_data.get("subject", f"Following up: {orig_subject}")
            body = followup_data.get("body", "")
            
            success = await send_smtp_email(recruiter_email, subject, body, from_email, smtp_pass)
            if success:
                # Update status to followed_up
                await database.db.applications.update_one(
                    {"_id": app_doc["_id"]},
                    {"$set": {"status": "followed_up", "followed_up_at": datetime.datetime.utcnow()}}
                )
                
                # Log action
                await database.db.agent_logs.insert_one({
                    "user_id": uid,
                    "job_id": job_id,
                    "agent_name": "follow_up",
                    "action": "send_followup",
                    "status": "completed",
                    "details": {"recipient": recruiter_email},
                    "timestamp": datetime.datetime.utcnow()
                })
                
                followup_count += 1
                followup_details.append({
                    "job": f"{job_title} at {company}",
                    "recipient": recruiter_email
                })
            else:
                # Log failure
                log_details = {"recipient": recruiter_email}
                if not smtp_pass:
                    log_details["error"] = "Gmail App Password is not configured. Go to Settings to connect your email."
                else:
                    log_details["error"] = "SMTP sending failed."
                    
                await database.db.agent_logs.insert_one({
                    "user_id": uid,
                    "job_id": job_id,
                    "agent_name": "follow_up",
                    "action": "send_followup",
                    "status": "failed",
                    "details": log_details,
                    "timestamp": datetime.datetime.utcnow()
                })

    return {
        "status": "completed",
        "agent": "follow_up",
        "message": f"Processed follow-ups. Sent {followup_count} emails.",
        "followups_sent": followup_count,
        "details": followup_details
    }

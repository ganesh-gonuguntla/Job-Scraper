"""Agent 8 — Apply & Email Sender (Phase 8)."""

import datetime
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import app.database as database
from bson import ObjectId

async def send_smtp_email(to_email: str, subject: str, body: str, from_email: str = None, smtp_pass: str = None) -> bool:
    # Read settings if configured (can be configured in .env)
    # Default to dry-run mock send if not configured
    import os
    
    if not smtp_pass:
        smtp_pass = os.getenv("SMTP_PASS")
    if not from_email:
        from_email = os.getenv("SMTP_USER")
        
    smtp_host = "smtp.gmail.com" if smtp_pass else os.getenv("SMTP_HOST")
    smtp_port = "587" if smtp_pass else os.getenv("SMTP_PORT", "587")
    
    if not smtp_pass or not from_email:
        # Mock send success
        print("[WARNING] Gmail App Password is not configured. Go to Settings to connect your email.")
        print(f"[MOCK EMAIL SEND] To: {to_email} | Subject: {subject}")
        return False

    try:
        msg = MIMEMultipart()
        msg['From'] = from_email
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))
        
        server = smtplib.SMTP(smtp_host, int(smtp_port))
        server.starttls()
        server.login(from_email, smtp_pass)
        server.sendmail(from_email, to_email, msg.as_string())
        server.quit()
        return True
    except Exception as e:
        print(f"SMTP sending failed: {str(e)}")
        return False

async def submit_application(user_id: str, match_id: str) -> dict:
    match_doc = await database.db.matches.find_one({"_id": ObjectId(match_id)})
    if not match_doc:
        return {"success": False, "message": "Match not found."}

    job_id = match_doc.get("job_id")
    
    # Retrieve user email
    user_doc = await database.db.users.find_one({"_id": ObjectId(user_id)})
    if not user_doc:
        return {"success": False, "message": "User not found."}
    from_email = user_doc.get("email")

    profile = await database.db.profiles.find_one({"user_id": ObjectId(user_id)})
    if not profile:
        return {"success": False, "message": "Profile not found."}

    preferences = profile.get("preferences", {})
    review_before_send = preferences.get("review_before_send", False)
    smtp_pass = preferences.get("smtp_pass", "").strip()

    # 1. Handle Review checkpoint
    if review_before_send and match_doc.get("status") != "approved":
        # Pause application, set status in matches
        await database.db.matches.update_one(
            {"_id": ObjectId(match_id)},
            {"$set": {"status": "pending_review"}}
        )
        # Log action
        await database.db.agent_logs.insert_one({
            "user_id": ObjectId(user_id),
            "job_id": ObjectId(job_id),
            "agent_name": "apply_sender",
            "action": "hold_for_review",
            "status": "pending",
            "details": {"match_id": match_id},
            "timestamp": datetime.datetime.utcnow()
        })
        return {
            "status": "review_pending",
            "agent": "apply_sender",
            "message": "Application paused: User review before send is active."
        }

    # 2. Retrieve generated email & optimized resume
    email_doc = await database.db.generated_emails.find_one({"match_id": ObjectId(match_id)})
    if not email_doc:
        return {"success": False, "message": "Draft email not found. Please generate email first."}

    recipient = email_doc.get("recipient_email", "")
    subject = email_doc.get("subject", "")
    body = email_doc.get("body", "")

    if not recipient:
        # Fallback to general careers email if recruiter search failed
        recipient = "careers@company.com"

    # Send Email
    success = await send_smtp_email(recipient, subject, body, from_email, smtp_pass)
    status_str = "emailed" if success else "failed"

    if success:
        # Create applications log
        await database.db.applications.update_one(
            {"job_id": ObjectId(job_id), "user_id": ObjectId(user_id)},
            {"$set": {
                "status": "emailed",
                "applied_at": datetime.datetime.utcnow()
            }},
            upsert=True
        )

        # Create sent email document
        await database.db.sent_emails.insert_one({
            "email_id": email_doc["_id"],
            "sent_status": "sent",
            "sent_time": datetime.datetime.utcnow(),
            "channel": "direct_hr_email"
        })

        # Update Match status
        await database.db.matches.update_one(
            {"_id": ObjectId(match_id)},
            {"$set": {"status": "applied"}}
        )
    else:
        # Log failure
        await database.db.applications.update_one(
            {"job_id": ObjectId(job_id), "user_id": ObjectId(user_id)},
            {"$set": {
                "status": "failed",
                "applied_at": datetime.datetime.utcnow()
            }},
            upsert=True
        )

    # Log action
    log_details = {"recipient": recipient, "channel": "direct_hr_email"}
    if not success:
        if not smtp_pass:
            log_details["error"] = "Gmail App Password is not configured. Go to Settings to connect your email."
        else:
            log_details["error"] = "SMTP sending failed."

    await database.db.agent_logs.insert_one({
        "user_id": ObjectId(user_id),
        "job_id": ObjectId(job_id),
        "agent_name": "apply_sender",
        "action": "submit_application",
        "status": "completed" if success else "failed",
        "details": log_details,
        "timestamp": datetime.datetime.utcnow()
    })

    return {
        "status": status_str,
        "agent": "apply_sender",
        "message": "Application email sent successfully!" if success else ("Gmail App Password is not configured. Go to Settings to connect your email." if not smtp_pass else "Application delivery failed."),
        "recipient": recipient
    }

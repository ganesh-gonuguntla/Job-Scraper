"""Agent 5 — Recruiter Discovery Agent (Phase 6)."""

import re
import datetime
import urllib.parse
import app.database as database
from bson import ObjectId
import google.generativeai as genai
from app.config import settings

def extract_domain(url: str) -> str:
    try:
        parsed = urllib.parse.urlparse(url)
        netloc = parsed.netloc
        if not netloc:
            netloc = parsed.path
        # Remove www.
        if netloc.startswith("www."):
            netloc = netloc[4:]
        # Remove subdomains if possible (just keep domain.com/co.uk)
        parts = netloc.split(".")
        if len(parts) >= 2:
            return ".".join(parts[-2:])
        return netloc
    except Exception:
        return "company.com"

async def find_recruiter(job_id: str) -> dict:
    job = await database.db.jobs.find_one({"_id": ObjectId(job_id)})
    if not job:
        return {"success": False, "message": "Job not found."}

    # Check if we already have a contact in job_contacts
    existing_contact = await database.db.job_contacts.find_one({"job_id": ObjectId(job_id)})
    if existing_contact:
        return {
            "status": "completed",
            "agent": "recruiter_discovery",
            "message": "Recruiter already exists in database.",
            "contact": {
                "name": existing_contact.get("hr_name"),
                "email": existing_contact.get("email"),
                "designation": existing_contact.get("designation"),
                "confidence": existing_contact.get("confidence_score")
            }
        }

    apply_url = job.get("apply_url", "")
    company = job.get("company", "Company")
    domain = extract_domain(apply_url)
    
    # Try parsing company careers page
    email = None
    hr_name = "Hiring Team"
    designation = "Careers Team"
    confidence = 50
    source = "generated_fallback"

    if apply_url and not apply_url.startswith("http://localhost") and not apply_url.startswith("https://localhost"):
        try:
            import httpx
            from bs4 import BeautifulSoup
            
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(apply_url)
                if resp.status_code == 200:
                    soup = BeautifulSoup(resp.text, 'html.parser')
                    # Find all mailto links
                    mailtos = soup.select('a[href^="mailto:"]')
                    for link in mailtos:
                        href = link.get('href', '')
                        m = re.search(r'mailto:([\w\.-]+@[\w\.-]+\.\w+)', href)
                        if m:
                            email = m.group(1).strip()
                            confidence = 85
                            source = "careers_page_crawl"
                            break
                    
                    if not email:
                        # Search page for raw email regex
                        emails = re.findall(r'[\w\.-]+@[\w\.-]+\.\w+', soup.get_text())
                        # Filter out common logo or support emails if domain matches
                        for e in emails:
                            if domain in e.lower() and not any(x in e.lower() for x in ["support@", "info@", "noreply@", "webmaster@"]):
                                email = e.strip()
                                confidence = 75
                                source = "careers_page_regex"
                                break
        except Exception as e:
            print(f"Failed to crawl apply page: {str(e)}")

    # Fallback to smart corporate address synthesis if no email found
    if not email:
        clean_company = re.sub(r'[^a-zA-Z0-9]', '', company).lower()
        if not domain or domain == "localhost" or "." not in domain:
            domain = f"{clean_company}.com"
        
        email = f"careers@{domain}"
        hr_name = "Hiring Team"
        designation = "Talent Acquisition"
        confidence = 40
        source = "synthesized_domain_email"

    # Save to job_contacts
    contact_doc = {
        "job_id": ObjectId(job_id),
        "hr_name": hr_name,
        "designation": designation,
        "email": email,
        "email_source": source,
        "confidence_score": confidence
    }
    
    await database.db.job_contacts.update_one(
        {"job_id": ObjectId(job_id)},
        {"$set": contact_doc},
        upsert=True
    )

    # Log action
    await database.db.agent_logs.insert_one({
        "job_id": ObjectId(job_id),
        "agent_name": "recruiter_discovery",
        "action": "find_recruiter",
        "status": "completed",
        "details": {"email": email, "source": source, "confidence": confidence},
        "timestamp": datetime.datetime.utcnow()
    })

    return {
        "status": "completed",
        "agent": "recruiter_discovery",
        "message": f"Contact determined: {email} ({confidence}% confidence)",
        "contact": {
            "name": hr_name,
            "email": email,
            "designation": designation,
            "confidence": confidence
        }
    }

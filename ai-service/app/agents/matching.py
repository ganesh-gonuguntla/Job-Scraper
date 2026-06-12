"""Agent 4 — Matching Agent (Phase 5)."""

import datetime
import re
import app.database as database
from bson import ObjectId
from app.config import settings

def cosine_similarity(v1: list[float], v2: list[float]) -> float:
    # Calculate the similarity between embedding vectors using dot product

    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot_product = sum(x * y for x, y in zip(v1, v2))
    norm_v1 = sum(x * x for x in v1) ** 0.5
    norm_v2 = sum(x * x for x in v2) ** 0.5
    if norm_v1 == 0 or norm_v2 == 0:
        return 0.0
    return dot_product / (norm_v1 * norm_v2)

def extract_years_from_text(text: str) -> int:
    if not text:
        return 0
    # Try finding patterns like "3 years", "5+ years", "10 years"
    matches = re.findall(r'(\d+)\s*(?:\+)?\s*year', text.lower())
    if matches:
        return max(int(m) for m in matches)
    # Search for single digits
    digits = re.findall(r'\b\d+\b', text)
    if digits:
        return max(int(d) for d in digits if int(d) < 30)  # Filter out years like 2026
    return 0

async def compute_match(user_id: str, job_id: str) -> dict:
    profile = await database.db.profiles.find_one({"user_id": ObjectId(user_id)})
    resume = await database.db.resumes.find_one(
        {"user_id": ObjectId(user_id)},
        sort=[("created_at", -1)]
    )
    job = await database.db.jobs.find_one({"_id": ObjectId(job_id)})

    if not profile or not resume or not job:
        return {"success": False, "message": "Missing profile, resume, or job data."}

    # 1. Semantic Similarity (40%)
    resume_emb = resume.get("embedding", [])
    job_emb = job.get("embedding", [])
    semantic_sim = cosine_similarity(resume_emb, job_emb)
    # Clip negative values
    semantic_sim = max(0.0, semantic_sim)
    semantic_score = semantic_sim * 40.0

    # 2. Skill Overlap (30%)
    candidate_skills = {s.lower().strip() for s in profile.get("skills", [])}
    job_skills = {s.lower().strip() for s in job.get("skills_required", [])}
    
    missing_skills = []
    if job_skills:
        overlap = candidate_skills.intersection(job_skills)
        overlap_ratio = len(overlap) / len(job_skills)
        missing_skills = list(job_skills - candidate_skills)
    else:
        overlap_ratio = 1.0
        
    skills_score = overlap_ratio * 30.0

    # 3. Experience Match (20%)
    job_desc = job.get("jd_text", "")
    job_req_years = extract_years_from_text(job_desc)
    candidate_years = extract_years_from_text(profile.get("experience", ""))
    
    if job_req_years <= 0:
        exp_score = 20.0
    else:
        if candidate_years >= job_req_years:
            exp_score = 20.0
        else:
            exp_score = (candidate_years / job_req_years) * 20.0
            
    # 4. Location Match (10%)
    job_loc = job.get("location", "").lower()
    profile_loc = profile.get("location", "").lower()
    
    if "remote" in job_loc or "remote" in profile_loc:
        location_score = 10.0
    elif job_loc in profile_loc or profile_loc in job_loc:
        location_score = 10.0
    else:
        location_score = 5.0

    # Calculate final score
    total_score = semantic_score + skills_score + exp_score + location_score
    # Enforce standard bounds
    total_score = round(min(100.0, max(0.0, total_score)), 1)

    threshold = profile.get("preferences", {}).get("match_threshold", 40.0)
    status = "qualified" if total_score >= threshold else "low_match"

    # Save match to MongoDB
    match_doc = {
        "user_id": ObjectId(user_id),
        "job_id": ObjectId(job_id),
        "score": total_score,
        "missing_skills": missing_skills,
        "status": status,
        "created_at": datetime.datetime.utcnow()
    }

    # Upsert match document
    existing_match = await database.db.matches.find_one({
        "user_id": ObjectId(user_id),
        "job_id": ObjectId(job_id)
    })
    
    if existing_match:
        await database.db.matches.update_one(
            {"_id": existing_match["_id"]},
            {"$set": {"score": total_score, "missing_skills": missing_skills, "status": status}}
        )
        match_id = existing_match["_id"]
    else:
        res = await database.db.matches.insert_one(match_doc)
        match_id = res.inserted_id

    # Log action
    await database.db.agent_logs.insert_one({
        "user_id": ObjectId(user_id),
        "job_id": ObjectId(job_id),
        "agent_name": "matching",
        "action": "compute_match",
        "status": "completed",
        "details": {
            "score": total_score,
            "status": status,
            "semantic": round(semantic_score, 1),
            "skills": round(skills_score, 1),
            "experience": round(exp_score, 1),
            "location": round(location_score, 1)
        },
        "timestamp": datetime.datetime.utcnow()
    })

    return {
        "status": "completed",
        "agent": "matching",
        "message": f"Job compatibility calculated: {total_score}%",
        "match_id": str(match_id),
        "score": total_score,
        "status_decision": status,
        "missing_skills": missing_skills
    }

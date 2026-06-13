import datetime
import os
import json
import re
import urllib.parse
import httpx
from bs4 import BeautifulSoup
import app.database as database
from bson import ObjectId
import google.generativeai as genai
from app.config import settings
from app.utils import retry_gemini_call

async def fetch_search_results(query: str) -> list:
    url = "https://html.duckduckgo.com/html/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    links = []
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, data={"q": query}, headers=headers, timeout=12.0)
            if response.status_code != 200:
                print(f"[ERROR] DuckDuckGo search failed with status {response.status_code}")
                return []
            
            soup = BeautifulSoup(response.text, "html.parser")
            for a in soup.find_all("a", class_="result__a"):
                href = a.get("href", "")
                if "uddg=" in href:
                    match = re.search(r'uddg=([^&]+)', href)
                    if match:
                        real_url = urllib.parse.unquote(match.group(1))
                        links.append(real_url)
                elif href.startswith("http"):
                    links.append(href)
    except Exception as e:
        print(f"[ERROR] DuckDuckGo query failed: {str(e)}")
    return list(set(links))

async def parse_job_page(url: str) -> dict | None:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(url, headers=headers, timeout=12.0, follow_redirects=True)
            if res.status_code != 200:
                return None
            
            soup = BeautifulSoup(res.text, "html.parser")
            
            # Strip tags we don't need
            for tag in soup(["script", "style", "nav", "footer", "header", "input", "button"]):
                tag.decompose()
                
            page_text = soup.get_text(separator="\n")
            page_text = re.sub(r'\n+', '\n', page_text).strip()
            
            if len(page_text) < 100:
                return None
                
            # Use Gemini to clean and structure the data with retry logic
            genai.configure(api_key=settings.gemini_api_key)
            model = genai.GenerativeModel("gemini-2.5-flash")
            
            prompt = f"""
You are an expert Job Posting Webpage Analyzer.
Extract the structured job information from this raw text extracted from {url}.

Raw Text:
---
{page_text[:4000]}
---

Return your response as a valid JSON object matching this structure:
{{
  "title": "Job Title",
  "company": "Company Name",
  "jd_text": "Cleaned full job description...",
  "location": "Location (Remote/Hybrid/City)",
  "skills_required": ["Skill1", "Skill2"]
}}
"""
            response = await retry_gemini_call(
                "JobSearch",
                "parse_job_page",
                lambda: model.generate_content(
                    prompt,
                    generation_config={"response_mime_type": "application/json"}
                )
            )
            if not response:
                return None
            data = json.loads(response.text)
            
            if not data.get("title") or not data.get("company"):
                return None
                
            data["apply_url"] = url
            return data
    except Exception as e:
        print(f"[ERROR] Failed parsing job page {url}: {str(e)}")
        return None

async def search_jobs(user_id: str) -> dict:
    # Dynamic web crawling method searching boards like Lever and Greenhouse

    profile = await database.db.profiles.find_one({"user_id": ObjectId(user_id)})
    if not profile:
        return {"success": False, "message": "No profile found."}

    target_roles = profile.get("target_roles", [])
    if not target_roles:
        target_roles = ["Software Engineer"]
    location = profile.get("location", "Remote")
    if not location:
        location = "Remote"

    scraped_jobs = []
    
    # 1. Run dynamic search query
    # Formulate search queries looking for Greenhouse/Lever job boards to find real jobs
    for role in target_roles[:2]: # Search top 2 roles
        query = f'site:greenhouse.io OR site:lever.co "{role}" "{location}"'
        print(f"[INFO] Scraper searching DuckDuckGo for: {query}")
        urls = await fetch_search_results(query)
        
        # Scrape and parse top 4 results per query to avoid hitting rate limits or blocking
        count = 0
        for url in urls:
            if count >= 3:
                break
            # Skip non-job links (like main directories)
            if url.strip('/') in ["https://boards.greenhouse.io", "https://jobs.lever.co"]:
                continue
                
            print(f"[INFO] Scraper downloading and analyzing: {url}")
            job_details = await parse_job_page(url)
            if job_details:
                scraped_jobs.append(job_details)
                count += 1

    # Fallback to general API or simulation ONLY if no live page could be fetched
    source_used = "dynamic_crawler"
    if not scraped_jobs:
        # Fallback public api (Arbeitnow)
        try:
            print("[INFO] Dynamic crawler found 0 jobs. Falling back to Arbeitnow API...")
            async with httpx.AsyncClient() as client:
                res = await client.get("https://www.arbeitnow.com/api/job-board-api", timeout=10.0)
                if res.status_code == 200:
                    results = res.json().get("data", [])
                    for job in results:
                        title_lower = job.get("title", "").lower()
                        role_match = any(r.lower() in title_lower for r in target_roles)
                        if role_match:
                            scraped_jobs.append({
                                "title": job.get("title"),
                                "company": job.get("company_name"),
                                "jd_text": job.get("description"),
                                "skills_required": job.get("tags", []),
                                "apply_url": job.get("url"),
                                "location": job.get("location", "Remote")
                            })
                    if scraped_jobs:
                        source_used = "arbeitnow_fallback"
        except Exception as e:
            print(f"[WARNING] Arbeitnow fallback failed: {str(e)}")

    # Final static fallback if everything fails
    if not scraped_jobs:
        source_used = "simulation"
        scraped_jobs = [
            {
                "title": f"Senior {target_roles[0]}",
                "company": "Global Tech Corp",
                "jd_text": f"Seeking a Senior {target_roles[0]} to join our team. Must be proficient in modern web applications, cloud services, and databases. Location: {location}.",
                "skills_required": ["JavaScript", "Python", "React"],
                "apply_url": "https://globaltechcorp.com/careers",
                "location": location
            }
        ]

    saved_jobs = []
    for job_data in scraped_jobs:
        # Check if job already exists in DB
        existing = await database.db.jobs.find_one({
            "title": job_data["title"],
            "company": job_data["company"]
        })
        if existing:
            saved_jobs.append(existing)
            continue

        job_doc = {
            "title": job_data["title"],
            "company": job_data["company"],
            "jd_text": job_data["jd_text"],
            "skills_required": job_data["skills_required"],
            "apply_url": job_data["apply_url"],
            "location": job_data["location"],
            "source": f"scraped_{source_used}",
            "scraped_at": datetime.datetime.utcnow(),
            "embedding": []
        }
        res = await database.db.jobs.insert_one(job_doc)
        job_doc["_id"] = res.inserted_id
        saved_jobs.append(job_doc)

    # Log action
    await database.db.agent_logs.insert_one({
        "user_id": ObjectId(user_id),
        "agent_name": "job_search",
        "action": "search_jobs",
        "status": "completed",
        "details": {"jobs_found": len(saved_jobs), "source": source_used},
        "timestamp": datetime.datetime.utcnow()
    })

    return {
        "status": "completed",
        "agent": "job_search",
        "message": f"Discovered and stored {len(saved_jobs)} jobs from {source_used}.",
        "jobs": [{"id": str(j["_id"]), "title": j["title"], "company": j["company"]} for j in saved_jobs]
    }

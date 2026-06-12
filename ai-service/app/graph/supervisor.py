"""LangGraph supervisor — orchestrates the full autonomous pipeline."""

from typing import TypedDict, Any, List
from langgraph.graph import StateGraph, END
import app.database as database
from bson import ObjectId
import datetime

from app.agents.job_search import search_jobs
from app.agents.jd_analyzer import analyze_jd
from app.agents.matching import compute_match
from app.agents.recruiter_discovery import find_recruiter
from app.agents.resume_optimization import optimize_resume
from app.agents.email_writer import create_email
from app.agents.apply_sender import submit_application
from app.agents.follow_up import run_followups

class AgentState(TypedDict, total=False):
    user_id: str
    jobs_to_process: List[dict]
    processed_jobs: List[dict]
    status: str
    message: str

async def run_job_search(state: AgentState) -> dict:
    user_id = state["user_id"]
    # Trigger scraping of new jobs
    await search_jobs(user_id)
    
    # Retrieve all jobs that this user hasn't matched against yet
    matched_cursor = database.db.matches.find({"user_id": ObjectId(user_id)}, {"job_id": 1})
    matched_job_ids = [m["job_id"] async for m in matched_cursor]
    
    unmatched_cursor = database.db.jobs.find({"_id": {"$nin": matched_job_ids}})
    jobs_to_process = []
    async for j in unmatched_cursor:
        jobs_to_process.append({
            "id": str(j["_id"]),
            "title": j["title"],
            "company": j["company"]
        })
        
    return {
        "jobs_to_process": jobs_to_process,
        "status": "search_completed"
    }

async def process_jobs(state: AgentState) -> dict:
    user_id = state["user_id"]
    jobs = state.get("jobs_to_process", [])
    processed = []
    
    for job_summary in jobs:
        job_id = job_summary["id"]
        
        # 1. Analyze Job Description
        await analyze_jd(job_id)
        
        # 2. Compute Compatibility Match Score
        match_res = await compute_match(user_id, job_id)
        score = match_res.get("score", 0.0)
        status_decision = match_res.get("status_decision", "rejected")
        match_id = match_res.get("match_id")
        
        job_details = {
            "id": job_id,
            "title": job_summary.get("title"),
            "company": job_summary.get("company"),
            "score": score,
            "decision": status_decision,
            "actions_taken": []
        }
        
        # 3. If match is >= 40%, run optimization outreach
        if status_decision == "qualified" and match_id:
            # Discover recruiter
            await find_recruiter(job_id)
            job_details["actions_taken"].append("recruiter_discovery")
            
            # Optimize Resume
            await optimize_resume(match_id)
            job_details["actions_taken"].append("resume_optimization")
            
            # Generate Email
            await create_email(user_id, match_id)
            job_details["actions_taken"].append("email_writer")
            
            # Send/Apply
            apply_res = await submit_application(user_id, match_id)
            job_details["actions_taken"].append(f"apply_sender:{apply_res.get('status', 'unknown')}")
            
        processed.append(job_details)
        
    # Run follow-ups check
    try:
        await run_followups(user_id)
    except Exception as e:
        print(f"Error in automatic followups check: {str(e)}")

    return {
        "processed_jobs": processed,
        "status": "pipeline_completed",
        "message": f"Successfully processed {len(processed)} jobs in pipeline."
    }

# Setup LangGraph state machine workflow
workflow = StateGraph(AgentState)

# Add nodes
workflow.add_node("search", run_job_search)
workflow.add_node("process", process_jobs)

# Set Entry and Edges
workflow.set_entry_point("search")
workflow.add_edge("search", "process")
workflow.add_edge("process", END)

# Compile graph
compiled_graph = workflow.compile()

async def run_pipeline(user_id: str) -> dict:
    # Initialize state
    initial_state: AgentState = {
        "user_id": user_id,
        "jobs_to_process": [],
        "processed_jobs": [],
        "status": "initiated",
        "message": "Starting job application pipeline"
    }
    
    # Run graph execution
    final_state = await compiled_graph.ainvoke(initial_state)
    
    # Log main pipeline run in database
    await database.db.agent_logs.insert_one({
        "user_id": ObjectId(user_id),
        "agent_name": "supervisor",
        "action": "run_pipeline",
        "status": "completed",
        "details": {
            "processed_count": len(final_state.get("processed_jobs", [])),
            "jobs": final_state.get("processed_jobs", [])
        },
        "timestamp": datetime.datetime.utcnow()
    })
    
    return {
        "user_id": user_id,
        "status": final_state.get("status"),
        "message": final_state.get("message"),
        "processed_jobs": final_state.get("processed_jobs")
    }

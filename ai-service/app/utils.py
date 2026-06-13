"""
Utility functions for AI agents
Includes error handling, retries, and logging helpers
"""

import asyncio
import google.generativeai as genai
from app.config import settings
import datetime
import app.database as database
from bson import ObjectId


async def retry_gemini_call(agent_name: str, operation_name: str, gemini_func, *args, **kwargs):
    """
    Execute a Gemini API call with retry logic and exponential backoff.
    
    Args:
        agent_name: Name of the agent calling this (for logging)
        operation_name: Name of the operation (e.g., "generate_email")
        gemini_func: The Gemini function to call
        *args, **kwargs: Arguments to pass to gemini_func
    
    Returns:
        Response from Gemini API, or None if all retries failed
    """
    for attempt in range(settings.max_gemini_retries):
        try:
            genai.configure(api_key=settings.gemini_api_key)
            response = gemini_func(*args, **kwargs)
            return response
        except Exception as e:
            if attempt < settings.max_gemini_retries - 1:
                delay = settings.gemini_retry_delay * (2 ** attempt)
                print(f"[{agent_name}] RETRY {attempt + 1}/{settings.max_gemini_retries}: {operation_name} failed: {str(e)}")
                print(f"[{agent_name}] Retrying in {delay}s...")
                await asyncio.sleep(delay)
            else:
                print(f"[{agent_name}] FAILED: {operation_name} failed after {settings.max_gemini_retries} attempts")
                print(f"[{agent_name}] Error: {str(e)}")
                return None


async def log_agent_action(user_id: str, job_id: str | None, agent_name: str, action: str, status: str, details: dict = None):
    """Log an agent action to the database."""
    try:
        log_doc = {
            "user_id": ObjectId(user_id) if user_id else None,
            "job_id": ObjectId(job_id) if job_id else None,
            "agent_name": agent_name,
            "action": action,
            "status": status,
            "details": details or {},
            "timestamp": datetime.datetime.utcnow()
        }
        await database.db.agent_logs.insert_one(log_doc)
    except Exception as e:
        print(f"[ERROR] Failed to log agent action: {str(e)}")


async def handle_gemini_error(user_id: str, job_id: str, agent_name: str, operation: str, error: Exception):
    """Handle Gemini API errors gracefully."""
    error_msg = f"{agent_name}.{operation} failed: {str(error)}"
    print(f"[ERROR] {error_msg}")
    
    await log_agent_action(
        user_id=user_id,
        job_id=job_id,
        agent_name=agent_name,
        action=operation,
        status="failed",
        details={"error": str(error), "error_type": type(error).__name__}
    )

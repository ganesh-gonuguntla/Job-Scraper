from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.database import connect_db, close_db
from app.validate_env import validate_environment, validate_mongodb_uri, validate_gemini_key
from app.routes import agent, resume, jobs, recruiter, email, apply, followup


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Validate environment on startup
    validate_environment()
    validate_mongodb_uri()
    validate_gemini_key()
    
    await connect_db()
    yield
    await close_db()


app = FastAPI(
# Initialize the FastAPI application for the AI services

    title="AI Job Application Agent",
    description="LangGraph multi-agent AI service for autonomous job applications",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {
        "success": True,
        "service": "job-agent-ai",
        "status": "healthy",
    }


app.include_router(agent.router, prefix="/agent", tags=["Agent"])
app.include_router(resume.router, prefix="/resume", tags=["Resume"])
app.include_router(jobs.router, prefix="/jobs", tags=["Jobs"])
app.include_router(recruiter.router, prefix="/recruiter", tags=["Recruiter"])
app.include_router(email.router, prefix="/email", tags=["Email"])
app.include_router(apply.router, prefix="/apply", tags=["Apply"])
app.include_router(followup.router, prefix="/followup", tags=["Follow-Up"])

from fastapi import APIRouter
from pydantic import BaseModel

from app.agents.job_search import search_jobs
from app.agents.jd_analyzer import analyze_jd
from app.agents.matching import compute_match

router = APIRouter()


class SearchRequest(BaseModel):
    user_id: str


class MatchRequest(BaseModel):
    user_id: str
    job_id: str


@router.post("/search")
async def search(body: SearchRequest):
    result = await search_jobs(body.user_id)
    return {"success": True, **result}


@router.post("/match")
async def match(body: MatchRequest):
    result = await compute_match(body.user_id, body.job_id)
    return {"success": True, **result}


@router.post("/analyze-jd")
async def analyze_job_description(job_id: str):
    result = await analyze_jd(job_id)
    return {"success": True, **result}

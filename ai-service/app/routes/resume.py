from fastapi import APIRouter
from pydantic import BaseModel

from app.agents.resume_intelligence import analyze_resume

router = APIRouter()


class AnalyzeRequest(BaseModel):
    user_id: str
    resume_id: str | None = None


@router.post("/analyze")
async def analyze(body: AnalyzeRequest):
    result = await analyze_resume(body.user_id, body.resume_id)
    return {"success": True, **result}

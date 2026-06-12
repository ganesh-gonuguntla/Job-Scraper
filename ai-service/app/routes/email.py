from fastapi import APIRouter
from pydantic import BaseModel

from app.agents.email_writer import create_email
from app.agents.resume_optimization import optimize_resume

router = APIRouter()


class EmailRequest(BaseModel):
    user_id: str
    match_id: str


class OptimizeRequest(BaseModel):
    match_id: str


@router.post("/create")
async def create(body: EmailRequest):
    result = await create_email(body.user_id, body.match_id)
    return {"success": True, **result}


@router.post("/optimize-resume")
async def optimize(body: OptimizeRequest):
    result = await optimize_resume(body.match_id)
    return {"success": True, **result}

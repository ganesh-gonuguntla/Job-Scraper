from fastapi import APIRouter
from pydantic import BaseModel

from app.agents.follow_up import run_followups

router = APIRouter()


class FollowUpRequest(BaseModel):
    user_id: str | None = None


@router.post("/run")
async def run(body: FollowUpRequest):
    result = await run_followups(body.user_id)
    return {"success": True, **result}

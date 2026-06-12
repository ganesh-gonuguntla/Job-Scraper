from fastapi import APIRouter
from pydantic import BaseModel

from app.agents.apply_sender import submit_application

router = APIRouter()


class SubmitRequest(BaseModel):
    user_id: str
    match_id: str


@router.post("/submit")
async def submit(body: SubmitRequest):
    result = await submit_application(body.user_id, body.match_id)
    return {"success": True, **result}

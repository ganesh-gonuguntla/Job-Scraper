from fastapi import APIRouter
from pydantic import BaseModel

from app.agents.recruiter_discovery import find_recruiter

router = APIRouter()


class FindRequest(BaseModel):
    job_id: str


@router.post("/find")
async def find(body: FindRequest):
    result = await find_recruiter(body.job_id)
    return {"success": True, **result}

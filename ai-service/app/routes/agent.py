from fastapi import APIRouter
from pydantic import BaseModel

from app.graph.supervisor import run_pipeline

router = APIRouter()


class RunRequest(BaseModel):
    user_id: str


@router.post("/run")
async def run_agent_pipeline(body: RunRequest):
    result = await run_pipeline(body.user_id)
    return {"success": True, **result}

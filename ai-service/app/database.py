from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

client: AsyncIOMotorClient | None = None
db = None


async def connect_db():
    global client, db
    client = AsyncIOMotorClient(settings.mongodb_uri)
    db = client["job-agent"]
    await client.admin.command("ping")
    print("AI Service: MongoDB connected")


async def close_db():
    global client
    if client:
        client.close()

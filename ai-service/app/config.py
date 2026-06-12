from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    mongodb_uri: str = "mongodb://localhost:27017/job-agent"
    gemini_api_key: str = ""
    port: int = 8000
    match_threshold: float = 40.0
    embedding_model: str = "all-MiniLM-L6-v2"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

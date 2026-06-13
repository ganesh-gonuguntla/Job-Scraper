from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    mongodb_uri: str = "mongodb://localhost:27017/job-agent"
    gemini_api_key: str = ""
    port: int = 8000
    match_threshold: float = 40.0
    # Using Gemini embeddings (768-dim) for consistency across all agents
    embedding_model: str = "models/text-embedding-004"
    embedding_dimensions: int = 768
    # Gemini API error handling
    max_gemini_retries: int = 3
    gemini_retry_delay: float = 1.0  # seconds

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

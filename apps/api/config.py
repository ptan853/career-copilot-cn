"""Career Copilot API — 配置"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Career Copilot CN API"
    debug: bool = False

    # Database
    database_url: str = "postgresql://postgres:postgres@localhost:5432/career_copilot"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Auth
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days

    # Object Storage (S3-compatible)
    s3_endpoint: str = "http://localhost:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket: str = "career-copilot"

    # AI Providers
    deepseek_api_key: str = ""
    deepseek_api_base: str = "https://api.deepseek.com"
    qwen_api_key: str = ""
    qwen_api_base: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()

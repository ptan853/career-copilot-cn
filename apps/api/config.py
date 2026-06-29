"""Career Copilot API — 配置"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Career Copilot CN API"
    debug: bool = False

    # Database
    database_url: str = "sqlite:///./career_copilot.db"

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

    # Auth feature flags
    auth_allow_dev_fallback: bool = False
    auth_dev_code_echo: bool = False
    auth_code_expire_minutes: int = 5
    auth_code_max_attempts: int = 5
    auth_code_length: int = 6

    # Google OAuth
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/auth/google/callback"

    # Web app URL (for OAuth redirects)
    web_app_url: str = "http://localhost:3000"

    # AI Providers
    deepseek_api_key: str = ""
    deepseek_api_base: str = "https://api.deepseek.com"
    qwen_api_key: str = ""
    qwen_api_base: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()

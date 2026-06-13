"""
Environment variable validation for AI Service
Ensures all required environment variables are present before app starts
"""

import os
import sys


def validate_environment():
    """Validate required environment variables."""
    required_vars = [
        "MONGODB_URI",
        "GEMINI_API_KEY",
    ]

    optional_vars = [
        "PORT",
        "MATCH_THRESHOLD",
        "EMBEDDING_MODEL",
    ]

    missing = []
    warnings = []

    for var_name in required_vars:
        if not os.getenv(var_name):
            missing.append(var_name)

    for var_name in optional_vars:
        if not os.getenv(var_name):
            warnings.append(var_name)

    if missing:
        print("❌ Missing required environment variables:")
        for var in missing:
            print(f"   - {var}")
        sys.exit(1)

    if warnings:
        print("⚠️  Missing optional environment variables (using defaults):")
        for var in warnings:
            print(f"   - {var}")

    print("✅ Environment variables validated")


def validate_mongodb_uri():
    """Validate MongoDB URI format."""
    uri = os.getenv("MONGODB_URI", "")
    if not uri.startswith("mongodb://") and not uri.startswith("mongodb+srv://"):
        print("❌ Invalid MONGODB_URI format. Must start with mongodb:// or mongodb+srv://")
        sys.exit(1)

    node_env = os.getenv("NODE_ENV", "development")
    if "localhost" in uri and node_env == "production":
        print("❌ Cannot use localhost MongoDB in production")
        sys.exit(1)

    print("✅ MongoDB URI format validated")


def validate_gemini_key():
    """Validate Gemini API key."""
    key = os.getenv("GEMINI_API_KEY", "")
    if not key:
        print("⚠️  WARNING: GEMINI_API_KEY is not set. AI agents will fail.")
        print("   Set GEMINI_API_KEY environment variable to use Gemini API.")

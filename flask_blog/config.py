"""
config.py — Environment-specific configuration classes (Week 1 & Week 7).

Keeps sensitive settings in environment variables while providing safe
defaults for local development and isolated in-memory databases for testing.
"""

import os
from datetime import timedelta

basedir = os.path.abspath(os.path.dirname(__file__))


class Config:
    """Base configuration shared across all environments."""

    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-insecure-fallback-change-me")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    POSTS_PER_PAGE = int(os.environ.get("POSTS_PER_PAGE", 6))
    REMEMBER_COOKIE_DURATION = timedelta(days=14)
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    WTF_CSRF_ENABLED = True


class DevelopmentConfig(Config):
    """Local development settings with SQLite database and debug mode."""

    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL",
        f"sqlite:///{os.path.join(basedir, 'instance', 'blog.db')}",
    )


class TestingConfig(Config):
    """Automated Pytest settings using fast in-memory SQLite."""

    TESTING = True
    WTF_CSRF_ENABLED = False
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"


class ProductionConfig(Config):
    """Hardened production configuration for Gunicorn and Docker."""

    DEBUG = False
    SESSION_COOKIE_SECURE = os.environ.get("SESSION_COOKIE_SECURE", "false").lower() == "true"
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL",
        f"sqlite:///{os.path.join(basedir, 'instance', 'blog.db')}",
    )

    @classmethod
    def init_app(cls, app):
        # Ensure a real secret key is provided in production
        if app.config["SECRET_KEY"] == "dev-insecure-fallback-change-me":
            raise RuntimeError("SECRET_KEY environment variable must be set in production.")


config = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
    "default": DevelopmentConfig,
}

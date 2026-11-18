"""
app/__init__.py — Flask Application Factory Pattern (Week 1).

Initializes extensions, creates instance directory for SQLite,
and registers modular Blueprints (main, auth, posts, comments, errors).
"""

import os
from flask import Flask

from config import config
from app.extensions import csrf, db, login_manager, migrate


def create_app(config_name: str | None = None) -> Flask:
    """Create and configure a Flask application instance."""
    if config_name is None:
        config_name = os.environ.get("FLASK_CONFIG", "default")

    app = Flask(__name__, instance_relative_config=True)
    cfg_class = config[config_name]
    app.config.from_object(cfg_class)

    if hasattr(cfg_class, "init_app"):
        cfg_class.init_app(app)

    # Ensure instance/ folder exists for local SQLite storage
    os.makedirs(app.instance_path, exist_ok=True)

    # Initialize Flask extensions
    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)
    csrf.init_app(app)

    # Register Blueprints
    from app.main import main_bp
    from app.auth import auth_bp
    from app.posts import posts_bp
    from app.comments import comments_bp
    from app.errors import errors_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(posts_bp, url_prefix="/posts")
    app.register_blueprint(comments_bp, url_prefix="/comments")
    app.register_blueprint(errors_bp)

    # Import models so Flask-Migrate discovers all tables
    from app import models  # noqa: F401

    return app

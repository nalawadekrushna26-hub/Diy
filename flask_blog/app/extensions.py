"""
app/extensions.py — Centralized Flask extension instances (Week 1).

Extensions are instantiated here without an app object and bound later
inside create_app() to avoid circular imports.
"""

from flask_login import LoginManager
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from flask_wtf.csrf import CSRFProtect

db = SQLAlchemy()
migrate = Migrate()
login_manager = LoginManager()
csrf = CSRFProtect()

# Redirect anonymous users to the login route when accessing protected pages
login_manager.login_view = "auth.login"
login_manager.login_message = "Please sign in to access this page."
login_manager.login_message_category = "warning"

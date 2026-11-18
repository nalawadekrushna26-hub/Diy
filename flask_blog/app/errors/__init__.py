"""app/errors/__init__.py — Error Handlers Blueprint."""

from flask import Blueprint

errors_bp = Blueprint("errors", __name__)

from app.errors import handlers  # noqa: E402, F401

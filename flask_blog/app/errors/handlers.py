"""
app/errors/handlers.py — Custom HTTP Error Pages (403, 404, 500).
"""

from flask import render_template

from app.errors import errors_bp
from app.extensions import db


@errors_bp.app_errorhandler(403)
def forbidden_error(error):
    return render_template("errors/403.html", title="Access Denied"), 403


@errors_bp.app_errorhandler(404)
def not_found_error(error):
    return render_template("errors/404.html", title="Page Not Found"), 404


@errors_bp.app_errorhandler(500)
def internal_error(error):
    db.session.rollback()
    return render_template("errors/500.html", title="Server Error"), 500

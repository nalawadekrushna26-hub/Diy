"""
wsgi.py — Production WSGI Entry Point for Gunicorn (Week 7).

Run locally with Gunicorn:
  gunicorn --workers 4 --bind 0.0.0.0:8000 wsgi:app
"""

import os
from dotenv import load_dotenv

load_dotenv()

from app import create_app  # noqa: E402
from app.extensions import db  # noqa: E402

app = create_app(os.environ.get("FLASK_CONFIG", "production"))

with app.app_context():
    db.create_all()

"""
tests/conftest.py — Pytest Fixtures for Isolated Flask Testing (Week 7).
"""

import pytest

from app import create_app
from app.extensions import db as _db
from app.models import Category, User


@pytest.fixture
def app():
    """Create a fresh Flask app configured for in-memory SQLite testing."""
    app = create_app("testing")
    with app.app_context():
        _db.create_all()
        category = Category(name="Engineering", slug="engineering")
        _db.session.add(category)
        _db.session.commit()
        yield app
        _db.session.remove()
        _db.drop_all()


@pytest.fixture
def client(app):
    """Flask test client for sending HTTP requests."""
    return app.test_client()


@pytest.fixture
def create_user(app):
    """Helper factory fixture to create persisted test users."""
    def _make_user(username="alice", email="alice@example.com", password="Password123!"):
        user = User(username=username, email=email)
        user.set_password(password)
        _db.session.add(user)
        _db.session.commit()
        return user
    return _make_user


@pytest.fixture
def auth_client(client, create_user):
    """Test client already signed in as 'alice'."""
    user = create_user()
    client.post(
        "/auth/login",
        data={"email": user.email, "password": "Password123!"},
        follow_redirects=True,
    )
    return client, user

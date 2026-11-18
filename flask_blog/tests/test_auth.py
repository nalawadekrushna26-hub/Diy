"""
tests/test_auth.py — Unit & Integration Tests for Authentication (Week 7).
"""

from app.models import User


def test_user_password_hashing():
    user = User(username="tester", email="tester@example.com")
    user.set_password("SecretPass99")
    assert user.password_hash != "SecretPass99"
    assert user.check_password("SecretPass99") is True
    assert user.check_password("WrongPass") is False


def test_registration_and_login_flow(client, app):
    res = client.post(
        "/auth/register",
        data={
            "username": "bob_writer",
            "email": "bob@example.com",
            "password": "Password123!",
            "confirm_password": "Password123!",
        },
        follow_redirects=True,
    )
    assert res.status_code == 200
    assert b"Your account has been created" in res.data

    with app.app_context():
        user = User.query.filter_by(email="bob@example.com").first()
        assert user is not None
        assert user.username == "bob_writer"

    login_res = client.post(
        "/auth/login",
        data={"email": "bob@example.com", "password": "Password123!"},
        follow_redirects=True,
    )
    assert login_res.status_code == 200
    assert b"Welcome back, bob_writer" in login_res.data


def test_logout_and_protected_route(auth_client):
    client, _ = auth_client

    logout_res = client.post("/auth/logout", follow_redirects=True)
    assert logout_res.status_code == 200
    assert b"You have been signed out" in logout_res.data

    protected_res = client.get("/auth/profile", follow_redirects=True)
    assert b"Please sign in to access this page" in protected_res.data


def test_profile_update(auth_client, app):
    client, user = auth_client
    res = client.post(
        "/auth/profile",
        data={
            "username": "alice_updated",
            "email": user.email,
            "bio": "Backend engineer exploring Flask.",
        },
        follow_redirects=True,
    )
    assert res.status_code == 200
    assert b"Profile updated successfully" in res.data

    with app.app_context():
        refreshed = User.query.get(user.id)
        assert refreshed.username == "alice_updated"
        assert "Flask" in refreshed.bio

"""
tests/test_posts.py — Post CRUD, Relationships, and Authorization Tests (Week 7).
"""

from app.extensions import db
from app.models import Category, Post


def test_create_read_update_delete_post(auth_client, app):
    client, _ = auth_client

    with app.app_context():
        cat = Category.query.first()
        cat_id = cat.id

    # Create
    create_res = client.post(
        "/posts/create",
        data={
            "title": "Understanding Flask Blueprints",
            "summary": "Modular routing in Flask.",
            "category_id": cat_id,
            "tags_input": "flask, architecture",
            "content": "<p>Blueprints let you organize large Flask applications cleanly.</p>",
        },
        follow_redirects=True,
    )
    assert create_res.status_code == 200
    assert b"Understanding Flask Blueprints" in create_res.data

    with app.app_context():
        post = Post.query.filter_by(title="Understanding Flask Blueprints").first()
        assert post is not None
        assert len(post.tags) == 2
        post_id = post.id

    # Update
    edit_res = client.post(
        f"/posts/{post_id}/edit",
        data={
            "title": "Understanding Flask Blueprints Revised",
            "summary": "Updated summary.",
            "category_id": cat_id,
            "tags_input": "flask",
            "content": "<p>Revised content with at least twenty characters.</p>",
        },
        follow_redirects=True,
    )
    assert edit_res.status_code == 200
    assert b"Understanding Flask Blueprints Revised" in edit_res.data

    # Delete
    del_res = client.post(f"/posts/{post_id}/delete", follow_redirects=True)
    assert del_res.status_code == 200
    assert b"Your post has been deleted" in del_res.data

    with app.app_context():
        assert db.session.get(Post, post_id) is None


def test_unauthorized_user_cannot_edit_or_delete_other_post(client, create_user, app):
    author = create_user(username="author1", email="author1@example.com")
    other = create_user(username="other2", email="other2@example.com")

    with app.app_context():
        cat = Category.query.first()
        post = Post(
            title="Protected Post",
            content="<p>Only author1 owns this article.</p>",
            user_id=author.id,
            category_id=cat.id,
        )
        db.session.add(post)
        db.session.commit()
        post_id = post.id

    client.post("/auth/login", data={"email": other.email, "password": "Password123!"})
    edit_res = client.get(f"/posts/{post_id}/edit")
    delete_res = client.post(f"/posts/{post_id}/delete")

    assert edit_res.status_code == 403
    assert delete_res.status_code == 403

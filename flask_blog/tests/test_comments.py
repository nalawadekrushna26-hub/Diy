"""
tests/test_comments.py — Comment Creation, Validation, Editing, and Deletion Tests (Week 7).
"""

from app.extensions import db
from app.models import Category, Comment, Post


def test_comment_lifecycle_and_validation(auth_client, app):
    client, user = auth_client

    with app.app_context():
        cat = Category.query.first()
        post = Post(
            title="Article for Comments",
            content="<p>Testing comment creation and editing.</p>",
            user_id=user.id,
            category_id=cat.id,
        )
        db.session.add(post)
        db.session.commit()
        post_id = post.id

    # Validation: empty comment rejected
    empty_res = client.post(f"/comments/post/{post_id}/add", data={"body": ""}, follow_redirects=True)
    assert b"Comment cannot be empty" in empty_res.data

    # Create valid comment
    add_res = client.post(
        f"/comments/post/{post_id}/add",
        data={"body": "Very clear walkthrough of Flask-WTF!"},
        follow_redirects=True,
    )
    assert add_res.status_code == 200
    assert b"Very clear walkthrough" in add_res.data

    with app.app_context():
        comment = Comment.query.filter_by(post_id=post_id).first()
        assert comment is not None
        comment_id = comment.id

    # Edit comment
    edit_res = client.post(
        f"/comments/{comment_id}/edit",
        data={"body": "Updated thoughtful response."},
        follow_redirects=True,
    )
    assert edit_res.status_code == 200
    assert b"Updated thoughtful response." in edit_res.data

    # Delete comment
    del_res = client.post(f"/comments/{comment_id}/delete", follow_redirects=True)
    assert del_res.status_code == 200
    assert b"Comment deleted." in del_res.data


def test_other_user_cannot_delete_comment(client, create_user, app):
    owner = create_user(username="comment_owner", email="owner@example.com")
    stranger = create_user(username="stranger", email="stranger@example.com")

    with app.app_context():
        cat = Category.query.first()
        post = Post(title="Post", content="<p>Body text over twenty chars.</p>", user_id=owner.id, category_id=cat.id)
        db.session.add(post)
        db.session.commit()
        comment = Comment(body="Original comment", user_id=owner.id, post_id=post.id)
        db.session.add(comment)
        db.session.commit()
        comment_id = comment.id

    client.post("/auth/login", data={"email": stranger.email, "password": "Password123!"})
    res = client.post(f"/comments/{comment_id}/delete")
    assert res.status_code == 403

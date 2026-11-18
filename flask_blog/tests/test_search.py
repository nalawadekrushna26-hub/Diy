"""
tests/test_search.py — Search, Filtering, Pagination, and Empty Result Tests (Week 7).
"""

from app.extensions import db
from app.models import Category, Post, Tag


def test_search_filtering_and_empty_results(client, create_user, app):
    author = create_user()

    with app.app_context():
        eng = Category.query.filter_by(slug="engineering").first()
        design = Category(name="Design", slug="design")
        tag_sql = Tag(name="sqlalchemy")
        db.session.add_all([design, tag_sql])
        db.session.commit()

        p1 = Post(
            title="Mastering SQLAlchemy Queries",
            content="<p>Deep dive into joins and eager loading.</p>",
            user_id=author.id,
            category_id=eng.id,
            tags=[tag_sql],
        )
        p2 = Post(
            title="Typography on the Web",
            content="<p>Choosing readable serif fonts for essays.</p>",
            user_id=author.id,
            category_id=design.id,
        )
        db.session.add_all([p1, p2])
        db.session.commit()

    # Search by keyword
    res_q = client.get("/search?q=SQLAlchemy")
    assert res_q.status_code == 200
    assert b"Mastering SQLAlchemy Queries" in res_q.data
    assert b"Typography on the Web" not in res_q.data

    # Filter by category
    res_cat = client.get("/?category=design")
    assert res_cat.status_code == 200
    assert b"Typography on the Web" in res_cat.data
    assert b"Mastering SQLAlchemy Queries" not in res_cat.data

    # Filter by tag
    res_tag = client.get("/?tag=sqlalchemy")
    assert res_tag.status_code == 200
    assert b"Mastering SQLAlchemy Queries" in res_tag.data

    # Empty search result handling
    res_empty = client.get("/search?q=nonexistent_keyword_xyz")
    assert res_empty.status_code == 200
    assert b"No matching posts found" in res_empty.data

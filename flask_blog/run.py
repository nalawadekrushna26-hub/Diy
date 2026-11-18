"""
run.py — Local Development Entry Point & CLI Helpers (Week 1).

Usage:
  python run.py          # Starts Flask dev server on http://127.0.0.1:5000
  flask seed-db          # Seeds sample categories, demo author, and starter posts
"""

import os
from dotenv import load_dotenv

load_dotenv()

from app import create_app  # noqa: E402
from app.extensions import db  # noqa: E402
from app.models import Category, Comment, Post, Tag, User  # noqa: E402

app = create_app(os.environ.get("FLASK_CONFIG", "development"))


@app.cli.command("seed-db")
def seed_db():
    """Populate initial categories and sample editorial content."""
    db.create_all()

    default_categories = [
        ("Engineering", "engineering"),
        ("Architecture", "architecture"),
        ("Design", "design"),
        ("Databases", "databases"),
        ("DevOps", "devops"),
    ]
    for name, slug in default_categories:
        if not Category.query.filter_by(slug=slug).first():
            db.session.add(Category(name=name, slug=slug))
    db.session.commit()

    if not User.query.filter_by(email="editor@inkwell.dev").first():
        author = User(
            username="elena_vance",
            email="editor@inkwell.dev",
            bio="Python web architect and technical essayist.",
        )
        author.set_password("StrongPass123!")
        db.session.add(author)
        db.session.commit()

        eng = Category.query.filter_by(slug="architecture").first()
        tag_flask = Tag(name="flask")
        tag_patterns = Tag(name="patterns")
        db.session.add_all([tag_flask, tag_patterns])

        sample_post = Post(
            title="Designing Maintainable Flask Apps with the Application Factory",
            summary="Why deferring extension initialization and separating Blueprints keeps medium-to-large Flask apps clean.",
            content=(
                "<p>When a Flask project grows past a single file, circular imports quickly become the primary source "
                "of friction. Using the <strong>Application Factory Pattern</strong> resolves this cleanly by creating "
                "extension instances once and binding them inside <code>create_app()</code>.</p>"
                "<h3>Key Architectural Benefits</h3>"
                "<ul><li>Clean separation between configuration, models, and Blueprints.</li>"
                "<li>Effortless isolated testing with an in-memory SQLite database.</li>"
                "<li>Predictable WSGI initialization for Gunicorn in production.</li></ul>"
            ),
            author=author,
            category=eng,
            tags=[tag_flask, tag_patterns],
        )
        db.session.add(sample_post)
        db.session.commit()

        sample_comment = Comment(
            body="Splitting extensions into app/extensions.py made our Blueprint imports completely clean.",
            author=author,
            post=sample_post,
        )
        db.session.add(sample_comment)
        db.session.commit()

    print("Database seeded successfully.")


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5000)

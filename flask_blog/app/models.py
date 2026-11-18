"""
app/models.py — SQLAlchemy ORM Database Models (Weeks 2, 3, and 5).

Models:
  - User: Registered blog authors and readers (with Werkzeug password hashing).
  - Category: Primary editorial bucket for organizing posts (1-to-Many with Post).
  - Tag: Flexible topic keywords (Many-to-Many with Post via post_tags).
  - Post: Blog articles authored by Users, linked to Category, Tags, and Comments.
  - Comment: Reader discussions linked to both User and Post.
"""

from datetime import datetime, timezone
from flask_login import UserMixin
from werkzeug.security import check_password_hash, generate_password_hash

from app.extensions import db, login_manager


def utc_now():
    """Return current UTC timestamp."""
    return datetime.now(timezone.utc)


# Association table for Many-to-Many relationship between Post and Tag
post_tags = db.Table(
    "post_tags",
    db.Column("post_id", db.Integer, db.ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True),
    db.Column("tag_id", db.Integer, db.ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class User(UserMixin, db.Model):
    """Registered user model compatible with Flask-Login."""

    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(40), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    bio = db.Column(db.String(300), default="", nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    posts = db.relationship("Post", back_populates="author", cascade="all, delete-orphan", lazy="dynamic")
    comments = db.relationship("Comment", back_populates="author", cascade="all, delete-orphan", lazy="dynamic")

    def set_password(self, raw_password: str) -> None:
        """Hash and store password securely using Werkzeug."""
        self.password_hash = generate_password_hash(raw_password)

    def check_password(self, raw_password: str) -> bool:
        """Verify raw password against stored hash."""
        return check_password_hash(self.password_hash, raw_password)

    def __repr__(self) -> str:
        return f"<User {self.username}>"


@login_manager.user_loader
def load_user(user_id: str):
    """Flask-Login callback to reload a user from the session ID."""
    return db.session.get(User, int(user_id))


class Category(db.Model):
    """Blog post category model (Week 3)."""

    __tablename__ = "categories"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False, index=True)
    slug = db.Column(db.String(60), unique=True, nullable=False, index=True)

    posts = db.relationship("Post", back_populates="category", lazy="dynamic")

    def __repr__(self) -> str:
        return f"<Category {self.name}>"


class Tag(db.Model):
    """Blog post tag model (Week 3)."""

    __tablename__ = "tags"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(40), unique=True, nullable=False, index=True)

    posts = db.relationship("Post", secondary=post_tags, back_populates="tags")

    def __repr__(self) -> str:
        return f"<Tag {self.name}>"


class Post(db.Model):
    """Blog post model (Week 3)."""

    __tablename__ = "posts"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(160), nullable=False, index=True)
    summary = db.Column(db.String(280), default="", nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=utc_now, nullable=False, index=True)
    updated_at = db.Column(db.DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    # Foreign Keys
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True)

    # Relationships
    author = db.relationship("User", back_populates="posts")
    category = db.relationship("Category", back_populates="posts")
    tags = db.relationship("Tag", secondary=post_tags, back_populates="posts")
    comments = db.relationship(
        "Comment",
        back_populates="post",
        cascade="all, delete-orphan",
        order_by="Comment.created_at.desc()",
    )

    @property
    def reading_minutes(self) -> int:
        """Estimate reading time from plain word count."""
        word_count = len((self.content or "").split())
        return max(1, round(word_count / 200))

    def __repr__(self) -> str:
        return f"<Post {self.id}: {self.title}>"


class Comment(db.Model):
    """User comment model connected to both User and Post (Week 5)."""

    __tablename__ = "comments"

    id = db.Column(db.Integer, primary_key=True)
    body = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=utc_now, nullable=False, index=True)
    updated_at = db.Column(db.DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    # Foreign Keys
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    post_id = db.Column(db.Integer, db.ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)

    # Relationships
    author = db.relationship("User", back_populates="comments")
    post = db.relationship("Post", back_populates="comments")

    def __repr__(self) -> str:
        return f"<Comment {self.id} by user={self.user_id}>"

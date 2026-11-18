"""
app/main/routes.py — Home Page, Pagination, Search, and Filtering (Weeks 4 & 6).
"""

from flask import current_app, render_template, request
from sqlalchemy import or_

from app.main import main_bp
from app.models import Category, Post, Tag


@main_bp.route("/")
def index():
    """Render paginated home page with optional category and tag filters."""
    page = request.args.get("page", 1, type=int)
    category_slug = request.args.get("category", "").strip()
    tag_name = request.args.get("tag", "").strip()

    query = Post.query
    active_category = None
    active_tag = None

    if category_slug:
        active_category = Category.query.filter_by(slug=category_slug).first()
        if active_category:
            query = query.filter(Post.category_id == active_category.id)
        else:
            query = query.filter(Post.id == -1)

    if tag_name:
        active_tag = Tag.query.filter(Tag.name.ilike(tag_name)).first()
        if active_tag:
            query = query.filter(Post.tags.any(Tag.id == active_tag.id))
        else:
            query = query.filter(Post.id == -1)

    per_page = current_app.config.get("POSTS_PER_PAGE", 6)
    posts = query.order_by(Post.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)

    categories = Category.query.order_by(Category.name.asc()).all()
    tags = Tag.query.order_by(Tag.name.asc()).all()

    return render_template(
        "main/index.html",
        title="Home",
        posts=posts,
        categories=categories,
        tags=tags,
        active_category=active_category,
        active_tag=active_tag,
    )


@main_bp.route("/search")
def search():
    """Search posts by title or content with category/tag filtering and pagination."""
    q = request.args.get("q", "").strip()
    category_slug = request.args.get("category", "").strip()
    tag_name = request.args.get("tag", "").strip()
    page = request.args.get("page", 1, type=int)

    query = Post.query

    if q:
        pattern = f"%{q}%"
        query = query.filter(or_(Post.title.ilike(pattern), Post.content.ilike(pattern), Post.summary.ilike(pattern)))

    active_category = None
    if category_slug:
        active_category = Category.query.filter_by(slug=category_slug).first()
        if active_category:
            query = query.filter(Post.category_id == active_category.id)
        else:
            query = query.filter(Post.id == -1)

    active_tag = None
    if tag_name:
        active_tag = Tag.query.filter(Tag.name.ilike(tag_name)).first()
        if active_tag:
            query = query.filter(Post.tags.any(Tag.id == active_tag.id))
        else:
            query = query.filter(Post.id == -1)

    per_page = current_app.config.get("POSTS_PER_PAGE", 6)
    posts = query.order_by(Post.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)

    categories = Category.query.order_by(Category.name.asc()).all()

    return render_template(
        "main/search.html",
        title=f"Search: {q}" if q else "Search Articles",
        q=q,
        posts=posts,
        categories=categories,
        active_category=active_category,
        active_tag=active_tag,
    )

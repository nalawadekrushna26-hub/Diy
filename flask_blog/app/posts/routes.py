"""
app/posts/routes.py — Blog Post CRUD Routes & Rich Text Sanitization (Weeks 3 & 5).
"""

import bleach
from flask import abort, flash, redirect, render_template, request, url_for
from flask_login import current_user, login_required

from app.comments.forms import CommentForm
from app.extensions import db
from app.models import Category, Post, Tag
from app.posts import posts_bp
from app.posts.forms import PostForm

ALLOWED_TAGS = [
    "p", "br", "strong", "em", "u", "s", "h2", "h3", "h4",
    "blockquote", "ul", "ol", "li", "pre", "code", "a", "hr",
]
ALLOWED_ATTRIBUTES = {"a": ["href", "title", "rel", "target"]}


def sanitize_html(raw_html: str) -> str:
    """Clean rich-text HTML submitted by CKEditor to prevent XSS."""
    return bleach.clean(raw_html or "", tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRIBUTES, strip=True)


def parse_tags(raw_tags: str) -> list[Tag]:
    """Convert comma-separated tag names into deduplicated Tag model instances."""
    tag_objects = []
    seen = set()
    for chunk in (raw_tags or "").split(","):
        name = chunk.strip().lower()
        if not name or name in seen:
            continue
        seen.add(name)
        tag = Tag.query.filter(Tag.name.ilike(name)).first()
        if not tag:
            tag = Tag(name=name[:40])
            db.session.add(tag)
        tag_objects.append(tag)
    return tag_objects


def populate_category_choices(form: PostForm) -> None:
    """Load categories into the WTForms SelectField."""
    categories = Category.query.order_by(Category.name.asc()).all()
    if not categories:
        default_cat = Category(name="General", slug="general")
        db.session.add(default_cat)
        db.session.commit()
        categories = [default_cat]
    form.category_id.choices = [(c.id, c.name) for c in categories]


@posts_bp.route("/create", methods=["GET", "POST"])
@login_required
def create_post():
    """Create a new blog post (authenticated users only)."""
    form = PostForm()
    populate_category_choices(form)

    if form.validate_on_submit():
        post = Post(
            title=form.title.data.strip(),
            summary=(form.summary.data or "").strip(),
            content=sanitize_html(form.content.data),
            category_id=form.category_id.data,
            author=current_user,
        )
        post.tags = parse_tags(form.tags_input.data)
        db.session.add(post)
        db.session.commit()
        flash("Your post has been published.", "success")
        return redirect(url_for("posts.post_detail", post_id=post.id))

    return render_template("posts/create_post.html", title="Write New Post", form=form, is_edit=False)


@posts_bp.route("/<int:post_id>")
def post_detail(post_id: int):
    """Display an individual blog post along with its comments and comment form."""
    post = Post.query.get_or_404(post_id)
    comment_form = CommentForm()
    return render_template(
        "posts/post_detail.html",
        title=post.title,
        post=post,
        comment_form=comment_form,
    )


@posts_bp.route("/<int:post_id>/edit", methods=["GET", "POST"])
@login_required
def edit_post(post_id: int):
    """Update an existing post (strictly limited to the post's author)."""
    post = Post.query.get_or_404(post_id)
    if post.user_id != current_user.id:
        abort(403)

    form = PostForm()
    populate_category_choices(form)

    if form.validate_on_submit():
        post.title = form.title.data.strip()
        post.summary = (form.summary.data or "").strip()
        post.content = sanitize_html(form.content.data)
        post.category_id = form.category_id.data
        post.tags = parse_tags(form.tags_input.data)
        db.session.commit()
        flash("Post updated successfully.", "success")
        return redirect(url_for("posts.post_detail", post_id=post.id))

    if request.method == "GET":
        form.title.data = post.title
        form.summary.data = post.summary
        form.category_id.data = post.category_id
        form.tags_input.data = ", ".join(tag.name for tag in post.tags)
        form.content.data = post.content

    return render_template("posts/create_post.html", title="Edit Post", form=form, post=post, is_edit=True)


@posts_bp.route("/<int:post_id>/delete", methods=["POST"])
@login_required
def delete_post(post_id: int):
    """Delete an existing post (strictly limited to the post's author)."""
    post = Post.query.get_or_404(post_id)
    if post.user_id != current_user.id:
        abort(403)

    db.session.delete(post)
    db.session.commit()
    flash("Your post has been deleted.", "info")
    return redirect(url_for("main.index"))

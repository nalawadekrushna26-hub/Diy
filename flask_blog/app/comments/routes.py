"""
app/comments/routes.py — Comment Creation, Editing, and Deletion (Week 5).
"""

from flask import abort, flash, redirect, render_template, request, url_for
from flask_login import current_user, login_required

from app.comments import comments_bp
from app.comments.forms import CommentForm
from app.extensions import db
from app.models import Comment, Post


@comments_bp.route("/post/<int:post_id>/add", methods=["POST"])
@login_required
def add_comment(post_id: int):
    """Add a validated comment to a specific blog post."""
    post = Post.query.get_or_404(post_id)
    form = CommentForm()

    if form.validate_on_submit():
        comment = Comment(
            body=form.body.data.strip(),
            author=current_user,
            post=post,
        )
        db.session.add(comment)
        db.session.commit()
        flash("Your comment has been added.", "success")
    else:
        for errors in form.errors.values():
            for err in errors:
                flash(err, "danger")

    return redirect(url_for("posts.post_detail", post_id=post.id) + "#comments")


@comments_bp.route("/<int:comment_id>/edit", methods=["GET", "POST"])
@login_required
def edit_comment(comment_id: int):
    """Edit an existing comment (strictly limited to comment author)."""
    comment = Comment.query.get_or_404(comment_id)
    if comment.user_id != current_user.id:
        abort(403)

    form = CommentForm()
    if form.validate_on_submit():
        comment.body = form.body.data.strip()
        db.session.commit()
        flash("Comment updated.", "success")
        return redirect(url_for("posts.post_detail", post_id=comment.post_id) + "#comments")

    if request.method == "GET":
        form.body.data = comment.body

    return render_template("comments/edit_comment.html", title="Edit Comment", form=form, comment=comment)


@comments_bp.route("/<int:comment_id>/delete", methods=["POST"])
@login_required
def delete_comment(comment_id: int):
    """Delete a comment (strictly limited to comment author)."""
    comment = Comment.query.get_or_404(comment_id)
    if comment.user_id != current_user.id:
        abort(403)

    post_id = comment.post_id
    db.session.delete(comment)
    db.session.commit()
    flash("Comment deleted.", "info")
    return redirect(url_for("posts.post_detail", post_id=post_id) + "#comments")

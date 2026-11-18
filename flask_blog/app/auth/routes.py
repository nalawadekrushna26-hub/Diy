"""
app/auth/routes.py — Authentication & User Profile Routes (Weeks 2 & 4).
"""

from urllib.parse import urlparse

from flask import flash, redirect, render_template, request, url_for
from flask_login import current_user, login_required, login_user, logout_user

from app.auth import auth_bp
from app.auth.forms import LoginForm, RegistrationForm, UpdateProfileForm
from app.extensions import db
from app.models import Post, User


@auth_bp.route("/register", methods=["GET", "POST"])
def register():
    """Register a new user account with hashed password."""
    if current_user.is_authenticated:
        return redirect(url_for("main.index"))

    form = RegistrationForm()
    if form.validate_on_submit():
        user = User(
            username=form.username.data.strip(),
            email=form.email.data.strip().lower(),
        )
        user.set_password(form.password.data)
        db.session.add(user)
        db.session.commit()
        flash("Your account has been created. You can now sign in.", "success")
        return redirect(url_for("auth.login"))

    return render_template("auth/register.html", title="Create Account", form=form)


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    """Authenticate user and establish a Flask-Login session."""
    if current_user.is_authenticated:
        return redirect(url_for("main.index"))

    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data.strip().lower()).first()
        if user and user.check_password(form.password.data):
            login_user(user, remember=form.remember_me.data)
            flash(f"Welcome back, {user.username}.", "success")

            # Safely honor ?next= redirect only if it stays on the same host
            next_page = request.args.get("next")
            if next_page and urlparse(next_page).netloc == "":
                return redirect(next_page)
            return redirect(url_for("main.index"))

        flash("Invalid email or password. Please try again.", "danger")

    return render_template("auth/login.html", title="Sign In", form=form)


@auth_bp.route("/logout", methods=["POST"])
@login_required
def logout():
    """End the active user session safely via POST."""
    logout_user()
    flash("You have been signed out.", "info")
    return redirect(url_for("main.index"))


@auth_bp.route("/profile", methods=["GET", "POST"])
@login_required
def profile():
    """View and update the current user's profile and authored posts."""
    form = UpdateProfileForm()
    if form.validate_on_submit():
        current_user.username = form.username.data.strip()
        current_user.email = form.email.data.strip().lower()
        current_user.bio = (form.bio.data or "").strip()
        db.session.commit()
        flash("Profile updated successfully.", "success")
        return redirect(url_for("auth.profile"))

    if request.method == "GET":
        form.username.data = current_user.username
        form.email.data = current_user.email
        form.bio.data = current_user.bio

    page = request.args.get("page", 1, type=int)
    posts = (
        Post.query.filter_by(user_id=current_user.id)
        .order_by(Post.created_at.desc())
        .paginate(page=page, per_page=6, error_out=False)
    )
    return render_template(
        "auth/profile.html",
        title="My Profile",
        profile_user=current_user,
        form=form,
        posts=posts,
        is_owner=True,
    )


@auth_bp.route("/user/<string:username>")
def user_profile(username: str):
    """Public profile page displaying any author's bio and published articles."""
    user = User.query.filter_by(username=username).first_or_404()
    page = request.args.get("page", 1, type=int)
    posts = (
        Post.query.filter_by(user_id=user.id)
        .order_by(Post.created_at.desc())
        .paginate(page=page, per_page=6, error_out=False)
    )
    return render_template(
        "auth/profile.html",
        title=f"{user.username} — Author Profile",
        profile_user=user,
        form=None,
        posts=posts,
        is_owner=current_user.is_authenticated and current_user.id == user.id,
    )

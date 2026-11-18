"""
app/auth/forms.py — Flask-WTF Forms for Authentication & Profiles (Week 2).
"""

from flask_login import current_user
from flask_wtf import FlaskForm
from wtforms import BooleanField, PasswordField, StringField, SubmitField, TextAreaField
from wtforms.validators import DataRequired, Email, EqualTo, Length, ValidationError

from app.models import User


class RegistrationForm(FlaskForm):
    """Form for registering a new user account."""

    username = StringField(
        "Username",
        validators=[DataRequired(), Length(min=3, max=40)],
    )
    email = StringField(
        "Email",
        validators=[DataRequired(), Email(), Length(max=120)],
    )
    password = PasswordField(
        "Password",
        validators=[DataRequired(), Length(min=8, message="Password must be at least 8 characters.")],
    )
    confirm_password = PasswordField(
        "Confirm Password",
        validators=[DataRequired(), EqualTo("password", message="Passwords must match.")],
    )
    submit = SubmitField("Create Account")

    def validate_username(self, field):
        if User.query.filter_by(username=field.data.strip()).first():
            raise ValidationError("That username is already taken. Please choose another.")

    def validate_email(self, field):
        if User.query.filter_by(email=field.data.strip().lower()).first():
            raise ValidationError("An account with this email already exists.")


class LoginForm(FlaskForm):
    """Form for authenticating an existing user."""

    email = StringField("Email", validators=[DataRequired(), Email()])
    password = PasswordField("Password", validators=[DataRequired()])
    remember_me = BooleanField("Remember Me")
    submit = SubmitField("Sign In")


class UpdateProfileForm(FlaskForm):
    """Form allowing signed-in users to update their username, email, and bio."""

    username = StringField("Username", validators=[DataRequired(), Length(min=3, max=40)])
    email = StringField("Email", validators=[DataRequired(), Email(), Length(max=120)])
    bio = TextAreaField("Short Bio", validators=[Length(max=300)])
    submit = SubmitField("Save Profile")

    def validate_username(self, field):
        cleaned = field.data.strip()
        if cleaned != current_user.username and User.query.filter_by(username=cleaned).first():
            raise ValidationError("That username is already taken.")

    def validate_email(self, field):
        cleaned = field.data.strip().lower()
        if cleaned != current_user.email and User.query.filter_by(email=cleaned).first():
            raise ValidationError("That email is already registered.")

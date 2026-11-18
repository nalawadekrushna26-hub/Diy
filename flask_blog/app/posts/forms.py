"""
app/posts/forms.py — Flask-WTF Forms for Blog Posts (Week 3).
"""

from flask_wtf import FlaskForm
from wtforms import SelectField, StringField, SubmitField, TextAreaField
from wtforms.validators import DataRequired, Length


class PostForm(FlaskForm):
    """Form for creating and editing a blog post with rich text content."""

    title = StringField(
        "Title",
        validators=[DataRequired(), Length(min=4, max=160)],
    )
    summary = StringField(
        "Summary",
        validators=[Length(max=280)],
    )
    category_id = SelectField(
        "Category",
        coerce=int,
        validators=[DataRequired()],
    )
    tags_input = StringField(
        "Tags (comma-separated)",
        validators=[Length(max=200)],
    )
    content = TextAreaField(
        "Content",
        validators=[DataRequired(), Length(min=20, message="Post content must be at least 20 characters.")],
    )
    submit = SubmitField("Publish Post")

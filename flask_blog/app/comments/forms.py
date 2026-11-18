"""
app/comments/forms.py — Flask-WTF Form for Comments (Week 5).
"""

from flask_wtf import FlaskForm
from wtforms import SubmitField, TextAreaField
from wtforms.validators import DataRequired, Length


class CommentForm(FlaskForm):
    """Form for creating and editing a post comment."""

    body = TextAreaField(
        "Comment",
        validators=[
            DataRequired(message="Comment cannot be empty."),
            Length(min=2, max=1200, message="Comment must be between 2 and 1200 characters."),
        ],
    )
    submit = SubmitField("Post Comment")

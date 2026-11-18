# Inkwell — Full-Stack Python Flask Blog Application (7-Week Curriculum)

A modular, beginner-friendly, production-ready **Blog Web Application** built with **Python Flask**, **SQLAlchemy**, **Flask-Migrate**, **Flask-Login**, **Flask-WTF**, **Bootstrap 5**, **CKEditor 5**, **Pytest**, **Gunicorn**, and **Docker**.

---

## Project Folder Structure

```text
flask_blog/
├── app/
│   ├── __init__.py              # Week 1: Application Factory (create_app)
│   ├── extensions.py            # Week 1: Shared db, migrate, login_manager, csrf
│   ├── models.py                # Weeks 2, 3, 5: User, Category, Tag, Post, Comment
│   ├── auth/                    # Week 2: Registration, login, logout, profiles
│   ├── main/                    # Weeks 4 & 6: Home feed, pagination, search & filters
│   ├── posts/                   # Week 3: Post CRUD, CKEditor rich text, sanitization
│   ├── comments/                # Week 5: Comment CRUD & validation
│   ├── errors/                  # Custom 403, 404, 500 pages
│   ├── static/
│   │   ├── css/style.css
│   │   └── js/main.js
│   └── templates/               # Week 4: Reusable Jinja2 + Bootstrap 5 templates
├── tests/                       # Week 7: Pytest unit & integration tests
├── config.py                    # Development, Testing, Production configs
├── run.py                       # Local dev server & `flask seed-db` CLI
├── wsgi.py                      # Gunicorn WSGI entry point
├── requirements.txt             # Pinned Python dependencies
├── Dockerfile                   # Production container image
└── .env.example                 # Environment variables template
```

---

## Step-by-Step Local Setup

### 1. Create and Activate a Virtual Environment

```bash
cd flask_blog
python3 -m venv venv
# macOS / Linux:
source venv/bin/activate
# Windows PowerShell:
# .\venv\Scripts\Activate.ps1
```

### 2. Install Required Libraries

```bash
pip install -r requirements.txt
```

### 3. Configure Environment Variables

```bash
cp .env.example .env
# Edit .env and set a strong random SECRET_KEY
```

### 4. Initialize Database & Run Migrations (Week 1)

```bash
export FLASK_APP=run.py
flask db init
flask db migrate -m "Initial blog schema"
flask db upgrade
flask seed-db
```

### 5. Run the Development Server

```bash
python run.py
# Open http://127.0.0.1:5000 in your browser
```

---

## Running Automated Tests (Week 7)

```bash
pytest -v
```

Tests run against an isolated in-memory SQLite database (`TestingConfig`) and cover:
- Password hashing, registration, login, logout, and profile updates (`tests/test_auth.py`)
- Post CRUD, tags/categories, and 403 authorization checks (`tests/test_posts.py`)
- Comment creation, validation, editing, deletion, and 403 checks (`tests/test_comments.py`)
- Keyword search, category/tag filtering, and empty search results (`tests/test_search.py`)

---

## Production Deployment (Gunicorn & Docker)

### Run Directly with Gunicorn

```bash
export FLASK_CONFIG=production
export SECRET_KEY="replace-with-a-cryptographically-random-key"
gunicorn --workers 4 --bind 0.0.0.0:8000 wsgi:app
```

### Build and Run with Docker

```bash
docker build -t inkwell-flask-blog .
docker run -d -p 8000:8000 \
  -e FLASK_CONFIG=production \
  -e SECRET_KEY="replace-with-a-cryptographically-random-key" \
  inkwell-flask-blog
```

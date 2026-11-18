import { Check, Copy, Download, FileCode2, FolderTree, Terminal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { FlaskFile } from '../types';

interface WeekGuide {
  week: number;
  title: string;
  summary: string;
  keyFiles: string[];
  commands: string[];
  steps: string[];
}

const CURRICULUM: WeekGuide[] = [
  {
    week: 1,
    title: 'Project Setup & Application Factory',
    summary:
      'Establish a clean modular folder layout using the Application Factory Pattern, Blueprints, SQLAlchemy, Flask-Migrate, and environment configs.',
    keyFiles: [
      'config.py',
      'app/__init__.py',
      'app/extensions.py',
      'run.py',
      '.env.example',
    ],
    commands: [
      'python3 -m venv venv && source venv/bin/activate',
      'pip install -r requirements.txt',
      'cp .env.example .env',
      'export FLASK_APP=run.py && flask db init && flask db migrate -m "Initial schema" && flask db upgrade',
    ],
    steps: [
      'Instantiate db, migrate, login_manager, and csrf inside app/extensions.py to prevent circular imports.',
      'Bind extensions and register Blueprints inside create_app() in app/__init__.py.',
      'Separate DevelopmentConfig, TestingConfig, and ProductionConfig inside config.py.',
    ],
  },
  {
    week: 2,
    title: 'User Authentication & Profiles',
    summary:
      'Add User model with Werkzeug password hashing, Flask-Login session management, CSRF-protected forms, and editable author profiles.',
    keyFiles: [
      'app/models.py',
      'app/auth/forms.py',
      'app/auth/routes.py',
      'app/templates/auth/register.html',
      'app/templates/auth/login.html',
      'app/templates/auth/profile.html',
    ],
    commands: ['flask seed-db', 'python run.py'],
    steps: [
      'Hash passwords with generate_password_hash() and verify via check_password_hash() on User.',
      'Protect private routes with @login_required and reload users via @login_manager.user_loader.',
      'Validate unique usernames/emails and password confirmation in RegistrationForm.',
    ],
  },
  {
    week: 3,
    title: 'Blog Posts, Categories, Tags & Rich Text',
    summary:
      'Model Post, Category, and Tag relationships, enforce author-only CRUD authorization, and sanitize CKEditor HTML output with Bleach.',
    keyFiles: [
      'app/posts/forms.py',
      'app/posts/routes.py',
      'app/templates/posts/create_post.html',
    ],
    commands: ['python run.py  # Visit /posts/create after signing in'],
    steps: [
      'Connect Post to User (author), Category (1-to-Many), and Tag (Many-to-Many via post_tags).',
      'Check post.user_id == current_user.id before editing or deleting, returning HTTP 403 otherwise.',
      'Sanitize CKEditor 5 rich text HTML via bleach.clean() before saving to SQLite.',
    ],
  },
  {
    week: 4,
    title: 'Frontend Templates, Bootstrap 5 & Pagination',
    summary:
      'Craft reusable Jinja2 templates with Bootstrap 5 responsive grids, flash banners, navbar, footer, and SQLAlchemy pagination.',
    keyFiles: [
      'app/templates/base.html',
      'app/templates/main/index.html',
      'app/templates/posts/post_detail.html',
      'app/static/css/style.css',
      'app/static/js/main.js',
    ],
    commands: ['python run.py  # Browse /?page=1 and /?page=2'],
    steps: [
      'Extend base.html across every view to keep navbar, search bar, flash alerts, and footer consistent.',
      'Paginate Post.query with .paginate(page=page, per_page=per_page) and render Bootstrap page links.',
      'Add custom 403, 404, and 500 error pages via the errors Blueprint.',
    ],
  },
  {
    week: 5,
    title: 'Comments System & Ownership Controls',
    summary:
      'Allow authenticated readers to post validated comments beneath articles and edit or delete only their own remarks.',
    keyFiles: [
      'app/comments/forms.py',
      'app/comments/routes.py',
      'app/templates/comments/edit_comment.html',
    ],
    commands: ['python run.py  # Open any post and submit a comment'],
    steps: [
      'Define Comment foreign keys to users.id and posts.id with cascade delete.',
      'Validate comment length (2–1200 chars) via CommentForm and flash validation feedback.',
      'Guard /comments/<id>/edit and /comments/<id>/delete with comment.user_id == current_user.id.',
    ],
  },
  {
    week: 6,
    title: 'Search, Category/Tag Filtering & Empty States',
    summary:
      'Enable case-insensitive SQLAlchemy ILIKE search across post titles, summaries, and content alongside category and tag filters.',
    keyFiles: ['app/main/routes.py', 'app/templates/main/search.html'],
    commands: ['python run.py  # Try /search?q=flask&category=architecture'],
    steps: [
      'Combine keyword search (or_(Post.title.ilike, Post.content.ilike)) with optional category and tag filters.',
      'Preserve active search query and category parameters across pagination links.',
      'Display a clear empty-state panel with a reset link when zero articles match.',
    ],
  },
  {
    week: 7,
    title: 'Pytest Suite, Gunicorn & Docker Deployment',
    summary:
      'Verify authentication, CRUD, authorization, comments, and search using Pytest, then package for production with Gunicorn and Docker.',
    keyFiles: [
      'tests/conftest.py',
      'tests/test_auth.py',
      'tests/test_posts.py',
      'tests/test_comments.py',
      'tests/test_search.py',
      'wsgi.py',
      'Dockerfile',
      'README.md',
    ],
    commands: [
      'pytest -v',
      'gunicorn --workers 4 --bind 0.0.0.0:8000 wsgi:app',
      'docker build -t inkwell-flask-blog . && docker run -p 8000:8000 -e SECRET_KEY=prod-key inkwell-flask-blog',
    ],
    steps: [
      'Run Pytest fixtures against TestingConfig (in-memory SQLite, CSRF disabled for form tests).',
      'Verify 403 Forbidden protections when another user attempts to alter someone else’s post or comment.',
      'Serve wsgi:app via 4 Gunicorn workers inside a slim Python 3.11 Docker container.',
    ],
  },
];

export function FlaskCurriculumView() {
  const [files, setFiles] = useState<FlaskFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedPath, setSelectedPath] = useState('app/__init__.py');
  const [fileFilter, setFileFilter] = useState('');
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  useEffect(() => {
    api
      .getFlaskCurriculum()
      .then((res) => {
        setFiles(res.files);
        if (res.files.length > 0 && !res.files.some((f) => f.path === selectedPath)) {
          setSelectedPath(res.files[0].path);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load Flask files.'))
      .finally(() => setLoading(false));
  }, []);

  const currentWeek = CURRICULUM.find((w) => w.week === selectedWeek) || CURRICULUM[0];

  const filteredFiles = useMemo(() => {
    const q = fileFilter.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => f.path.toLowerCase().includes(q));
  }, [files, fileFilter]);

  const activeFile = useMemo(
    () => files.find((f) => f.path === selectedPath) || files[0] || null,
    [files, selectedPath]
  );

  function copyContent(text: string, label: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedPath(label);
      setTimeout(() => setCopiedPath(null), 1800);
    });
  }

  function downloadFile(file: FlaskFile) {
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.path.split('/').pop() || 'file.txt';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-8">
      {/* Header & Week Selector */}
      <section className="border-b border-stone-200 pb-6">
        <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">
          7-Week Python Flask Curriculum &middot; Full Source Codebase
        </p>
        <h1 className="font-display text-3xl md:text-4xl font-bold text-stone-900 mb-3 text-balance">
          Complete Flask Project Blueprint
        </h1>
        <p className="text-stone-600 max-w-3xl text-sm md:text-base leading-relaxed">
          Every module for Weeks 1–7 is saved inside the <code className="font-code text-xs bg-stone-100 px-1.5 py-0.5 rounded">flask_blog/</code> directory. Select a week below to review the step-by-step commands and inspect any source file directly.
        </p>

        {/* Week Segmented Tabs */}
        <div className="flex flex-wrap gap-1.5 mt-5 p-1 bg-stone-100 rounded-lg w-fit">
          {CURRICULUM.map((item) => (
            <button
              key={item.week}
              type="button"
              onClick={() => {
                setSelectedWeek(item.week);
                if (item.keyFiles[0]) {
                  setSelectedPath(item.keyFiles[0]);
                }
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                selectedWeek === item.week
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Week {item.week}
            </button>
          ))}
        </div>
      </section>

      {/* Active Week Guide Card */}
      <section className="bg-white border border-stone-200 rounded-lg p-6">
        <div className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-amber-900 font-semibold mb-1">
                Week {currentWeek.week} Milestone
              </p>
              <h2 className="font-display text-2xl font-bold text-stone-900">
                {currentWeek.title}
              </h2>
              <p className="text-sm text-stone-600 mt-1 leading-relaxed">{currentWeek.summary}</p>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">
                Implementation Checklist
              </h3>
              <ul className="space-y-2 text-sm text-stone-700">
                {currentWeek.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="font-code text-xs text-stone-400 mt-0.5 tabular-nums">
                      0{i + 1}.
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">
                Key Files for Week {currentWeek.week}
              </h3>
              <div className="flex flex-wrap gap-2">
                {currentWeek.keyFiles.map((filePath) => (
                  <button
                    key={filePath}
                    type="button"
                    onClick={() => setSelectedPath(filePath)}
                    className={`px-2.5 py-1 text-xs font-code rounded border transition-colors ${
                      selectedPath === filePath
                        ? 'bg-stone-900 text-white border-stone-900'
                        : 'bg-stone-50 text-stone-700 border-stone-200 hover:border-stone-400'
                    }`}
                  >
                    {filePath}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-stone-900 text-stone-100 rounded-lg p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-stone-800">
                <span className="flex items-center gap-2 text-xs font-medium text-stone-300">
                  <Terminal className="w-3.5 h-3.5" aria-hidden="true" />
                  Terminal Commands
                </span>
                <button
                  type="button"
                  onClick={() =>
                    copyContent(currentWeek.commands.join('\n'), `week-${currentWeek.week}`)
                  }
                  className="text-xs text-stone-300 hover:text-white flex items-center gap-1"
                >
                  {copiedPath === `week-${currentWeek.week}` ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </>
                  )}
                </button>
              </div>
              <pre className="font-code text-xs leading-relaxed text-stone-200 overflow-x-auto whitespace-pre-wrap">
                {currentWeek.commands.map((cmd) => `$ ${cmd}`).join('\n')}
              </pre>
            </div>
            <p className="text-xs text-stone-400 mt-4 pt-3 border-t border-stone-800">
              Run inside <code className="font-code text-stone-300">flask_blog/</code> with your virtual environment activated.
            </p>
          </div>
        </div>
      </section>

      {/* Live Source File Explorer */}
      <section className="bg-white border border-stone-200 rounded-lg overflow-hidden">
        <div className="grid lg:grid-cols-12 min-h-[520px]">
          {/* File Tree Sidebar */}
          <aside className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-stone-200 bg-stone-50/70 p-4 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-600">
                <FolderTree className="w-4 h-4" aria-hidden="true" />
                flask_blog/ ({files.length} files)
              </span>
            </div>

            <input
              type="search"
              value={fileFilter}
              onChange={(e) => setFileFilter(e.target.value)}
              placeholder="Filter files (e.g. models.py, test_)..."
              className="w-full px-3 py-1.5 text-xs bg-white border border-stone-300 rounded mb-3 focus:outline-none focus:border-stone-800"
            />

            {loading ? (
              <p className="text-xs text-stone-500 py-4">Loading Flask codebase...</p>
            ) : error ? (
              <p className="text-xs text-red-700 py-4">{error}</p>
            ) : (
              <div className="overflow-y-auto max-h-[460px] space-y-0.5 pr-1">
                {filteredFiles.map((file) => {
                  const active = activeFile?.path === file.path;
                  return (
                    <button
                      key={file.path}
                      type="button"
                      onClick={() => setSelectedPath(file.path)}
                      className={`w-full text-left px-2.5 py-1.5 rounded text-xs font-code flex items-center gap-2 transition-colors ${
                        active
                          ? 'bg-stone-900 text-white'
                          : 'text-stone-700 hover:bg-stone-200/60'
                      }`}
                    >
                      <FileCode2 className="w-3.5 h-3.5 shrink-0 opacity-75" aria-hidden="true" />
                      <span className="truncate">{file.path}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          {/* Code Viewer */}
          <div className="lg:col-span-8 flex flex-col bg-stone-950 text-stone-100">
            {activeFile ? (
              <>
                <div className="flex items-center justify-between gap-3 px-4 py-3 bg-stone-900 border-b border-stone-800">
                  <span className="font-code text-xs text-stone-200 truncate">
                    flask_blog/{activeFile.path}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => copyContent(activeFile.content, activeFile.path)}
                      className="px-2.5 py-1 text-xs font-medium text-stone-200 bg-stone-800 rounded hover:bg-stone-700 flex items-center gap-1.5 whitespace-nowrap"
                    >
                      {copiedPath === activeFile.path ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy Code
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadFile(activeFile)}
                      className="px-2.5 py-1 text-xs font-medium text-stone-900 bg-stone-100 rounded hover:bg-white flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5" /> Download
                    </button>
                  </div>
                </div>
                <pre className="p-5 font-code text-xs leading-relaxed overflow-auto max-h-[500px] text-stone-200">
                  <code>{activeFile.content}</code>
                </pre>
              </>
            ) : (
              <div className="p-8 text-xs text-stone-400">Select a file to inspect its source code.</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

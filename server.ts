import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const SECRET_KEY = process.env.SECRET_KEY || 'inkwell-dev-session-secret-change-in-prod';
const SESSION_COOKIE = 'inkwell_session';

// Ensure SQLite instance folder exists (mirrors Flask instance/blog.db)
const instanceDir = path.join(__dirname, 'instance');
fs.mkdirSync(instanceDir, { recursive: true });
const dbPath = path.join(instanceDir, 'blog.db');
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON;');

// Initialize Relational Schema matching Flask SQLAlchemy models
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    bio TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL,
    cover_image TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS post_tags (
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, tag_id)
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE
  );
`);

function hashPassword(rawPassword: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(rawPassword, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(rawPassword: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const keyBuffer = Buffer.from(keyHex, 'hex');
  const derivedBuffer = crypto.scryptSync(rawPassword, salt, 64);
  if (keyBuffer.length !== derivedBuffer.length) return false;
  return crypto.timingSafeEqual(keyBuffer, derivedBuffer);
}

function signSessionToken(userId: number, rememberMe: boolean): string {
  const ttlSeconds = rememberMe ? 14 * 24 * 3600 : 24 * 3600;
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifySessionToken(token: string | undefined): number | null {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expectedSig = crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { uid: number; exp: number };
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed.uid;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    result[key] = val;
  }
  return result;
}

function sanitizeHtml(input: string): string {
  return (input || '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function estimateReadingMinutes(html: string): number {
  const words = stripTags(html).split(' ').filter(Boolean).length;
  return Math.max(1, Math.round(words / 180));
}

function seedDatabase(): void {
  const existingUsers = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number };
  if (existingUsers.cnt > 0) return;

  const categories = [
    ['Architecture', 'architecture'],
    ['Databases', 'databases'],
    ['Security', 'security'],
    ['Typography & UI', 'typography-ui'],
    ['Engineering', 'engineering'],
  ];
  const insertCat = db.prepare('INSERT INTO categories (name, slug) VALUES (?, ?)');
  for (const [name, slug] of categories) {
    insertCat.run(name, slug);
  }

  const now = new Date().toISOString();
  const insertUser = db.prepare(
    'INSERT INTO users (username, email, password_hash, bio, created_at) VALUES (?, ?, ?, ?, ?)'
  );
  const elenaId = Number(
    insertUser.run(
      'elena_vance',
      'editor@inkwell.dev',
      hashPassword('StrongPass123!'),
      'Principal Python architect and technical essayist exploring clean web foundations.',
      '2026-09-12T10:00:00.000Z'
    ).lastInsertRowid
  );
  const marcusId = Number(
    insertUser.run(
      'marcus_chen',
      'marcus@inkwell.dev',
      hashPassword('StrongPass123!'),
      'Systems engineer focused on relational databases, migrations, and readable typography.',
      '2026-09-20T14:30:00.000Z'
    ).lastInsertRowid
  );

  const catMap: Record<string, number> = {};
  for (const row of db.prepare('SELECT id, slug FROM categories').all() as Array<{ id: number; slug: string }>) {
    catMap[row.slug] = row.id;
  }

  const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
  const getTag = db.prepare('SELECT id FROM tags WHERE name = ?');
  const linkTag = db.prepare('INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)');

  function attachTags(postId: number, names: string[]): void {
    for (const raw of names) {
      const name = raw.trim().toLowerCase();
      if (!name) continue;
      insertTag.run(name);
      const row = getTag.get(name) as { id: number } | undefined;
      if (row) linkTag.run(postId, row.id);
    }
  }

  const seedPosts = [
    {
      title: 'Designing Maintainable Flask Apps with the Application Factory',
      summary:
        'Why deferring extension initialization inside create_app() and organizing routes with Blueprints prevents circular imports as your codebase grows.',
      cover: '/src/assets/images/cover_flask_architecture_1794981014544.jpg',
      categorySlug: 'architecture',
      userId: elenaId,
      createdAt: '2026-11-16T09:15:00.000Z',
      tags: ['flask', 'blueprints', 'architecture'],
      content: `<p>When a Flask project grows past a single script, circular imports quickly become the primary source of friction. A route module needs the database instance, while the app module imports the routes. Using the <strong>Application Factory Pattern</strong> resolves this tension cleanly by creating extension instances once in <code>app/extensions.py</code> and binding them later inside <code>create_app()</code>.</p>
<h3>Why Blueprints Matter</h3>
<p>Instead of registering every URL in one file, Blueprints split your application into cohesive domain modules: authentication, main feed, posts, comments, and error handlers. Each Blueprint owns its own forms, routes, and template folder structure.</p>
<blockquote>Good software architecture makes the next feature easier to write than the previous one.</blockquote>
<h3>Practical Benefits in Testing and Production</h3>
<ul>
  <li>Spin up isolated app instances with an in-memory SQLite database during Pytest runs.</li>
  <li>Swap between <code>DevelopmentConfig</code> and <code>ProductionConfig</code> using environment variables.</li>
  <li>Expose a clean <code>wsgi.py</code> target for Gunicorn workers inside Docker.</li>
</ul>`,
    },
    {
      title: 'Schema Evolution Without Fear: SQLAlchemy & Flask-Migrate',
      summary:
        'Managing relational tables, foreign keys, and many-to-many association tables cleanly from SQLite development through production deployments.',
      cover: '/src/assets/images/cover_database_migrations_1794981015684.jpg',
      categorySlug: 'databases',
      userId: marcusId,
      createdAt: '2026-11-14T15:40:00.000Z',
      tags: ['sqlalchemy', 'migrations', 'sqlite'],
      content: `<p>Databases rarely stay frozen after week one. As soon as you introduce categories, many-to-many tags, or user comments, your schema must evolve without erasing existing records.</p>
<h3>Modeling Relationships Explicitly</h3>
<p>In SQLAlchemy, clear foreign keys and <code>back_populates</code> declarations turn database joins into intuitive Python attributes. Cascading deletes ensure that removing a post cleanly removes its orphaned comments and tag links.</p>
<pre><code>flask db init
flask db migrate -m "Add comments and post_tags"
flask db upgrade</code></pre>
<p>Treat every generated migration script like source code: inspect the <code>upgrade()</code> and <code>downgrade()</code> functions before committing them to version control.</p>`,
    },
    {
      title: 'Session Security, Password Hashing & Ownership Checks in Flask',
      summary:
        'A practical checklist for integrating Flask-Login, Werkzeug scrypt/pbkdf2 hashes, CSRF tokens, and strict 403 authorization guards.',
      cover: '/src/assets/images/cover_auth_security_1794981015950.jpg',
      categorySlug: 'security',
      userId: elenaId,
      createdAt: '2026-11-11T11:20:00.000Z',
      tags: ['flask-login', 'security', 'authentication'],
      content: `<p>Authentication confirms <em>who</em> a visitor is; authorization confirms <em>what</em> they are permitted to touch. Confusing the two is one of the most common pitfalls in early web projects.</p>
<h3>Three Non-Negotiable Safeguards</h3>
<ol>
  <li><strong>Never store plain-text passwords:</strong> Always hash credentials via <code>generate_password_hash()</code> and verify with <code>check_password_hash()</code>.</li>
  <li><strong>Enforce CSRF protection:</strong> Flask-WTF injects hidden CSRF tokens into every form, including POST-only logout and delete actions.</li>
  <li><strong>Verify resource ownership:</strong> Before updating or deleting any post or comment, assert <code>resource.user_id == current_user.id</code> and abort with HTTP <code>403</code> otherwise.</li>
</ol>`,
    },
    {
      title: 'Editorial Typography & Calm Interfaces for Long-Form Reading',
      summary:
        'How measure width, serif pairings, hairline borders, and unboxed metadata transform a standard CRUD blog into a pleasurable reading space.',
      cover: '/src/assets/images/cover_typography_craft_1794981016864.jpg',
      categorySlug: 'typography-ui',
      userId: marcusId,
      createdAt: '2026-11-08T08:45:00.000Z',
      tags: ['typography', 'jinja2', 'bootstrap'],
      content: `<p>Readers decide within seconds whether an article feels welcoming or exhausting. Most developer blogs fail not because of missing features, but because lines stretch 120 characters wide across stark screens.</p>
<h3>Calibrating the Reading Column</h3>
<p>Constraining article prose to roughly 65–75 characters per line with generous 1.75–1.8 line height gives the eye a steady rhythm. Pairing an expressive display serif for headlines with clean sans-serif metadata creates effortless visual hierarchy without visual noise.</p>`,
    },
    {
      title: 'Building a Resilient Comment System with Validation & Ownership',
      summary:
        'Connecting reader discussions to both User and Post models while preventing empty submissions and unauthorized edits.',
      cover: '',
      categorySlug: 'engineering',
      userId: elenaId,
      createdAt: '2026-11-05T17:10:00.000Z',
      tags: ['comments', 'wtforms', 'validation'],
      content: `<p>A great blog invites dialogue. In Week 5 of our curriculum, we connect a dedicated <code>Comment</code> model to both <code>users.id</code> and <code>posts.id</code>, ordering replies chronologically so readers can follow the conversation effortlessly.</p>
<p>Server-side validation via WTForms ensures comments stay between 2 and 1,200 characters, while owner-only edit and delete controls protect every contributor's voice.</p>`,
    },
    {
      title: 'Fast Keyword Search, Tag Filtering & Pagination with SQLAlchemy',
      summary:
        'Combining case-insensitive ILIKE queries, category slugs, and page numbers into clean, shareable URLs.',
      cover: '',
      categorySlug: 'databases',
      userId: marcusId,
      createdAt: '2026-11-02T13:05:00.000Z',
      tags: ['search', 'pagination', 'sqlalchemy'],
      content: `<p>As an archive grows past a dozen posts, discovery becomes essential. Using query parameters like <code>?q=flask&amp;category=architecture&amp;page=2</code> keeps search results bookmarkable and preserves browser back-button behavior.</p>
<p>Equally important is designing a helpful empty state: when a query matches zero articles, guide the reader back to all topics rather than leaving a blank screen.</p>`,
    },
    {
      title: 'From Localhost to Production: Pytest, Gunicorn & Docker',
      summary:
        'Replacing Flask’s development server with multi-worker Gunicorn processes inside a slim Python container backed by automated tests.',
      cover: '',
      categorySlug: 'engineering',
      userId: elenaId,
      createdAt: '2026-10-28T10:00:00.000Z',
      tags: ['pytest', 'gunicorn', 'docker'],
      content: `<p>Flask's built-in development server is designed for debugging, not concurrent production traffic. Before shipping, we verify every route with Pytest against an in-memory database, then package the app in a slim Docker image running four Gunicorn workers bound to <code>wsgi:app</code>.</p>`,
    },
  ];

  const insertPost = db.prepare(
    `INSERT INTO posts (title, summary, content, cover_image, created_at, updated_at, user_id, category_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertComment = db.prepare(
    'INSERT INTO comments (body, created_at, updated_at, user_id, post_id) VALUES (?, ?, ?, ?, ?)'
  );

  seedPosts.forEach((p, index) => {
    const postId = Number(
      insertPost.run(
        p.title,
        p.summary,
        p.content,
        p.cover,
        p.createdAt,
        p.createdAt,
        p.userId,
        catMap[p.categorySlug] ?? null
      ).lastInsertRowid
    );
    attachTags(postId, p.tags);

    if (index === 0) {
      insertComment.run(
        'Moving extensions into app/extensions.py finally eliminated all circular import headaches in my Flask project.',
        '2026-11-16T12:30:00.000Z',
        '2026-11-16T12:30:00.000Z',
        marcusId,
        postId
      );
      insertComment.run(
        'Agreed! And having TestingConfig swap SQLite to :memory: makes the Pytest suite run in under a second.',
        '2026-11-16T14:05:00.000Z',
        '2026-11-16T14:05:00.000Z',
        elenaId,
        postId
      );
    } else if (index === 1) {
      insertComment.run(
        'Always inspecting generated Alembic migrations before running flask db upgrade has saved our team multiple times.',
        '2026-11-14T18:20:00.000Z',
        '2026-11-14T18:20:00.000Z',
        elenaId,
        postId
      );
    }
  });

  // Reference unused `now` safely for lint clarity
  void now;
}

seedDatabase();

interface AuthUser {
  id: number;
  username: string;
  email: string;
  bio: string;
  created_at: string;
}

interface AuthedRequest extends Request {
  currentUser?: AuthUser | null;
}

function attachUser(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const cookies = parseCookies(req.headers.cookie);
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7).trim()
    : undefined;
  const token = bearer || cookies[SESSION_COOKIE];
  const uid = verifySessionToken(token);
  if (uid !== null) {
    const row = db
      .prepare('SELECT id, username, email, bio, created_at FROM users WHERE id = ?')
      .get(uid) as AuthUser | undefined;
    req.currentUser = row || null;
  } else {
    req.currentUser = null;
  }
  next();
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.currentUser) {
    res.status(401).json({ error: 'Please sign in to perform this action.' });
    return;
  }
  next();
}

function setSessionCookie(req: Request, res: Response, token: string, rememberMe: boolean): void {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const maxAgeMs = (rememberMe ? 14 * 24 * 3600 : 24 * 3600) * 1000;
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    maxAge: maxAgeMs,
    path: '/',
  });
}

function hydratePost(row: Record<string, unknown>) {
  const postId = Number(row.id);
  const tagRows = db
    .prepare(
      `SELECT t.name FROM tags t
       INNER JOIN post_tags pt ON pt.tag_id = t.id
       WHERE pt.post_id = ?
       ORDER BY t.name ASC`
    )
    .all(postId) as Array<{ name: string }>;

  const commentCountRow = db
    .prepare('SELECT COUNT(*) as cnt FROM comments WHERE post_id = ?')
    .get(postId) as { cnt: number };

  const content = String(row.content || '');
  return {
    id: postId,
    title: String(row.title),
    summary: String(row.summary || ''),
    content,
    cover_image: String(row.cover_image || ''),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    user_id: Number(row.user_id),
    author_username: String(row.author_username),
    author_bio: String(row.author_bio || ''),
    category_id: row.category_id ? Number(row.category_id) : null,
    category_name: row.category_name ? String(row.category_name) : 'General',
    category_slug: row.category_slug ? String(row.category_slug) : 'general',
    tags: tagRows.map((t) => t.name),
    comment_count: Number(commentCountRow.cnt),
    reading_minutes: estimateReadingMinutes(content),
  };
}

function collectFlaskFiles(dir: string, baseDir: string): Array<{ path: string; content: string; language: string }> {
  const results: Array<{ path: string; content: string; language: string }> = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of entries) {
    if (entry.name === '__pycache__' || entry.name === '.pytest_cache' || entry.name === 'venv') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFlaskFiles(full, baseDir));
    } else {
      const rel = path.relative(baseDir, full).replace(/\\/g, '/');
      const ext = path.extname(entry.name).slice(1) || 'text';
      const content = fs.readFileSync(full, 'utf8');
      results.push({ path: rel, content, language: ext });
    }
  }
  return results;
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));
  app.use(attachUser);

  // Health
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Auth Routes
  app.get('/api/auth/me', (req: AuthedRequest, res) => {
    res.json({ user: req.currentUser || null });
  });

  app.post('/api/auth/register', (req: Request, res: Response) => {
    const username = String(req.body?.username || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const confirmPassword = String(req.body?.confirmPassword || '');

    const errors: Record<string, string> = {};
    if (username.length < 3 || username.length > 40) {
      errors.username = 'Username must be between 3 and 40 characters.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address.';
    }
    if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
    }
    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords must match.';
    }

    if (Object.keys(errors).length > 0) {
      res.status(400).json({ error: 'Validation failed.', fields: errors });
      return;
    }

    if (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
      res.status(400).json({
        error: 'Validation failed.',
        fields: { username: 'That username is already taken.' },
      });
      return;
    }
    if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
      res.status(400).json({
        error: 'Validation failed.',
        fields: { email: 'An account with this email already exists.' },
      });
      return;
    }

    const now = new Date().toISOString();
    const info = db
      .prepare('INSERT INTO users (username, email, password_hash, bio, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(username, email, hashPassword(password), '', now);

    const user = db
      .prepare('SELECT id, username, email, bio, created_at FROM users WHERE id = ?')
      .get(Number(info.lastInsertRowid)) as unknown as AuthUser;

    const token = signSessionToken(user.id, true);
    setSessionCookie(req, res, token, true);
    res.status(201).json({ user, token });
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const rememberMe = Boolean(req.body?.rememberMe);

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const userRow = db
      .prepare('SELECT id, username, email, password_hash, bio, created_at FROM users WHERE email = ?')
      .get(email) as (AuthUser & { password_hash: string }) | undefined;

    if (!userRow || !verifyPassword(password, userRow.password_hash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = signSessionToken(userRow.id, rememberMe);
    setSessionCookie(req, res, token, rememberMe);
    const { password_hash: _ignored, ...safeUser } = userRow;
    void _ignored;
    res.json({ user: safeUser, token });
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      sameSite: isHttps ? 'none' : 'lax',
      secure: isHttps,
      path: '/',
    });
    res.json({ ok: true });
  });

  app.put('/api/auth/profile', requireAuth, (req: AuthedRequest, res: Response) => {
    const current = req.currentUser!;
    const username = String(req.body?.username || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const bio = String(req.body?.bio || '').trim().slice(0, 300);

    const errors: Record<string, string> = {};
    if (username.length < 3 || username.length > 40) {
      errors.username = 'Username must be between 3 and 40 characters.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address.';
    }
    if (Object.keys(errors).length > 0) {
      res.status(400).json({ error: 'Validation failed.', fields: errors });
      return;
    }

    const existingUsername = db
      .prepare('SELECT id FROM users WHERE username = ? AND id != ?')
      .get(username, current.id);
    if (existingUsername) {
      res.status(400).json({ error: 'Username already taken.', fields: { username: 'That username is already taken.' } });
      return;
    }

    const existingEmail = db
      .prepare('SELECT id FROM users WHERE email = ? AND id != ?')
      .get(email, current.id);
    if (existingEmail) {
      res.status(400).json({ error: 'Email already registered.', fields: { email: 'That email is already registered.' } });
      return;
    }

    db.prepare('UPDATE users SET username = ?, email = ?, bio = ? WHERE id = ?').run(
      username,
      email,
      bio,
      current.id
    );
    const updated = db
      .prepare('SELECT id, username, email, bio, created_at FROM users WHERE id = ?')
      .get(current.id) as unknown as AuthUser;
    res.json({ user: updated });
  });

  // Public Author Profile
  app.get('/api/users/:username', (req: Request, res: Response) => {
    const user = db
      .prepare('SELECT id, username, bio, created_at FROM users WHERE username = ?')
      .get(req.params.username) as Omit<AuthUser, 'email'> | undefined;
    if (!user) {
      res.status(404).json({ error: 'Author not found.' });
      return;
    }

    const postRows = db
      .prepare(
        `SELECT p.*, u.username as author_username, u.bio as author_bio,
                c.name as category_name, c.slug as category_slug
         FROM posts p
         JOIN users u ON u.id = p.user_id
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.user_id = ?
         ORDER BY p.created_at DESC`
      )
      .all(user.id);

    res.json({
      author: user,
      posts: postRows.map(hydratePost),
    });
  });

  // Categories & Tags
  app.get('/api/categories', (_req, res) => {
    const rows = db
      .prepare(
        `SELECT c.id, c.name, c.slug, COUNT(p.id) as post_count
         FROM categories c
         LEFT JOIN posts p ON p.category_id = c.id
         GROUP BY c.id
         ORDER BY c.name ASC`
      )
      .all();
    res.json({ categories: rows });
  });

  app.get('/api/tags', (_req, res) => {
    const rows = db
      .prepare(
        `SELECT t.id, t.name, COUNT(pt.post_id) as post_count
         FROM tags t
         JOIN post_tags pt ON pt.tag_id = t.id
         GROUP BY t.id
         ORDER BY post_count DESC, t.name ASC`
      )
      .all();
    res.json({ tags: rows });
  });

  // Posts List (Search, Category/Tag Filter, Pagination)
  app.get('/api/posts', (req: Request, res: Response) => {
    const q = String(req.query.q || '').trim();
    const categorySlug = String(req.query.category || '').trim();
    const tagName = String(req.query.tag || '').trim().toLowerCase();
    const author = String(req.query.author || '').trim();
    const page = Math.max(1, Number(req.query.page || 1));
    const perPage = Math.min(20, Math.max(1, Number(req.query.per_page || 6)));

    const whereClauses: string[] = [];
    const params: Array<string | number> = [];

    if (q) {
      whereClauses.push('(LOWER(p.title) LIKE ? OR LOWER(p.summary) LIKE ? OR LOWER(p.content) LIKE ?)');
      const pattern = `%${q.toLowerCase()}%`;
      params.push(pattern, pattern, pattern);
    }
    if (categorySlug) {
      whereClauses.push('c.slug = ?');
      params.push(categorySlug);
    }
    if (author) {
      whereClauses.push('u.username = ?');
      params.push(author);
    }
    if (tagName) {
      whereClauses.push(
        'EXISTS (SELECT 1 FROM post_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.post_id = p.id AND LOWER(t.name) = ?)'
      );
      params.push(tagName);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const countSql = `
      SELECT COUNT(*) as total
      FROM posts p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN categories c ON c.id = p.category_id
      ${whereSql}
    `;
    const totalRow = db.prepare(countSql).get(...params) as { total: number };
    const total = Number(totalRow.total);
    const pages = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(page, pages);
    const offset = (safePage - 1) * perPage;

    const listSql = `
      SELECT p.*, u.username as author_username, u.bio as author_bio,
             c.name as category_name, c.slug as category_slug
      FROM posts p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN categories c ON c.id = p.category_id
      ${whereSql}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const rows = db.prepare(listSql).all(...params, perPage, offset);

    res.json({
      items: rows.map(hydratePost),
      total,
      page: safePage,
      per_page: perPage,
      pages,
    });
  });

  // Single Post + Comments
  app.get('/api/posts/:id', (req: Request, res: Response) => {
    const postId = Number(req.params.id);
    if (!Number.isInteger(postId)) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }

    const row = db
      .prepare(
        `SELECT p.*, u.username as author_username, u.bio as author_bio,
                c.name as category_name, c.slug as category_slug
         FROM posts p
         JOIN users u ON u.id = p.user_id
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.id = ?`
      )
      .get(postId);

    if (!row) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }

    const comments = db
      .prepare(
        `SELECT cm.id, cm.body, cm.created_at, cm.updated_at, cm.user_id, cm.post_id,
                u.username as author_username
         FROM comments cm
         JOIN users u ON u.id = cm.user_id
         WHERE cm.post_id = ?
         ORDER BY cm.created_at DESC`
      )
      .all(postId);

    res.json({
      post: hydratePost(row),
      comments,
    });
  });

  // Create Post
  app.post('/api/posts', requireAuth, (req: AuthedRequest, res: Response) => {
    const title = String(req.body?.title || '').trim();
    const summary = String(req.body?.summary || '').trim().slice(0, 280);
    const content = sanitizeHtml(String(req.body?.content || ''));
    const categoryId = Number(req.body?.category_id);
    const tagsInput = String(req.body?.tags_input || '');

    const errors: Record<string, string> = {};
    if (title.length < 4 || title.length > 160) {
      errors.title = 'Title must be between 4 and 160 characters.';
    }
    if (stripTags(content).length < 20) {
      errors.content = 'Post content must contain at least 20 characters of text.';
    }
    if (!Number.isInteger(categoryId) || !db.prepare('SELECT id FROM categories WHERE id = ?').get(categoryId)) {
      errors.category_id = 'Please choose a valid category.';
    }
    if (Object.keys(errors).length > 0) {
      res.status(400).json({ error: 'Validation failed.', fields: errors });
      return;
    }

    const now = new Date().toISOString();
    const info = db
      .prepare(
        `INSERT INTO posts (title, summary, content, cover_image, created_at, updated_at, user_id, category_id)
         VALUES (?, ?, ?, '', ?, ?, ?, ?)`
      )
      .run(title, summary, content, now, now, req.currentUser!.id, categoryId);

    const postId = Number(info.lastInsertRowid);
    const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
    const getTag = db.prepare('SELECT id FROM tags WHERE name = ?');
    const linkTag = db.prepare('INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)');

    const seen = new Set<string>();
    for (const chunk of tagsInput.split(',')) {
      const name = chunk.trim().toLowerCase().slice(0, 40);
      if (!name || seen.has(name)) continue;
      seen.add(name);
      insertTag.run(name);
      const tagRow = getTag.get(name) as { id: number } | undefined;
      if (tagRow) linkTag.run(postId, tagRow.id);
    }

    const created = db
      .prepare(
        `SELECT p.*, u.username as author_username, u.bio as author_bio,
                c.name as category_name, c.slug as category_slug
         FROM posts p
         JOIN users u ON u.id = p.user_id
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.id = ?`
      )
      .get(postId)!;

    res.status(201).json({ post: hydratePost(created) });
  });

  // Update Post (Author Only)
  app.put('/api/posts/:id', requireAuth, (req: AuthedRequest, res: Response) => {
    const postId = Number(req.params.id);
    const existing = db.prepare('SELECT id, user_id FROM posts WHERE id = ?').get(postId) as
      | { id: number; user_id: number }
      | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }
    if (existing.user_id !== req.currentUser!.id) {
      res.status(403).json({ error: 'You are not authorized to edit this post.' });
      return;
    }

    const title = String(req.body?.title || '').trim();
    const summary = String(req.body?.summary || '').trim().slice(0, 280);
    const content = sanitizeHtml(String(req.body?.content || ''));
    const categoryId = Number(req.body?.category_id);
    const tagsInput = String(req.body?.tags_input || '');

    const errors: Record<string, string> = {};
    if (title.length < 4 || title.length > 160) {
      errors.title = 'Title must be between 4 and 160 characters.';
    }
    if (stripTags(content).length < 20) {
      errors.content = 'Post content must contain at least 20 characters of text.';
    }
    if (!Number.isInteger(categoryId) || !db.prepare('SELECT id FROM categories WHERE id = ?').get(categoryId)) {
      errors.category_id = 'Please choose a valid category.';
    }
    if (Object.keys(errors).length > 0) {
      res.status(400).json({ error: 'Validation failed.', fields: errors });
      return;
    }

    const now = new Date().toISOString();
    db.prepare(
      'UPDATE posts SET title = ?, summary = ?, content = ?, category_id = ?, updated_at = ? WHERE id = ?'
    ).run(title, summary, content, categoryId, now, postId);

    db.prepare('DELETE FROM post_tags WHERE post_id = ?').run(postId);
    const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
    const getTag = db.prepare('SELECT id FROM tags WHERE name = ?');
    const linkTag = db.prepare('INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)');
    const seen = new Set<string>();
    for (const chunk of tagsInput.split(',')) {
      const name = chunk.trim().toLowerCase().slice(0, 40);
      if (!name || seen.has(name)) continue;
      seen.add(name);
      insertTag.run(name);
      const tagRow = getTag.get(name) as { id: number } | undefined;
      if (tagRow) linkTag.run(postId, tagRow.id);
    }

    const updated = db
      .prepare(
        `SELECT p.*, u.username as author_username, u.bio as author_bio,
                c.name as category_name, c.slug as category_slug
         FROM posts p
         JOIN users u ON u.id = p.user_id
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.id = ?`
      )
      .get(postId)!;

    res.json({ post: hydratePost(updated) });
  });

  // Delete Post (Author Only)
  app.delete('/api/posts/:id', requireAuth, (req: AuthedRequest, res: Response) => {
    const postId = Number(req.params.id);
    const existing = db.prepare('SELECT id, user_id FROM posts WHERE id = ?').get(postId) as
      | { id: number; user_id: number }
      | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }
    if (existing.user_id !== req.currentUser!.id) {
      res.status(403).json({ error: 'You are not authorized to delete this post.' });
      return;
    }

    db.prepare('DELETE FROM posts WHERE id = ?').run(postId);
    res.json({ ok: true });
  });

  // Add Comment
  app.post('/api/posts/:id/comments', requireAuth, (req: AuthedRequest, res: Response) => {
    const postId = Number(req.params.id);
    const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId);
    if (!post) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }

    const body = String(req.body?.body || '').trim();
    if (body.length < 2 || body.length > 1200) {
      res.status(400).json({ error: 'Comment must be between 2 and 1200 characters.' });
      return;
    }

    const now = new Date().toISOString();
    const info = db
      .prepare('INSERT INTO comments (body, created_at, updated_at, user_id, post_id) VALUES (?, ?, ?, ?, ?)')
      .run(body, now, now, req.currentUser!.id, postId);

    const created = db
      .prepare(
        `SELECT cm.id, cm.body, cm.created_at, cm.updated_at, cm.user_id, cm.post_id,
                u.username as author_username
         FROM comments cm
         JOIN users u ON u.id = cm.user_id
         WHERE cm.id = ?`
      )
      .get(Number(info.lastInsertRowid));

    res.status(201).json({ comment: created });
  });

  // Update Comment (Author Only)
  app.put('/api/comments/:id', requireAuth, (req: AuthedRequest, res: Response) => {
    const commentId = Number(req.params.id);
    const existing = db.prepare('SELECT id, user_id FROM comments WHERE id = ?').get(commentId) as
      | { id: number; user_id: number }
      | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Comment not found.' });
      return;
    }
    if (existing.user_id !== req.currentUser!.id) {
      res.status(403).json({ error: 'You are not authorized to edit this comment.' });
      return;
    }

    const body = String(req.body?.body || '').trim();
    if (body.length < 2 || body.length > 1200) {
      res.status(400).json({ error: 'Comment must be between 2 and 1200 characters.' });
      return;
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE comments SET body = ?, updated_at = ? WHERE id = ?').run(body, now, commentId);

    const updated = db
      .prepare(
        `SELECT cm.id, cm.body, cm.created_at, cm.updated_at, cm.user_id, cm.post_id,
                u.username as author_username
         FROM comments cm
         JOIN users u ON u.id = cm.user_id
         WHERE cm.id = ?`
      )
      .get(commentId);

    res.json({ comment: updated });
  });

  // Delete Comment (Author Only)
  app.delete('/api/comments/:id', requireAuth, (req: AuthedRequest, res: Response) => {
    const commentId = Number(req.params.id);
    const existing = db.prepare('SELECT id, user_id FROM comments WHERE id = ?').get(commentId) as
      | { id: number; user_id: number }
      | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Comment not found.' });
      return;
    }
    if (existing.user_id !== req.currentUser!.id) {
      res.status(403).json({ error: 'You are not authorized to delete this comment.' });
      return;
    }

    db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);
    res.json({ ok: true });
  });

  // Expose the complete 7-week Python Flask codebase from /flask_blog
  app.get('/api/flask-curriculum', (_req, res) => {
    const flaskRoot = path.join(__dirname, 'flask_blog');
    const files = collectFlaskFiles(flaskRoot, flaskRoot);
    res.json({ files });
  });

  // Vite Middleware (Dev) or Static Assets (Prod)
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Inkwell Blog Studio running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

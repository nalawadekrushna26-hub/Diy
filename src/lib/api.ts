import type {
  Category,
  CommentItem,
  FlaskFile,
  PaginatedPosts,
  Post,
  TagSummary,
  User,
} from '../types';

const TOKEN_STORAGE_KEY = 'inkwell_auth_token';

function getStoredToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage restrictions
  }
}

export class ApiError extends Error {
  status: number;
  fields?: Record<string, string>;

  constructor(message: string, status: number, fields?: Record<string, string>) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(
      String(data.error || 'Request failed.'),
      res.status,
      data.fields as Record<string, string> | undefined
    );
  }
  return data as T;
}

export const api = {
  getMe: () => request<{ user: User | null }>('/api/auth/me'),

  register: async (payload: {
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
  }) => {
    const res = await request<{ user: User; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setStoredToken(res.token);
    return res.user;
  },

  login: async (payload: { email: string; password: string; rememberMe: boolean }) => {
    const res = await request<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setStoredToken(res.token);
    return res.user;
  },

  logout: async () => {
    await request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
    setStoredToken(null);
  },

  updateProfile: (payload: { username: string; email: string; bio: string }) =>
    request<{ user: User }>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  getAuthorProfile: (username: string) =>
    request<{ author: Omit<User, 'email'>; posts: Post[] }>(
      `/api/users/${encodeURIComponent(username)}`
    ),

  getCategories: () => request<{ categories: Category[] }>('/api/categories'),
  getTags: () => request<{ tags: TagSummary[] }>('/api/tags'),

  getPosts: (params: {
    q?: string;
    category?: string;
    tag?: string;
    author?: string;
    page?: number;
    per_page?: number;
  }) => {
    const sp = new URLSearchParams();
    if (params.q) sp.set('q', params.q);
    if (params.category) sp.set('category', params.category);
    if (params.tag) sp.set('tag', params.tag);
    if (params.author) sp.set('author', params.author);
    if (params.page) sp.set('page', String(params.page));
    if (params.per_page) sp.set('per_page', String(params.per_page));
    return request<PaginatedPosts>(`/api/posts?${sp.toString()}`);
  },

  getPost: (id: number) =>
    request<{ post: Post; comments: CommentItem[] }>(`/api/posts/${id}`),

  createPost: (payload: {
    title: string;
    summary: string;
    category_id: number;
    tags_input: string;
    content: string;
  }) =>
    request<{ post: Post }>('/api/posts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updatePost: (
    id: number,
    payload: {
      title: string;
      summary: string;
      category_id: number;
      tags_input: string;
      content: string;
    }
  ) =>
    request<{ post: Post }>(`/api/posts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deletePost: (id: number) =>
    request<{ ok: boolean }>(`/api/posts/${id}`, { method: 'DELETE' }),

  addComment: (postId: number, body: string) =>
    request<{ comment: CommentItem }>(`/api/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),

  updateComment: (commentId: number, body: string) =>
    request<{ comment: CommentItem }>(`/api/comments/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify({ body }),
    }),

  deleteComment: (commentId: number) =>
    request<{ ok: boolean }>(`/api/comments/${commentId}`, { method: 'DELETE' }),

  getFlaskCurriculum: () => request<{ files: FlaskFile[] }>('/api/flask-curriculum'),
};

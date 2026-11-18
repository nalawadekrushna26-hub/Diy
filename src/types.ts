export interface User {
  id: number;
  username: string;
  email: string;
  bio: string;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  post_count: number;
}

export interface TagSummary {
  id: number;
  name: string;
  post_count: number;
}

export interface Post {
  id: number;
  title: string;
  summary: string;
  content: string;
  cover_image: string;
  created_at: string;
  updated_at: string;
  user_id: number;
  author_username: string;
  author_bio: string;
  category_id: number | null;
  category_name: string;
  category_slug: string;
  tags: string[];
  comment_count: number;
  reading_minutes: number;
}

export interface PaginatedPosts {
  items: Post[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface CommentItem {
  id: number;
  body: string;
  created_at: string;
  updated_at: string;
  user_id: number;
  post_id: number;
  author_username: string;
}

export interface FlaskFile {
  path: string;
  content: string;
  language: string;
}

export interface FlashMessage {
  id: number;
  type: 'success' | 'error' | 'info';
  text: string;
}

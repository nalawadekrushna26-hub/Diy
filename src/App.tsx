/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ArrowLeft, Search, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { FlaskCurriculumView } from './components/FlaskCurriculumView';
import { formatShortDate, PostCard, PostCoverImage } from './components/PostCard';
import { RichTextEditor } from './components/RichTextEditor';
import { api, ApiError } from './lib/api';
import type {
  Category,
  CommentItem,
  FlashMessage,
  PaginatedPosts,
  Post,
  TagSummary,
  User,
} from './types';

type RouteView =
  | { name: 'home' }
  | { name: 'post'; postId: number }
  | { name: 'editor'; postId?: number }
  | { name: 'auth'; mode: 'login' | 'register' }
  | { name: 'profile'; username?: string }
  | { name: 'flask-guide' };

export default function App() {
  const [route, setRoute] = useState<RouteView>({ name: 'home' });
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // Flash messages (mirroring Flask's flash() banner)
  const [flashes, setFlashes] = useState<FlashMessage[]>([]);

  // Home feed & search state
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<TagSummary[]>([]);
  const [postsData, setPostsData] = useState<PaginatedPosts>({
    items: [],
    total: 0,
    page: 1,
    per_page: 6,
    pages: 1,
  });
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [activeTag, setActiveTag] = useState('');
  const [page, setPage] = useState(1);
  const [feedLoading, setFeedLoading] = useState(true);

  // Single post detail & comments state
  const [detailPost, setDetailPost] = useState<Post | null>(null);
  const [detailComments, setDetailComments] = useState<CommentItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [confirmDeletePost, setConfirmDeletePost] = useState(false);
  const [newCommentBody, setNewCommentBody] = useState('');
  const [commentError, setCommentError] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState('');
  const [confirmDeleteCommentId, setConfirmDeleteCommentId] = useState<number | null>(null);

  // Post Editor state
  const [editorTitle, setEditorTitle] = useState('');
  const [editorSummary, setEditorSummary] = useState('');
  const [editorCategoryId, setEditorCategoryId] = useState<number>(1);
  const [editorTags, setEditorTags] = useState('');
  const [editorContent, setEditorContent] = useState('<p></p>');
  const [editorErrors, setEditorErrors] = useState<Record<string, string>>({});
  const [editorSubmitting, setEditorSubmitting] = useState(false);

  // Auth forms state
  const [authUsername, setAuthUsername] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [authErrors, setAuthErrors] = useState<Record<string, string>>({});
  const [authFormError, setAuthFormError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Profile view state
  const [profileAuthor, setProfileAuthor] = useState<Omit<User, 'email'> | null>(null);
  const [profilePosts, setProfilePosts] = useState<Post[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileUsername, setProfileUsername] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileBio, setProfileBio] = useState('');
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});

  function pushFlash(type: FlashMessage['type'], text: string) {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setFlashes((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setFlashes((prev) => prev.filter((f) => f.id !== id));
    }, 5000);
  }

  const loadMetadata = useCallback(async () => {
    try {
      const [catRes, tagRes] = await Promise.all([api.getCategories(), api.getTags()]);
      setCategories(catRes.categories);
      setTags(tagRes.tags);
      if (catRes.categories.length > 0) {
        setEditorCategoryId((prev) => prev || catRes.categories[0].id);
      }
    } catch {
      // Handled gracefully
    }
  }, []);

  const loadFeed = useCallback(async () => {
    setFeedLoading(true);
    try {
      const data = await api.getPosts({
        q: activeSearch,
        category: activeCategory,
        tag: activeTag,
        page,
        per_page: 6,
      });
      setPostsData(data);
    } catch (err) {
      pushFlash('error', err instanceof Error ? err.message : 'Unable to load articles.');
    } finally {
      setFeedLoading(false);
    }
  }, [activeSearch, activeCategory, activeTag, page]);

  useEffect(() => {
    api
      .getMe()
      .then((res) => setCurrentUser(res.user))
      .catch(() => setCurrentUser(null))
      .finally(() => setAuthReady(true));
    loadMetadata();
  }, [loadMetadata]);

  useEffect(() => {
    if (route.name === 'home') {
      loadFeed();
    }
  }, [route.name, loadFeed]);

  async function openPostDetail(postId: number) {
    setRoute({ name: 'post', postId });
    setDetailLoading(true);
    setConfirmDeletePost(false);
    setCommentError('');
    setEditingCommentId(null);
    setConfirmDeleteCommentId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      const data = await api.getPost(postId);
      setDetailPost(data.post);
      setDetailComments(data.comments);
    } catch (err) {
      pushFlash('error', err instanceof Error ? err.message : 'Article not found.');
      setRoute({ name: 'home' });
    } finally {
      setDetailLoading(false);
    }
  }

  function openCreateEditor() {
    if (!currentUser) {
      pushFlash('info', 'Please sign in to write and publish articles.');
      setRoute({ name: 'auth', mode: 'login' });
      return;
    }
    setEditorTitle('');
    setEditorSummary('');
    setEditorCategoryId(categories[0]?.id || 1);
    setEditorTags('');
    setEditorContent('<p></p>');
    setEditorErrors({});
    setRoute({ name: 'editor' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openEditEditor(post: Post) {
    if (!currentUser || currentUser.id !== post.user_id) {
      pushFlash('error', 'You do not have permission to edit this post.');
      return;
    }
    setEditorTitle(post.title);
    setEditorSummary(post.summary);
    setEditorCategoryId(post.category_id || categories[0]?.id || 1);
    setEditorTags(post.tags.join(', '));
    setEditorContent(post.content);
    setEditorErrors({});
    setRoute({ name: 'editor', postId: post.id });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function openProfile(username?: string) {
    const targetUsername = username || currentUser?.username;
    if (!targetUsername) {
      setRoute({ name: 'auth', mode: 'login' });
      return;
    }
    setRoute({ name: 'profile', username: targetUsername });
    setProfileLoading(true);
    setProfileErrors({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      const data = await api.getAuthorProfile(targetUsername);
      setProfileAuthor(data.author);
      setProfilePosts(data.posts);
      if (currentUser && data.author.id === currentUser.id) {
        setProfileUsername(currentUser.username);
        setProfileEmail(currentUser.email);
        setProfileBio(currentUser.bio);
      }
    } catch (err) {
      pushFlash('error', err instanceof Error ? err.message : 'Author profile not found.');
      setRoute({ name: 'home' });
    } finally {
      setProfileLoading(false);
    }
  }

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    setActiveSearch(searchInput.trim());
  }

  function clearFilters() {
    setSearchInput('');
    setActiveSearch('');
    setActiveCategory('');
    setActiveTag('');
    setPage(1);
  }

  async function handleAuthSubmit(e: FormEvent) {
    e.preventDefault();
    if (route.name !== 'auth') return;
    setAuthErrors({});
    setAuthFormError('');
    setAuthSubmitting(true);
    try {
      if (route.mode === 'register') {
        const user = await api.register({
          username: authUsername,
          email: authEmail,
          password: authPassword,
          confirmPassword: authConfirmPassword,
        });
        setCurrentUser(user);
        pushFlash('success', `Welcome to Inkwell, ${user.username}. Your account is ready.`);
      } else {
        const user = await api.login({
          email: authEmail,
          password: authPassword,
          rememberMe,
        });
        setCurrentUser(user);
        pushFlash('success', `Welcome back, ${user.username}.`);
      }
      setAuthPassword('');
      setAuthConfirmPassword('');
      setRoute({ name: 'home' });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fields) setAuthErrors(err.fields);
        else setAuthFormError(err.message);
      } else {
        setAuthFormError('Unable to sign in right now.');
      }
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleLogout() {
    await api.logout();
    setCurrentUser(null);
    pushFlash('info', 'You have been signed out.');
    if (route.name === 'editor' || route.name === 'profile') {
      setRoute({ name: 'home' });
    }
  }

  async function handleSavePost(e: FormEvent) {
    e.preventDefault();
    if (route.name !== 'editor') return;
    setEditorErrors({});
    setEditorSubmitting(true);
    try {
      const payload = {
        title: editorTitle,
        summary: editorSummary,
        category_id: editorCategoryId,
        tags_input: editorTags,
        content: editorContent,
      };
      const res = route.postId
        ? await api.updatePost(route.postId, payload)
        : await api.createPost(payload);

      await loadMetadata();
      pushFlash('success', route.postId ? 'Article updated.' : 'Article published.');
      await openPostDetail(res.post.id);
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setEditorErrors(err.fields);
      } else {
        pushFlash('error', err instanceof Error ? err.message : 'Unable to save article.');
      }
    } finally {
      setEditorSubmitting(false);
    }
  }

  async function handleDeletePost(postId: number) {
    try {
      await api.deletePost(postId);
      await loadMetadata();
      pushFlash('info', 'Your article has been deleted.');
      setRoute({ name: 'home' });
      loadFeed();
    } catch (err) {
      pushFlash('error', err instanceof Error ? err.message : 'Unable to delete article.');
    }
  }

  async function handleAddComment(e: FormEvent) {
    e.preventDefault();
    if (!detailPost) return;
    setCommentError('');
    try {
      const res = await api.addComment(detailPost.id, newCommentBody);
      setDetailComments((prev) => [res.comment, ...prev]);
      setDetailPost((prev) =>
        prev ? { ...prev, comment_count: prev.comment_count + 1 } : prev
      );
      setNewCommentBody('');
      pushFlash('success', 'Comment posted.');
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Unable to post comment.');
    }
  }

  async function handleUpdateComment(commentId: number) {
    try {
      const res = await api.updateComment(commentId, editingCommentBody);
      setDetailComments((prev) => prev.map((c) => (c.id === commentId ? res.comment : c)));
      setEditingCommentId(null);
      pushFlash('success', 'Comment updated.');
    } catch (err) {
      pushFlash('error', err instanceof Error ? err.message : 'Unable to update comment.');
    }
  }

  async function handleDeleteComment(commentId: number) {
    try {
      await api.deleteComment(commentId);
      setDetailComments((prev) => prev.filter((c) => c.id !== commentId));
      setDetailPost((prev) =>
        prev ? { ...prev, comment_count: Math.max(0, prev.comment_count - 1) } : prev
      );
      setConfirmDeleteCommentId(null);
      pushFlash('info', 'Comment deleted.');
    } catch (err) {
      pushFlash('error', err instanceof Error ? err.message : 'Unable to delete comment.');
    }
  }

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setProfileErrors({});
    try {
      const res = await api.updateProfile({
        username: profileUsername,
        email: profileEmail,
        bio: profileBio,
      });
      setCurrentUser(res.user);
      setProfileAuthor(res.user);
      pushFlash('success', 'Profile updated.');
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setProfileErrors(err.fields);
      } else {
        pushFlash('error', err instanceof Error ? err.message : 'Unable to update profile.');
      }
    }
  }

  const isFiltering = Boolean(activeSearch || activeCategory || activeTag);
  const showLeadSplit = route.name === 'home' && !isFiltering && page === 1 && postsData.items.length > 0;
  const leadPost = showLeadSplit ? postsData.items[0] : null;
  const gridPosts = showLeadSplit ? postsData.items.slice(1) : postsData.items;

  return (
    <div className="min-h-screen flex flex-col bg-[#FBF9F5] text-stone-900">
      {/* Top Bar Contract: 3 clean zones separated by gap-8 */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-stone-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => {
              clearFilters();
              setRoute({ name: 'home' });
            }}
            className="font-display text-2xl font-bold tracking-tight text-stone-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-stone-900"
          >
            Inkwell
          </button>

          {/* Zone 2: 4 concise single-line nav links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-stone-600">
            <button
              type="button"
              onClick={() => setRoute({ name: 'home' })}
              className={`whitespace-nowrap shrink-0 transition-colors hover:text-stone-900 ${
                route.name === 'home' ? 'text-stone-900 underline underline-offset-8' : ''
              }`}
            >
              Articles
            </button>
            <button
              type="button"
              onClick={openCreateEditor}
              className={`whitespace-nowrap shrink-0 transition-colors hover:text-stone-900 ${
                route.name === 'editor' ? 'text-stone-900 underline underline-offset-8' : ''
              }`}
            >
              Write
            </button>
            <button
              type="button"
              onClick={() => setRoute({ name: 'flask-guide' })}
              className={`whitespace-nowrap shrink-0 transition-colors hover:text-stone-900 ${
                route.name === 'flask-guide' ? 'text-stone-900 underline underline-offset-8' : ''
              }`}
            >
              Flask Guide
            </button>
            {currentUser ? (
              <button
                type="button"
                onClick={() => openProfile(currentUser.username)}
                className={`whitespace-nowrap shrink-0 transition-colors hover:text-stone-900 ${
                  route.name === 'profile' ? 'text-stone-900 underline underline-offset-8' : ''
                }`}
              >
                {currentUser.username}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAuthErrors({});
                  setAuthFormError('');
                  setRoute({ name: 'auth', mode: 'register' });
                }}
                className={`whitespace-nowrap shrink-0 transition-colors hover:text-stone-900 ${
                  route.name === 'auth' && route.mode === 'register'
                    ? 'text-stone-900 underline underline-offset-8'
                    : ''
                }`}
              >
                Register
              </button>
            )}
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="shrink-0">
            {currentUser ? (
              <button
                type="button"
                onClick={openCreateEditor}
                className="px-4 py-2 text-xs font-semibold text-white bg-stone-900 rounded-md hover:bg-amber-900 transition-colors whitespace-nowrap shrink-0"
              >
                New Post
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAuthErrors({});
                  setAuthFormError('');
                  setRoute({ name: 'auth', mode: 'login' });
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-stone-900 rounded-md hover:bg-amber-900 transition-colors whitespace-nowrap shrink-0"
              >
                Sign In
              </button>
            )}
          </div>
        </div>

        {/* Compact mobile navigation */}
        <div className="md:hidden border-t border-stone-100 px-4 py-2 flex items-center justify-between text-xs font-medium text-stone-600 overflow-x-auto gap-4">
          <button type="button" onClick={() => setRoute({ name: 'home' })} className="whitespace-nowrap">
            Articles
          </button>
          <button type="button" onClick={openCreateEditor} className="whitespace-nowrap">
            Write
          </button>
          <button type="button" onClick={() => setRoute({ name: 'flask-guide' })} className="whitespace-nowrap">
            Flask Guide
          </button>
          {currentUser ? (
            <button type="button" onClick={() => openProfile(currentUser.username)} className="whitespace-nowrap">
              Profile
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setRoute({ name: 'auth', mode: 'register' })}
              className="whitespace-nowrap"
            >
              Register
            </button>
          )}
        </div>
      </header>

      {/* Flash Messages Banner */}
      {flashes.length > 0 && (
        <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-4 space-y-2">
          {flashes.map((flash) => (
            <div
              key={flash.id}
              role="status"
              className={`flex items-center justify-between gap-4 px-4 py-3 rounded-md border text-sm ${
                flash.type === 'error'
                  ? 'bg-red-50 border-red-200 text-red-900'
                  : flash.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-stone-100 border-stone-300 text-stone-800'
              }`}
            >
              <span>{flash.text}</span>
              <button
                type="button"
                aria-label="Dismiss message"
                onClick={() => setFlashes((prev) => prev.filter((f) => f.id !== flash.id))}
                className="p-1 opacity-70 hover:opacity-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 md:py-10">
        {/* VIEW 1: HOME / ARTICLES FEED */}
        {route.name === 'home' && (
          <div className="space-y-10">
            {/* Editorial Masthead */}
            <section className="border-b border-stone-200 pb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div>
                <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">
                  Editorial Archive &middot; Python Flask Full-Stack Edition
                </p>
                <h1 className="font-display text-4xl md:text-5xl font-bold text-stone-900 tracking-tight text-balance">
                  Essays on Architecture, Databases &amp; Craft
                </h1>
              </div>

              <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full lg:w-96 shrink-0">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                  <input
                    type="search"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search title or content..."
                    aria-label="Search articles"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-stone-300 rounded-md focus:outline-none focus:border-stone-900"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-md hover:bg-amber-900 transition-colors whitespace-nowrap shrink-0"
                >
                  Search
                </button>
              </form>
            </section>

            {/* Category Segmented Controls & Topic Tags */}
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-1 p-1 bg-stone-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCategory('');
                      setPage(1);
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      activeCategory === ''
                        ? 'bg-white text-stone-900 shadow-sm'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    All Topics
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setActiveCategory(cat.slug);
                        setPage(1);
                      }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        activeCategory === cat.slug
                          ? 'bg-white text-stone-900 shadow-sm'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>

                {isFiltering && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-xs font-medium text-amber-900 hover:underline underline-offset-4 whitespace-nowrap"
                  >
                    Clear active filters ({postsData.total} shown)
                  </button>
                )}
              </div>

              {tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
                  <span className="uppercase tracking-wider text-[11px] text-stone-400">Tags:</span>
                  {tags.slice(0, 10).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setActiveTag(activeTag === t.name ? '' : t.name);
                        setPage(1);
                      }}
                      className={`transition-colors ${
                        activeTag === t.name
                          ? 'font-semibold text-amber-900 underline underline-offset-4'
                          : 'hover:text-stone-900'
                      }`}
                    >
                      #{t.name}
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Lead Story Feature (Tier 1 Editorial Salience) */}
            {!feedLoading && leadPost && (
              <section className="bg-white border border-stone-200 rounded-lg overflow-hidden grid lg:grid-cols-12 items-stretch">
                <div className="lg:col-span-7 bg-stone-100">
                  <button
                    type="button"
                    onClick={() => openPostDetail(leadPost.id)}
                    className="block w-full h-full text-left"
                  >
                    <img
                      src={leadPost.cover_image}
                      alt={leadPost.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-64 lg:h-full object-cover"
                    />
                  </button>
                </div>
                <div className="lg:col-span-5 p-6 md:p-8 flex flex-col justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500 mb-3">
                      <span className="font-semibold text-amber-900">{leadPost.category_name}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{formatShortDate(leadPost.created_at)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{leadPost.reading_minutes} min read</span>
                    </div>

                    <h2 className="font-display text-2xl md:text-3xl font-bold text-stone-900 leading-tight mb-3 text-balance">
                      <button
                        type="button"
                        onClick={() => openPostDetail(leadPost.id)}
                        className="text-left hover:text-amber-900 transition-colors"
                      >
                        {leadPost.title}
                      </button>
                    </h2>

                    <p className="text-sm md:text-base text-stone-600 leading-relaxed mb-6">
                      {leadPost.summary}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-stone-100 flex items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => openProfile(leadPost.author_username)}
                      className="text-xs font-semibold text-stone-800 hover:underline underline-offset-4"
                    >
                      By {leadPost.author_username}
                    </button>
                    <button
                      type="button"
                      onClick={() => openPostDetail(leadPost.id)}
                      className="px-4 py-2 text-xs font-semibold bg-stone-900 text-white rounded-md hover:bg-amber-900 transition-colors whitespace-nowrap"
                    >
                      Read Essay
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* Posts Grid */}
            {feedLoading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-80 bg-white border border-stone-200 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : gridPosts.length > 0 ? (
              <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {gridPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onOpenPost={openPostDetail}
                    onOpenAuthor={openProfile}
                    onFilterTag={(tag) => {
                      setActiveTag(tag);
                      setPage(1);
                    }}
                  />
                ))}
              </section>
            ) : !leadPost ? (
              <section className="bg-white border border-stone-200 rounded-lg p-12 text-center">
                <h2 className="font-display text-2xl font-bold text-stone-900 mb-2">
                  No matching articles found
                </h2>
                <p className="text-sm text-stone-600 mb-5">
                  Try a broader search phrase or clear your active category and tag filters.
                </p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="px-4 py-2 text-xs font-semibold bg-stone-900 text-white rounded-md hover:bg-amber-900 transition-colors"
                >
                  Show All Articles
                </button>
              </section>
            ) : null}

            {/* Pagination */}
            {postsData.pages > 1 && (
              <nav aria-label="Pagination" className="pt-4 flex items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={postsData.page <= 1}
                  onClick={() => {
                    setPage((p) => Math.max(1, p - 1));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="px-3.5 py-2 text-xs font-medium bg-white border border-stone-300 rounded-md disabled:opacity-40 hover:border-stone-800 transition-colors"
                >
                  Previous
                </button>
                {Array.from({ length: postsData.pages }, (_, i) => i + 1).map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      setPage(num);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={`px-3.5 py-2 text-xs font-medium rounded-md tabular-nums transition-colors ${
                      num === postsData.page
                        ? 'bg-stone-900 text-white'
                        : 'bg-white border border-stone-300 text-stone-700 hover:border-stone-800'
                    }`}
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={postsData.page >= postsData.pages}
                  onClick={() => {
                    setPage((p) => Math.min(postsData.pages, p + 1));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="px-3.5 py-2 text-xs font-medium bg-white border border-stone-300 rounded-md disabled:opacity-40 hover:border-stone-800 transition-colors"
                >
                  Next
                </button>
              </nav>
            )}
          </div>
        )}

        {/* VIEW 2: INDIVIDUAL ARTICLE + COMMENTS */}
        {route.name === 'post' && (
          <div className="max-w-4xl mx-auto space-y-8">
            <button
              type="button"
              onClick={() => setRoute({ name: 'home' })}
              className="inline-flex items-center gap-2 text-xs font-medium text-stone-600 hover:text-stone-900"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Articles
            </button>

            {detailLoading || !detailPost ? (
              <div className="h-96 bg-white border border-stone-200 rounded-lg animate-pulse" />
            ) : (
              <>
                <article className="bg-white border border-stone-200 rounded-lg overflow-hidden">
                  {detailPost.cover_image && (
                    <PostCoverImage
                      src={detailPost.cover_image}
                      alt={detailPost.title}
                      title={detailPost.title}
                      aspectClass="aspect-[16/9]"
                    />
                  )}

                  <div className="p-6 md:p-10">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 mb-3">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveCategory(detailPost.category_slug);
                          setPage(1);
                          setRoute({ name: 'home' });
                        }}
                        className="font-semibold text-amber-900 hover:underline underline-offset-4"
                      >
                        {detailPost.category_name}
                      </button>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{formatShortDate(detailPost.created_at)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{detailPost.reading_minutes} min read</span>
                    </div>

                    <h1 className="font-display text-3xl md:text-4xl font-bold text-stone-900 leading-tight mb-5 text-balance">
                      {detailPost.title}
                    </h1>

                    <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-8 border-b border-stone-200">
                      <div className="text-sm text-stone-600">
                        Written by{' '}
                        <button
                          type="button"
                          onClick={() => openProfile(detailPost.author_username)}
                          className="font-semibold text-stone-900 hover:underline underline-offset-4"
                        >
                          {detailPost.author_username}
                        </button>
                      </div>

                      {currentUser && currentUser.id === detailPost.user_id && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditEditor(detailPost)}
                            className="px-3 py-1.5 text-xs font-medium border border-stone-300 rounded-md hover:border-stone-900 transition-colors"
                          >
                            Edit Post
                          </button>

                          {!confirmDeletePost ? (
                            <button
                              type="button"
                              onClick={() => setConfirmDeletePost(true)}
                              className="px-3 py-1.5 text-xs font-medium text-red-700 border border-red-200 rounded-md hover:bg-red-50 transition-colors"
                            >
                              Delete
                            </button>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleDeletePost(detailPost.id)}
                                className="px-3 py-1.5 text-xs font-semibold text-white bg-red-700 rounded-md hover:bg-red-800"
                              >
                                Confirm Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeletePost(false)}
                                className="px-2.5 py-1.5 text-xs text-stone-600 hover:text-stone-900"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div
                      className="editorial-prose"
                      dangerouslySetInnerHTML={{ __html: detailPost.content }}
                    />

                    {detailPost.tags.length > 0 && (
                      <div className="pt-6 mt-8 border-t border-stone-200 flex flex-wrap gap-4 text-xs text-stone-500">
                        {detailPost.tags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => {
                              setActiveTag(tag);
                              setPage(1);
                              setRoute({ name: 'home' });
                            }}
                            className="hover:text-stone-900 transition-colors"
                          >
                            #{tag}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </article>

                {/* Comments System (Week 5) */}
                <section id="comments" className="bg-white border border-stone-200 rounded-lg p-6 md:p-8">
                  <h2 className="font-display text-2xl font-bold text-stone-900 mb-6 tabular-nums">
                    Comments ({detailComments.length})
                  </h2>

                  {currentUser ? (
                    <form onSubmit={handleAddComment} className="mb-8 space-y-3">
                      <textarea
                        value={newCommentBody}
                        onChange={(e) => setNewCommentBody(e.target.value)}
                        rows={3}
                        placeholder="Share a thoughtful response..."
                        className="w-full p-3 text-sm border border-stone-300 rounded-md focus:outline-none focus:border-stone-900"
                      />
                      {commentError && <p className="text-xs text-red-700">{commentError}</p>}
                      <button
                        type="submit"
                        className="px-4 py-2 text-xs font-semibold bg-stone-900 text-white rounded-md hover:bg-amber-900 transition-colors"
                      >
                        Post Comment
                      </button>
                    </form>
                  ) : (
                    <div className="mb-8 pb-6 border-b border-stone-200 text-sm text-stone-600">
                      <button
                        type="button"
                        onClick={() => setRoute({ name: 'auth', mode: 'login' })}
                        className="font-semibold text-stone-900 underline underline-offset-4"
                      >
                        Sign in
                      </button>{' '}
                      to leave a comment on this essay.
                    </div>
                  )}

                  {detailComments.length > 0 ? (
                    <div className="space-y-4">
                      {detailComments.map((comment) => {
                        const isCommentAuthor = currentUser && currentUser.id === comment.user_id;
                        const isEditing = editingCommentId === comment.id;

                        return (
                          <div key={comment.id} className="border border-stone-200 rounded-md p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2 text-xs">
                              <div>
                                <button
                                  type="button"
                                  onClick={() => openProfile(comment.author_username)}
                                  className="font-semibold text-stone-900 hover:underline underline-offset-4"
                                >
                                  {comment.author_username}
                                </button>
                                <span className="text-stone-400 mx-1.5">&middot;</span>
                                <span className="text-stone-500 tabular-nums">
                                  {formatShortDate(comment.created_at)}
                                </span>
                              </div>

                              {isCommentAuthor && !isEditing && (
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingCommentId(comment.id);
                                      setEditingCommentBody(comment.body);
                                      setConfirmDeleteCommentId(null);
                                    }}
                                    className="text-stone-700 hover:text-stone-900 font-medium"
                                  >
                                    Edit
                                  </button>

                                  {confirmDeleteCommentId === comment.id ? (
                                    <span className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteComment(comment.id)}
                                        className="text-red-700 font-semibold hover:underline"
                                      >
                                        Confirm
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteCommentId(null)}
                                        className="text-stone-500 hover:text-stone-900"
                                      >
                                        Cancel
                                      </button>
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteCommentId(comment.id)}
                                      className="text-red-700 hover:underline inline-flex items-center gap-1"
                                    >
                                      <Trash2 className="w-3 h-3" aria-hidden="true" />
                                      Delete
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            {isEditing ? (
                              <div className="space-y-2 mt-2">
                                <textarea
                                  value={editingCommentBody}
                                  onChange={(e) => setEditingCommentBody(e.target.value)}
                                  rows={3}
                                  className="w-full p-2.5 text-sm border border-stone-300 rounded-md focus:outline-none focus:border-stone-900"
                                />
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateComment(comment.id)}
                                    className="px-3 py-1.5 text-xs font-semibold bg-stone-900 text-white rounded-md hover:bg-amber-900"
                                  >
                                    Save Changes
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingCommentId(null)}
                                    className="px-3 py-1.5 text-xs text-stone-600 hover:text-stone-900"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">
                                {comment.body}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-stone-500">
                      No comments yet. Start the conversation above.
                    </p>
                  )}
                </section>
              </>
            )}
          </div>
        )}

        {/* VIEW 3: CREATE / EDIT POST WITH RICH TEXT */}
        {route.name === 'editor' && (
          <div className="max-w-3xl mx-auto">
            <div className="bg-white border border-stone-200 rounded-lg p-6 md:p-8">
              <h1 className="font-display text-3xl font-bold text-stone-900 mb-1">
                {route.postId ? 'Edit Article' : 'Write New Article'}
              </h1>
              <p className="text-sm text-stone-600 mb-6">
                Format headings, emphasis, lists, quotes, and code blocks with the rich text editor.
              </p>

              <form onSubmit={handleSavePost} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Article Title
                  </label>
                  <input
                    type="text"
                    value={editorTitle}
                    onChange={(e) => setEditorTitle(e.target.value)}
                    placeholder="Enter a clear, compelling headline"
                    className={`w-full px-3.5 py-2.5 text-sm border rounded-md focus:outline-none ${
                      editorErrors.title
                        ? 'border-red-500'
                        : 'border-stone-300 focus:border-stone-900'
                    }`}
                  />
                  {editorErrors.title && (
                    <p className="text-xs text-red-700 mt-1">{editorErrors.title}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Short Summary
                  </label>
                  <input
                    type="text"
                    value={editorSummary}
                    onChange={(e) => setEditorSummary(e.target.value)}
                    placeholder="One-sentence overview shown on the home feed"
                    className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-md focus:outline-none focus:border-stone-900"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                      Category
                    </label>
                    <select
                      value={editorCategoryId}
                      onChange={(e) => setEditorCategoryId(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md bg-white focus:outline-none focus:border-stone-900"
                    >
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                      Tags (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={editorTags}
                      onChange={(e) => setEditorTags(e.target.value)}
                      placeholder="flask, sqlalchemy, patterns"
                      className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-md focus:outline-none focus:border-stone-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Article Body
                  </label>
                  <RichTextEditor
                    value={editorContent}
                    onChange={setEditorContent}
                    hasError={Boolean(editorErrors.content)}
                  />
                  {editorErrors.content && (
                    <p className="text-xs text-red-700 mt-1">{editorErrors.content}</p>
                  )}
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={editorSubmitting}
                    className="px-5 py-2.5 text-sm font-semibold bg-stone-900 text-white rounded-md hover:bg-amber-900 disabled:opacity-50 transition-colors"
                  >
                    {editorSubmitting
                      ? 'Saving...'
                      : route.postId
                      ? 'Update Article'
                      : 'Publish Article'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      route.postId ? openPostDetail(route.postId) : setRoute({ name: 'home' })
                    }
                    className="px-4 py-2.5 text-sm text-stone-600 hover:text-stone-900"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* VIEW 4: SIGN IN / REGISTER */}
        {route.name === 'auth' && (
          <div className="max-w-md mx-auto">
            <div className="bg-white border border-stone-200 rounded-lg p-6 md:p-8">
              <h1 className="font-display text-3xl font-bold text-stone-900 mb-1">
                {route.mode === 'register' ? 'Create Account' : 'Sign In'}
              </h1>
              <p className="text-sm text-stone-600 mb-6">
                {route.mode === 'register'
                  ? 'Register to write essays, manage your posts, and join discussions.'
                  : 'Welcome back. Enter your email and password to continue.'}
              </p>

              {authFormError && (
                <div className="mb-4 px-3.5 py-2.5 text-xs bg-red-50 border border-red-200 text-red-800 rounded">
                  {authFormError}
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                {route.mode === 'register' && (
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                      Username
                    </label>
                    <input
                      type="text"
                      value={authUsername}
                      onChange={(e) => setAuthUsername(e.target.value)}
                      placeholder="elena_vance"
                      className={`w-full px-3.5 py-2 text-sm border rounded-md focus:outline-none ${
                        authErrors.username
                          ? 'border-red-500'
                          : 'border-stone-300 focus:border-stone-900'
                      }`}
                    />
                    {authErrors.username && (
                      <p className="text-xs text-red-700 mt-1">{authErrors.username}</p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={`w-full px-3.5 py-2 text-sm border rounded-md focus:outline-none ${
                      authErrors.email
                        ? 'border-red-500'
                        : 'border-stone-300 focus:border-stone-900'
                    }`}
                  />
                  {authErrors.email && (
                    <p className="text-xs text-red-700 mt-1">{authErrors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className={`w-full px-3.5 py-2 text-sm border rounded-md focus:outline-none ${
                      authErrors.password
                        ? 'border-red-500'
                        : 'border-stone-300 focus:border-stone-900'
                    }`}
                  />
                  {authErrors.password && (
                    <p className="text-xs text-red-700 mt-1">{authErrors.password}</p>
                  )}
                </div>

                {route.mode === 'register' ? (
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={authConfirmPassword}
                      onChange={(e) => setAuthConfirmPassword(e.target.value)}
                      className={`w-full px-3.5 py-2 text-sm border rounded-md focus:outline-none ${
                        authErrors.confirmPassword
                          ? 'border-red-500'
                          : 'border-stone-300 focus:border-stone-900'
                      }`}
                    />
                    {authErrors.confirmPassword && (
                      <p className="text-xs text-red-700 mt-1">{authErrors.confirmPassword}</p>
                    )}
                  </div>
                ) : (
                  <label className="flex items-center gap-2 text-xs text-stone-700">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-stone-300"
                    />
                    Remember me for 14 days
                  </label>
                )}

                <button
                  type="submit"
                  disabled={authSubmitting}
                  className="w-full py-2.5 text-sm font-semibold bg-stone-900 text-white rounded-md hover:bg-amber-900 disabled:opacity-50 transition-colors"
                >
                  {authSubmitting
                    ? 'Please wait...'
                    : route.mode === 'register'
                    ? 'Create Account'
                    : 'Sign In'}
                </button>
              </form>

              {route.mode === 'login' && (
                <div className="mt-4 pt-4 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthEmail('editor@inkwell.dev');
                      setAuthPassword('StrongPass123!');
                    }}
                    className="w-full py-2 text-xs font-medium text-stone-700 bg-stone-100 rounded-md hover:bg-stone-200 transition-colors"
                  >
                    Fill Demo Author Credentials (editor@inkwell.dev)
                  </button>
                </div>
              )}

              <p className="text-xs text-stone-600 text-center mt-5">
                {route.mode === 'register' ? (
                  <>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthErrors({});
                        setAuthFormError('');
                        setRoute({ name: 'auth', mode: 'login' });
                      }}
                      className="font-semibold text-stone-900 underline underline-offset-4"
                    >
                      Sign In
                    </button>
                  </>
                ) : (
                  <>
                    New to Inkwell?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthErrors({});
                        setAuthFormError('');
                        setRoute({ name: 'auth', mode: 'register' });
                      }}
                      className="font-semibold text-stone-900 underline underline-offset-4"
                    >
                      Create an account
                    </button>
                  </>
                )}
              </p>
            </div>
          </div>
        )}

        {/* VIEW 5: USER PROFILE */}
        {route.name === 'profile' && (
          <div className="grid lg:grid-cols-12 gap-8">
            <aside className="lg:col-span-4">
              <div className="bg-white border border-stone-200 rounded-lg p-6">
                {profileLoading || !profileAuthor ? (
                  <p className="text-sm text-stone-500">Loading profile...</p>
                ) : (
                  <>
                    <h1 className="font-display text-2xl font-bold text-stone-900">
                      {profileAuthor.username}
                    </h1>
                    <p className="text-xs text-stone-500 mt-1 mb-4">
                      Member since {formatShortDate(profileAuthor.created_at)}
                    </p>
                    <p className="text-sm text-stone-700 leading-relaxed">
                      {profileAuthor.bio || 'No biography added yet.'}
                    </p>

                    {currentUser && currentUser.id === profileAuthor.id && (
                      <>
                        <hr className="my-5 border-stone-200" />
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-3">
                          Profile Settings
                        </h2>
                        <form onSubmit={handleSaveProfile} className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-stone-700 mb-1">
                              Username
                            </label>
                            <input
                              type="text"
                              value={profileUsername}
                              onChange={(e) => setProfileUsername(e.target.value)}
                              className="w-full px-3 py-1.5 text-sm border border-stone-300 rounded focus:outline-none focus:border-stone-900"
                            />
                            {profileErrors.username && (
                              <p className="text-xs text-red-700 mt-1">{profileErrors.username}</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-stone-700 mb-1">
                              Email
                            </label>
                            <input
                              type="email"
                              value={profileEmail}
                              onChange={(e) => setProfileEmail(e.target.value)}
                              className="w-full px-3 py-1.5 text-sm border border-stone-300 rounded focus:outline-none focus:border-stone-900"
                            />
                            {profileErrors.email && (
                              <p className="text-xs text-red-700 mt-1">{profileErrors.email}</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-stone-700 mb-1">
                              Bio
                            </label>
                            <textarea
                              value={profileBio}
                              onChange={(e) => setProfileBio(e.target.value)}
                              rows={3}
                              className="w-full px-3 py-1.5 text-sm border border-stone-300 rounded focus:outline-none focus:border-stone-900"
                            />
                          </div>
                          <div className="flex items-center justify-between pt-2">
                            <button
                              type="submit"
                              className="px-4 py-2 text-xs font-semibold bg-stone-900 text-white rounded-md hover:bg-amber-900"
                            >
                              Save Profile
                            </button>
                            <button
                              type="button"
                              onClick={handleLogout}
                              className="text-xs font-medium text-stone-600 hover:text-stone-900"
                            >
                              Sign Out
                            </button>
                          </div>
                        </form>
                      </>
                    )}
                  </>
                )}
              </div>
            </aside>

            <section className="lg:col-span-8 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl font-bold text-stone-900 tabular-nums">
                  Published Articles ({profilePosts.length})
                </h2>
                {currentUser && profileAuthor && currentUser.id === profileAuthor.id && (
                  <button
                    type="button"
                    onClick={openCreateEditor}
                    className="px-3.5 py-2 text-xs font-semibold bg-stone-900 text-white rounded-md hover:bg-amber-900"
                  >
                    Write New Post
                  </button>
                )}
              </div>

              {profilePosts.length > 0 ? (
                <div className="space-y-4">
                  {profilePosts.map((post) => (
                    <article
                      key={post.id}
                      className="bg-white border border-stone-200 rounded-lg p-5 flex flex-col gap-3"
                    >
                      <div className="flex items-center gap-2 text-xs text-stone-500">
                        <span className="font-medium text-stone-700">{post.category_name}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{formatShortDate(post.created_at)}</span>
                      </div>
                      <h3 className="font-display text-xl font-bold text-stone-900">
                        <button
                          type="button"
                          onClick={() => openPostDetail(post.id)}
                          className="text-left hover:text-amber-900 transition-colors"
                        >
                          {post.title}
                        </button>
                      </h3>
                      <p className="text-sm text-stone-600">{post.summary}</p>
                      {currentUser && currentUser.id === post.user_id && (
                        <div className="flex items-center gap-3 pt-2 border-t border-stone-100 text-xs">
                          <button
                            type="button"
                            onClick={() => openEditEditor(post)}
                            className="font-medium text-stone-800 hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => openPostDetail(post.id)}
                            className="text-stone-500 hover:text-stone-900"
                          >
                            View &amp; Manage
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="bg-white border border-stone-200 rounded-lg p-8 text-center text-sm text-stone-500">
                  No articles published yet.
                </div>
              )}
            </section>
          </div>
        )}

        {/* VIEW 6: 7-WEEK FLASK CURRICULUM & CODEBASE EXPLORER */}
        {route.name === 'flask-guide' && <FlaskCurriculumView />}
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-stone-200 bg-white mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500">
          <span>Inkwell Journal &middot; Full-Stack Python Flask 7-Week Reference &amp; Live SQLite Workspace</span>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => setRoute({ name: 'home' })}
              className="hover:text-stone-900 transition-colors"
            >
              Articles
            </button>
            <button
              type="button"
              onClick={() => setRoute({ name: 'flask-guide' })}
              className="hover:text-stone-900 transition-colors"
            >
              7-Week Flask Codebase
            </button>
            {authReady && currentUser ? (
              <button
                type="button"
                onClick={handleLogout}
                className="hover:text-stone-900 transition-colors"
              >
                Sign Out ({currentUser.username})
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setRoute({ name: 'auth', mode: 'login' })}
                className="hover:text-stone-900 transition-colors"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

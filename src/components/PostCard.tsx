import { BookOpen } from 'lucide-react';
import { useState } from 'react';
import type { Post } from '../types';

interface PostCardProps {
  post: Post;
  onOpenPost: (postId: number) => void;
  onOpenAuthor: (username: string) => void;
  onFilterTag: (tag: string) => void;
}

export function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function stripHtmlExcerpt(html: string, maxLen = 145): string {
  const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (plain.length <= maxLen) return plain;
  return `${plain.slice(0, maxLen).trimEnd()}...`;
}

export function PostCoverImage({
  src,
  alt,
  title,
  aspectClass = 'aspect-[4/3]',
}: {
  src: string;
  alt: string;
  title: string;
  aspectClass?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`${aspectClass} w-full bg-gradient-to-br from-stone-100 via-stone-200/70 to-stone-100 border-b border-stone-200 flex flex-col items-center justify-center px-6 text-center`}
      >
        <BookOpen className="w-6 h-6 text-stone-400 mb-2" aria-hidden="true" />
        <p className="font-display text-sm text-stone-600 line-clamp-2">{title}</p>
      </div>
    );
  }

  return (
    <div className={`${aspectClass} w-full overflow-hidden bg-stone-100 border-b border-stone-200`}>
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
      />
    </div>
  );
}

export function PostCard({ post, onOpenPost, onOpenAuthor, onFilterTag }: PostCardProps) {
  return (
    <article className="group bg-white border border-stone-200 rounded-lg overflow-hidden flex flex-col justify-between transition-colors duration-150 hover:border-stone-400">
      <div>
        <button
          type="button"
          onClick={() => onOpenPost(post.id)}
          className="block w-full text-left focus-visible:outline-2 focus-visible:outline-stone-900"
        >
          <PostCoverImage src={post.cover_image} alt={post.title} title={post.title} />
        </button>

        <div className="p-5">
          {/* Zero-Pill Metadata Line */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500 mb-2">
            <span className="font-medium text-stone-700">{post.category_name}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{formatShortDate(post.created_at)}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{post.reading_minutes} min read</span>
          </div>

          <h3 className="font-display text-xl font-semibold text-stone-900 leading-snug mb-2">
            <button
              type="button"
              onClick={() => onOpenPost(post.id)}
              className="text-left hover:text-amber-900 transition-colors focus-visible:outline-2 focus-visible:outline-stone-900"
            >
              {post.title}
            </button>
          </h3>

          <p className="text-sm text-stone-600 leading-relaxed mb-4">
            {post.summary || stripHtmlExcerpt(post.content)}
          </p>
        </div>
      </div>

      <div className="px-5 pb-5 pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2 text-xs">
        <button
          type="button"
          onClick={() => onOpenAuthor(post.author_username)}
          className="font-medium text-stone-800 hover:underline underline-offset-4"
        >
          By {post.author_username}
        </button>

        <div className="flex items-center gap-3 text-stone-500">
          {post.tags.slice(0, 2).map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onFilterTag(tag)}
              className="hover:text-stone-900 transition-colors"
            >
              #{tag}
            </button>
          ))}
          <span className="tabular-nums">{post.comment_count} comments</span>
        </div>
      </div>
    </article>
  );
}

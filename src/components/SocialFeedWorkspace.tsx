import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { MygramUser } from "../lib/supabase";
import { supabase } from "../lib/supabase";

type PublicProfile = {
  id: string;
  username: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

type PostRow = {
  id: string;
  user_id: string;
  content: string;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
};

type CommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  parent_comment_id: string | null;
};

type ReactionRow = {
  id: string;
  post_id: string;
  user_id: string;
  reaction: string;
};

type FeedPost = PostRow & {
  author: PublicProfile | null;
  comments: Array<CommentRow & { author: PublicProfile | null }>;
  reactions: ReactionRow[];
};

const REACTIONS = [
  { key: "like", label: "إعجاب", glyph: "👍" },
  { key: "love", label: "أحببته", glyph: "❤️" },
  { key: "haha", label: "ضحكني", glyph: "😂" },
  { key: "care", label: "أهتم", glyph: "🥰" },
  { key: "wow", label: "مذهل", glyph: "😮" },
  { key: "sad", label: "أحزنني", glyph: "😢" },
  { key: "angry", label: "أغضبني", glyph: "😡" },
  { key: "fire", label: "رائع", glyph: "🔥" },
] as const;

function profileName(profile: PublicProfile | null, fallbackId?: string) {
  if (!profile) return fallbackId ? `مستخدم ${fallbackId.slice(0, 6)}` : "مستخدم MYGRAM";
  const firstLast = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
  return firstLast || profile.full_name || (profile.username ? `@${profile.username}` : "مستخدم MYGRAM");
}

function relativeTime(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("ar", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function reactionSummary(reactions: ReactionRow[]) {
  const counts = new Map<string, number>();
  for (const reaction of reactions) {
    counts.set(reaction.reaction, (counts.get(reaction.reaction) ?? 0) + 1);
  }
  return REACTIONS.filter((item) => (counts.get(item.key) ?? 0) > 0)
    .map((item) => ({ ...item, count: counts.get(item.key) ?? 0 }));
}

export function SocialFeedWorkspace({ user }: { user: MygramUser }) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [draft, setDraft] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [busyPost, setBusyPost] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadFeed = useCallback(async () => {
    if (!supabase) return;
    const { data: postRows, error: postError } = await supabase
      .from("posts")
      .select("id,user_id,content,media_url,media_type,created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (postError) {
      setError("تعذر تحميل موجز المنشورات. تحقق من صلاحيات قاعدة البيانات.");
      setLoading(false);
      return;
    }

    const rows = (postRows ?? []) as PostRow[];
    if (rows.length === 0) {
      setPosts([]);
      setLoading(false);
      return;
    }

    const postIds = rows.map((post) => post.id);
    const [commentResult, reactionResult] = await Promise.all([
      supabase.from("post_comments")
        .select("id,post_id,user_id,content,created_at,parent_comment_id")
        .in("post_id", postIds)
        .order("created_at", { ascending: true })
        .limit(500),
      supabase.from("post_reactions")
        .select("id,post_id,user_id,reaction")
        .in("post_id", postIds)
        .limit(1000),
    ]);

    const comments = (commentResult.data ?? []) as CommentRow[];
    const reactions = (reactionResult.data ?? []) as ReactionRow[];
    const profileIds = [...new Set([
      ...rows.map((post) => post.user_id),
      ...comments.map((comment) => comment.user_id),
    ])];

    const { data: profileRows } = await supabase
      .from("public_profiles")
      .select("id,username,full_name,first_name,last_name,avatar_url")
      .in("id", profileIds);

    const profileById = new Map<string, PublicProfile>(
      ((profileRows ?? []) as PublicProfile[]).map((profile) => [profile.id, profile]),
    );
    const commentsByPost = new Map<string, CommentRow[]>();
    for (const comment of comments) {
      commentsByPost.set(comment.post_id, [...(commentsByPost.get(comment.post_id) ?? []), comment]);
    }
    const reactionsByPost = new Map<string, ReactionRow[]>();
    for (const reaction of reactions) {
      reactionsByPost.set(reaction.post_id, [...(reactionsByPost.get(reaction.post_id) ?? []), reaction]);
    }

    setPosts(rows.map((post) => ({
      ...post,
      author: profileById.get(post.user_id) ?? null,
      comments: (commentsByPost.get(post.id) ?? []).map((comment) => ({
        ...comment,
        author: profileById.get(comment.user_id) ?? null,
      })),
      reactions: reactionsByPost.get(post.id) ?? [],
    })));
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void loadFeed().finally(() => { if (!active) return; });
    return () => { active = false; };
  }, [loadFeed]);

  const ownPostCount = useMemo(
    () => posts.filter((post) => post.user_id === user.id).length,
    [posts, user.id],
  );

  async function publishPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || publishing) return;
    const content = draft.trim();
    if (!content) {
      setError("اكتب شيئاً قبل النشر.");
      return;
    }
    if (content.length > 5000) {
      setError("المنشور يتجاوز الحد الأقصى البالغ 5000 حرف.");
      return;
    }

    setPublishing(true);
    setError("");
    setNotice("");
    try {
      const { error: insertError } = await supabase.from("posts").insert({
        user_id: user.id,
        content,
      });
      if (insertError) throw insertError;
      setDraft("");
      setNotice("تم نشر منشورك.");
      await loadFeed();
    } catch {
      setError("تعذر نشر المنشور. تحقق من الجلسة ثم أعد المحاولة.");
    } finally {
      setPublishing(false);
    }
  }

  async function addComment(postId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || busyPost) return;
    const content = (commentDrafts[postId] ?? "").trim();
    if (!content) return;
    if (content.length > 2000) {
      setError("التعليق يتجاوز الحد الأقصى البالغ 2000 حرف.");
      return;
    }

    setBusyPost(postId);
    setError("");
    try {
      const { error: insertError } = await supabase.from("post_comments").insert({
        post_id: postId,
        user_id: user.id,
        content,
      });
      if (insertError) throw insertError;
      setCommentDrafts((current) => ({ ...current, [postId]: "" }));
      await loadFeed();
    } catch {
      setError("تعذر إضافة التعليق.");
    } finally {
      setBusyPost(null);
    }
  }

  async function toggleReaction(post: FeedPost, reaction: string) {
    if (!supabase || busyPost) return;
    const existing = post.reactions.find((item) => item.user_id === user.id);
    setBusyPost(post.id);
    setError("");
    try {
      if (existing?.reaction === reaction) {
        const { error: deleteError } = await supabase.from("post_reactions")
          .delete().eq("post_id", post.id).eq("user_id", user.id);
        if (deleteError) throw deleteError;
      } else if (existing) {
        const { error: updateError } = await supabase.from("post_reactions")
          .update({ reaction }).eq("post_id", post.id).eq("user_id", user.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("post_reactions").insert({
          post_id: post.id,
          user_id: user.id,
          reaction,
        });
        if (insertError) throw insertError;
      }
      await loadFeed();
    } catch {
      setError("تعذر حفظ التفاعل. قد يكون هناك تفاعل آخر قيد الحفظ.");
    } finally {
      setBusyPost(null);
    }
  }

  async function deletePost(postId: string) {
    if (!supabase || busyPost) return;
    setBusyPost(postId);
    setError("");
    try {
      const { error: deleteError } = await supabase.from("posts").delete()
        .eq("id", postId).eq("user_id", user.id);
      if (deleteError) throw deleteError;
      await loadFeed();
      setNotice("تم حذف المنشور.");
    } catch {
      setError("تعذر حذف المنشور.");
    } finally {
      setBusyPost(null);
    }
  }

  async function deleteComment(commentId: string, postId: string) {
    if (!supabase || busyPost) return;
    setBusyPost(postId);
    setError("");
    try {
      const { error: deleteError } = await supabase.from("post_comments").delete()
        .eq("id", commentId).eq("user_id", user.id);
      if (deleteError) throw deleteError;
      await loadFeed();
    } catch {
      setError("تعذر حذف التعليق.");
    } finally {
      setBusyPost(null);
    }
  }

  if (!supabase) {
    return (
      <section className="panel social-setup">
        <div className="eyebrow">MYGRAM FB</div>
        <h1>المساحة الاجتماعية</h1>
        <p>يتطلب تشغيل الموجز إعداد اتصال Supabase في بيئة البناء.</p>
      </section>
    );
  }

  return (
    <section className="social-workspace">
      <header className="social-header">
        <div>
          <div className="eyebrow">MYGRAM FB · SOCIAL</div>
          <h1>الموجز الاجتماعي</h1>
          <p>انشر، ناقش، وتفاعل مع مجتمع MYGRAM.</p>
        </div>
        <div className="social-stat"><b>{posts.length}</b><small>منشور ظاهر</small><b>{ownPostCount}</b><small>منشور لك</small></div>
      </header>

      <form className="panel social-composer" onSubmit={publishPost}>
        <div className="social-composer-head">
          <span className="social-avatar">{(user.email?.[0] ?? "م").toUpperCase()}</span>
          <div><b>ابدأ منشوراً جديداً</b><small>شارك فكرة أو خبراً مع مجتمعك</small></div>
        </div>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="بماذا تفكر؟"
          maxLength={5000}
          rows={4}
          disabled={publishing}
        />
        <div className="social-composer-foot">
          <small>{draft.length} / 5000</small>
          <button className="button primary" type="submit" disabled={publishing || !draft.trim()}>
            {publishing ? "جارٍ النشر…" : "نشر"}
          </button>
        </div>
      </form>

      {(error || notice) && (
        <div className={`social-notice ${error ? "error" : ""}`} role="status">
          {error || notice}
          <button type="button" onClick={() => { setError(""); setNotice(""); }}>×</button>
        </div>
      )}

      <div className="social-feed">
        {loading ? <div className="panel social-empty">جارٍ تحميل الموجز…</div> :
          posts.length === 0 ? (
            <div className="panel social-empty">
              <span>✦</span>
              <b>ابدأ أول موجة في مجتمعك</b>
              <small>لا توجد منشورات بعد. اكتب أول منشور ليبدأ الحوار.</small>
            </div>
          ) : posts.map((post) => {
            const ownReaction = post.reactions.find((reaction) => reaction.user_id === user.id);
            const summaries = reactionSummary(post.reactions);
            return (
              <article className="panel social-post" key={post.id}>
                <header className="social-post-head">
                  <span className="social-avatar">{profileName(post.author, post.user_id).slice(0, 1)}</span>
                  <div>
                    <b>{profileName(post.author, post.user_id)}</b>
                    <small>{post.author?.username ? `@${post.author.username} · ` : ""}{relativeTime(post.created_at)}</small>
                  </div>
                  {post.user_id === user.id && (
                    <button className="social-delete" type="button" onClick={() => void deletePost(post.id)} disabled={busyPost === post.id}>
                      حذف
                    </button>
                  )}
                </header>
                <p className="social-post-content">{post.content}</p>
                {summaries.length > 0 && (
                  <div className="social-reaction-summary">
                    <span>{summaries.slice(0, 4).map((item) => item.glyph).join(" ")}</span>
                    <small>{post.reactions.length} تفاعل</small>
                    <small>{post.comments.length} تعليق</small>
                  </div>
                )}
                <div className="social-reaction-bar" aria-label="التفاعلات">
                  {REACTIONS.map((reaction) => {
                    const count = post.reactions.filter((item) => item.reaction === reaction.key).length;
                    return (
                      <button
                        key={reaction.key}
                        type="button"
                        className={ownReaction?.reaction === reaction.key ? "active" : ""}
                        onClick={() => void toggleReaction(post, reaction.key)}
                        disabled={busyPost === post.id}
                        title={reaction.label}
                        aria-pressed={ownReaction?.reaction === reaction.key}
                      >
                        <span>{reaction.glyph}</span>{count > 0 && <small>{count}</small>}
                      </button>
                    );
                  })}
                </div>
                <div className="social-comments">
                  {post.comments.map((comment) => (
                    <div className="social-comment" key={comment.id}>
                      <span className="social-comment-avatar">{profileName(comment.author, comment.user_id).slice(0, 1)}</span>
                      <div className="social-comment-body">
                        <b>{profileName(comment.author, comment.user_id)}</b>
                        <p>{comment.content}</p>
                      </div>
                      {comment.user_id === user.id && (
                        <button type="button" onClick={() => void deleteComment(comment.id, post.id)} disabled={busyPost === post.id} aria-label="حذف التعليق">×</button>
                      )}
                    </div>
                  ))}
                  <form className="social-comment-form" onSubmit={(event) => void addComment(post.id, event)}>
                    <input
                      value={commentDrafts[post.id] ?? ""}
                      onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))}
                      placeholder="أضف تعليقاً..."
                      maxLength={2000}
                      disabled={busyPost === post.id}
                    />
                    <button type="submit" disabled={busyPost === post.id || !(commentDrafts[post.id] ?? "").trim()}>إرسال</button>
                  </form>
                </div>
              </article>
            );
          })}
      </div>
    </section>
  );
}

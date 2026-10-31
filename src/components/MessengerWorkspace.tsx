import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { MygramUser } from "../lib/supabase";
import { supabase } from "../lib/supabase";
import {
  compensateAttachmentInsertFailure,
  mergeMessagesByCreatedAtId,
} from "../lib/workshops/messenger.mjs";

type ProfileSummary = {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

type ConversationRow = {
  id: string;
  user_low: string;
  user_high: string;
  created_at: string;
  last_message_at: string | null;
};

type ConversationView = ConversationRow & {
  other: ProfileSummary | null;
  lastMessage: string;
};

type AttachmentView = {
  id: string;
  message_id: string;
  object_path: string;
  mime_type: string;
  byte_size: number;
  signedUrl: string | null;
};

type MessageView = {
  id: string;
  conversation_id: string;
  sender_id: string;
  message_type: "text" | "image" | "video" | "audio" | "file";
  body: string | null;
  created_at: string;
  attachments: AttachmentView[];
};

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/jpeg", "image/png", "image/webp", "image/avif",
  "video/mp4", "video/webm",
  "audio/mpeg", "audio/mp4", "audio/ogg", "audio/webm", "audio/wav",
  "application/pdf",
]);

function displayName(profile: ProfileSummary | null) {
  if (!profile) return "محادثة مباشرة";
  const full = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
  return full || (profile.username ? `@${profile.username}` : "مستخدم MYGRAM");
}

function initials(profile: ProfileSummary | null) {
  const name = displayName(profile);
  return name.slice(0, 1) || "م";
}

function shortTime(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ar", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function fileMessageType(file: File): MessageView["message_type"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "file";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function MessengerWorkspace({ user }: { user: MygramUser }) {
  const [conversations, setConversations] = useState<ConversationView[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const activeConversationId = useRef<string | null>(null);
  const messageRequestVersion = useRef(0);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [fileName, setFileName] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const messageEnd = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const loadConversations = useCallback(async () => {
    if (!supabase) return;
    const { data, error: queryError } = await supabase
      .from("messenger_conversations")
      .select("id,user_low,user_high,created_at,last_message_at")
      .or(`user_low.eq.${user.id},user_high.eq.${user.id}`)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(100);

    if (queryError) {
      setError("تعذر تحميل المحادثات. تأكد من تطبيق ترحيل Messenger على Staging.");
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as ConversationRow[];
    if (rows.length === 0) {
      setConversations([]);
      setSelectedId(null);
      setLoading(false);
      return;
    }

    const otherIds = [...new Set(rows.map((row) => row.user_low === user.id ? row.user_high : row.user_low))];
    const conversationIds = rows.map((row) => row.id);
    const [profilesResult, messagesResult] = await Promise.all([
      supabase.from("public_profiles").select("id,username,first_name,last_name,avatar_url").in("id", otherIds),
      supabase.from("messenger_messages")
        .select("conversation_id,body,message_type,created_at")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false }),
    ]);

    const profiles = new Map<string, ProfileSummary>(
      ((profilesResult.data ?? []) as ProfileSummary[]).map((profile) => [profile.id, profile]),
    );
    const latest = new Map<string, string>();
    for (const message of messagesResult.data ?? []) {
      if (!latest.has(message.conversation_id)) {
        latest.set(
          message.conversation_id,
          message.body?.trim() || (message.message_type === "image" ? "صورة" : message.message_type === "video" ? "فيديو" : message.message_type === "audio" ? "رسالة صوتية" : "ملف مرفق"),
        );
      }
    }

    const views = rows.map((row) => {
      const otherId = row.user_low === user.id ? row.user_high : row.user_low;
      return {
        ...row,
        other: profiles.get(otherId) ?? null,
        lastMessage: latest.get(row.id) ?? "ابدأ المحادثة",
      };
    });
    setConversations(views);
    setSelectedId((current) => current && views.some((item) => item.id === current) ? current : views[0]?.id ?? null);
    setLoading(false);
  }, [user.id]);

  const loadMessages = useCallback(async (
    conversationId: string,
    before: Pick<MessageView, "created_at" | "id"> | null = null,
    append = false,
  ) => {
    if (!supabase || !isUuid(conversationId)) return;
    // Concurrent page/realtime reads for the same conversation must coexist.
    // The version changes only when the selected conversation changes or unmounts.
    const requestVersion = messageRequestVersion.current;
    if (!append) setMessagesLoading(true);
    const pageSize = 50;
    let query = supabase.from("messenger_messages")
      .select("id,conversation_id,sender_id,message_type,body,created_at")
      .eq("conversation_id", conversationId);
    if (before) {
      query = query.or(`created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${before.id})`);
    }
    const { data, error: queryError } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(pageSize);

    if (requestVersion !== messageRequestVersion.current || activeConversationId.current !== conversationId) return;
    if (queryError) {
      setError("تعذر تحميل الرسائل. قد لا تكون عضواً في هذه المحادثة.");
      if (!append) setMessagesLoading(false);
      return;
    }

    const rows = (data ?? []) as Omit<MessageView, "attachments">[];
    let attachments: AttachmentView[] = [];
    const messageIds = rows.map((message) => message.id);
    if (messageIds.length > 0) {
      const attachmentResult = await supabase.from("messenger_attachments")
        .select("id,message_id,object_path,mime_type,byte_size")
        .in("message_id", messageIds);
      if (attachmentResult.error) {
        setInfo("تعذر تحميل بيانات المرفقات. أعد تحميل الرسائل للمحاولة.");
      } else {
        attachments = await Promise.all(
          (attachmentResult.data ?? []).map(async (attachment) => {
            const { data: signed, error: signedError } = await supabase!
              .storage.from("messenger-attachments")
              .createSignedUrl(attachment.object_path, 900);
            return {
              ...attachment,
              signedUrl: signedError ? null : signed?.signedUrl ?? null,
            } as AttachmentView;
          }),
        );
      }
    }

    if (requestVersion !== messageRequestVersion.current || activeConversationId.current !== conversationId) return;
    const byMessage = new Map<string, AttachmentView[]>();
    for (const attachment of attachments) {
      byMessage.set(attachment.message_id, [...(byMessage.get(attachment.message_id) ?? []), attachment]);
    }
    const incoming = rows.map((message) => ({
      ...message,
      message_type: message.message_type as MessageView["message_type"],
      attachments: byMessage.get(message.id) ?? [],
    }));
    // Merge every response into the current timeline. A realtime refresh may
    // finish before an older-page request; neither response may erase the other.
    setMessages((current) => mergeMessagesByCreatedAtId(current, incoming));
    // A latest-page refresh must preserve the current older-page availability.
    // Only a first-page load or an older-page cursor request can change this flag.
    if (!append || before) setHasOlderMessages(rows.length === pageSize);
    if (!append) setMessagesLoading(false);
  }, []);

  async function loadOlderMessages() {
    if (!selectedId || !messages.length || loadingOlder || !hasOlderMessages) return;
    setLoadingOlder(true);
    setError("");
    try {
      const oldest = messages[0];
      await loadMessages(selectedId, { created_at: oldest.created_at, id: oldest.id }, true);
    } finally {
      setLoadingOlder(false);
    }
  }

  async function refreshAttachmentUrl(messageId: string, attachmentId: string, objectPath: string) {
    if (!supabase) return;
    const { data, error: signedError } = await supabase.storage
      .from("messenger-attachments")
      .createSignedUrl(objectPath, 900);
    if (signedError || !data?.signedUrl) {
      setInfo("تعذر تجديد رابط المرفق. تحقق من عضويتك في المحادثة ثم أعد المحاولة.");
      return;
    }
    setMessages((current) => current.map((message) => message.id !== messageId ? message : ({
      ...message,
      attachments: message.attachments.map((attachment) => attachment.id === attachmentId
        ? { ...attachment, signedUrl: data.signedUrl }
        : attachment),
    })));
    setInfo("تم تجديد رابط المرفق لمدة مؤقتة.");
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void loadConversations().finally(() => {
      if (!active) return;
    });
    return () => { active = false; };
  }, [loadConversations]);

  useEffect(() => {
    const activeClient = supabase;
    if (!selectedId || !activeClient) {
      activeConversationId.current = null;
      setMessages([]);
      setHasOlderMessages(false);
      return;
    }

    let active = true;
    activeConversationId.current = selectedId;
    setError("");
    void loadMessages(selectedId);
    void activeClient.realtime.setAuth();

    const channel = activeClient
      .channel(`messenger:${selectedId}:messages`, { config: { private: true } })
      .on("broadcast", { event: "INSERT" }, () => {
        if (active) {
          // Refresh the newest page without discarding older pages already loaded.
          void loadMessages(selectedId, null, true);
          void loadConversations();
        }
      })
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setInfo("تعذر الاتصال اللحظي. يمكنك متابعة المحادثة وإعادة تحميل الرسائل يدوياً.");
        } else if (status === "SUBSCRIBED") {
          setInfo("");
        }
      });

    return () => {
      active = false;
      if (activeConversationId.current === selectedId) activeConversationId.current = null;
      messageRequestVersion.current += 1;
      void activeClient.removeChannel(channel);
    };
  }, [selectedId, loadMessages, loadConversations]);

  useEffect(() => {
    messageEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, selectedId]);

  function selectConversation(conversationId: string) {
    // Invalidate pending requests synchronously, before React effects for the
    // new selection run, so an old conversation cannot paint stale rows.
    activeConversationId.current = conversationId;
    messageRequestVersion.current += 1;
    setMessages([]);
    setHasOlderMessages(false);
    setMessagesLoading(true);
    setSelectedId(conversationId);
  }

  async function createConversation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || creating) return;
    const username = newUsername.trim().replace(/^@/, "").toLowerCase();
    if (!/^[a-z0-9_]{3,30}$/.test(username)) {
      setError("أدخل اسم مستخدم صحيحاً، من 3 إلى 30 حرفاً أو رقماً أو _.");
      return;
    }

    setCreating(true);
    setError("");
    setInfo("");
    try {
      const { data: target, error: profileError } = await supabase
        .from("public_profiles")
        .select("id,username,first_name,last_name,avatar_url")
        .eq("username", username)
        .maybeSingle();

      if (profileError || !target) {
        setError("لم نعثر على مستخدم بهذا الاسم.");
        return;
      }
      if (target.id === user.id) {
        setError("لا يمكنك بدء محادثة مع حسابك نفسه.");
        return;
      }

      const [userLow, userHigh] = [user.id, target.id].sort();
      const { data: existing, error: existingError } = await supabase
        .from("messenger_conversations")
        .select("id")
        .eq("user_low", userLow)
        .eq("user_high", userHigh)
        .maybeSingle();

      if (existingError) throw existingError;
      let conversationId = existing?.id as string | undefined;
      if (!conversationId) {
        const { data: created, error: insertError } = await supabase
          .from("messenger_conversations")
          .insert({ user_low: userLow, user_high: userHigh, created_by: user.id })
          .select("id")
          .single();
        if (insertError) throw insertError;
        conversationId = created.id;
      }

      if (!conversationId) {
        throw new Error("Messenger conversation creation returned no id.");
      }

      setNewUsername("");
      await loadConversations();
      selectConversation(conversationId);
      setInfo(`تم فتح محادثة مع ${displayName(target as ProfileSummary)}.`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      setError(message.includes("duplicate key")
        ? "المحادثة موجودة بالفعل. حدّث قائمة المحادثات."
        : "تعذر بدء المحادثة. تحقق من اسم المستخدم وصلاحيات Messenger.");
    } finally {
      setCreating(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !selectedId || sending) return;
    const body = draft.trim();
    const file = fileInput.current?.files?.[0] ?? null;
    if (!body && !file) return;

    if (file && (!ALLOWED_MIME.has(file.type) || file.size < 1 || file.size > MAX_FILE_BYTES)) {
      setError("نوع الملف غير مدعوم أو يتجاوز الحد الأقصى 25 ميغابايت.");
      return;
    }

    setSending(true);
    setError("");
    setInfo("");
    let uploadedPath: string | null = null;

    try {
      if (file) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || "attachment";
        uploadedPath = `${selectedId}/${user.id}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("messenger-attachments")
          .upload(uploadedPath, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
      }

      const { data: message, error: insertError } = await supabase
        .from("messenger_messages")
        .insert({
          conversation_id: selectedId,
          sender_id: user.id,
          client_message_id: crypto.randomUUID(),
          // Text remains a valid message if the optional attachment row fails.
          message_type: body ? "text" : file ? fileMessageType(file) : "text",
          body: body || null,
        })
        .select("id")
        .single();

      if (insertError) {
        if (uploadedPath) {
          const cleanup = await compensateAttachmentInsertFailure({
            removeStorageObject: () => supabase!.storage.from("messenger-attachments").remove([uploadedPath!]),
            deleteEmptyMessage: async () => ({ error: null }),
            hasTextBody: true,
          });
          if (!cleanup.storageRemoved) throw new Error("ATTACHMENT_ROLLBACK_FAILED");
        }
        throw insertError;
      }

      if (file && uploadedPath) {
        const { error: attachmentError } = await supabase.from("messenger_attachments").insert({
          conversation_id: selectedId,
          message_id: message.id,
          uploaded_by: user.id,
          object_path: uploadedPath,
          mime_type: file.type,
          byte_size: file.size,
        });
        if (attachmentError) {
          const cleanup = await compensateAttachmentInsertFailure({
            removeStorageObject: () => supabase!.storage.from("messenger-attachments").remove([uploadedPath!]),
            deleteEmptyMessage: async () => await supabase!.from("messenger_messages")
              .delete()
              .eq("id", message.id)
              .eq("sender_id", user.id),
            hasTextBody: Boolean(body),
          });

          if (!body) {
            if (!cleanup.storageRemoved || !cleanup.messageResolved) {
              throw new Error("ATTACHMENT_ROLLBACK_FAILED");
            }
            throw new Error("ATTACHMENT_METADATA_INSERT_FAILED");
          }

          setInfo(cleanup.storageRemoved
            ? "تم إرسال النص، لكن تعذر حفظ المرفق ونُظّف الملف المرفوع."
            : "تم إرسال النص، لكن تعذر حفظ المرفق وتعذر تأكيد تنظيف الملف. يلزم فحص Storage.");
        }
      }

      setDraft("");
      if (fileInput.current) fileInput.current.value = "";
      setFileName("");
      // Keep history already paged in by the user when refreshing after send.
      await Promise.all([loadMessages(selectedId, null, true), loadConversations()]);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      setError(message.includes("ATTACHMENT_METADATA_INSERT_FAILED")
        ? "لم تُرسل الرسالة لأن بيانات المرفق لم تُحفظ. أعد المحاولة."
        : message.includes("ATTACHMENT_ROLLBACK_FAILED")
          ? "فشل حفظ المرفق وتعذر تأكيد تنظيف جميع الموارد. لا تعاود الإرسال قبل مراجعة المحادثة وStorage."
          : message.includes("row-level security")
            ? "رفضت قاعدة البيانات العملية لأن صلاحية المحادثة غير متاحة."
            : "تعذر إرسال الرسالة أو المرفق. تحقق من الاتصال ثم أعد المحاولة.");
    } finally {
      setSending(false);
    }
  }

  if (!supabase) {
    return (
      <section className="panel messenger-setup">
        <div className="eyebrow">MYGRAM MESSENGER</div>
        <h1>مراسلة خاصة وآمنة</h1>
        <p>يتطلب تشغيل Messenger إعداد VITE_SUPABASE_URL وVITE_SUPABASE_PUBLISHABLE_KEY في بيئة البناء.</p>
      </section>
    );
  }

  return (
    <section className="messenger-workspace" aria-label="MYGRAM Messenger">
      <aside className="messenger-rail panel">
        <div className="messenger-rail-head">
          <div>
            <div className="eyebrow">MYGRAM · DIRECT</div>
            <h1>Messenger</h1>
          </div>
          <span className="messenger-online-dot" title="اتصال الحساب نشط"/>
        </div>

        <form className="messenger-new-chat" onSubmit={createConversation}>
          <label htmlFor="messenger-username">محادثة جديدة</label>
          <div className="messenger-new-chat-row">
            <input
              id="messenger-username"
              value={newUsername}
              onChange={(event) => setNewUsername(event.target.value)}
              placeholder="@username"
              dir="ltr"
              maxLength={31}
              autoComplete="off"
            />
            <button className="button primary" type="submit" disabled={creating || !newUsername.trim()}>
              {creating ? "…" : "فتح"}
            </button>
          </div>
        </form>

        <div className="messenger-list-heading">محادثاتك <span>{conversations.length}</span></div>
        <div className="messenger-conversation-list">
          {loading ? <p className="messenger-empty">جارٍ تحميل المحادثات…</p> :
            conversations.length === 0 ? (
              <div className="messenger-empty">
                <span>✉</span>
                <b>صندوقك هادئ حالياً</b>
                <small>ابدأ محادثة بكتابة اسم مستخدم MYGRAM بالأعلى.</small>
              </div>
            ) : conversations.map((conversation) => (
              <button
                type="button"
                key={conversation.id}
                className={`messenger-conversation ${selectedId === conversation.id ? "active" : ""}`}
                onClick={() => selectConversation(conversation.id)}
              >
                <span className="messenger-avatar">{initials(conversation.other)}</span>
                <span className="messenger-conversation-copy">
                  <b>{displayName(conversation.other)}</b>
                  <small>{conversation.lastMessage}</small>
                </span>
                <time>{shortTime(conversation.last_message_at ?? conversation.created_at)}</time>
              </button>
            ))}
        </div>
        <small className="messenger-private-note">المحادثات المباشرة مرئية لطرفيها فقط.</small>
      </aside>

      <div className="messenger-chat panel">
        {selected ? (
          <>
            <header className="messenger-chat-head">
              <span className="messenger-avatar large">{initials(selected.other)}</span>
              <span>
                <b>{displayName(selected.other)}</b>
                <small dir="ltr">{selected.other?.username ? `@${selected.other.username}` : "MYGRAM"}</small>
              </span>
              <span className="messenger-secure-label">محادثة خاصة</span>
            </header>

            <div className="messenger-history" aria-live="polite">
              {messages.length > 0 && hasOlderMessages && (
                <button className="messenger-load-older" type="button" onClick={() => void loadOlderMessages()} disabled={loadingOlder || messagesLoading}>
                  {loadingOlder ? "جارٍ تحميل الأقدم…" : "تحميل رسائل أقدم"}
                </button>
              )}
              {messagesLoading ? <p className="messenger-empty">جارٍ تحميل الرسائل…</p> :
                messages.length === 0 ? (
                  <div className="messenger-empty chat-empty">
                    <span>✦</span>
                    <b>أول رسالة تبدأ الحكاية</b>
                    <small>أرسل رسالة نصية أو أرفق صورة أو ملفاً.</small>
                  </div>
                ) : messages.map((message) => (
                  <article
                    key={message.id}
                    className={`messenger-message ${message.sender_id === user.id ? "mine" : "theirs"}`}
                  >
                    {message.body && <p>{message.body}</p>}
                    {message.attachments.map((attachment) => (
                      <div className="messenger-attachment" key={attachment.id}>
                        {attachment.signedUrl && attachment.mime_type.startsWith("image/") &&
                          <a href={attachment.signedUrl} target="_blank" rel="noreferrer">
                            <img src={attachment.signedUrl} alt="مرفق صورة" loading="lazy"/>
                          </a>}
                        {attachment.signedUrl && attachment.mime_type.startsWith("video/") &&
                          <video src={attachment.signedUrl} controls preload="metadata"/>}
                        {attachment.signedUrl && attachment.mime_type.startsWith("audio/") &&
                          <audio src={attachment.signedUrl} controls preload="metadata"/>}
                        {attachment.signedUrl && !attachment.mime_type.startsWith("image/") &&
                          !attachment.mime_type.startsWith("video/") &&
                          !attachment.mime_type.startsWith("audio/") &&
                          <a className="messenger-file-link" href={attachment.signedUrl} target="_blank" rel="noreferrer">
                            ↧ تنزيل الملف · {(attachment.byte_size / 1024).toFixed(0)} KB
                          </a>}
                        <button className="messenger-refresh-link" type="button" onClick={() => void refreshAttachmentUrl(message.id, attachment.id, attachment.object_path)}>
                          تجديد رابط المرفق
                        </button>
                      </div>
                    ))}
                    <time>{shortTime(message.created_at)}</time>
                  </article>
                ))}
              <div ref={messageEnd}/>
            </div>

            <form className="messenger-composer" onSubmit={sendMessage}>
              {fileName && <div className="messenger-file-chip">{fileName}<button type="button" onClick={() => {
                if (fileInput.current) fileInput.current.value = "";
                setFileName("");
              }} aria-label="إزالة الملف">×</button></div>}
              <div className="messenger-composer-row">
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="اكتب رسالة..."
                  aria-label="نص الرسالة"
                  maxLength={10000}
                  disabled={sending}
                />
                <input
                  ref={fileInput}
                  className="messenger-hidden-file"
                  type="file"
                  accept={[...ALLOWED_MIME].join(",")}
                  onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
                  aria-label="إرفاق ملف"
                />
                <button className="messenger-attach" type="button" onClick={() => fileInput.current?.click()} disabled={sending} aria-label="إرفاق صورة أو ملف">＋</button>
                <button className="button primary messenger-send" type="submit" disabled={sending || (!draft.trim() && !fileName)}>
                  {sending ? "…" : "إرسال"}
                </button>
              </div>
              <small>الحد الأقصى للمرفق 25 MB. تُستخدم روابط تنزيل مؤقتة للملفات الخاصة.</small>
            </form>
          </>
        ) : (
          <div className="messenger-empty chat-empty">
            <span>✧</span>
            <b>اختر محادثة للبدء</b>
            <small>محادثاتك تظهر هنا بعد فتح أول دردشة.</small>
          </div>
        )}
      </div>

      {(error || info) && (
        <div className={`messenger-feedback ${error ? "error" : ""}`} role="status">
          {error || info}
          <button type="button" onClick={() => { setError(""); setInfo(""); }}>×</button>
        </div>
      )}
    </section>
  );
}

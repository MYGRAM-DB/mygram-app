(() => {
  "use strict";
  const config = window.MYGRAM_CONFIG;
  const client = window.supabase.createClient(config.supabaseUrl, config.supabaseKey);
  const $ = (id) => document.getElementById(id);
  const form = $("postForm");
  const contentInput = $("postContent");
  const publishButton = $("publishButton");
  const publishText = $("publishText");
  const postsContainer = $("postsContainer");
  const refreshButton = $("refreshButton");
  let user = null;
  let profile = null;
  let loading = false;
  let toastTimer;
  let selectedMedia = null;

  $("year").textContent = new Date().getFullYear();

  function toast(message, kind = "") {
    const el = $("toast");
    el.textContent = message;
    el.className = "toast show" + (kind ? " " + kind : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = "toast"; }, 3600);
  }

  function displayName() {
    return user?.user_metadata?.full_name?.trim()
      || profile?.full_name?.trim()
      || (profile?.username ? "@" + profile.username : "")
      || user?.email?.split("@")[0]
      || "عضو MYGRAM";
  }

  function initial(name) { return Array.from((name || "م").trim())[0] || "م"; }
  function setAvatar(el, url, name) { if (!el) return; el.replaceChildren(); if (url) { const img=document.createElement("img"); img.src=url; img.alt="الصورة الشخصية"; img.style.cssText="width:100%;height:100%;object-fit:cover;border-radius:50%"; el.appendChild(img); } else el.textContent=initial(name); }

  function showState(icon, title, detail = "") {
    const box = document.createElement("div");
    box.className = "panel state-card";
    const symbol = document.createElement("div");
    symbol.className = "state-symbol";
    symbol.textContent = icon;
    const heading = document.createElement("strong");
    heading.textContent = title;
    box.append(symbol, heading);
    if (detail) {
      const p = document.createElement("p");
      p.textContent = detail;
      box.appendChild(p);
    }
    postsContainer.replaceChildren(box);
  }

  function dateLabel(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  function makePost(post, author) {
    const card = document.createElement("article");
    card.className = "panel post-card";
    const head = document.createElement("div");
    head.className = "post-head";
    const avatar = document.createElement("div");
    avatar.className = "user-avatar";
    setAvatar(avatar, post.author_avatar_url || (post.user_id === user.id ? profile?.avatar_url : null), author);
    const info = document.createElement("div");
    info.className = "post-author-info";
    const name = document.createElement("strong");
    name.textContent = author;
    const date = document.createElement("time");
    date.className = "post-date";
    date.dateTime = post.created_at;
    date.textContent = dateLabel(post.created_at);
    info.append(name, date);
    head.append(avatar, info);
    const body = document.createElement("div");
    body.className = "post-body";
    // textContent يمنع تنفيذ HTML أو JavaScript أُدرج في المنشور.
    body.textContent = post.content;
    if (post.media_url && post.media_type) {
      let media;
      if (post.media_type === "video") { media = document.createElement("video"); media.controls = true; media.preload = "metadata"; }
      else { media = document.createElement("img"); media.alt = "مرفق المنشور"; }
      media.className = "post-media"; media.src = post.media_url; card.appendChild(media);
    }
    const foot = document.createElement("div");
    foot.className = "post-foot";
    const badge = document.createElement("span");
    badge.textContent = post.media_url ? "🌐 منشور مع مرفق · MYGRAM" : "🌐 منشور نصّي · MYGRAM";
    foot.appendChild(badge);
    const actions = document.createElement("div");
    actions.className = "post-actions";
    actions.innerHTML = `<button type="button" class="button ghost small" data-like>❤️ <span>إعجاب</span> <b data-like-count>…</b></button>
      <button type="button" class="button ghost small" data-toggle-comments>💬 التعليقات</button>`;
    const comments = document.createElement("div");
    comments.className = "post-comments";
    comments.hidden = true;
    const commentList = document.createElement("div");
    commentList.className = "comment-list";
    const commentForm = document.createElement("form");
    commentForm.className = "comment-form";
    commentForm.innerHTML = '<input maxlength="1000" required placeholder="اكتب تعليقاً..." aria-label="اكتب تعليقاً"><button class="button primary small" type="submit">إرسال</button>';
    comments.append(commentList, commentForm);
    card.append(head, body, foot, actions, comments);

    const likeButton = actions.querySelector("[data-like]");
    const likeCount = actions.querySelector("[data-like-count]");
    async function refreshLikes() {
      const { count, error } = await client.from("post_reactions").select("id", { count: "exact", head: true }).eq("post_id", post.id);
      if (!error) likeCount.textContent = String(count || 0);
      const { data: mine } = await client.from("post_reactions").select("id").eq("post_id", post.id).eq("user_id", user.id).maybeSingle();
      likeButton.classList.toggle("is-liked", !!mine);
      likeButton.querySelector("span").textContent = mine ? "أعجبك" : "إعجاب";
    }
    likeButton.addEventListener("click", async () => {
      likeButton.disabled = true;
      try {
        const { data: mine, error: readError } = await client.from("post_reactions").select("id").eq("post_id", post.id).eq("user_id", user.id).maybeSingle();
        if (readError) throw readError;
        const result = mine
          ? await client.from("post_reactions").delete().eq("id", mine.id)
          : await client.from("post_reactions").insert({ post_id: post.id, user_id: user.id, reaction: "like" });
        if (result.error) throw result.error;
        await refreshLikes();
      } catch (e) { toast("تعذر حفظ الإعجاب: " + e.message, "error"); }
      finally { likeButton.disabled = false; }
    });
    async function refreshComments() {
      commentList.replaceChildren();
      const { data, error } = await client.from("post_comments").select("id,user_id,content,created_at").eq("post_id", post.id).order("created_at", { ascending: true }).limit(100);
      if (error) { commentList.textContent = "تعذر تحميل التعليقات. تأكد من تطبيق ملف SQL الجديد."; return; }
      if (!data?.length) { commentList.textContent = "لا توجد تعليقات بعد."; return; }
      for (const c of data) {
        const row = document.createElement("p");
        row.className = "comment-row";
        row.textContent = (c.user_id === user.id ? "أنت: " : "") + c.content;
        commentList.appendChild(row);
      }
    }
    actions.querySelector("[data-toggle-comments]").addEventListener("click", async () => {
      comments.hidden = !comments.hidden;
      if (!comments.hidden) await refreshComments();
    });
    commentForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = commentForm.querySelector("input");
      const content = input.value.trim();
      if (!content) return;
      const button = commentForm.querySelector("button");
      button.disabled = true;
      try {
        const { error } = await client.from("post_comments").insert({ post_id: post.id, user_id: user.id, content });
        if (error) throw error;
        input.value = "";
        await refreshComments();
      } catch (e) { toast("تعذر نشر التعليق: " + e.message, "error"); }
      finally { button.disabled = false; }
    });
    refreshLikes();
    return card;
  }

  async function loadProfile() {
    const { data, error } = await client.from("profiles")
      .select("id, username, full_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    if (error) {
      console.warn("تعذّر جلب الملف الشخصي:", error.message);
      return null;
    }
    return data;
  }

  async function loadPosts() {
    if (loading || !user) return;
    loading = true;
    refreshButton.disabled = true;
    refreshButton.textContent = "جارٍ التحديث...";
    showState("◌", "جارٍ تحميل المنشورات...");

    try {
      const { data: posts, error } = await client.from("posts")
        .select("id, user_id, content, media_url, media_type, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("posts select:", error);
        showState("⚠️", "لم نتمكن من تحميل المنشورات", "تحقّق من صلاحيات جدول posts وسياسات RLS في Supabase.");
        return;
      }

      if (!posts?.length) {
        showState("✍️", "كن أول من ينشر!", "اكتب أول منشور لك باستخدام المربع أعلاه.");
        return;
      }

      const ids = [...new Set(posts.map(p => p.user_id).filter(Boolean))];
      let byId = {};
      if (ids.length) {
        const { data: profiles, error: profileError } = await client.from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", ids);
        if (!profileError && profiles) { byId = Object.fromEntries(profiles.map(p => [p.id, p])); for (const post of posts) post.author_avatar_url=byId[post.user_id]?.avatar_url || null; }
      }

      const fragment = document.createDocumentFragment();
      for (const post of posts) {
        const p = byId[post.user_id];
        const author = post.user_id === user.id
          ? displayName()
          : p?.full_name?.trim() || (p?.username ? "@" + p.username : "عضو MYGRAM");
        fragment.appendChild(makePost(post, author));
      }
      postsContainer.replaceChildren(fragment);
    } catch (error) {
      console.error(error);
      showState("⚠️", "حدث خطأ أثناء تحميل المنشورات", "تحقّق من اتصال الإنترنت ثم حدّث الصفحة.");
    } finally {
      loading = false;
      refreshButton.disabled = false;
      refreshButton.textContent = "↻ تحديث";
    }
  }

  contentInput.addEventListener("input", () => {
    $("charCount").textContent = contentInput.value.length;
  });

  const mediaInput = $("postMedia");
  const mediaName = $("mediaFileName");
  const mediaPreview = $("mediaPreview");
  const clearMedia = $("clearMediaButton");
  if (mediaInput) mediaInput.addEventListener("change", () => {
    const file = mediaInput.files?.[0]; selectedMedia = file || null; mediaPreview.replaceChildren();
    if (!file) { mediaName.textContent = "اختياري · صورة أو فيديو حتى 50 ميغابايت"; clearMedia.hidden = true; return; }
    if (!(file.type.startsWith("image/") || file.type.startsWith("video/"))) { toast("اختر صورة أو فيديو فقط.", "error"); mediaInput.value=""; selectedMedia=null; return; }
    if (file.size > 50*1024*1024) { toast("حجم الملف يجب ألا يتجاوز 50 ميغابايت.", "error"); mediaInput.value=""; selectedMedia=null; return; }
    mediaName.textContent = file.name; clearMedia.hidden = false;
    const el = document.createElement(file.type.startsWith("video/") ? "video" : "img"); el.className="post-media"; el.src=URL.createObjectURL(file); if(el.tagName==="VIDEO") el.controls=true; mediaPreview.appendChild(el); const x=document.createElement("button"); x.type="button"; x.className="attachment-remove"; x.textContent="×"; x.setAttribute("aria-label","إزالة المرفق المختار"); x.title="إزالة المرفق"; x.addEventListener("click",()=>{selectedMedia=null;mediaInput.value="";mediaPreview.replaceChildren();mediaName.textContent="اختياري · صورة أو فيديو حتى 50 ميغابايت";clearMedia.hidden=true;}); mediaPreview.appendChild(x);
  });
  if (clearMedia) clearMedia.addEventListener("click",()=>{selectedMedia=null;mediaInput.value="";mediaPreview.replaceChildren();mediaName.textContent="اختياري · صورة أو فيديو حتى 50 ميغابايت";clearMedia.hidden=true;});

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!user) {
      toast("انتهت جلسة الدخول. سجّل الدخول مجدداً.", "error");
      location.replace(config.loginUrl);
      return;
    }
    const content = contentInput.value.trim();
    if (!content && !selectedMedia) {
      toast("اكتب محتوى أو أرفق صورة/فيديو أولاً.", "error");
      contentInput.focus();
      return;
    }
    if (content.length > 5000) {
      toast("الحد الأقصى 5000 حرف.", "error");
      return;
    }

    publishButton.disabled = true;
    publishText.textContent = "جارٍ النشر...";
    try {
      let media_url = null, media_type = null;
      if (selectedMedia) {
        const ext = (selectedMedia.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
        const path = `${user.id}/posts/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
        const { error: uploadError } = await client.storage.from("mygram-media").upload(path, selectedMedia, { upsert: false, contentType: selectedMedia.type, cacheControl: "3600" });
        if (uploadError) { toast("تعذّر رفع المرفق. تأكد من إعداد التخزين في Supabase. " + uploadError.message, "error"); return; }
        media_url = client.storage.from("mygram-media").getPublicUrl(path).data.publicUrl;
        media_type = selectedMedia.type.startsWith("video/") ? "video" : "image";
      }
      const { error } = await client.from("posts").insert({ user_id: user.id, content: content || "", media_url, media_type });
      if (error) {
        console.error("posts insert:", error);
        if (error.code === "42501") {
          toast("لا توجد صلاحية للنشر. تحقّق من سياسة INSERT في Supabase.", "error");
        } else {
          toast("تعذّر النشر: " + (error.message || "خطأ غير معروف"), "error");
        }
        return;
      }
      contentInput.value = "";
      $("charCount").textContent = "0";
      if (mediaInput) { selectedMedia=null; mediaInput.value=""; mediaPreview.replaceChildren(); mediaName.textContent="اختياري · صورة أو فيديو حتى 50 ميغابايت"; clearMedia.hidden=true; }
      toast("تم نشر منشورك بنجاح 💜", "success");
      await loadPosts();
    } catch (error) {
      console.error(error);
      toast("تعذّر الاتصال بالخادم. حاول مجدداً.", "error");
    } finally {
      publishButton.disabled = false;
      publishText.textContent = "نشر";
    }
  });

  refreshButton.addEventListener("click", loadPosts);

  $("logoutButton").addEventListener("click", async () => {
    const button = $("logoutButton");
    button.disabled = true;
    const { error } = await client.auth.signOut();
    if (error) {
      button.disabled = false;
      toast("تعذّر تسجيل الخروج. حاول مجدداً.", "error");
      return;
    }
    location.replace(config.loginUrl);
  });

  async function init() {
    try {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      user = data.session?.user || null;
      if (!user) {
        location.replace(config.loginUrl);
        return;
      }
      profile = await loadProfile();
      const name = displayName();
      $("welcomeTitle").textContent = "أهلاً بك، " + name + " 👋";
      setAvatar($("headerAvatar"), profile?.avatar_url, name);
      setAvatar($("composerAvatar"), profile?.avatar_url, name);
      setAvatar($("accountMenuToggle"), profile?.avatar_url, name);
      await loadPosts();

      client.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT" || !session) location.replace(config.loginUrl);
      });
    } catch (error) {
      console.error("init:", error);
      showState("⚠️", "تعذّر التحقق من جلسة الدخول", "حدّث الصفحة، وإذا استمر الخطأ راجع إعدادات Supabase.");
    }
  }

  init();
})();

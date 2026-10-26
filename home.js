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

  const reactionStyle = document.createElement("style");
  reactionStyle.textContent = `.post-reaction-picker[hidden]{display:none!important}.post-reaction-picker{display:flex;gap:5px;flex-wrap:wrap;align-items:center;margin:8px 0;padding:8px 10px;background:#fff;border:1px solid #e8eef6;border-radius:18px;box-shadow:0 8px 24px #163d6b18;transform-origin:left center;animation:mygram-reactions-in .16s ease-out}.post-reaction-picker button{min-width:38px;transition:transform .15s}.post-reaction-picker button:hover,.post-reaction-picker button:focus-visible{transform:translateY(-3px) scale(1.08)}.reaction-trigger.is-liked{color:#087cf0;background:#eaf4ff}.reaction-trigger{touch-action:manipulation;user-select:none;-webkit-user-select:none}@keyframes mygram-reactions-in{from{opacity:0;transform:translateY(5px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}@media(prefers-reduced-motion:reduce){.post-reaction-picker{animation:none}}`;
  document.head.appendChild(reactionStyle);

  $("year").textContent = new Date().getFullYear();

  function toast(message, kind = "") {
    if (kind === "error") window.MYGRAM_SOUNDS?.play("error");
    message=window.MYGRAM_TRANSLATE_TEXT?window.MYGRAM_TRANSLATE_TEXT(message):message;
    const el = $("toast");
    el.textContent = message;
    el.className = "toast show" + (kind ? " " + kind : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = "toast"; }, 3600);
  }

  function uiText(value) { return window.MYGRAM_TRANSLATE_TEXT ? window.MYGRAM_TRANSLATE_TEXT(value) : value; }

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
    const locale = document.documentElement.lang || "ar";
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  function makePost(post, author) {
    const card = document.createElement("article");
    card.className = "panel post-card";
    card.id = "post-" + post.id;
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
    let media = null;
    if (post.media_url && post.media_type) {
      if (post.media_type === "video") { media = document.createElement("video"); media.controls = true; media.preload = "metadata"; media.playsInline = true; }
      else { media = document.createElement("img"); media.alt = uiText("مرفق المنشور"); media.loading = "lazy"; }
      media.className = "post-media"; media.src = post.media_url;
    }
    const foot = document.createElement("div");
    foot.className = "post-foot";
    const badge = document.createElement("span");
    badge.textContent = uiText(post.media_url ? "🌐 منشور مع مرفق · MYGRAM" : "🌐 منشور نصّي · MYGRAM");
    foot.appendChild(badge);
    const actions = document.createElement("div");
    actions.className = "post-actions";
    actions.innerHTML = `<button type="button" class="button ghost small reaction-trigger" data-reaction-trigger aria-label="${uiText("اضغط مطولاً لعرض التفاعلات")}" aria-expanded="false">👍 <span>${uiText("أعجبني")}</span> <b data-primary-reaction-count>0</b></button>
      <div class="post-reaction-picker" role="group" aria-label="${uiText("التفاعلات")}" hidden>
      <button type="button" class="button ghost small" data-reaction="like" aria-label="${uiText("إعجاب 👍")}" aria-pressed="false">👍 <b data-reaction-count="like">0</b></button>
      <button type="button" class="button ghost small" data-reaction="love" aria-label="${uiText("حب ❤️")}" aria-pressed="false">❤️ <b data-reaction-count="love">0</b></button>
      <button type="button" class="button ghost small" data-reaction="haha" aria-label="${uiText("ضحك 😂")}" aria-pressed="false">😂 <b data-reaction-count="haha">0</b></button>
      <button type="button" class="button ghost small" data-reaction="care" aria-label="${uiText("رعاية 🥰")}" aria-pressed="false">🥰 <b data-reaction-count="care">0</b></button>
      <button type="button" class="button ghost small" data-reaction="wow" aria-label="${uiText("دهشة 😮")}" aria-pressed="false">😮 <b data-reaction-count="wow">0</b></button>
      <button type="button" class="button ghost small" data-reaction="sad" aria-label="${uiText("حزن 😢")}" aria-pressed="false">😢 <b data-reaction-count="sad">0</b></button>
      <button type="button" class="button ghost small" data-reaction="angry" aria-label="${uiText("غضب 😡")}" aria-pressed="false">😡 <b data-reaction-count="angry">0</b></button>
      <button type="button" class="button ghost small" data-reaction="fire" aria-label="${uiText("نار 🔥")}" aria-pressed="false">🔥 <b data-reaction-count="fire">0</b></button>
      </div><button type="button" class="button ghost small" data-toggle-comments>💬 ${uiText("التعليقات")}</button>`;
    const comments = document.createElement("div");
    comments.className = "post-comments";
    comments.hidden = true;
    const commentList = document.createElement("div");
    commentList.className = "comment-list";
    const commentForm = document.createElement("form");
    commentForm.className = "comment-form";
    commentForm.innerHTML = '<input maxlength="1000" required placeholder="' + uiText("اكتب تعليقاً...") + '" aria-label="' + uiText("اكتب تعليقاً") + '"><button class="button primary small" type="submit">' + uiText("إرسال") + '</button>';
    comments.append(commentList, commentForm);
    card.append(head, body);
    if (media) card.appendChild(media);
    card.append(foot, actions, comments);

    const reactionButtons = [...actions.querySelectorAll("[data-reaction]")];
    const reactionPicker = actions.querySelector(".post-reaction-picker");
    const reactionTrigger = actions.querySelector("[data-reaction-trigger]");
    let longPressTimer = null;
    let longPressFired = false;
    const openReactionPicker = () => {
      reactionPicker.hidden = false;
      reactionTrigger.setAttribute("aria-expanded", "true");
      reactionPicker.classList.add("reaction-picker-open");
    };
    const closeReactionPicker = () => {
      reactionPicker.hidden = true;
      reactionTrigger.setAttribute("aria-expanded", "false");
      reactionPicker.classList.remove("reaction-picker-open");
    };
    reactionTrigger.addEventListener("pointerdown", () => {
      longPressFired = false;
      clearTimeout(longPressTimer);
      longPressTimer = setTimeout(() => {
        longPressFired = true;
        openReactionPicker();
      }, 450);
    });
    for (const eventName of ["pointerup", "pointercancel", "pointerleave"]) {
      reactionTrigger.addEventListener(eventName, () => clearTimeout(longPressTimer));
    }
    reactionTrigger.addEventListener("contextmenu", event => event.preventDefault());
    reactionTrigger.addEventListener("click", () => {
      if (longPressFired) { longPressFired = false; return; }
      if (!reactionPicker.hidden) { closeReactionPicker(); return; }
      const likeButton = reactionButtons.find(button => button.dataset.reaction === "like");
      if (likeButton) likeButton.click();
    });
    async function refreshLikes() {
      const { data: rows, error } = await client.from("post_reactions").select("id,user_id,reaction").eq("post_id", post.id);
      if (error) { toast("تعذر تحميل التفاعلات: " + error.message, "error"); return; }
      const counts = { like: 0, love: 0, haha: 0, care: 0, wow: 0, sad: 0, angry: 0, fire: 0 };
      for (const row of rows || []) if (Object.prototype.hasOwnProperty.call(counts, row.reaction)) counts[row.reaction]++;
      const mine = (rows || []).find(row => row.user_id === user.id);
      for (const button of reactionButtons) {
        const key = button.dataset.reaction;
        const count = button.querySelector("[data-reaction-count]");
        if (count) count.textContent = String(counts[key] || 0);
        button.setAttribute("aria-pressed", String(mine?.reaction === key));
        button.classList.toggle("is-liked", mine?.reaction === key);
      }
      const primaryCount = reactionTrigger.querySelector("[data-primary-reaction-count]");
      if (primaryCount) primaryCount.textContent = String(Object.values(counts).reduce((sum, count) => sum + count, 0));
      const primary = mine?.reaction;
      const labels = { like: ["👍", uiText("أعجبني")], love: ["❤️", uiText("أحببته")], haha: ["😂", uiText("أضحكني")], care: ["🥰", uiText("أهتم")], wow: ["😮", uiText("أدهشني")], sad: ["😢", uiText("أحزنني")], angry: ["😡", uiText("أغضبني")], fire: ["🔥", uiText("رائع")] };
      const face = labels[primary] || labels.like;
      reactionTrigger.querySelector("span").textContent = primary ? face[1] : uiText("أعجبني");
      reactionTrigger.firstChild.textContent = face[0] + " ";
      reactionTrigger.classList.toggle("is-liked", Boolean(primary));
    }
    for (const button of reactionButtons) button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        const { data: mine, error: readError } = await client.from("post_reactions").select("id,reaction").eq("post_id", post.id).eq("user_id", user.id).maybeSingle();
        if (readError) throw readError;
        let result;
        if (mine?.reaction === button.dataset.reaction) {
          result = await client.from("post_reactions").delete().eq("id", mine.id);
        } else if (mine) {
          result = await client.from("post_reactions").update({ reaction: button.dataset.reaction }).eq("id", mine.id);
        } else {
          result = await client.from("post_reactions").insert({ post_id: post.id, user_id: user.id, reaction: button.dataset.reaction });
        }
        if (result.error) throw result.error;
        closeReactionPicker();
        await refreshLikes();
      } catch (e) { toast("تعذر حفظ التفاعل: " + e.message, "error"); }
      finally { button.disabled = false; }
    });
    async function refreshComments() {
      commentList.replaceChildren();
      const { data, error } = await client.from("post_comments").select("id,user_id,content,created_at").eq("post_id", post.id).order("created_at", { ascending: true }).limit(100);
      if (error) { commentList.textContent = uiText("تعذر تحميل التعليقات. تحقق من سياسات التعليقات في Supabase."); return; }
      if (!data?.length) { commentList.textContent = uiText("لا توجد تعليقات بعد."); return; }
      const ids=[...new Set(data.map(c=>c.user_id).filter(Boolean))];
      let byId={};
      if(ids.length){const result=await client.from("profiles").select("id,username,full_name").in("id",ids);if(!result.error)byId=Object.fromEntries((result.data||[]).map(p=>[p.id,p]))}
      for (const comment of data) {
        const row = document.createElement("p");
        row.className = "comment-row";
        const author=comment.user_id===user.id?uiText("أنت"):byId[comment.user_id]?.full_name||byId[comment.user_id]?.username||uiText("عضو MYGRAM");
        row.textContent = author + ": " + comment.content;
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
    window.addEventListener("mygram:languagechange", () => {
      reactionTrigger.setAttribute("aria-label", uiText("اضغط مطولاً لعرض التفاعلات"));
      reactionPicker.setAttribute("aria-label", uiText("التفاعلات"));
      actions.querySelector("[data-toggle-comments]").textContent = "💬 " + uiText("التعليقات");
      const input = commentForm.querySelector("input");
      input.placeholder = uiText("اكتب تعليقاً...");
      input.setAttribute("aria-label", uiText("اكتب تعليقاً"));
      commentForm.querySelector("button").textContent = uiText("إرسال");
      void refreshLikes();
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
    refreshButton.textContent = uiText("جارٍ التحديث...");
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
      if (typeof window.MYGRAM_TRANSLATE_DYNAMIC_UI === "function") window.MYGRAM_TRANSLATE_DYNAMIC_UI();
    } catch (error) {
      console.error(error);
      showState("⚠️", "حدث خطأ أثناء تحميل المنشورات", "تحقّق من اتصال الإنترنت ثم حدّث الصفحة.");
    } finally {
      loading = false;
      refreshButton.disabled = false;
      refreshButton.textContent = "↻ " + uiText("تحديث");
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
    publishText.textContent = uiText("جارٍ النشر...");
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
      window.MYGRAM_SOUNDS?.play("success");
      toast("تم نشر منشورك بنجاح 💜", "success");
      await loadPosts();
    } catch (error) {
      console.error(error);
      toast("تعذّر الاتصال بالخادم. حاول مجدداً.", "error");
    } finally {
      publishButton.disabled = false;
      publishText.textContent = uiText("نشر");
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

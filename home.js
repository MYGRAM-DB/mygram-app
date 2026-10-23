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

  function initial(name) {
    return Array.from((name || "م").trim())[0] || "م";
  }

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
    avatar.textContent = initial(author);
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
    badge.textContent = "🌐 منشور نصّي · MYGRAM";
    foot.appendChild(badge);
    card.append(head, body, foot);
    return card;
  }

  async function loadProfile() {
    const { data, error } = await client.from("users")
      .select("id, username, full_name")
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
        const { data: profiles, error: profileError } = await client.from("users")
          .select("id, username, full_name")
          .in("id", ids);
        if (!profileError && profiles) byId = Object.fromEntries(profiles.map(p => [p.id, p]));
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
    const el = document.createElement(file.type.startsWith("video/") ? "video" : "img"); el.className="post-media"; el.src=URL.createObjectURL(file); if(el.tagName==="VIDEO") el.controls=true; mediaPreview.appendChild(el);
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
      $("headerAvatar").textContent = initial(name);
      $("composerAvatar").textContent = initial(name);
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

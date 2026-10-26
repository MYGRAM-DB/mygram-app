(() => {
  "use strict";
  const cfg = window.MYGRAM_CONFIG;
  if (!cfg || !cfg.supabaseUrl || !cfg.supabaseKey || !window.supabase) return;
  const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
  let currentUser = null, refreshInFlight = false, lastNotifications = [];
  const $ = (selector, root = document) => root.querySelector(selector);
  const make = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const translate = text => window.MYGRAM_TRANSLATE_TEXT ? window.MYGRAM_TRANSLATE_TEXT(text) : text;
  const style = make("style");
  style.textContent = [
    ".mygram-notifications-host{position:relative;display:inline-flex;align-items:center;flex:0 0 auto;z-index:80}",
    ".mygram-notifications-trigger{position:relative;width:42px;height:42px;display:grid;place-items:center;border:1px solid #e2eaf5;border-radius:14px;background:#fff;color:#526781;box-shadow:0 3px 10px #173b680a;cursor:pointer;transition:background .15s,border-color .15s,transform .15s}",
    ".mygram-notifications-trigger:hover,.mygram-notifications-trigger[aria-expanded=true]{background:#edf6ff;border-color:#cde4ff;color:#087cf0}",
    ".mygram-notifications-trigger:focus-visible{outline:3px solid #087cf04a;outline-offset:2px}",
    ".mygram-notifications-trigger svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}",
    ".mygram-notifications-badge{position:absolute;top:-5px;inset-inline-end:-5px;min-width:18px;height:18px;padding:0 4px;display:grid;place-items:center;border:2px solid #fff;border-radius:999px;background:#ed3d5a;color:white;font:800 10px/1 system-ui;box-shadow:0 2px 5px #e43c5c2e}",
    ".mygram-notifications-badge[hidden]{display:none!important}",
    ".mygram-notifications-panel{position:absolute;top:calc(100% + 11px);inset-inline-end:0;width:min(370px,calc(100vw - 24px));max-height:min(72vh,520px);overflow:hidden;display:flex;flex-direction:column;background:#fff;border:1px solid #e4ebf5;border-radius:19px;box-shadow:0 24px 65px #10294d2b;direction:inherit;color:#172b4d}",
    ".mygram-notifications-panel[hidden]{display:none!important}",
    ".mygram-notifications-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:16px 17px;border-bottom:1px solid #edf1f7;background:linear-gradient(125deg,#f7fbff,#fff)}",
    ".mygram-notifications-head h3{margin:0;font:900 15px/1.3 system-ui,sans-serif;color:#1b2e49}",
    ".mygram-notifications-head small{display:block;margin-top:4px;color:#8b99ad;font-size:10px}",
    ".mygram-notifications-markall{border:0;border-radius:9px;padding:8px 9px;background:#eaf4ff;color:#087cf0;font:800 10px system-ui,sans-serif;cursor:pointer;white-space:nowrap}",
    ".mygram-notifications-list{overflow-y:auto;display:grid;gap:0;padding:4px 8px;overscroll-behavior:contain}",
    ".mygram-notification-item{display:flex;align-items:flex-start;gap:10px;width:100%;padding:11px 9px;border:0;border-radius:12px;background:white;text-align:start;color:#263b56;cursor:pointer}",
    ".mygram-notification-item:hover{background:#f5f9ff}.mygram-notification-item.unread{background:#eef6ff}",
    ".mygram-notification-avatar{flex:0 0 39px;width:39px;height:39px;display:grid;place-items:center;border-radius:50%;background:linear-gradient(135deg,#d6ecff,#e7dcff);color:#176ac2;font:900 13px system-ui;overflow:hidden}",
    ".mygram-notification-avatar img{width:100%;height:100%;object-fit:cover}",
    ".mygram-notification-copy{min-width:0;flex:1;font:12px/1.65 system-ui,sans-serif;overflow-wrap:anywhere}",
    ".mygram-notification-copy strong{font-weight:900;color:#172b4d}.mygram-notification-time{display:block;margin-top:3px;color:#8795a8;font-size:10px}",
    ".mygram-notification-dot{flex:0 0 7px;width:7px;height:7px;margin-top:7px;border-radius:50%;background:#087cf0}",
    ".mygram-notifications-empty{padding:28px 16px;text-align:center;color:#7c8aa0;font:12px/1.8 system-ui,sans-serif}.mygram-notifications-empty span{display:block;margin-bottom:8px;font-size:27px}",
    ".mygram-notifications-foot{padding:10px 15px;border-top:1px solid #edf1f7;background:#fbfdff;text-align:center}.mygram-notifications-foot a{font-size:11px;font-weight:800;color:#087cf0;text-decoration:none}",
    "@media(max-width:700px){.mygram-notifications-trigger{width:38px;height:38px;border-radius:12px}.mygram-notifications-panel{inset-inline-end:-8px;width:min(360px,calc(100vw - 20px));max-height:70vh}.mygram-notifications-head{padding:13px}}"
  ].join("\n");
  document.head.appendChild(style);

  function routeFor(row) {
    switch (row.notification_type) {
      case "friend_request": return "people.html?tab=incoming";
      case "friend_accepted": return "people.html?tab=search";
      case "post_reaction":
      case "post_comment":
      case "friend_post": return row.entity_id ? "home.html#post-" + encodeURIComponent(row.entity_id) : "home.html#feed";
      case "friend_story": return "services.html?tab=stories";
      case "friend_reel": return "services.html?tab=reels";
      case "direct_message": return "services.html?tab=messages";
      default: return "home.html";
    }
  }
  function messageFor(type) {
    const labels = {
      friend_request: "أرسل لك طلب صداقة", friend_accepted: "قبل طلب صداقتك",
      post_reaction: "تفاعل مع منشورك", post_comment: "علّق على منشورك",
      friend_post: "نشر منشوراً جديداً", friend_story: "نشر قصة جديدة",
      friend_reel: "نشر ريل جديد", direct_message: "أرسل إليك رسالة"
    };
    return translate(labels[type] || "لديك إشعار جديد");
  }
  function timeAgo(value) {
    const diff = Math.max(0, Date.now() - new Date(value).getTime());
    if (!Number.isFinite(diff)) return "";
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return translate("الآن");
    if (minutes < 60) return translate("منذ") + " " + minutes + " " + translate("د");
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return translate("منذ") + " " + hours + " " + translate("س");
    try { return new Intl.DateTimeFormat(document.documentElement.lang || "ar", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
    catch { return ""; }
  }
  function createHost() {
    if ($(".mygram-notifications-host")) return $(".mygram-notifications-host");
    const right = $(".topbar-right");
    const header = $(".services-topbar") || $("header .topbar-inner") || $("header.topbar") || $("header.people-topbar");
    if (!right && !header) return null;
    const host = make("div", "mygram-notifications-host");
    const trigger = make("button", "mygram-notifications-trigger");
    trigger.type = "button";
    trigger.setAttribute("aria-label", translate("الإشعارات"));
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-expanded", "false");
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"></path>';
    const badge = make("span", "mygram-notifications-badge", "0");
    badge.hidden = true;
    trigger.append(icon, badge);
    const panel = make("section", "mygram-notifications-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", translate("الإشعارات"));
    panel.hidden = true;
    const head = make("div", "mygram-notifications-head");
    const titleWrap = make("div");
    titleWrap.append(make("h3", "", translate("الإشعارات")), make("small", "", translate("آخر التفاعلات مع حسابك")));
    const mark = make("button", "mygram-notifications-markall", translate("قراءة الكل"));
    mark.type = "button";
    head.append(titleWrap, mark);
    const list = make("div", "mygram-notifications-list");
    list.setAttribute("aria-live", "polite");
    const foot = make("div", "mygram-notifications-foot");
    const friendLink = make("a", "", translate("إدارة طلبات الصداقة") + " ↗");
    friendLink.href = "people.html?tab=incoming";
    foot.appendChild(friendLink);
    panel.append(head, list, foot);
    host.append(trigger, panel);
    if (right) right.insertBefore(host, right.firstChild);
    else {
      const nav = $("nav", header);
      header.insertBefore(host, nav || null);
    }
    trigger.addEventListener("click", async () => {
      const open = panel.hidden;
      panel.hidden = !open;
      trigger.setAttribute("aria-expanded", String(open));
      if (open) await refresh();
    });
    mark.addEventListener("click", markAllRead);
    document.addEventListener("click", event => {
      if (!host.contains(event.target)) {
        panel.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
      }
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        panel.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
      }
    });
    return host;
  }
  function setBadge(count) {
    const badge = $(".mygram-notifications-badge");
    if (!badge) return;
    badge.textContent = count > 99 ? "99+" : String(count);
    badge.hidden = !count;
  }
  function render(rows, actors) {
    const list = $(".mygram-notifications-list");
    if (!list) return;
    list.replaceChildren();
    if (!rows.length) {
      const empty = make("div", "mygram-notifications-empty");
      empty.append(make("span", "", "🔔"), document.createTextNode(translate("أنت على اطلاع! ستظهر هنا الإعجابات والتعليقات وطلبات الصداقة والقصص الجديدة.")));
      list.appendChild(empty);
      return;
    }
    for (const row of rows) {
      const actor = actors.get(row.actor_id);
      const button = make("button", "mygram-notification-item" + (row.read_at ? "" : " unread"));
      button.type = "button";
      const avatar = make("span", "mygram-notification-avatar");
      if (actor && actor.avatar_url) {
        const img = make("img");
        img.src = actor.avatar_url;
        img.alt = "";
        img.loading = "lazy";
        avatar.appendChild(img);
      } else avatar.textContent = (actor && (actor.full_name || actor.username) || "م").trim()[0] || "م";
      const copy = make("span", "mygram-notification-copy");
      const name = make("strong", "", actor && actor.full_name || actor && actor.username && "@" + actor.username || translate("أحد أعضاء MYGRAM"));
      copy.append(name, document.createTextNode(" " + messageFor(row.notification_type)));
      copy.appendChild(make("small", "mygram-notification-time", timeAgo(row.created_at)));
      button.append(avatar, copy);
      if (!row.read_at) button.appendChild(make("span", "mygram-notification-dot"));
      button.addEventListener("click", async () => {
        if (!row.read_at) {
          try { await db.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", row.id); } catch {}
        }
        window.location.href = routeFor(row);
      });
      list.appendChild(button);
    }
  }
  async function refresh() {
    if (!currentUser || refreshInFlight) return;
    refreshInFlight = true;
    try {
      const listQuery = db.from("notifications").select("id,recipient_id,actor_id,notification_type,entity_id,created_at,read_at").order("created_at", { ascending: false }).limit(15);
      const unreadQuery = db.from("notifications").select("id", { count: "exact", head: true });
      const unreadPromise = typeof unreadQuery.is === "function"
        ? unreadQuery.is("read_at", null)
        : Promise.resolve({ count: null, error: null });
      const results = await Promise.all([listQuery, unreadPromise]);
      if (results[0].error) throw results[0].error;
      lastNotifications = results[0].data || [];
      const fallback = lastNotifications.filter(item => !item.read_at).length;
      setBadge(typeof results[1].count === "number" ? results[1].count : fallback);
      const ids = [...new Set(lastNotifications.map(item => item.actor_id).filter(Boolean))];
      let actors = new Map();
      if (ids.length) {
        const query = db.from("profiles").select("id,username,full_name,avatar_url").in("id", ids);
        const result = await query;
        if (!result.error) actors = new Map((result.data || []).map(actor => [actor.id, actor]));
      }
      render(lastNotifications, actors);
    } catch (error) {
      const list = $(".mygram-notifications-list");
      if (list) {
        list.replaceChildren(make("div", "mygram-notifications-empty", translate("تعذر تحميل الإشعارات الآن. حاول مرة أخرى.")));
      }
    } finally { refreshInFlight = false; }
  }
  async function markAllRead() {
    if (!currentUser || !lastNotifications.length) return;
    const query = db.from("notifications").update({ read_at: new Date().toISOString() });
    if (typeof query.is === "function") await query.is("read_at", null);
    else {
      for (const row of lastNotifications.filter(item => !item.read_at)) {
        await db.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", row.id);
      }
    }
    await refresh();
  }
  async function init() {
    const host = createHost();
    if (!host) return;
    const session = await db.auth.getSession();
    if (session.error || !session.data || !session.data.session) { host.remove(); return; }
    currentUser = session.data.session.user;
    await refresh();
    if (typeof db.channel === "function") {
      try {
        db.channel("mygram-notifications-" + currentUser.id)
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: "recipient_id=eq." + currentUser.id }, payload => { if (payload?.new?.actor_id !== currentUser.id) window.MYGRAM_SOUNDS?.play("notification"); refresh(); })
          .subscribe();
      } catch {}
    }
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
    window.addEventListener("mygram:languagechange", () => {
      const trigger = $(".mygram-notifications-trigger");
      if (trigger) trigger.setAttribute("aria-label", translate("الإشعارات"));
      const title = $(".mygram-notifications-head h3");
      if (title) title.textContent = translate("الإشعارات");
      const mark = $(".mygram-notifications-markall");
      if (mark) mark.textContent = translate("قراءة الكل");
      const sub = $(".mygram-notifications-head small");
      if (sub) sub.textContent = translate("آخر التفاعلات مع حسابك");
      refresh();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { init().catch(() => {}); }, { once: true });
  else init().catch(() => {});
})();
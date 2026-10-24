(() => {
  "use strict";
  const cfg = window.MYGRAM_CONFIG || {};
  const loginUrl = cfg.loginUrl || "index.html";
  // Fail closed: a private page must not remain visible if auth cannot initialize.
  if (!window.supabase || !cfg.supabaseUrl || !cfg.supabaseKey) {
    location.replace(loginUrl);
    return;
  }
  const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
  client.auth.getSession().then(({ data, error }) => {
    if (error || !data?.session) location.replace(loginUrl);
  }).catch(() => location.replace(loginUrl));
})();

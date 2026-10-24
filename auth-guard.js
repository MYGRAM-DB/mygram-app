/* Shared fail-closed session guard for static protected pages. */
(() => {
  "use strict";
  const config = window.MYGRAM_CONFIG;
  const loginUrl = config?.loginUrl || "index.html";

  async function protectPage() {
    try {
      if (!window.supabase?.createClient || !config?.supabaseUrl || !config?.supabaseKey) {
        window.location.replace(loginUrl);
        return;
      }
      const client = window.supabase.createClient(config.supabaseUrl, config.supabaseKey);
      const { data, error } = await client.auth.getSession();
      if (error || !data?.session) {
        window.location.replace(loginUrl);
        return;
      }
      document.documentElement.dataset.authenticated = "true";
    } catch {
      window.location.replace(loginUrl);
    }
  }

  protectPage();
})();

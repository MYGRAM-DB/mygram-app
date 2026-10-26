(() => {
  'use strict';

  async function startPresenceHeartbeat() {
    const config = window.MYGRAM_CONFIG;
    if (!config?.supabaseUrl || !config?.supabaseKey || !window.supabase || !window.MYGRAM_PRESENCE) return;
    try {
      const client = window.supabase.createClient(config.supabaseUrl, config.supabaseKey);
      const { data, error } = await client.auth.getSession();
      if (error || !data?.session?.user?.id) return;
      window.__MYGRAM_PRESENCE_HEARTBEAT__?.stop?.();
      window.__MYGRAM_PRESENCE_HEARTBEAT__ = await window.MYGRAM_PRESENCE.init(client, data.session.user, null);
      window.addEventListener('pagehide', () => {
        window.__MYGRAM_PRESENCE_HEARTBEAT__?.stop?.();
      }, { once: true });
    } catch (error) {
      console.warn('MYGRAM global presence heartbeat is unavailable:', error?.message || error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startPresenceHeartbeat, { once: true });
  } else {
    startPresenceHeartbeat();
  }
})();
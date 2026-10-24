/* Public Supabase settings only. NEVER put service_role or any secret here. */
(() => {
  const SUPABASE_URL = "https://rocztskcyakvekokftfx.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_EhY56n7FdI_wW0aW6opIfEbg_VeJvwa59";
  window.MYGRAM_CONFIG = {
    SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY,
    supabaseUrl: SUPABASE_URL,            // read by auth/home/people/profile/services/account-menu
    supabaseKey: SUPABASE_PUBLISHABLE_KEY,
    homeUrl: "home.html",
    loginUrl: "index.html",
    MEDIA_BUCKET: "mygram-media",
    POST_BUCKET: "mygram-media",          // was "post-media": every other page uses mygram-media
    STORY_BUCKET: "mygram-media"
  };
})();

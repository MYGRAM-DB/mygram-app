/* Public Supabase settings only. NEVER put service_role or any secret here. */
(() => {
  const SUPABASE_URL = "https://rocztskcyakvekokftfx.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvY3p0c2tjeWFrdmVrb2tmdGZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2NjkzNzcsImV4cCI6MjEwODI0NTM3N30.UhDU0IXmknrG8c0znIBkB8_tCrJrI6N1Qz9cZO9ZGVY"; // Verified legacy anon key; safe for browser use with RLS enabled.
  window.MYGRAM_CONFIG = {
    SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY,
    supabaseUrl: SUPABASE_URL,            // read by auth/home/people/profile/services/account-menu
    supabaseKey: SUPABASE_PUBLISHABLE_KEY,
    homeUrl: "home.html",
    loginUrl: "login.html",
    MEDIA_BUCKET: "mygram-media",
    POST_BUCKET: "mygram-media",          // was "post-media": every other page uses mygram-media
    STORY_BUCKET: "mygram-media"
  };
})();

/* Public Supabase settings only. NEVER put service_role or any secret here. */
(() => {
  // This branch is intentionally pinned to MYGRAM-STAGING. Do not merge to production
  // until the staging test suite passes and the production configuration is reviewed.
  const SUPABASE_URL = "https://cbyvtehvaojxfcgpelir.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNieXZ0ZWh2YW9qeGZjZ3BlbGlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyOTkzNTgsImV4cCI6MjEwODg3NTM1OH0.Qd1zbUtQhKttDm5uJRa5hvGL2rPgRSpb7XH0y3DORHc";
  window.MYGRAM_CONFIG = {
    ENVIRONMENT: "staging",
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    supabaseUrl: SUPABASE_URL,
    supabaseKey: SUPABASE_PUBLISHABLE_KEY,
    homeUrl: "home.html",
    loginUrl: "login.html",
    MEDIA_BUCKET: "mygram-media",
    POST_BUCKET: "mygram-media",
    STORY_BUCKET: "mygram-media"
  };
})();

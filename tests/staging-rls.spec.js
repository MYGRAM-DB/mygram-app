const { test, expect } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;
const emailA = process.env.MYGRAM_TEST_USER_A_EMAIL;
const passwordA = process.env.MYGRAM_TEST_USER_A_PASSWORD;
const emailB = process.env.MYGRAM_TEST_USER_B_EMAIL;
const passwordB = process.env.MYGRAM_TEST_USER_B_PASSWORD;
const emailC = process.env.MYGRAM_TEST_USER_C_EMAIL;
const passwordC = process.env.MYGRAM_TEST_USER_C_PASSWORD;

const ready = Boolean(url && key && emailA && passwordA && emailB && passwordB && emailC && passwordC);
test.skip(!ready, "Configure SUPABASE_URL, SUPABASE_ANON_KEY, and pre-created test accounts A, B, and C in CI secrets.");

async function signedInClient(email, password) {
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Could not sign in test account ${email}: ${error.message}`);
  return { client, user: data.user };
}

test.describe("MYGRAM Staging RLS isolation", () => {
  test("creates a profile through auth trigger and isolates writes between users", async () => {
    const a = await signedInClient(emailA, passwordA);
    const b = await signedInClient(emailB, passwordB);
    const c = await signedInClient(emailC, passwordC);
    const marker = `staging-rls-${Date.now()}`;
    let postId;

    try {
      const { data: profileA, error: profileErr } = await a.client
        .from("profiles").select("id,username").eq("id", a.user.id).maybeSingle();
      expect(profileErr).toBeNull();
      expect(profileA, "auth signup trigger should create profile A").not.toBeNull();
      expect(profileA.id).toBe(a.user.id);

      const { data: profileB, error: profileBErr } = await b.client
        .from("profiles").select("id").eq("id", b.user.id).maybeSingle();
      expect(profileBErr).toBeNull();
      expect(profileB, "auth signup trigger should create profile B").not.toBeNull();

      const { error: prefErr } = await a.client.from("user_preferences").upsert({
        user_id: a.user.id, language_code: "en", region: marker, share_location: false,
      }, { onConflict: "user_id" });
      expect(prefErr).toBeNull();

      const { data: insertedPost, error: postErr } = await a.client.from("posts").insert({
        user_id: a.user.id, content: marker,
      }).select("id,user_id,content").single();
      expect(postErr).toBeNull();
      postId = insertedPost.id;
      expect(insertedPost.user_id).toBe(a.user.id);

      // Public social read is permitted to authenticated users.
      const { data: visiblePost, error: visibleErr } = await b.client
        .from("posts").select("id,user_id,content").eq("id", postId).maybeSingle();
      expect(visibleErr).toBeNull();
      expect(visiblePost?.content).toBe(marker);

      // Private preferences must be invisible to users B and C.
      const { data: leakedPrefs, error: prefsReadErr } = await b.client
        .from("user_preferences").select("user_id,region").eq("user_id", a.user.id);
      expect(prefsReadErr).toBeNull();
      expect(leakedPrefs).toEqual([]);
      const { data: leakedPrefsC, error: prefsReadErrC } = await c.client
        .from("user_preferences").select("user_id,region").eq("user_id", a.user.id);
      expect(prefsReadErrC).toBeNull();
      expect(leakedPrefsC).toEqual([]);

      // UPDATE/DELETE requests against A's post must affect zero rows for B.
      const { data: changedRows, error: updateErr } = await b.client
        .from("posts").update({ content: marker + "-tampered" }).eq("id", postId).select("id");
      expect(updateErr).toBeNull();
      expect(changedRows).toEqual([]);

      const { data: deletedRows, error: deleteErr } = await b.client
        .from("posts").delete().eq("id", postId).select("id");
      expect(deleteErr).toBeNull();
      expect(deletedRows).toEqual([]);

      const { data: cChangedRows, error: cUpdateErr } = await c.client
        .from("posts").update({ content: marker + "-tampered-by-c" }).eq("id", postId).select("id");
      expect(cUpdateErr).toBeNull();
      expect(cChangedRows).toEqual([]);

      const { data: stillOwnedPost, error: verifyErr } = await a.client
        .from("posts").select("id,content,user_id").eq("id", postId).single();
      expect(verifyErr).toBeNull();
      expect(stillOwnedPost.content).toBe(marker);
      expect(stillOwnedPost.user_id).toBe(a.user.id);

      const { data: ownPref, error: ownPrefErr } = await a.client
        .from("user_preferences").select("user_id,region").eq("user_id", a.user.id).single();
      expect(ownPrefErr).toBeNull();
      expect(ownPref.region).toBe(marker);
    } finally {
      if (postId) await a.client.from("posts").delete().eq("id", postId);
      await a.client.from("user_preferences").delete().eq("user_id", a.user.id);
      await a.client.auth.signOut();
      await b.client.auth.signOut();
      await c.client.auth.signOut();
    }
  });

  test("login page can authenticate user A and render the social feed", async ({ page }) => {
    await page.goto(process.env.MYGRAM_STAGING_BASE_URL || "http://127.0.0.1:4173/login.html");
    // New browsers default to signup unless this device has a remembered account.
    // Explicitly select login so the required full-name signup field cannot block submission.
    await page.locator("#loginTab").click();
    await page.locator("#email").fill(emailA);
    await page.locator("#password").fill(passwordA);
    await page.locator("#submitButton").click();
    await expect(page).toHaveURL(/home\.html/);
    await expect(page.locator("#postForm")).toBeVisible();
    await expect(page.locator("#postsContainer")).toBeVisible();
  });
});

(() => {
  "use strict";
  const config = window.MYGRAM_CONFIG;
  const client = window.supabase.createClient(config.supabaseUrl, config.supabaseKey);
  const form = document.getElementById("authForm");
  const loginTab = document.getElementById("loginTab");
  const signupTab = document.getElementById("signupTab");
  const nameLabel = document.getElementById("nameLabel");
  const fullName = document.getElementById("fullName");
  const email = document.getElementById("email");
  const password = document.getElementById("password");
  const submitButton = document.getElementById("submitButton");
  const resetPasswordButton = document.getElementById("resetPasswordButton");
  const notice = document.getElementById("authNotice");
  let mode = "login";

  document.getElementById("year").textContent = new Date().getFullYear();

  function setNotice(message, kind = "") {
    notice.textContent = message;
    notice.className = "notice" + (kind ? " " + kind : "");
  }

  function setMode(nextMode) {
    mode = nextMode;
    const signup = mode === "signup";
    loginTab.classList.toggle("active", !signup);
    signupTab.classList.toggle("active", signup);
    nameLabel.classList.toggle("hidden", !signup);
    fullName.required = signup;
    password.autocomplete = signup ? "new-password" : "current-password";
    document.getElementById("formTitle").textContent = signup ? "انضم إلى MYGRAM ✨" : "أهلاً بعودتك 👋";
    document.getElementById("formSubtitle").textContent = signup
      ? "أنشئ حسابك وابدأ مشاركة أفكارك."
      : "سجّل الدخول للمتابعة إلى MYGRAM.";
    submitButton.textContent = signup ? "إنشاء الحساب" : "تسجيل الدخول";
    setNotice("");
  }

  resetPasswordButton.addEventListener("click", async () => {
    const normalizedEmail = email.value.trim().toLowerCase();
    if (!normalizedEmail) { setNotice("أدخل بريدك الإلكتروني أولاً لإرسال رابط الاستعادة.", "error"); email.focus(); return; }
    resetPasswordButton.disabled = true;
    setNotice("جارٍ إرسال رابط استعادة كلمة المرور...");
    try {
      const redirectTo = new URL("login.html?reset=1", location.href).href;
      const { error } = await client.auth.resetPasswordForEmail(normalizedEmail, { redirectTo });
      if (error) throw error;
      setNotice("إذا كان البريد مسجلاً، ستصلك رسالة لاستعادة كلمة المرور.", "success");
    } catch (error) {
      console.error("MYGRAM password reset:", error);
      setNotice("تعذّر إرسال رسالة الاستعادة. تحقّق من إعدادات البريد وحاول مجدداً.", "error");
    } finally { resetPasswordButton.disabled = false; }
  });

  loginTab.addEventListener("click", () => setMode("login"));
  signupTab.addEventListener("click", () => setMode("signup"));

  async function ensureSessionRedirect() {
    const { data } = await client.auth.getSession();
    if (data.session) window.location.replace(config.homeUrl);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const normalizedEmail = email.value.trim().toLowerCase();
    const pass = password.value;
    if (pass.length < 6) {
      setNotice("كلمة المرور يجب أن تكون 6 أحرف على الأقل.", "error");
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = mode === "signup" ? "جارٍ إنشاء الحساب..." : "جارٍ تسجيل الدخول...";
    setNotice("");

    try {
      if (mode === "signup") {
        const name = fullName.value.trim();
        const { data, error } = await client.auth.signUp({
          email: normalizedEmail,
          password: pass,
          options: { data: { full_name: name }, emailRedirectTo: new URL(config.homeUrl, location.href).href }
        });
        if (error) throw error;

        if (data.session) {
          setNotice("تم إنشاء الحساب بنجاح. جارٍ فتح MYGRAM...", "success");
          setTimeout(() => window.location.replace(config.homeUrl), 700);
        } else {
          setNotice("تم إرسال رسالة تأكيد إلى بريدك الإلكتروني. أكّد الحساب ثم سجّل الدخول.", "success");
          setMode("login");
        }
      } else {
        const { error } = await client.auth.signInWithPassword({
          email: normalizedEmail,
          password: pass
        });
        if (error) throw error;
        window.location.replace(config.homeUrl);
      }
    } catch (error) {
      console.error("MYGRAM auth error:", error);
      let message = error.message || "حدث خطأ غير متوقع.";
      if (/Invalid login credentials/i.test(message)) message = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
      if (/Email not confirmed/i.test(message)) message = "يجب تأكيد البريد الإلكتروني أولاً.";
      setNotice(message, "error");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = mode === "signup" ? "إنشاء الحساب" : "تسجيل الدخول";
    }
  });

  ensureSessionRedirect();
})();

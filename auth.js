(() => {
  "use strict";
  const config = window.MYGRAM_CONFIG;
  const client = window.supabase.createClient(config.supabaseUrl, config.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  const form = document.getElementById("authForm");
  const loginTab = document.getElementById("loginTab");
  const signupTab = document.getElementById("signupTab");
  const tabs = document.querySelector(".auth-tabs");
  const nameLabel = document.getElementById("nameLabel");
  const fullName = document.getElementById("fullName");
  const email = document.getElementById("email");
  const emailLabel = email.closest("label");
  const password = document.getElementById("password");
  const passwordLabel = password.closest("label");
  const submitButton = document.getElementById("submitButton");
  const resetPasswordButton = document.getElementById("resetPasswordButton");
  const notice = document.getElementById("authNotice");
  let mode = "login";
  let recoverySessionReady = false;
  document.getElementById("year").textContent = new Date().getFullYear();

  function setNotice(message, kind = "") {
    notice.textContent = message;
    notice.className = "notice" + (kind ? " " + kind : "");
  }
  function setMode(nextMode) {
    mode = nextMode;
    const signup = mode === "signup";
    const recovery = mode === "recovery";
    tabs.hidden = recovery;
    nameLabel.classList.toggle("hidden", !signup || recovery);
    emailLabel.hidden = recovery;
    resetPasswordButton.hidden = recovery || signup;
    fullName.required = signup && !recovery;
    email.required = !recovery;
    password.autocomplete = signup || recovery ? "new-password" : "current-password";
    document.getElementById("formTitle").textContent = recovery ? "تعيين كلمة مرور جديدة" : signup ? "انضم إلى MYGRAM ✨" : "أهلاً بعودتك 👋";
    document.getElementById("formSubtitle").textContent = recovery
      ? "اختر كلمة مرور جديدة لا تقل عن 8 أحرف."
      : signup ? "أنشئ حسابك وابدأ مشاركة أفكارك." : "سجّل الدخول للمتابعة إلى MYGRAM.";
    passwordLabel.querySelector("label");
    password.placeholder = recovery ? "8 أحرف على الأقل" : "6 أحرف على الأقل";
    password.minLength = recovery ? 8 : 6;
    submitButton.textContent = recovery ? "حفظ كلمة المرور الجديدة" : signup ? "إنشاء الحساب" : "تسجيل الدخول";
    setNotice("");
  }
  function safeError(error) {
    const raw = String(error?.message || "");
    if (/Invalid login credentials/i.test(raw)) return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
    if (/Email not confirmed/i.test(raw)) return "يجب تأكيد البريد الإلكتروني أولاً.";
    if (/password should be at least|weak password|password is too short/i.test(raw)) return "كلمة المرور ضعيفة. اختر كلمة أطول وأكثر صعوبة في التخمين.";
    return "تعذّر إكمال العملية. تحقّق من البيانات والإعدادات وحاول مجدداً.";
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
      console.error("MYGRAM password reset request failed:", error);
      setNotice("تعذّر إرسال رسالة الاستعادة. تحقّق من إعدادات البريد والرابط المسموح به ثم حاول مجدداً.", "error");
    } finally { resetPasswordButton.disabled = false; }
  });

  loginTab.addEventListener("click", () => setMode("login"));
  signupTab.addEventListener("click", () => setMode("signup"));

  client.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      recoverySessionReady = Boolean(session);
      setMode("recovery");
      setNotice("تم التحقق من رابط الاستعادة. أدخل كلمة المرور الجديدة.", "success");
    }
  });

  async function ensureSessionRedirect() {
    const params = new URLSearchParams(location.search);
    if (params.get("reset") === "1") {
      const { data, error } = await client.auth.getSession();
      if (data.session) {
        recoverySessionReady = true;
        setMode("recovery");
        setNotice("إذا كان رابط الاستعادة صالحاً، يمكنك تعيين كلمة مرور جديدة.", "success");
      } else {
        setMode("login");
        setNotice("افتح رابط الاستعادة من أحدث رسالة بريدية. قد تكون الروابط القديمة منتهية الصلاحية.", "error");
      }
      if (error) console.warn("MYGRAM recovery session check failed");
      return;
    }
    const { data } = await client.auth.getSession();
    if (data.session) window.location.replace(config.homeUrl);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const normalizedEmail = email.value.trim().toLowerCase();
    const pass = password.value;
    const recovery = mode === "recovery";
    if (pass.length < (recovery ? 8 : 6)) {
      setNotice(recovery ? "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل." : "كلمة المرور يجب أن تكون 6 أحرف على الأقل.", "error");
      return;
    }
    if (recovery && !recoverySessionReady) {
      setNotice("جلسة الاستعادة غير صالحة. اطلب رسالة استعادة جديدة وافتح أحدث رابط.", "error");
      return;
    }
    submitButton.disabled = true;
    resetPasswordButton.disabled = true;
    setNotice("");
    try {
      if (recovery) {
        const { error } = await client.auth.updateUser({ password: pass });
        if (error) throw error;
        await client.auth.signOut();
        recoverySessionReady = false;
        history.replaceState(null, "", new URL("login.html?password-updated=1", location.href));
        setMode("login");
        password.value = "";
        setNotice("تم تحديث كلمة المرور. سجّل الدخول بكلمة المرور الجديدة.", "success");
      } else if (mode === "signup") {
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
          setMode("login");
          setNotice("إذا كان التسجيل متاحاً، ستصلك رسالة تأكيد إلى بريدك الإلكتروني.", "success");
        }
      } else {
        const { error } = await client.auth.signInWithPassword({ email: normalizedEmail, password: pass });
        if (error) throw error;
        window.location.replace(config.homeUrl);
      }
    } catch (error) {
      console.error("MYGRAM auth operation failed:", error);
      setNotice(safeError(error), "error");
    } finally {
      submitButton.disabled = false;
      resetPasswordButton.disabled = false;
      if (mode !== "recovery") submitButton.textContent = mode === "signup" ? "إنشاء الحساب" : "تسجيل الدخول";
    }
  });
  ensureSessionRedirect();
})();

(() => {
  "use strict";
  const config = window.MYGRAM_CONFIG;
  const client = window.supabase.createClient(config.supabaseUrl, config.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  const form = document.getElementById("authForm");
  const loginTab = document.getElementById("loginTab");
  const signupTab = document.getElementById("signupTab");
  const phoneTab = document.getElementById("phoneTab");
  const phoneCountryLabel = document.getElementById("phoneCountryLabel"), phoneLabel = document.getElementById("phoneLabel");
  const phoneCountry = document.getElementById("phoneCountry"), phoneNumber = document.getElementById("phoneNumber");
  const otpLabel = document.getElementById("otpLabel"), otpCode = document.getElementById("otpCode");
  let phoneOtpSent = false, pendingPhone = "";
  const tabs = document.querySelector(".auth-tabs");
  const nameLabel = document.getElementById("nameLabel");
  const fullName = document.getElementById("fullName");
  const email = document.getElementById("email");
  const emailLabel = email.closest("label");
  const password = document.getElementById("password");
  const passwordLabel = password.closest("label");
  const submitButton = document.getElementById("submitButton");
  const resetPasswordButton = document.getElementById("resetPasswordButton");
  const googleSignInButton = document.getElementById("googleSignInButton");
  const magicLinkButton = document.getElementById("magicLinkButton");
  const socialAuthSection = document.getElementById("socialAuthSection");
  const notice = document.getElementById("authNotice");
  let mode = (() => { try { return localStorage.getItem("mygram-account-known") === "1" ? "login" : "signup"; } catch { return "signup"; } })();
  let recoverySessionReady = false;
  document.getElementById("year").textContent = new Date().getFullYear();

  function setNotice(message, kind = "") {
    notice.textContent = window.MYGRAM_TRANSLATE_TEXT ? window.MYGRAM_TRANSLATE_TEXT(message) : message;
    notice.className = "notice" + (kind ? " " + kind : "");
  }
  function setMode(nextMode) {
    mode = nextMode;
    const signup = mode === "signup";
    const recovery = mode === "recovery";
    const phone = mode === "phone" || mode === "phone-verify";
    const phoneVerify = mode === "phone-verify";
    tabs.style.display = recovery ? "none" : "";
    nameLabel.classList.toggle("hidden", (!signup && mode !== "phone") || recovery || phoneVerify);
    phoneCountryLabel.classList.toggle("hidden", !phone || phoneVerify || recovery);
    phoneLabel.classList.toggle("hidden", !phone || phoneVerify || recovery);
    otpLabel.classList.toggle("hidden", !phoneVerify);
    passwordLabel.style.display = recovery || phone ? "none" : "";
    password.required = !recovery && !phone;
    phoneNumber.required = phone && !phoneVerify;
    otpCode.required = phoneVerify;
    loginTab.classList.toggle("active", mode === "login");
    signupTab.classList.toggle("active", mode === "signup");
    phoneTab.classList.toggle("active", phone);
    emailLabel.style.display = recovery || phone ? "none" : "";
    resetPasswordButton.hidden = recovery || signup || phone;
    magicLinkButton.hidden = mode !== "login";
    socialAuthSection.hidden = recovery || phone;
    fullName.required = signup && !recovery;
    email.required = !recovery && !phone;
    password.autocomplete = signup || recovery ? "new-password" : "current-password";
    document.getElementById("formTitle").textContent = recovery ? "تعيين كلمة مرور جديدة" : phoneVerify ? "تحقق من رقم هاتفك" : phone ? "التسجيل برقم الهاتف" : signup ? "انضم إلى MYGRAM ✨" : "أهلاً بعودتك 👋";
    document.getElementById("formSubtitle").textContent = recovery
      ? "اختر كلمة مرور جديدة لا تقل عن 8 أحرف."
      : phoneVerify ? "أدخل رمز SMS المكوّن من 6 أرقام." : phone ? "اختر رمز الدولة وأدخل رقمك لاستلام رمز التحقق." : signup ? "أنشئ حسابك وابدأ مشاركة أفكارك." : "سجّل الدخول للمتابعة إلى MYGRAM.";
    password.placeholder = signup || recovery ? "8 أحرف على الأقل" : "أدخل كلمة المرور";
    password.minLength = signup || recovery ? 8 : 1;
    submitButton.textContent = recovery ? "حفظ كلمة المرور الجديدة" : phoneVerify ? "تأكيد الرمز" : phone ? (phoneOtpSent ? "إعادة إرسال الرمز" : "إرسال رمز SMS") : signup ? "إنشاء الحساب" : "تسجيل الدخول";
    setNotice("");
    window.MYGRAM_APPLY_LANGUAGE?.();
    const translate = window.MYGRAM_TRANSLATE_TEXT || (value => value);
    const titleSource = recovery ? "تعيين كلمة مرور جديدة" : phoneVerify ? "تحقق من رقم هاتفك" : phone ? "التسجيل برقم الهاتف" : signup ? "انضم إلى MYGRAM ✨" : "أهلاً بعودتك 👋";
    const subtitleSource = recovery ? "اختر كلمة مرور جديدة لا تقل عن 8 أحرف." : phoneVerify ? "أدخل رمز SMS المكوّن من 6 أرقام." : phone ? "اختر رمز الدولة وأدخل رقمك لاستلام رمز التحقق." : signup ? "أنشئ حسابك وابدأ مشاركة أفكارك." : "سجّل الدخول للمتابعة إلى MYGRAM.";
    const placeholderSource = signup || recovery ? "8 أحرف على الأقل" : "أدخل كلمة المرور";
    const submitSource = recovery ? "حفظ كلمة المرور الجديدة" : phoneVerify ? "تأكيد الرمز" : phone ? (phoneOtpSent ? "إعادة إرسال الرمز" : "إرسال رمز SMS") : signup ? "إنشاء الحساب" : "تسجيل الدخول";
    const titleElement = document.getElementById("formTitle");
    const subtitleElement = document.getElementById("formSubtitle");
    titleElement.dataset.i18n = titleSource;
    subtitleElement.dataset.i18n = subtitleSource;
    submitButton.dataset.i18n = submitSource;
    titleElement.textContent = translate(titleSource);
    subtitleElement.textContent = translate(subtitleSource);
    password.placeholder = translate(placeholderSource);
    submitButton.textContent = translate(submitSource);
  }
  // HIBP Pwned Passwords range API: only the first 5 SHA-1 hex characters leave the browser.
  async function checkCompromisedPassword(value) {
    if (!window.crypto?.subtle) throw new Error("لا يمكن إجراء فحص أمان كلمة المرور في هذا المتصفح. حدّث المتصفح وحاول مجدداً.");
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-1", bytes);
    const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
    const response = await fetch("https://api.pwnedpasswords.com/range/" + hash.slice(0, 5), {
      headers: { "Add-Padding": "true" }, cache: "no-store", credentials: "omit"
    });
    if (!response.ok) throw new Error("تعذّر فحص كلمة المرور المسربة حالياً. حاول مجدداً بعد قليل.");
    const suffix = hash.slice(5);
    const rows = (await response.text()).split(/\r?\n/);
    const match = rows.find(row => row.slice(0, 35).toUpperCase() === suffix);
    if (match && Number(match.split(":")[1]) > 0) throw new Error("كلمة المرور هذه ظهرت في تسريبات سابقة. اختر كلمة مرور مختلفة تماماً.");
  }

  function safeError(error) {
    const raw = String(error?.message || "");
    if (/كلمة المرور هذه ظهرت في تسريبات|تعذّر فحص كلمة المرور المسربة|لا يمكن إجراء فحص أمان كلمة المرور/.test(raw)) return raw;
    if (/unsupported provider|provider.*not enabled|provider.*disabled|google.*not.*enabled/i.test(raw)) return "تسجيل الدخول عبر Google غير مفعّل بعد. يجب إعداد مزوّد Google في Supabase أولاً.";
    if (/redirect.*not allowed|redirect_to.*not.*allowed/i.test(raw)) return "رابط العودة غير مسموح به في Supabase. أضف رابط MYGRAM إلى قائمة Redirect URLs.";
    if (/Invalid login credentials/i.test(raw)) return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
    if (/Email not confirmed/i.test(raw)) return "يجب تأكيد البريد الإلكتروني أولاً.";
    if (/password should be at least|weak password|password is too short/i.test(raw)) return "كلمة المرور ضعيفة. اختر كلمة أطول وأكثر صعوبة في التخمين.";
    return "تعذّر إكمال العملية. تحقّق من البيانات والإعدادات وحاول مجدداً.";
  }


  googleSignInButton.addEventListener("click", async () => {
    googleSignInButton.disabled = true;
    setNotice("جارٍ فتح تسجيل الدخول عبر Google...");
    try {
      const redirectTo = new URL("login.html", location.href).href;
      const { error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, queryParams: { prompt: "select_account" } }
      });
      if (error) throw error;
    } catch (error) {
      console.error("MYGRAM Google sign-in failed:", error);
      setNotice(safeError(error), "error");
      googleSignInButton.disabled = false;
    }
  });

  magicLinkButton.addEventListener("click", async () => {
    const normalizedEmail = email.value.trim().toLowerCase();
    if (!normalizedEmail) {
      setNotice("أدخل بريدك الإلكتروني أولاً لإرسال رابط الدخول.", "error");
      email.focus();
      return;
    }
    if (!email.checkValidity()) {
      setNotice("أدخل عنوان بريد إلكتروني صالحاً.", "error");
      email.focus();
      return;
    }
    magicLinkButton.disabled = true;
    setNotice("جارٍ إرسال رابط الدخول...");
    try {
      const emailRedirectTo = new URL("login.html", location.href).href;
      const { error } = await client.auth.signInWithOtp({
        email: normalizedEmail,
        options: { shouldCreateUser: false, emailRedirectTo }
      });
      if (error) throw error;
      setNotice("إذا كان البريد مرتبطاً بحساب، ستصلك رسالة دخول.", "success");
    } catch (error) {
      console.error("MYGRAM magic-link sign-in failed:", error);
      setNotice("تعذر إرسال الرابط. تحقق من إعدادات البريد في Supabase وحاول مجدداً.", "error");
    } finally {
      magicLinkButton.disabled = false;
    }
  });

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

  loginTab.addEventListener("click", () => { phoneOtpSent=false;setMode("login"); });
  signupTab.addEventListener("click", () => { phoneOtpSent=false;setMode("signup"); });
  phoneTab.addEventListener("click", () => { phoneOtpSent=false;setMode("phone"); });
  if(window.MYGRAM_FILL_COUNTRIES && phoneCountry){window.MYGRAM_FILL_COUNTRIES(phoneCountry,"ar",true);phoneCountry.value="US";}
  function e164Phone(){
    const raw=phoneNumber.value.trim();
    if(raw.startsWith("+")) return "+"+raw.slice(1).replace(/\D/g,"");
    const country=window.MYGRAM_COUNTRIES?.find(x=>x.code===phoneCountry.value);
    const dial=(country?.dial||"").replace(/\D/g,"");
    let national=raw.replace(/\D/g,"").replace(/^0+/,"");
    const prefix=String(country?.nationalPrefix||"").replace(/\D/g,"");
    if(dial==="1"&&national.length===11&&national.startsWith("1"))national=national.slice(1);
    if(prefix&&dial==="1"){
      if(national.length===7)national=prefix+national;
      else if(national.length===10){if(!national.startsWith(prefix))return "";}
      else return "";
    }else if(prefix&&!national.startsWith(prefix))national=prefix+national;
    return dial&&national?"+"+dial+national:"";
  }

  client.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      recoverySessionReady = Boolean(session);
      setMode("recovery");
      setNotice("تم التحقق من رابط الاستعادة. أدخل كلمة المرور الجديدة.", "success");
    }
  });

  async function routeAfterAuth() {
    try {
      const { data: sessionData } = await client.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) { window.location.replace(config.loginUrl); return; }
      const { data: profile, error } = await client.from("profiles")
        .select("profile_completed").eq("id", user.id).maybeSingle();
      if (error) throw error;
      window.location.replace(profile?.profile_completed ? config.homeUrl : "onboarding.html");
    } catch (error) {
      console.error("MYGRAM profile routing failed:", error);
      window.location.replace("onboarding.html");
    }
  }

  async function ensureSessionRedirect() {
    const params = new URLSearchParams(location.search);
    const oauthError = params.get("error_description") || params.get("error");
    if (oauthError) {
      history.replaceState(null, "", new URL("login.html", location.href));
      setMode("login");
      setNotice(safeError({ message: oauthError }), "error");
      return;
    }
    if (params.get("reset") === "1") {
      const { data, error } = await client.auth.getSession();
      setMode("login");
      setNotice("افتح رابط الاستعادة من أحدث رسالة بريدية. يجب أن يكون الرابط صالحاً وغير منتهي الصلاحية.", "error");
      recoverySessionReady = false;
      if (error) console.warn("MYGRAM recovery session check failed");
      return;
    }
    const { data } = await client.auth.getSession();
    if (data.session) await routeAfterAuth();
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const normalizedEmail = email.value.trim().toLowerCase();
    const pass = password.value;
    const recovery = mode === "recovery";
    if(mode==="phone" || mode==="phone-verify"){
      event.preventDefault();
      submitButton.disabled=true;
      try{
        if(mode==="phone"){
          const phone=e164Phone();
          if(!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error("رقم الهاتف غير مكتمل. تحقق من رمز الدولة والرقم.");
          pendingPhone=phone;
          const {error}=await client.auth.signInWithOtp({phone,options:{shouldCreateUser:true,data:{full_name:fullName.value.trim()}}});
          if(error)throw error;
          phoneOtpSent=true;setMode("phone-verify");setNotice("إذا كان الرقم صالحاً والإرسال متاحاً، سيصلك رمز تحقق برسالة SMS.","success");
        }else{
          const token=otpCode.value.trim();
          if(!/^\d{6}$/.test(token))throw new Error("أدخل رمز التحقق المكوّن من 6 أرقام.");
          const {data,error}=await client.auth.verifyOtp({phone:pendingPhone,token,type:"sms"});
          if(error)throw error;
          if(!data.session)throw new Error("تم التحقق، لكن لم تُنشأ جلسة. حاول تسجيل الدخول مجدداً.");
          try { localStorage.setItem("mygram-account-known", "1"); } catch {}
          setNotice("تم التحقق من الهاتف بنجاح. جارٍ فتح MYGRAM...","success");
          await routeAfterAuth();
        }
      }catch(err){console.warn("MYGRAM phone auth failed",err);setNotice(err.message&&/رقم الهاتف|رمز التحقق|تم التحقق/.test(err.message)?err.message:"تعذّر إرسال أو التحقق من الرمز. تحقق من إعدادات SMS في Supabase وحاول مجدداً.","error")}
      finally{submitButton.disabled=false}
      return;
    }
    if ((mode === "signup" || recovery) && pass.length < 8) {
      setNotice(recovery ? "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل." : "كلمة المرور يجب أن تكون 8 أحرف على الأقل.", "error");
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
        await checkCompromisedPassword(pass);
        const { error } = await client.auth.updateUser({ password: pass });
        if (error) throw error;
        await client.auth.signOut();
        recoverySessionReady = false;
        history.replaceState(null, "", new URL("login.html?password-updated=1", location.href));
        setMode("login");
        password.value = "";
        setNotice("تم تحديث كلمة المرور. سجّل الدخول بكلمة المرور الجديدة.", "success");
      } else if (mode === "signup") {
        await checkCompromisedPassword(pass);
        const name = fullName.value.trim();
        const { data, error } = await client.auth.signUp({
          email: normalizedEmail,
          password: pass,
          options: { data: { full_name: name }, emailRedirectTo: new URL("onboarding.html", location.href).href }
        });
        if (error) throw error;
        try { localStorage.setItem("mygram-account-known", "1"); } catch {}
        if (data.session) {
          setNotice("تم إنشاء الحساب بنجاح. جارٍ فتح MYGRAM...", "success");
          setTimeout(() => routeAfterAuth(), 250);
        } else {
          setMode("login");
          setNotice("إذا كان التسجيل متاحاً، ستصلك رسالة تأكيد إلى بريدك الإلكتروني.", "success");
        }
      } else {
        const { error } = await client.auth.signInWithPassword({ email: normalizedEmail, password: pass });
        if (error) throw error;
        try { localStorage.setItem("mygram-account-known", "1"); } catch {}
        await routeAfterAuth();
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
  setMode(new URLSearchParams(location.search).get("reset") === "1" ? "login" : "signup");
  ensureSessionRedirect();
})();

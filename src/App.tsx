import { isValidUsername, normalizeUsername } from "./lib/profile-validation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { products, getProductBySlug, type ProductDefinition } from "./config/products";
import { navigate, routeFromPath, useHashPath } from "./lib/navigation";
import { isSupabaseConfigured, supabase, type MygramUser } from "./lib/supabase";
import { MessengerWorkspace } from "./components/MessengerWorkspace";

type Theme = "dark" | "light";
type AuthMode = "signin" | "signup";
type CountryOption = { code: string; name_ar: string; name_en: string; calling_code: string | null };

function readTheme(): Theme {
  try {
    const value = localStorage.getItem("mygram-theme");
    return value === "light" ? "light" : "dark";
  } catch { return "dark"; }
}

function Mark() {
  return <span className="mark" aria-hidden="true"><svg viewBox="0 0 44 44"><path d="M7 31V13l15 15 15-15v18" fill="none" stroke="url(#mygram-gradient)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5"/><defs><linearGradient id="mygram-gradient" x1="2" x2="42" y1="40" y2="4"><stop stopColor="#38d6c4"/><stop offset=".52" stopColor="#4d8cff"/><stop offset="1" stopColor="#a878ff"/></linearGradient></defs></svg></span>;
}

function Status({ product }: { product: ProductDefinition }) {
  return <span className={`pill ${product.status}`}>{product.status === "partial" ? "بنية أولية موجودة" : "لم يبدأ التنفيذ"}</span>;
}

function ProductCard({ product }: { product: ProductDefinition }) {
  return <a className="product-card" href={`#/products/${product.slug}`} data-testid={`product-${product.slug}`}>
    <span className={`product-icon ${product.accent}`}>{product.icon}</span>
    <span className="product-copy"><b>{product.name}</b><small>{product.subtitle}</small></span>
    <Status product={product}/>
    <span className="arrow">↗</span>
  </a>;
}

function NotFound() {
  return <section className="panel not-found"><h1>الصفحة غير موجودة</h1><a className="button primary" href="#/">العودة للرئيسية</a></section>;
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [user, setUser] = useState<MygramUser | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [authMessage, setAuthMessage] = useState("");
  const [profileCheckBusy, setProfileCheckBusy] = useState(false);
  const [profileCheckError, setProfileCheckError] = useState("");
  const [onboardingBusy, setOnboardingBusy] = useState(false);
  const [onboardingMessage, setOnboardingMessage] = useState("");
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [countriesBusy, setCountriesBusy] = useState(false);
  const path = useHashPath();
  const route = useMemo(() => routeFromPath(path), [path]);
  const product = route.page === "product" ? getProductBySlug(route.slug) : undefined;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
    try { localStorage.setItem("mygram-theme", theme); } catch { /* In-memory state remains active. */ }
  }, [theme]);

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) { setUser(data.session?.user ?? null); setAuthLoading(false); }
    }).catch(() => { if (active) setAuthLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setProfileCheckBusy(false);
      if (route.page === "onboarding") navigate("/auth");
      return;
    }
    if (!supabase) return;
    let active = true;
    setProfileCheckBusy(true);
    setProfileCheckError("");
    void supabase.from("my_profile_state").select("profile_completed").eq("id", user.id).maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setProfileCheckError("تعذر التحقق من حالة الملف الشخصي. أعد تحميل الصفحة أو سجّل الدخول مجدداً.");
          setProfileCheckBusy(false);
          return;
        }
        const completed = data?.profile_completed === true;
        setProfileCheckBusy(false);
        if (!completed && route.page !== "onboarding") navigate("/onboarding");
        if (completed && route.page === "onboarding") navigate("/");
      }, () => {
        if (active) {
          setProfileCheckError("تعذر الاتصال للتحقق من اكتمال الملف الشخصي.");
          setProfileCheckBusy(false);
        }
      });
    return () => { active = false; };
  }, [authLoading, user?.id, route.page]);

  useEffect(() => {
    if (route.page !== "onboarding" || !user || !supabase) return;
    let active = true;
    setCountriesBusy(true);
    void supabase.from("supported_countries").select("code,name_ar,name_en,calling_code")
      .eq("enabled", true).order("name_ar")
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setOnboardingMessage("تعذر تحميل قائمة الدول. أعد تحميل الصفحة.");
        else setCountries((data ?? []) as CountryOption[]);
        setCountriesBusy(false);
      }, () => {
        if (active) {
          setOnboardingMessage("تعذر تحميل قائمة الدول. تحقق من الاتصال ثم أعد المحاولة.");
          setCountriesBusy(false);
        }
      });
    return () => { active = false; };
  }, [route.page, user?.id]);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || authBusy) return;
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim().toLowerCase();
    const password = String(data.get("password") ?? "");
    if (!email || password.length < 8) {
      setAuthMessage("أدخل بريداً إلكترونياً صحيحاً وكلمة مرور لا تقل عن 8 أحرف.");
      return;
    }
    setAuthBusy(true);
    setAuthMessage("");
    try {
      if (authMode === "signup") {
        const { data: result, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (result.session) navigate("/onboarding");
        else setAuthMessage("تم إنشاء طلب الحساب. افتح رسالة تأكيد البريد، ثم سجّل الدخول لإكمال ملفك الشخصي.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setAuthMessage(message.includes("already registered")
        ? "هذا البريد مسجّل مسبقاً. سجّل الدخول بدلاً من إنشاء حساب جديد."
        : "تعذر إتمام العملية. تحقق من البيانات وإعدادات Auth ثم أعد المحاولة.");
    } finally { setAuthBusy(false); }
  }

  async function submitOnboarding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user || onboardingBusy) return;

    const data = new FormData(event.currentTarget);
    const firstName = String(data.get("firstName") ?? "").trim();
    const lastName = String(data.get("lastName") ?? "").trim();
    const username = normalizeUsername(String(data.get("username") ?? ""));
    const dateOfBirth = String(data.get("dateOfBirth") ?? "");
    const gender = String(data.get("gender") ?? "") || null;
    const nationalityCode = String(data.get("nationalityCode") ?? "") || null;
    const currentCountryCode = String(data.get("currentCountryCode") ?? "") || null;
    const region = String(data.get("region") ?? "").trim() || null;
    const cityName = String(data.get("cityName") ?? "").trim() || null;
    const contactPhone = String(data.get("contactPhone") ?? "").trim() || null;
    const bio = String(data.get("bio") ?? "").trim();
    const interests = String(data.get("interests") ?? "")
      .split(",").map((item) => item.trim()).filter(Boolean).slice(0, 20);
    const shareLocation = data.get("shareLocation") === "on";

    if (firstName.length < 1 || firstName.length > 60 || lastName.length < 1 || lastName.length > 60) {
      setOnboardingMessage("اكتب الاسم الأول واسم العائلة، بحد أقصى 60 حرفاً لكل منهما.");
      return;
    }
    if (!isValidUsername(username)) {
      setOnboardingMessage("اسم المستخدم يجب أن يتكون من 3 إلى 30 حرفاً إنجليزياً صغيراً أو رقماً أو _.");
      return;
    }
    if (!dateOfBirth || dateOfBirth > new Date().toISOString().slice(0, 10)) {
      setOnboardingMessage("أدخل تاريخ ميلاد صحيحاً غير موجود في المستقبل.");
      return;
    }

    setOnboardingBusy(true);
    setOnboardingMessage("");
    try {
      const { error } = await supabase.rpc("complete_mygram_profile", {
        p_first_name: firstName,
        p_last_name: lastName,
        p_username: username,
        p_date_of_birth: dateOfBirth,
        p_gender: gender,
        p_nationality_code: nationalityCode,
        p_contact_phone: contactPhone,
        p_current_country_code: currentCountryCode,
        p_region: region,
        p_city_name: cityName,
        p_bio: bio,
        p_interests: interests,
        p_share_location: shareLocation,
      });
      if (error) {
        if (error.code === "23505" || error.message.includes("USERNAME_TAKEN")) {
          setOnboardingMessage("اسم المستخدم محجوز. اختر اسماً آخر.");
        } else if (error.message.includes("INVALID_USERNAME")) {
          setOnboardingMessage("صيغة اسم المستخدم غير صحيحة.");
        } else {
          setOnboardingMessage("تعذر حفظ الملف. راجع البيانات وحاول مرة أخرى.");
        }
        return;
      }
      navigate("/");
    } catch {
      setOnboardingMessage("تعذر الاتصال لحفظ الملف الشخصي. بياناتك لم تُعتمد، أعد المحاولة.");
    } finally {
      setOnboardingBusy(false);
    }
  }

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) setAuthMessage("تعذر تسجيل الخروج. أعد المحاولة.");
    else navigate("/");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a href="#/" className="brand"><Mark/><span><b>MYGRAM</b><small>كل ما تحتاجه هنا</small></span></a>
        <div className="side-label">مساحة العمل</div>
        <nav className="side-nav">
          <a href="#/" aria-current={route.page === "home" ? "page" : undefined}><span>⌂</span>الرئيسية</a>
          <a href="#/products" aria-current={route.page === "products" || route.page === "product" ? "page" : undefined}><span>▦</span>المنتجات التسعة</a>
          <a href="#/settings" aria-current={route.page === "settings" ? "page" : undefined}><span>⚙</span>الإعدادات</a>
        </nav>
        <div className="side-bottom"><span className={`dot ${isSupabaseConfigured ? "ready" : ""}`}/>{isSupabaseConfigured ? "اتصال Supabase مُعد" : "اتصال Supabase غير مُعد"}<small>v0.1.0 · Foundation</small></div>
      </aside>

      <main className="main">
        <header className="topbar">
          <a href="#/" className="mobile-brand"><Mark/><b>MYGRAM</b></a>
          <div className="actions">
            <button className="icon-btn" type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="تغيير المظهر">{theme === "dark" ? "☼" : "☾"}</button>
            {user ? <div className="user-chip"><span>{(user.email?.[0] ?? "م").toUpperCase()}</span><small>{user.email}</small><button className="text-btn" onClick={signOut} type="button">تسجيل الخروج</button></div> : <a className="button primary small" href="#/auth">تسجيل الدخول</a>}
          </div>
        </header>

        <div className="page">
          {authLoading || profileCheckBusy ? <div className="loading" role="status">جارٍ التحقق من الجلسة والملف الشخصي…</div> :
          route.page === "auth" ? (
            <section className="panel auth-panel">
              <div className="eyebrow">الحساب</div><h1>الدخول إلى MYGRAM</h1>
              <p>أنشئ حسابك بالبريد وكلمة المرور، ثم أكمل معلومات ملفك الشخصي في خطوة منفصلة. التحقق الهاتفي غير مفعّل بعد.</p>
              {!isSupabaseConfigured && <div className="notice"><b>اتصال Supabase غير مُعد</b><span>أضف VITE_SUPABASE_URL وVITE_SUPABASE_PUBLISHABLE_KEY إلى متغيرات بيئة البناء. لن تُرسل طلبات قبل إعدادها.</span></div>}
              <form onSubmit={submitAuth}>
                <label>البريد الإلكتروني<input name="email" type="email" autoComplete="email" required maxLength={254} disabled={!isSupabaseConfigured || authBusy}/></label>
                <label>كلمة المرور<input name="password" type="password" autoComplete={authMode === "signup" ? "new-password" : "current-password"} minLength={8} required disabled={!isSupabaseConfigured || authBusy}/></label>
                <button className="button primary full" type="submit" disabled={!isSupabaseConfigured || authBusy}>{authBusy ? "جارٍ التنفيذ…" : authMode === "signup" ? "إنشاء حساب" : "متابعة"}</button>
              </form>
              {authMessage && <p className="auth-message" role="status">{authMessage}</p>}
              <button className="text-btn" type="button" onClick={() => setAuthMode(authMode === "signup" ? "signin" : "signup")}>{authMode === "signup" ? "لديك حساب؟ سجّل الدخول" : "مستخدم جديد؟ أنشئ حساباً"}</button>
              <small className="security-note">لا تضع Service Role Key في الواجهة الأمامية.</small>
            </section>
          ) : route.page === "onboarding" ? (
            !user || !supabase ? (
              <section className="panel onboarding-panel"><h1>استكمال الملف الشخصي</h1><p>سجّل الدخول أولاً للمتابعة.</p><a className="button primary" href="#/auth">الانتقال إلى تسجيل الدخول</a></section>
            ) : (
              <section className="panel onboarding-panel">
                <div className="eyebrow">خطوة بعد إنشاء الحساب</div>
                <h1>أهلاً بك في MYGRAM</h1>
                <p className="muted">أكمل ملفك مرة واحدة. تاريخ الميلاد وبيانات الاتصال تحفظ في مساحة خاصة بحسابك، ولا يتم نشرها في ملفك العام.</p>
                {profileCheckError && <div className="notice" role="alert">{profileCheckError}</div>}
                <form className="onboarding-form" onSubmit={submitOnboarding}>
                  <div className="form-grid">
                    <label>الاسم الأول<input name="firstName" autoComplete="given-name" minLength={1} maxLength={60} required disabled={onboardingBusy}/></label>
                    <label>اسم العائلة<input name="lastName" autoComplete="family-name" minLength={1} maxLength={60} required disabled={onboardingBusy}/></label>
                    <label>اسم المستخدم<input name="username" autoComplete="username" minLength={3} maxLength={30} pattern="[A-Za-z0-9_]{3,30}" required disabled={onboardingBusy} dir="ltr" placeholder="your_name"/><small>3 إلى 30 حرفاً أو رقماً أو شرطة سفلية، وسيتم حفظه بحروف صغيرة.</small></label>
                    <label>تاريخ الميلاد<input name="dateOfBirth" type="date" required max={new Date().toISOString().slice(0,10)} disabled={onboardingBusy}/></label>
                    <label>الجنس (اختياري)<select name="gender" defaultValue="" disabled={onboardingBusy}><option value="">أفضل عدم التحديد الآن</option><option value="female">أنثى</option><option value="male">ذكر</option><option value="nonbinary">غير ثنائي</option><option value="prefer_not_to_say">أفضل عدم الإفصاح</option></select></label>
                    <label>الجنسية (اختياري)<select name="nationalityCode" defaultValue="" disabled={onboardingBusy || countriesBusy}><option value="">اختر الجنسية</option>{countries.map((country) => <option key={country.code} value={country.code}>{country.name_ar} · {country.name_en}</option>)}</select></label>
                    <label>بلد الإقامة (اختياري)<select name="currentCountryCode" defaultValue="" disabled={onboardingBusy || countriesBusy}><option value="">اختر بلد الإقامة</option>{countries.map((country) => <option key={country.code} value={country.code}>{country.name_ar} · {country.calling_code ?? ""}</option>)}</select></label>
                    <label>المنطقة / المحافظة<input name="region" maxLength={100} disabled={onboardingBusy}/></label>
                    <label>المدينة<input name="cityName" maxLength={100} disabled={onboardingBusy}/></label>
                    <label>رقم هاتف للتواصل (غير متحقق)<input name="contactPhone" type="tel" autoComplete="tel" maxLength={30} disabled={onboardingBusy} dir="ltr" placeholder="+961..."/></label>
                  </div>
                  <label className="wide-field">نبذة عنك<textarea name="bio" maxLength={500} rows={3} disabled={onboardingBusy}/></label>
                  <label className="wide-field">الهوايات والاهتمامات، افصل بينها بفاصلة<input name="interests" maxLength={1000} disabled={onboardingBusy} placeholder="السفر، التقنية، الرياضة"/></label>
                  <label className="consent-field"><input name="shareLocation" type="checkbox" disabled={onboardingBusy}/> أسمح باستخدام منطقة ومدينة الإقامة في التوصيات المحلية. لا يمنح ذلك إذناً بنشر عنواني.</label>
                  {countriesBusy && <p className="muted" role="status">جارٍ تحميل قائمة الدول…</p>}
                  {onboardingMessage && <p className="auth-message" role="status">{onboardingMessage}</p>}
                  <button className="button primary full" type="submit" disabled={onboardingBusy || countriesBusy || countries.length === 0}>{onboardingBusy ? "جارٍ حفظ الملف…" : "حفظ واستكمال الدخول"}</button>
                </form>
                <small className="security-note">يُحفظ الملف والتفاصيل الخاصة والتفضيلات بعملية واحدة. إثبات البريد أو الهاتف يتم في تدفق تحقق منفصل.</small>
              </section>
            )
          ) : route.page === "settings" ? (
            <section className="settings-page">
              <div className="eyebrow">الإعدادات</div><h1>إعدادات التجربة</h1>
              <div className="settings-list">
                <div className="panel setting"><div><b>المظهر</b><small>داكن / فاتح</small></div><div className="segmented"><button aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}>داكن</button><button aria-pressed={theme === "light"} onClick={() => setTheme("light")}>فاتح</button></div></div>
                <div className="panel setting"><div><b>لغة الواجهة</b><small>العربية · RTL</small></div><span className="pill partial">اللغات الستون قيد الإعداد</span></div>
                <div className="panel setting"><div><b>الحساب</b><small>{user?.email ?? "لست مسجلاً"}</small></div><span className="pill partial">{user ? "تم تسجيل الدخول" : "لست مسجلاً"}</span></div>
              </div>
              {!isSupabaseConfigured && <div className="notice">اتصال Supabase غير مُعد. أضف متغيرات البيئة قبل تفعيل المصادقة.</div>}
            </section>
          ) : route.page === "products" ? (
            <section className="products-page"><div className="eyebrow">المنتجات التسعة</div><h1>مساحات MYGRAM</h1><p className="muted">اختر منتجاً لعرض نطاقه وحالة تنفيذه. وجود البنية الخلفية لا يعني اكتمال الواجهة أو الوظيفة.</p><div className="product-list">{products.map((item) => <ProductCard key={item.id} product={item}/>)}</div></section>
          ) : route.page === "product" ? (
            product ? (
              product.slug === "messenger" ? (
                user ? <MessengerWorkspace user={user}/> : (
                  <section className="panel detail">
                    <div className="eyebrow">MYGRAM MESSENGER</div>
                    <h1>MYGRAM MESSENGER</h1><p className="muted">محادثاتك الخاصة تبدأ هنا</p>
                    <p className="description">سجّل الدخول لفتح Messenger. لا تُعرض أي محادثة قبل التحقق من عضويتك فيها.</p>
                    <a className="button primary" href="#/auth">تسجيل الدخول</a>
                  </section>
                )
              ) : (
                <section className="panel detail"><a className="back" href="#/products">← العودة إلى المنتجات</a><span className={`product-icon large ${product.accent}`}>{product.icon}</span><div className="eyebrow">حالة المنتج</div><h1>{product.name}</h1><p className="muted">{product.subtitle}</p><p className="description">{product.description}</p><Status product={product}/><div className="notice">{product.status === "partial" ? "توجد أجزاء من قاعدة البيانات أو الخدمات السابقة، لكن واجهة المنتج الجديدة واختباراته لم تكتمل." : "هذا المنتج لم يبدأ تنفيذه بعد."}</div><small className="security-note">لا تُعتبر أي ميزة مكتملة قبل الاختبار والتحقق.</small></section>
              )
            ) : <NotFound/>
          ) : route.page === "not-found" ? <NotFound/> : (
            <>
              <section className="hero panel">
                <div className="hero-copy"><div className="eyebrow">✦ منظومة واحدة. تسعة منتجات. هوية موحدة.</div><h1>كل عالمك الرقمي يبدأ من هنا.</h1><p>MYGRAM تجمع التواصل الاجتماعي والمراسلة والفيديو والذكاء الاصطناعي والاجتماعات ضمن منظومة واحدة، مع بقاء كل منتج مستقلاً في وظائفه وصلاحياته.</p><a className="button primary" href="#/products">استكشف المنتجات ↗</a></div>
                <div className="hero-orbit" aria-hidden="true"><span className="orbit-ring"/><span className="orbit-core"><Mark/></span><i>◎</i><b>➤</b><em>▶</em></div>
              </section>
              <section className="foundation"><b>حالة التنفيذ · مرحلة التأسيس</b><p>يجري بناء البنية الأساسية أولاً. هذه البطاقات تصف نطاق المنتجات ولا تعني أن وظائفها جاهزة للاستخدام.</p></section>
              <section className="products-section"><div className="section-head"><div className="eyebrow">مساحات MYGRAM</div><h2>المنتجات التسعة</h2></div><div className="product-grid">{products.map((item) => <ProductCard key={item.id} product={item}/>)}</div></section>
              {!isSupabaseConfigured && <div className="notice"><b>اتصال Supabase غير مُعد</b><span>لن تُرسل أي طلبات إلى قاعدة البيانات حتى إضافة متغيرات البيئة العامة.</span><a href="#/auth">تسجيل الدخول ↗</a></div>}
            </>
          )}
        </div>
        <footer>نسخة تأسيسية. لا تُعتبر أي ميزة مكتملة قبل الاختبار والتحقق.</footer>
        <nav className="mobile-nav"><a href="#/" aria-current={route.page === "home" ? "page" : undefined}>⌂<small>الرئيسية</small></a><a href="#/products" aria-current={route.page === "products" || route.page === "product" ? "page" : undefined}>▦<small>المنتجات</small></a><a href="#/settings" aria-current={route.page === "settings" ? "page" : undefined}>⚙<small>الإعدادات</small></a></nav>
      </main>
    </div>
  );
}

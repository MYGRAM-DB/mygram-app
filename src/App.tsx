import { useEffect, useMemo, useState, type FormEvent } from "react";
import { products, getProductBySlug, type ProductDefinition } from "./config/products";
import { navigate, routeFromPath, useHashPath } from "./lib/navigation";
import { isSupabaseConfigured, supabase, type MygramUser } from "./lib/supabase";

type Theme = "dark" | "light";
type AuthMode = "signin" | "signup";

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

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || authBusy) return;
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const fullName = String(data.get("fullName") ?? "").trim();
    if (!email || password.length < 8 || (authMode === "signup" && fullName.length < 2)) {
      setAuthMessage("تحقق من البيانات المدخلة ثم أعد المحاولة.");
      return;
    }
    setAuthBusy(true);
    setAuthMessage("");
    try {
      if (authMode === "signup") {
        const { data: result, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
        if (result.session) navigate("/");
        else setAuthMessage("تم إرسال طلب التسجيل. تحقق من بريدك إذا كان تأكيد البريد مفعّلاً.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/");
      }
    } catch {
      setAuthMessage("تعذر إتمام العملية. تحقق من البيانات وإعدادات Auth ثم أعد المحاولة.");
    } finally { setAuthBusy(false); }
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
          {authLoading ? <div className="loading" role="status">جارٍ التحقق من الجلسة…</div> :
          route.page === "auth" ? (
            <section className="panel auth-panel">
              <div className="eyebrow">الحساب</div><h1>الدخول إلى MYGRAM</h1>
              <p>استخدم بريدك الإلكتروني وكلمة المرور. التحقق الهاتفي غير مفعّل في هذه النسخة التأسيسية.</p>
              {!isSupabaseConfigured && <div className="notice"><b>اتصال Supabase غير مُعد</b><span>أضف VITE_SUPABASE_URL وVITE_SUPABASE_PUBLISHABLE_KEY إلى متغيرات بيئة البناء. لن تُرسل طلبات قبل إعدادها.</span></div>}
              <form onSubmit={submitAuth}>
                {authMode === "signup" && <label>الاسم الكامل<input name="fullName" autoComplete="name" minLength={2} maxLength={100} required disabled={!isSupabaseConfigured || authBusy}/></label>}
                <label>البريد الإلكتروني<input name="email" type="email" autoComplete="email" required maxLength={254} disabled={!isSupabaseConfigured || authBusy}/></label>
                <label>كلمة المرور<input name="password" type="password" autoComplete={authMode === "signup" ? "new-password" : "current-password"} minLength={8} required disabled={!isSupabaseConfigured || authBusy}/></label>
                <button className="button primary full" type="submit" disabled={!isSupabaseConfigured || authBusy}>{authBusy ? "جارٍ التنفيذ…" : authMode === "signup" ? "إنشاء حساب" : "متابعة"}</button>
              </form>
              {authMessage && <p className="auth-message" role="status">{authMessage}</p>}
              <button className="text-btn" type="button" onClick={() => setAuthMode(authMode === "signup" ? "signin" : "signup")}>{authMode === "signup" ? "لديك حساب؟ سجّل الدخول" : "مستخدم جديد؟ أنشئ حساباً"}</button>
              <small className="security-note">لا تضع Service Role Key في الواجهة الأمامية.</small>
            </section>
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
            product ? <section className="panel detail"><a className="back" href="#/products">← العودة إلى المنتجات</a><span className={`product-icon large ${product.accent}`}>{product.icon}</span><div className="eyebrow">حالة المنتج</div><h1>{product.name}</h1><p className="muted">{product.subtitle}</p><p className="description">{product.description}</p><Status product={product}/><div className="notice">{product.status === "partial" ? "توجد أجزاء من قاعدة البيانات أو الخدمات السابقة، لكن واجهة المنتج الجديدة واختباراته لم تكتمل." : "هذا المنتج لم يبدأ تنفيذه بعد."}</div><small className="security-note">لا تُعتبر أي ميزة مكتملة قبل الاختبار والتحقق.</small></section> : <NotFound/>
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

function ProductCard({ product }: { product: ProductDefinition }) {
  return <a className="product-card" href={`#/products/${product.slug}`} data-testid={`product-${product.slug}`}><span className={`product-icon ${product.accent}`}>{product.icon}</span><span className="product-copy"><b>{product.name}</b><small>{product.subtitle}</small></span><Status product={product}/><span className="arrow">↗</span></a>;
}
function NotFound() {
  return <section className="panel not-found"><h1>الصفحة غير موجودة</h1><a className="button primary" href="#/">العودة للرئيسية</a></section>;
}

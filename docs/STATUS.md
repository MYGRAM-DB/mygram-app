# MYGRAM Execution Status

تاريخ خط الأساس: 2026-10-30

## الحالة العامة

<badge>PHASE B: FOUNDATION SHELL IMPLEMENTED</badge>

هذا لا يعني أن المنتجات أو الوظائف الأساسية مكتملة.

## المراحل

| المرحلة | الحالة | الملاحظات |
|---|---|---|
| A: Audit & Foundation | PARTIAL | تدقيق GitHub وSupabase؛ اختلافات البيئتين موثقة |
| B: Core Architecture | PARTIAL | Vite/React/TypeScript shell، سجل المنتجات التسعة، مسارات Hash، مظهر داكن/فاتح وRTL |
| C: Identity & Auth | PARTIAL | تسجيل البريد الأولي، توجيه onboarding، نموذج الملف، RPC ذرّية وبيانات خاصة منفصلة؛ لم يُختبر Auth API الحقيقي بعد |
| D: Social | PARTIAL | مخطط اجتماعي أولي وRLS موجودان؛ الواجهات والعمليات غير مكتملة |
| E: Messaging | PARTIAL | مخططات منفصلة موجودة في Production؛ إعادة بناء المنتج لم تبدأ |
| F: Video | NOT IMPLEMENTED | Tube وTikToks غير منفذين |
| G: AI & Meetings | PARTIAL | وظائف اجتماعات قديمة موجودة في Production؛ MYGRAM AI غير منفذ |
| H: Wallet | NOT IMPLEMENTED | لا جداول محفظة أو Ledger |
| I: Tests | PARTIAL | CI run 40994126414 أخضر: npm ci، Node 8/8، Playwright 6/6، TypeScript وVite؛ JWT Auth/RLS E2E ما زال مطلوباً |
| J: Release | BLOCKED | لا نشر Production |

## مواءمة Staging

- Migration 20261030022611_align_staging_core_schema_phase_1 أضافت حقول الملف والتفضيلات وعلاقة الردود وحدود النص.
- Migration 20261030023659_create_private_profile_details_and_stage_countries أنشأت تفاصيل الملف الخاصة وجدول الدول المرجعي.
- Staging يضم 8 جداول عامة و7 migrations.
- جدول الدول يحتوي 205 سجلات مرجعية، كلها مفعّلة، مع أسماء عربية/إنجليزية ورموز اتصال صالحة.
- profile_private_details مفعّل عليه RLS؛ بعد اختبار تكامل مؤقت تم تنظيف الصفوف التجريبية والتحقق من عودة الجدول إلى صفر صفوف. حقول إثبات البريد/الهاتف ليست قابلة للكتابة من المتصفح.
- Migration 20261030024521_add_secure_profile_completion_rpc أضافت RPC ذرّية لاستكمال الملف؛ SECURITY DEFINER مع search_path فارغ، التنفيذ لـauthenticated فقط، والهوية من auth.uid().
- سياسات الجداول الستة الأساسية لم تتغير في المرحلتين.
- تبقى 14 لغة فقط، ولا يوجد Translation Catalog أو Edge Functions.

## نتائج RLS الأولية

- اختبار داخل PostgreSQL بدور authenticated وهويتين مختلفتين نجح لملكية profiles/posts/comments/reactions وخصوصية user_preferences.
- تمت قراءة posts/comments/reactions للحساب الثاني كما تسمح السياسات.
- مُنع الحساب الثاني من تعديل/حذف/إدراج سجلات باسم المالك.
- انتهى الاختبار بـROLLBACK ولم تبق صفوف اصطناعية.
- هذه محاكاة claim على مستوى قاعدة البيانات، وليست اختبار جلستي دخول JWT عبر Auth API.
- يلزم اختبار runtime منفصل لجدول profile_private_details واختبار API بحسابين.

## ما لم يكتمل

- اختبار onboarding عبر Auth حقيقي، ورفع صورة الملف الشخصي.
- تسجيل الهاتف وOTP، وإعداد SMTP وإرسال البريد الحقيقي.
- تفرد usernames عبر البيئتين.
- حماية عرض حقول الموقع العامة في profiles.
- 60 لغة كاملة مع ترجمة جميع الشاشات.
- اختبار Auth/RLS/Storage عبر جلستي JWT مستقلتين.
- صفحات ووظائف المنتجات التسعة.
- المحفظة والدفتر المالي.

## المخاطر المفتوحة

1. اختبار رحلة onboarding وحفظ الملف عبر جلستي Auth/JWT مستقلتين.
2. اختبار REST لمنع قراءة تفاصيل الحساب الخاص ومنع تغيير حقول إثبات التحقق.
3. مراجعة إتاحة أعمدة profiles لأن SELECT الحالي يسمح للمستخدمين المصادقين بقراءة صفوف profiles؛ show_living_location ليس حماية على مستوى العمود.
4. انتقال supported_locales من is_active إلى enabled بآلية متزامنة قبل استعمال العمود الجديد.
5. استكمال بقية مخطط Staging تدريجياً.
6. إعداد SMTP/SMS/LiveKit/AI لاحقاً بأسرار منفصلة.
7. معالجة تعارضات usernames في Production ضمن مسار مستقل دون تغيير تلقائي.
8. تغطية اللغات والمنتجات والاختبارات المتكاملة.

# MYGRAM Execution Status

تاريخ خط الأساس: 2026-10-30

## الحالة العامة

<badge>PHASE B: FOUNDATION SHELL IMPLEMENTED</badge>

هذا لا يعني أن المنتجات أو الوظائف الأساسية مكتملة.

## المراحل

| المرحلة | الحالة | الملاحظات |
|---|---|---|
| A: Audit & Foundation | PARTIAL | تدقيق GitHub وSupabase؛ اختلافات البيئتين موثقة في SCHEMA_DRIFT.md |
| B: Core Architecture | PARTIAL | Vite/React/TypeScript shell، سجل المنتجات التسعة، مسارات Hash، مظهر داكن/فاتح وRTL |
| C: Identity & Auth | PARTIAL | تهيئة Supabase Auth بالبريد عند ضبط المتغيرات؛ لا تحقق بريد حي أو OTP أو استكمال ملف |
| D: Social | PARTIAL | مخطط قاعدة اجتماعي سابق موجود؛ واجهات إعادة البناء والعمليات غير مكتملة |
| E: Messaging | PARTIAL | مخططات منفصلة لـMessenger وWHATSMYGRAM موجودة؛ لا واجهة مراسلة جديدة أو E2E متكامل |
| F: Video | NOT IMPLEMENTED | Tube وTikToks غير منفذين؛ Reels القديمة لا تعني اكتمال المنتج |
| G: AI & Meetings | PARTIAL | Meetings functions ومخططات موجودة في Production؛ MYGRAM AI غير منفذ |
| H: Wallet | NOT IMPLEMENTED | لا جداول محفظة أو Ledger |
| I: Comprehensive Tests | PARTIAL | CI run #13: npm ci من القفل الملتزم، Node 4/4، Playwright 5/5، TypeScript وVite build نجحت؛ يلزم RLS E2E بحسابين |
| J: Release | BLOCKED | لا نشر Production في هذه المرحلة |

## ما يعمل في الهيكل الحالي

- التنقل بين الرئيسية والمنتجات والإعدادات.
- عرض تسعة منتجات من سجل موحد مع حالة تنفيذ صريحة.
- تغيير المظهر بين Dark وLight.
- تهيئة عميل Supabase Auth بالبريد إذا تم إعداد `VITE_SUPABASE_URL` و`VITE_SUPABASE_PUBLISHABLE_KEY`.
- إنشاء الحساب/تسجيل الدخول بالبريد عبر Supabase Auth عند إعداد البيئة، دون اعتبار ذلك تدفق onboarding مكتمل.
- تمييز واضح عند عدم إعداد Supabase دون إرسال طلبات غير مضبوطة.
- واجهة عربية RTL في نسخة التأسيس.
- خمس رحلات Playwright أساسية نجحت على Chromium.

## مواءمة Staging

- Migration `20261030022611_align_staging_core_schema_phase_1` مطبقة ومسجلة في Staging.
- أضيفت حقول الملف الشخصي والتفضيلات والموقع، علاقة التعليقات المتداخلة وحدود النص، وعمود توافق للغات وفهارس FK.
- تم التحقق من الأعمدة والقيود والفهارس والصفوف بعد Migration.
- لم تتغير سياسات RLS أو بيانات Auth أو Storage أو Edge Functions.
- ما زال Staging يحتوي 6 جداول فقط و14 لغة؛ الجداول المتبقية والدول والترجمة والـEdge Functions لم تواءم بعد.
- عمود `supported_locales.enabled` مؤقت للتوافق؛ السياسة الحالية ما زالت تقرأ `is_active`.

## ما لم يكتمل

- دعم 60 لغة كاملة في واجهات التطبيق.
- التسجيل الهاتفي وOTP.
- استكمال الملف الشخصي وتفرد اسم المستخدم عبر البيئتين.
- اختبار RLS بحسابين مستقلين.
- Auth/Storage integration tests والبريد الحقيقي.
- صفحات ووظائف المنتجات التسعة.
- نظام المحفظة والدفتر المالي.

## المخاطر المفتوحة

1. مواءمة بقية مخطط Staging على دفعات بعد مراجعة migrations والاعتماديات لكل منتج.
2. تنفيذ انتقال آمن لحقل تفعيل اللغات قبل اعتماد `enabled` على Staging.
3. إعداد متغيرات Supabase في بيئة البناء دون وضع Service Role Key بالعميل.
4. بناء onboarding بعد تثبيت contract واضح للأسماء والحقول.
5. اختبارات سلبية/إيجابية لثلاثة RPCs SECURITY DEFINER.
6. خمسة foreign keys غير مفهرسة في Production تحتاج مراجعة منفصلة، دون لمسها ضمن مرحلة Staging.
7. اختبار RLS/Auth بحسابين مستقلين.
8. تجهيز مزودي SMTP وSMS وTURN وLiveKit وAI عند اعتماد الخدمات.
9. تصميم Wallet قانونياً ومحاسبياً قبل أي كتابة مالية.
10. إثبات تغطية الترجمة لجميع واجهات المنتجات.

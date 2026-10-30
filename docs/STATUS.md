# MYGRAM Execution Status

تاريخ خط الأساس: 2026-10-30

## الحالة العامة

PHASE B: FOUNDATION SHELL IMPLEMENTED

هذا لا يعني أن المنتجات أو الوظائف الأساسية مكتملة.

## المراحل

| المرحلة | الحالة | الملاحظات |
|---|---|---|
| A: Audit & Foundation | PARTIAL | تدقيق GitHub وSupabase؛ اختلافات البيئتين موثقة |
| B: Core Architecture | PARTIAL | Vite/React/TypeScript shell، سجل المنتجات التسعة، مسارات Hash، مظهر داكن/فاتح وRTL |
| C: Identity & Auth | PARTIAL | تسجيل البريد الأولي، توجيه onboarding، نموذج الملف، RPC ذرّية وبيانات خاصة منفصلة؛ اختبار JWT حقيقي لم يُشغّل بعد |
| D: Social | PARTIAL | مخطط اجتماعي أولي وRLS موجودان؛ الواجهات والعمليات غير مكتملة |
| E: Messaging | PARTIAL | مخططات منفصلة موجودة في Production؛ إعادة بناء المنتج لم تبدأ |
| F: Video | NOT IMPLEMENTED | Tube وTikToks غير منفذين |
| G: AI & Meetings | PARTIAL | وظائف اجتماعات قديمة موجودة في Production؛ MYGRAM AI غير منفذ |
| H: Wallet | NOT IMPLEMENTED | لا جداول محفظة أو Ledger |
| I: Tests | PARTIAL | CI Run #36 أخضر على HEAD السابق لتغييرات الاختبار الحالية؛ اختبار JWT/Storage أضيف ولم يُشغّل بعد |
| J: Release | BLOCKED | لا نشر Production |

## مواءمة Staging

- Migration 20261030022611_align_staging_core_schema_phase_1 أضافت حقول الملف والتفضيلات وعلاقة الردود وحدود النص.
- Migration 20261030023659_create_private_profile_details_and_stage_countries أنشأت تفاصيل الملف الخاصة وجدول الدول المرجعي.
- Staging يضم 8 جداول عامة و8 migrations بعد إضافة تخزين صور الملف الشخصي.
- جدول الدول يحتوي 205 سجلات مرجعية، كلها مفعّلة، مع أسماء عربية/إنجليزية ورموز اتصال.
- profile_private_details مفعّل عليه RLS؛ حقول إثبات البريد/الهاتف ليست قابلة للكتابة من المتصفح حسب فحص column privileges.
- Migration 20261030024521 أضافت RPC ذرّية لاستكمال الملف؛ SECURITY DEFINER مع search_path فارغ، التنفيذ لـauthenticated فقط، والهوية من auth.uid().
- Migration 20261030030822 أنشأت bucket خاصة profile-avatars بحد 5 MiB وأربع سياسات تربط العمليات بمجلد auth.uid().
- لا توجد bucket عامة في Staging.
- تبقى 14 لغة فقط، ولا يوجد Translation Catalog أو Edge Functions.

## نتائج RLS الأولية

- اختبار داخل PostgreSQL بدور authenticated وهويتين مختلفتين نجح لملكية profiles/posts/comments/reactions وخصوصية user_preferences.
- تمت قراءة posts/comments/reactions للحساب الثاني كما تسمح السياسات.
- مُنع الحساب الثاني من تعديل/حذف/إدراج سجلات باسم المالك.
- انتهى الاختبار بـROLLBACK ولم تبق صفوف اصطناعية.
- هذه محاكاة claim على مستوى قاعدة البيانات، وليست اختبار جلستي دخول JWT عبر Auth API.
- فحص Staging أكد أن authenticated لا يستطيع تحديث verified_contact_method أو contact_verified_at.
- أضيف اختبار REST آلي بحسابين مستقلين لتغطية التفاصيل الخاصة وحقول الإثبات وStorage، لكنه ينتظر حسابي QA مستقلين في أسرار GitHub Actions.

## ما لم يكتمل

- تجهيز حسابي QA مستقلين مؤكدَي البريد وتشغيل الاختبار الآلي عبر JWT.
- اختبار signup وتأكيد البريد وتسليم SMTP إلى صندوق وارد حقيقي.
- رحلة UI الفعلية لتسجيل الدخول واستكمال الملف عبر حسابي QA.
- رفع صورة الملف الشخصي من واجهة MYGRAM وربطها بالملف.
- تسجيل الهاتف وOTP.
- تفرد usernames عبر البيئتين.
- حماية عرض حقول الموقع العامة في profiles.
- 60 لغة كاملة مع ترجمة جميع الشاشات.
- صفحات ووظائف المنتجات التسعة.
- المحفظة والدفتر المالي.

## تنبيهات Advisor في Staging

- SECURITY WARN: authenticated_security_definer_function_executable على RPC استكمال الملف. الاستدعاء مقصود من authenticated فقط مع قيود دفاعية موثقة، لكن يجب اختبار REST/JWT قبل اعتماد الميزة.
- SECURITY WARN: حماية كلمات المرور المسرّبة غير مفعلة.
- PERFORMANCE INFO: ستة فهارس غير مستخدمة بعد على الجداول الاجتماعية في Staging؛ لا تُحذف قبل توفر حمل فعلي ومراجعة خطط الاستعلام.

## المخاطر المفتوحة

1. اختبار رحلة Auth/JWT فعلية بحسابين مستقلين.
2. اختبار REST لمنع قراءة تفاصيل الحساب الخاص ومنع تغيير حقول إثبات التحقق.
3. اختبار Storage upload/read/upsert/delete للمالك وغير المالك عبر JWT.
4. اختبار SMTP/رسائل التأكيد والاستعادة عبر صندوق بريد حقيقي.
5. مراجعة إتاحة أعمدة profiles لأن SELECT الحالي يسمح للمستخدمين المصادقين بقراءة صفوف profiles؛ show_living_location ليس حماية على مستوى العمود.
6. انتقال supported_locales من is_active إلى enabled بآلية متزامنة قبل استعمال العمود الجديد.
7. استكمال بقية مخطط Staging تدريجياً.
8. إعداد SMS/LiveKit/AI لاحقاً بأسرار منفصلة.
9. معالجة تعارضات usernames في Production ضمن مسار مستقل دون تغيير تلقائي.
10. تغطية اللغات والمنتجات والاختبارات المتكاملة.

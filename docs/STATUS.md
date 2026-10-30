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
| C: Identity & Auth | PARTIAL | تسجيل البريد الأولي، توجيه onboarding، نموذج الملف، RPC ذرّية وبيانات خاصة منفصلة؛ اختبار جلستي JWT عبر Auth API ما زال مطلوباً |
| D: Social | PARTIAL | مخطط اجتماعي أولي وRLS موجودان؛ الواجهات والعمليات غير مكتملة |
| E: Messaging | NOT IMPLEMENTED IN STAGING | لا توجد جداول محادثات أو رسائل أو أعضاء محادثة في Staging؛ اختبار عزل A/B/C غير قابل للتنفيذ قبل ترحيل المخطط والسياسات |
| F: Video | NOT IMPLEMENTED | Tube وTikToks غير منفذين |
| G: AI & Meetings | PARTIAL | وظائف اجتماعات قديمة موجودة في Production؛ MYGRAM AI غير منفذ |
| H: Wallet | NOT IMPLEMENTED | لا جداول محفظة أو Ledger |
| I: Tests | PARTIAL | CI Run #46 أخضر على HEAD 4a710d5039f1b9319498ead8a83da4ce7b81d5f1 للاختبارات الأساسية والبناء؛ خطوة JWT/Storage الآلية تخطّتها CI لعدم تهيئة أسرار QA |
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
- توجد ثلاثة مستخدمين Auth مؤكدَي البريد. لم تُغيّر كلمات مرورهم أو بياناتهم الدائمة خلال فحوص المحاكاة.
- تبقى 14 لغة فقط، ولا يوجد Translation Catalog أو Edge Functions.
- جرد مخطط قاعدة البيانات في 2026-10-30 لم يجد أي جدول تطبيقي باسم أو مجال chat/message/conversation/participant/thread/inbox في Staging. لم يتم الرجوع إلى Production أو نسخه لهذا الفحص.

## نتائج RLS وStorage المحاكية (2026-10-30)

- استخدمت معاملة PostgreSQL مؤقتة مع SET LOCAL ROLE authenticated وclaims مختلفة لحسابين Staging موجودين، ثم نفذت ROLLBACK.
- RPC complete_mygram_profile نجحت لكل هوية محاكاة وأنشأت صفوف الملف الخاص والتفضيلات داخل المعاملة فقط.
- الحساب A قرأ تفاصيله الخاصة وتفضيلاته؛ لم تظهر له صفوف الحساب B الخاصة أو تفضيلاته.
- الحسابان المصادقان استطاعا قراءة صفّي الملف العامين، وفق سياسة profiles الحالية.
- الحساب B لم يستطع تعديل بيانات الملف الخاص للحساب A أو منشور A؛ عدد الصفوف المعدّلة في كل محاولة كان صفراً.
- الحساب A لم يستطع حذف تعليق أو تفاعل الحساب B؛ عدد الصفوف المحذوفة في كل محاولة كان صفراً.
- اختُبر Storage على مستوى صفوف storage.objects: المالك استطاع رؤية صف كائن تجريبي، والحساب الآخر لم يستطع رؤيته أو تحديثه. أُلغيت المعاملة.
- محاولة الحذف المباشر من storage.objects رفضها مشغّل Supabase الوقائي (الحذف يجب أن يتم عبر Storage API). لم يُجرَ حذف مباشر.
- تحقق لاحق بعد ROLLBACK أكد بقاء 3 مستخدمي Auth مؤكدين، وصفر صفوف اختبار دائمة في profile_private_details وuser_preferences وposts وpost_comments وpost_reactions وprofile-avatars.
- هذه محاكاة claims وصلاحيات قاعدة البيانات وليست اختبار جلستي دخول JWT عبر Auth API، وليست رفع ملف ثنائي فعلي عبر Storage API أو من واجهة MYGRAM.
- فحص column privileges أكد أن anon وauthenticated لا يستطيعان تحديث verified_contact_method أو contact_verified_at.
- اختبار REST آلي بحسابين مستقلين موجود في tests/authz.integration.mjs، لكنه لم يُشغّل بعد لأنه يتطلب أسرار حسابَي QA داخل GitHub Actions.

## اختبار محادثات A/B/C

- طلب التحقق: ينشئ A محادثة مباشرة مع B، ثم يحاول C تعداد المحادثات وقراءة المحادثة والرسائل والمرفقات والاشتراك في Realtime أو الانضمام إلى المحادثة.
- نتيجة فحص Staging: لا توجد حالياً جداول محادثات/رسائل/أعضاء أو سياسات RLS تخص Messenger؛ لذلك لم يُنفذ اختبار محادثة وهمي ولم تُسجل نتيجة PASS.
- بوابة التنفيذ: ترحيل مخطط Messenger إلى Staging، تعريف membership-based RLS على كل من conversation وmessages وattachments، حماية Realtime/Storage، ثم تشغيل اختبار ثلاث هويات JWT حقيقية A وB وC.
- معايير النجاح: A وB يستطيعان الوصول إلى محادثتهما؛ C لا يرى سجل المحادثة أو الرسائل أو المرفقات ولا يستطيع تعديل العضوية أو الاشتراك في قناة Realtime الخاصة بها.

## ما لم يكتمل

- تشغيل اختبار Auth API بجلسَتي JWT فعليتين باستخدام حسابَي QA مؤكدَي البريد.
- اختبار signup وتأكيد البريد وتسليم SMTP إلى صندوق وارد حقيقي.
- رحلة UI الفعلية لتسجيل الدخول واستكمال الملف عبر حسابَي QA.
- رفع صورة الملف الشخصي فعلياً عبر Storage API من واجهة MYGRAM وربطها بالملف.
- اختبار Storage upload/read/upsert/delete عبر JWT حقيقيين.
- تنفيذ مخطط Messenger وسياسات المحادثات في Staging ثم اختبار A/B/C عبر ثلاث هويات حقيقية.
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
4. تنفيذ مخطط Messenger وRLS واختبار عزل المحادثات بثلاثة حسابات.
5. اختبار SMTP/رسائل التأكيد والاستعادة عبر صندوق بريد حقيقي.
6. مراجعة إتاحة أعمدة profiles لأن SELECT الحالي يسمح للمستخدمين المصادقين بقراءة صفوف profiles؛ show_living_location ليس حماية على مستوى العمود.
7. انتقال supported_locales من is_active إلى enabled بآلية متزامنة قبل استعمال العمود الجديد.
8. استكمال بقية مخطط Staging تدريجياً.
9. إعداد SMS/LiveKit/AI لاحقاً بأسرار منفصلة.
10. تغطية اللغات والمنتجات والاختبارات المتكاملة.

# تقرير اختلاف مخططات Production وStaging

**تاريخ خط الأساس:** 2026-10-30  
**آخر تحديث:** بعد Migration Staging رقم `20261030022611`  
**النطاق:** مقارنة بنية وسلوك المخططين، مع فصل تغييرات Staging اللاحقة عن Production.

## 1. ملخص البيئتين

| المؤشر | Production: MYGRAM-DB | Staging: MYGRAM-STAGING |
|---|---:|---:|
| جداول public عند خط الأساس | 51 | 6 |
| Migration history بعد المرحلة الأولى | 45 | 5 |
| Edge Functions | 5 | 0 |
| اللغات | 60 | 14 |
| الدول | 205 | لا يوجد جدول |
| صفوف الترجمة | 2,820 | لا يوجد جدول |
| حسابات Auth المرصودة | 3 | 3 |

البيئتان على PostgreSQL 17.11، لكنهما **لا تزالان غير متطابقتين بنيوياً أو وظيفياً**. Migration المرحلة الأولى قاربت الجداول الأساسية المشتركة فقط؛ ولا تجعل Staging نسخة كاملة من Production.

## 2. جداول Production غير الموجودة في Staging

- الهوية والخصوصية: `users`, `profile_private_details`, `user_presence`
- الصداقة والمجتمعات: `friend_requests`, `communities`, `community_members`, `community_posts`, `notifications`, `live_sessions`
- المراسلة: `call_signals`, `chat_members`, `chat_messages`, `chats`, `direct_call_signals`, `direct_messages`, `messages`, `messaging_bookmarks`, `messaging_message_reactions`, `messaging_moderators`, `messaging_pins`, `messaging_poll_options`, `messaging_poll_votes`, `messaging_polls`, `messaging_space_meta`, `messaging_topics`
- WHATSMYGRAM: `whatsmygram_call_signals`, `whatsmygram_chat_members`, `whatsmygram_chats`, `whatsmygram_messages`
- الاجتماعات: `meeting_chair_transfers`, `meeting_messages`, `meeting_minutes`, `meeting_participants`, `meeting_transcripts`, `meetings`
- المحتوى: `reel_comments`, `reel_reactions`, `reels`, `stories`
- الدول والترجمة: `supported_countries`, `translation_cache`, `translation_catalog`, `translation_usage`
- إدارة المنصة: `platform_feature_registry`, `platform_spaces`

لا تُنشأ هذه الجداول دفعة واحدة أو قبل مراجعة migrations الأصلية واعتماد الاعتماديات والمفاتيح والسياسات الخاصة بكل مجموعة وظيفية.

## 3. المرحلة الأولى المطبقة على Staging فقط

**Migration:** `20261030022611_align_staging_core_schema_phase_1`  
**Version:** `20261030022611`  
**Git path:** `supabase/migrations/20261030022611_align_staging_core_schema_phase_1.sql`

تم تسجيلها بنجاح في Migration history الخاص بـStaging. أضافت فقط أعمدة وقيوداً وفهارس لا تتلف البيانات القائمة:

- `profiles`: حقول الاسم الأول/العائلة، إكمال الملف، الدراسة والعمل، الجنسية وبلد/مدينة الإقامة وإظهار الموقع.
- `profiles.username`: أضيف قيد UNIQUE عادي عند غيابه، مع الاحتفاظ بقيد الصيغة الموجود وفهرس التفرد على `lower(username)` الموجود في Staging.
- `user_preferences`: حقول الكشف التلقائي، المنطقة الزمنية، ومصدر اكتشاف اللغة/الدولة وموافقة الموقع، مع قيود تحقق مماثلة لـProduction.
- `supported_locales`: إضافة `enabled` و`updated_at` وملء `enabled` من `is_active`. لم تحذف أعمدة Staging الخاصة `english_name`, `is_active`, `sort_order`.
- `posts`: إضافة حد نصي أقصى 5000 حرف، مع الاحتفاظ بقيود Staging الإضافية على المحتوى والوسائط.
- `post_comments`: إضافة `parent_comment_id` ومفتاحه الأجنبي إلى التعليق الأب، ورفع حد النص من 1000 إلى 2000 حرف، مع الاحتفاظ بـ`updated_at`.
- إضافة فهارس `post_comments(parent_comment_id)`, `post_comments(user_id)`, `post_reactions(user_id)` لتغطية عمليات المفاتيح الأجنبية.

### التحقق بعد Migration

- تأكد وجود الأعمدة والقيود الجديدة في Staging.
- بقيت صفوف الملفات الشخصية 3، والصفوف في المنشورات والتعليقات والتفاعلات والتفضيلات صفراً، واللغات 14.
- بقيت أعمدة وقيود Staging الإضافية موجودة.
- بقي RLS مفعلاً على الجداول الستة الأساسية.
- لم تتغير تعريفات سياسات RLS أو إعدادات Auth أو Storage أو Edge Functions.
- اختفى تنبيه فحص الأداء الخاص بالمفاتيح الأجنبية غير المفهرسة؛ بقيت ملاحظات Unused Index، ولا تعني ضرورة حذف الفهارس في بيئة قليلة البيانات.
- ظهر تحذير Leaked Password Protection المعطل، وهو قيد معروف في خطة Free ومتروك كما اتُّفق عليه.

### اختلاف انتقالي يجب عدم تجاهله

سياسة القراءة العامة لـ`supported_locales` في Staging ما زالت تعتمد `is_active = true`، بينما أضيف `enabled` كعمود توافق وتمت تعبئته من `is_active` مرة واحدة. لا تعتمد الواجهة أو أي كتابة مستقبلية على `enabled` باعتباره المصدر النهائي قبل تنفيذ dual-write/trigger أو انتقال مستقل يختبر السياسة. حالياً، استمر باستخدام `is_active` في Staging حتى ذلك الانتقال.

## 4. الفروقات المتبقية في الجداول المشتركة

### profiles
- الحقول الإضافية الأساسية في Production أضيفت إلى Staging.
- Staging يحتفظ بقيد صيغة username `^[a-zA-Z0-9_]{3,30}$`، غير الموجود في تعريف Production الذي تمت مراجعته.
- Staging لديه فهرس فريد على `lower(username)` إضافة إلى UNIQUE عادي، ما يوفر تفرداً غير حساس لحالة الأحرف في Staging. Production لا يثبت هذا الضمان، وفحصه السابق وجد تعارضات lower-case وصفّين باسم فارغ/NULL.
- لا تعتبر نجاح تحقق username في Staging دليلاً على حل تعارضات Production. لا تُعدّل بيانات Production أو قيوده ضمن هذا العمل.

### posts
- حد المحتوى الأعلى 5000 حرف متوافق.
- Staging لا يزال لديه `content` مع default نص فارغ و`updated_at`.
- Staging يحتفظ بقيود إضافية تسمح بوسائط audio/file وتفرض محتوى نصياً أو وسيطاً. يجب اعتماد عقد وسائط المنتج قبل إزالة أي اختلاف.

### post_comments
- أضيف دعم التعليقات المتداخلة وحد 2000 حرف.
- Staging لا يزال لديه عمود `updated_at` غير موجود في تعريف Production الذي تمت مراجعته.

### supported_locales
- أضيف `enabled` و`updated_at` إلى Staging مع الحفاظ على الحقول القديمة.
- سياسة القراءة لا تزال تفحص `is_active`؛ انظر تحذير الانتقال في القسم 3.
- Staging يحتوي 14 لغة مقابل 60 في Production.

### user_preferences
- أضيفت الحقول والقيود التي كانت ناقصة.
- Staging لا يزال يحتوي حقول تشغيل إضافية مثل `share_location`, `auto_detect_language`, `auto_detect_region`, `timezone_name`, `location_consent_at`; يلزم مراجعة الاستخدام قبل اعتبار العقد متطابقاً تماماً.

## 5. سياسات RLS

على الجداول المشتركة الستة، ظلت تعريفات السياسات كما كانت قبل Migration. RLS ما زال مفعلاً. سياسات القراءة في posts/comments/reactions تسمح للمستخدم المصادق بقراءة السجلات؛ وعمليات الكتابة والتحديث والحذف مقيدة بملكية `user_id`. user_preferences مقيدة بملكية `user_id`. profiles تسمح بقراءة الحسابات المصادقة، وتقيّد الإدراج والتحديث بملكية `id`. supported_locales ما زالت قراءة عامة للسجلات النشطة عبر `is_active`.

هذه مراجعة تعريفات وليست إثباتاً عملياً للعزل. المرحلة التالية هي اختبار السماح والمنع باستخدام حسابي Staging مستقلين، من دون تبديل سياسات RLS قبل ظهور نتائج الاختبار.

## 6. Edge Functions والبيانات

- Production يحتوي خمس Edge Functions: `livekit-token`, `turn-credentials`, `translate-text`, `meetings-token`, `meeting-ai-minutes`.
- Staging لا يحتوي Edge Functions حتى الآن.
- لم يتم نسخ بيانات Production إلى Staging.
- لا تزال أعداد Staging 3 Auth/Profiles و14 لغة، وصفر منشورات وتعليقات وتفاعلات وتفضيلات وقت التحقق بعد Migration.
- لا تُنسخ أسرار Production تلقائياً. أنشئ secrets منفصلة بعد مراجعة كل Function عند الوصول إلى مرحلتها.

## 7. القرارات والقيود

1. لا Migration ولا DDL ولا DML على Production.
2. لا حذف جداول أو أعمدة Staging الزائدة قبل جرد استخداماتها.
3. لا نسخ بيانات مستخدمين حقيقيين إلى Staging.
4. لا تغيير RLS/Auth/Storage/Edge Functions ضمن Migration المرحلة الأولى.
5. لا يعتبر نجاح Migration أو CI دليلاً على جاهزية المنتج.
6. يجب أن توثق كل مرحلة migration ونتائج فحوص الأعمدة والقيود والفهارس والسياسات والبيانات.

## 8. ما لم يُنفذ

- لم تُنشأ بقية جداول Production المفقودة في Staging.
- لم تُنقل اللغات الستون أو الدول الـ205 أو سجلات الترجمة.
- لم تُنشر Edge Functions إلى Staging.
- لم تتغير سياسات RLS أو إعدادات Auth وStorage.
- لم يحدث أي تعديل على Production.

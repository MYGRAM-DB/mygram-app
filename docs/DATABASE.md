# مخطط قاعدة البيانات وحالة البيئات

## 1. البيئات

| البيئة | المشروع | الحالة | Postgres | نطاق المخطط العام |
|---|---|---|---|---|
| Production | MYGRAM-DB | ACTIVE_HEALTHY | 17.11 | 51 جدولاً عاماً |
| Staging | MYGRAM-STAGING | ACTIVE_HEALTHY | 17.11 | 6 جداول عامة في خط الأساس؛ تمت مواءمة أعمدتها الأساسية في المرحلة الأولى |

البيئتان منفصلتان. لا تُعتبر Staging نسخة مكتملة من Production، ولا يجوز افتراض أن Migration مطبقة في إحداهما مطبقة في الأخرى.

## 2. Production: الجداول الحالية

كل الجداول العامة الـ51 التي رُصدت عليها RLS مفعّلة. هذا لا يثبت وحده صحة السياسات؛ يجب اختبار السماح والمنع لكل عملية ولكل دور.

### الهوية والملف الشخصي والتفضيلات
- `profiles`
- `users` (توافق قديم يحتاج مراجعة)
- `profile_private_details`
- `user_preferences`
- `user_presence`

### التواصل الاجتماعي
- `posts`
- `post_comments`
- `post_reactions`
- `friend_requests`
- `stories`
- `reels`
- `reel_comments`
- `reel_reactions`
- `communities`
- `community_members`
- `community_posts`
- `live_sessions`
- `notifications`

### المراسلة والاتصال
- `direct_messages`
- `direct_call_signals`
- `chats`
- `chat_members`
- `chat_messages`
- `call_signals`
- `whatsmygram_chats`
- `whatsmygram_chat_members`
- `whatsmygram_messages`
- `whatsmygram_call_signals`
- `messaging_space_meta`
- `messaging_moderators`
- `messaging_topics`
- `messaging_pins`
- `messaging_polls`
- `messaging_poll_options`
- `messaging_poll_votes`
- `messaging_message_reactions`
- `messaging_bookmarks`
- `messages` (قديم)

### الاجتماعات
- `meetings`
- `meeting_participants`
- `meeting_messages`
- `meeting_transcripts`
- `meeting_minutes`
- `meeting_chair_transfers`

### الدول واللغات
- `supported_locales`
- `supported_countries`
- `translation_catalog`
- `translation_cache`
- `translation_usage`

### مساحة المنصة
- `platform_feature_registry`
- `platform_spaces`

## 3. بيانات ومؤشرات مقاسة

فحوص القراءة فقط في Production أظهرت:
- 3 حسابات في `auth.users` و3 صفوف في `profiles`.
- 3 منشورات، ولا توجد رسائل في `direct_messages` أو `chat_messages` أو `whatsmygram_messages` وقت الفحص.
- 60 صفاً في `supported_locales`.
- 205 صفوف في `supported_countries`.
- 2,820 سجل ترجمة في `translation_catalog`، أي 47 مفتاحاً أساسياً لكل لغة من اللغات الستين.
- لا توجد جداول بأسماء تتعلق بالمحفظة أو دفتر القيود أو العملات أو المعاملات المالية.
- 45 Migration في Production.
- خمس Edge Functions نشطة في Production: `livekit-token`, `turn-credentials`, `translate-text`, `meetings-token`, `meeting-ai-minutes`.

هذه أعداد لحظة الفحص وليست أرقاماً ثابتة؛ تُحدّث بعد كل مرحلة.

## 4. Staging: الوضع الحالي بعد المرحلة الأولى

الجداول الستة الموجودة:
- `profiles`
- `user_preferences`
- `posts`
- `post_comments`
- `post_reactions`
- `supported_locales`

Migration history أصبح 5 إصدارات، وآخرها:
`20261030022611_align_staging_core_schema_phase_1`.

بعد Migration:
- أضيفت حقول استكمال الملف الشخصي والموقع إلى `profiles`.
- أضيفت حقول الكشف التلقائي ومصادر تحديد اللغة/الدولة وموافقة الموقع إلى `user_preferences`.
- أضيف `parent_comment_id` إلى `post_comments`، وحد النص 2000 حرف.
- أضيف حد 5000 حرف إلى `posts`.
- أضيف `enabled` و`updated_at` إلى `supported_locales`، مع بقاء `english_name`, `is_active`, `sort_order`.
- أضيفت فهارس تغطية للمفاتيح الأجنبية في التعليقات والتفاعلات.

حالة البيانات بعد التحقق: 3 Auth/Profiles، و14 لغة، وصفر منشورات وتعليقات وتفاعلات وتفضيلات. لا توجد بيانات إنتاج منسوخة. لا تزال Staging بلا جدول دول وبلا Edge Functions.

**ملاحظة مهمة للغات:** سياسة القراءة العامة الحالية في Staging ما زالت تعتمد `is_active = true`. تم ملء `enabled` من `is_active` مرة واحدة، لكنه ليس حقل التفعيل النهائي بعد. لا تعتمد التطبيق على `enabled` قبل انتقال مستقل يحقق المزامنة ويختبر السياسة.

## 5. ازدواجية الهوية القديمة

- `auth.users` هو مصدر هوية المصادقة.
- `profiles` مرتبط بـ`auth.users.id` بمفتاح أجنبي، وهو ملف MYGRAM العام المستهدف.
- `users` جدول قديم مرتبط أيضاً بـ`auth.users` وله حقول وقيود منفصلة.
- لا يُحذف `users` ولا تُدمج صفوفه الآن. يجب جرد مراجع الكود والسياسات والبيانات، ثم تقديم Migration انتقالية قابلة للاستعادة.

## 6. نزاهة أسماء المستخدمين

Staging لديه:
- CHECK على صيغة username `^[a-zA-Z0-9_]{3,30}$`.
- قيد UNIQUE عادي وفهرس فريد على `lower(username)` مع تجاهل NULL.
- لا توجد أسماء مستخدمين مكررة في فحص خط الأساس.

Production لديه قيد UNIQUE عادي فقط في تعريف الجدول الذي تمت مراجعته، وكشف الفحص السابق تعارضاً واحداً على الأقل بعد lower-case وصفّين باسم username فارغ أو NULL. لذلك لا يجوز إعلان تطابق سياسة username بين البيئتين، ولا تعديل سجلات Production آلياً.

## 7. الترجمة والدول

- Production: 60 لغة و205 دول.
- `translation_catalog`: 47 مفاتيح لكل لغة، وحالة الصفوف كانت `approved` وقت الفحص.
- هذا لا يثبت تغطية جميع صفحات المنتجات أو صحة المصطلحات أو مراجعة بشرية شاملة.
- Staging يحتوي 14 لغة فقط ولا يحتوي جدول الدول أو كتالوج الترجمة.
- يجب إدخال catalog في Staging من مصدر موثوق ومراجع بعد إنشاء مخطط مستقل، لا بنسخ عشوائي لصفوف Production.

## 8. التخزين

- `mygram-media`: حاوية عامة للوسائط المقصودة للنشر العام.
- `mygram-private-messages`: حاوية خاصة للمراسلات والوسائط المقيدة بالمشاركين.
- سقف الحجم المرصود لكل حاوية: 50 MiB.
- توجد سياسات Storage مخصصة لأصحاب الملفات ومشاركي المحادثات. يجب اختبارها بملفات مستخدمين مختلفين قبل التوسع.

## 9. قواعد التغيير

1. اقرأ المخطط والقيود والسياسات وسجل Migration قبل كل تعديل.
2. لا تنشئ جدولاً جديداً قبل البحث عن جدول قائم يؤدي الغرض نفسه.
3. جميع تغييرات القاعدة تكون Migration موثقة وقابلة للتطبيق على Staging أولاً.
4. لا تُنفذ DROP أو TRUNCATE أو إعادة كتابة سجلات مستخدمين في Production ضمن مرحلة التأسيس.
5. لا تعتبر اكتمال Migration دليلاً على اكتمال الوظيفة.

## 10. انحراف Staging

التفاصيل الحية والفروقات الدقيقة موثقة في [SCHEMA_DRIFT.md](SCHEMA_DRIFT.md). المرحلة الأولى من المواءمة لا تغطي المنتجات الاجتماعية والمراسلة والدول والترجمة والاجتماعات أو Edge Functions.

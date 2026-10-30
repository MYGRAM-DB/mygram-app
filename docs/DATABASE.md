# مخطط قاعدة البيانات وحالة البيئات

## 1. البيئات

| البيئة | المشروع | الحالة | Postgres | نطاق المخطط العام |
|---|---|---|---|---|
| Production | MYGRAM-DB | ACTIVE_HEALTHY | 17.11 | 51 جدولاً عاماً |
| Staging | MYGRAM-STAGING | ACTIVE_HEALTHY | 17.11 | 6 جداول عامة |

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
- هناك 45 Migration مسجلة في Production، و4 في Staging.
- خمس Edge Functions نشطة في Production: `livekit-token`, `turn-credentials`, `translate-text`, `meetings-token`, `meeting-ai-minutes`. لا توجد Edge Functions في Staging.

هذه أعداد لحظة الفحص وليست أرقاماً ثابتة؛ تُحدّث بعد كل مرحلة.

## 4. Staging: الوضع الحالي

الجداول الستة الموجودة:
- `profiles`
- `user_preferences`
- `posts`
- `post_comments`
- `post_reactions`
- `supported_locales`

وفيها 3 حسابات Auth و3 ملفات شخصية، ولا توجد منشورات وقت الفحص. تحتوي `supported_locales` على 14 لغة فقط. لا توجد جداول الدول ولا Edge Functions حالياً.

## 5. ازدواجية الهوية القديمة

- `auth.users` هو مصدر هوية المصادقة.
- `profiles` مرتبط بـ`auth.users.id` بمفتاح أجنبي، وهو ملف MYGRAM العام المستهدف.
- `users` جدول قديم مرتبط أيضاً بـ`auth.users` وله حقول وقيود منفصلة.
- لا يُحذف `users` ولا تُدمج صفوفه الآن. يجب جرد مراجع الكود والسياسات والبيانات، ثم تقديم Migration انتقالية قابلة للاستعادة.

## 6. نزاهة أسماء المستخدمين

فحص Production كشف:
- مجموعة واحدة على الأقل فيها أسماء مستخدمين مكررة بعد توحيد حالة الأحرف.
- صفّين باسم مستخدم فارغ أو NULL.
- القيد الموجود على `profiles.username` هو UNIQUE عادي، وليس قيداً يثبت التفرد بعد `lower(username)`.

لا تُعدّل هذه السجلات آلياً. يلزم تحديد سياسة حجز الأسماء، ومعالجة التعارضات، وإشعار أصحاب الحسابات عند الحاجة قبل إنشاء قيد جديد.

## 7. الترجمة والدول

- Production: 60 لغة و205 دول.
- `translation_catalog`: 47 مفاتيح لكل لغة، وحالة الصفوف كانت `approved` وقت الفحص.
- هذا لا يثبت تغطية جميع صفحات المنتجات أو صحة المصطلحات أو مراجعة بشرية شاملة.
- Staging لا يحتوي حالياً إلا 14 لغة ولا يحتوي جدول الدول.

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

التفاصيل الحية والفروقات الدقيقة موثقة في [SCHEMA_DRIFT.md](SCHEMA_DRIFT.md). لا تستخدم Staging لاختبار وظائف تعتمد على جداول أو أعمدة غير موجودة فيها.

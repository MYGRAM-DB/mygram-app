# مخطط قاعدة البيانات وحالة البيئات

## 1. البيئات

| البيئة | المشروع | الحالة | Postgres | الجداول العامة |
|---|---|---|---|---:|
| Production | MYGRAM-DB | ACTIVE_HEALTHY | 17.11 | 51 |
| Staging | MYGRAM-STAGING | ACTIVE_HEALTHY | 17.11 | 8 |

البيئتان منفصلتان. Staging بيئة تحقق جزئية وليست نسخة مطابقة من Production.

## 2. Production: مجموعات الجداول

- الهوية: profiles, users (توافق قديم), profile_private_details, user_preferences, user_presence.
- التواصل الاجتماعي: posts, post_comments, post_reactions, friend_requests, stories, reels, reel_comments, reel_reactions, communities, community_members, community_posts, live_sessions, notifications.
- المراسلة: direct_messages, direct_call_signals, chats, chat_members, chat_messages, call_signals, whatsmygram_chats, whatsmygram_chat_members, whatsmygram_messages, whatsmygram_call_signals, messaging_space_meta, messaging_moderators, messaging_topics, messaging_pins, messaging_polls, messaging_poll_options, messaging_poll_votes, messaging_message_reactions, messaging_bookmarks, messages (قديم).
- الاجتماعات: meetings, meeting_participants, meeting_messages, meeting_transcripts, meeting_minutes, meeting_chair_transfers.
- الدول واللغات: supported_locales, supported_countries, translation_catalog, translation_cache, translation_usage.
- إدارة المنصة: platform_feature_registry, platform_spaces.

## 3. مؤشرات Production المقاسة

- 3 حسابات في auth.users و3 صفوف في profiles.
- 3 منشورات وقت الفحص السابق.
- 60 صفاً في supported_locales.
- 205 صفوف في supported_countries.
- 2,820 سجل ترجمة في translation_catalog، أي 47 مفتاحاً أساسياً لكل لغة.
- لا توجد جداول محفظة أو دفتر قيود أو معاملات مالية.
- 45 Migration وخمس Edge Functions: livekit-token, turn-credentials, translate-text, meetings-token, meeting-ai-minutes.

الأعداد لقطة وقت الفحص وليست أرقاماً ثابتة.

## 4. Staging: بعد مواءمة المرحلتين

الجداول العامة الثمانية:
- profiles
- user_preferences
- posts
- post_comments
- post_reactions
- supported_locales
- profile_private_details
- supported_countries

Migration history أصبح 6، وآخر إصدارين:
- 20261030022611_align_staging_core_schema_phase_1
- 20261030023659_create_private_profile_details_and_stage_countries

المرحلة الأولى أضافت حقول onboarding والتفضيلات وعلاقة التعليق الأب وحدود النص وفهارس FK. المرحلة الثانية أنشأت جدول التفاصيل الخاصة وجدول الدول.

بيانات Staging بعد التحقق:
- 3 Auth/Profiles.
- 205 دولة مفعّلة بأسماء عربية/إنجليزية ورموز اتصال.
- 14 لغة فقط، ولا يوجد Translation Catalog.
- صفر صفوف في profile_private_details وuser_preferences وposts وpost_comments وpost_reactions.
- لا توجد بيانات مستخدمين حقيقية منسوخة من Production.
- لا توجد Edge Functions بعد.

### التفاصيل الخاصة

profile_private_details يحتوي تاريخ الميلاد والجنس والجنسية ووسائل الاتصال. RLS بسياسات مالك السجل. authenticated يستطيع قراءة/حذف سجله وإدراج/تعديل الحقول المسموح بها فقط؛ حقلا verified_contact_method وcontact_verified_at غير قابلين للكتابة من المتصفح. يتم تحديث updated_at بواسطة trigger موثوق. بيانات الجدول صفرية بعد الإنشاء.

### الدول

supported_countries يوفر قراءة عامة للسجلات المفعلة فقط. لا يملك anon صلاحية الكتابة. العدد 205.

### انتقال اسم اللغة

supported_locales.enabled تمت تعبئته من is_active مرة واحدة. Policy القراءة الحالية في Staging ما زالت تقرأ is_active؛ لا تعتمد الواجهة على enabled قبل dual-write/trigger وانتقال policy مختبر.

## 5. ازدواجية الهوية القديمة

- auth.users هو مصدر هوية المصادقة.
- profiles مرتبط بـauth.users.id وهو ملف MYGRAM العام.
- users جدول قديم مرتبط أيضاً بـauth.users وله حقول وقيود منفصلة في Production.
- لا يُحذف users ولا تُدمج صفوفه الآن. يلزم جرد مراجع الكود والسياسات والبيانات قبل Migration انتقالية.

## 6. نزاهة أسماء المستخدمين

Staging لديه CHECK لصيغة username ^[a-zA-Z0-9_]{3,30}$ وفهرس unique على lower(username). Production لديه UNIQUE عادي فقط في تعريف الجدول الذي تمت مراجعته، وكشف الفحص السابق تعارضاً بعد lower-case وصفّين باسم username فارغ أو NULL. لا تُعدّل بيانات Production آلياً ولا تعتبر تحقق Staging ضماناً لتطابق Production.

## 7. الترجمة

- Production: 60 لغة و2,820 ترجمة.
- Staging: 14 لغة ولا يوجد catalog.
- 47 مفتاحاً لكل لغة لا يثبت وحده تغطية واجهات المنتجات أو مراجعة بشرية شاملة.
- لا ينسخ catalog عشوائياً؛ يلزم اعتماد نموذج المفاتيح ومراجعة المصدر والتغطية.

## 8. التخزين

- mygram-media: حاوية عامة للوسائط المقصودة للنشر العام.
- mygram-private-messages: حاوية خاصة للمراسلات والوسائط المقيدة بالمشاركين.
- سقف الحجم المرصود لكل حاوية: 50 MiB.
- اختبارات Storage بحسابين ما زالت مطلوبة.

## 9. قواعد التغيير

1. اقرأ المخطط والقيود والسياسات وسجل Migration قبل كل تعديل.
2. لا تنشئ جدولاً جديداً قبل البحث عن جدول قائم يؤدي الغرض نفسه.
3. كل DDL يكون Migration موثقة على Staging أولاً.
4. لا DROP أو TRUNCATE أو إعادة كتابة بيانات Production ضمن مرحلة التأسيس.
5. نجاح Migration أو CI لا يعني اكتمال الوظيفة.

## 10. انحراف Staging

التفاصيل الدقيقة موثقة في SCHEMA_DRIFT.md. المرحلة الحالية لا تشمل بقية جداول التواصل والمراسلة والفيديو والاجتماعات، ولا الترجمة أو Edge Functions.

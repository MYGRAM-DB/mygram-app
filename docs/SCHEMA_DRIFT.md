# تقرير اختلاف مخططات Production وStaging

**تاريخ الفحص:** 2026-10-30  
**نوع الفحص:** قراءة فقط. لم تُنفذ أي كتابة أو Migration أو تغيير سياسة.

## 1. ملخص الانحراف

| المؤشر | Production: MYGRAM-DB | Staging: MYGRAM-STAGING |
|---|---:|---:|
| جداول public | 51 | 6 |
| Migration history | 45 | 4 |
| Edge Functions | 5 | 0 |
| اللغات | 60 | 14 |
| الدول | 205 | لا يوجد جدول |
| صفوف الترجمة | 2,820 | لا يوجد جدول |
| الحسابات في Auth وقت الفحص | 3 | 3 |

البيئتان على PostgreSQL 17.11، لكنهما **غير متطابقتين بنيوياً أو وظيفياً**. لا يجوز توجيه الواجهة الجديدة إلى Staging واعتبارها ممثلة للإنتاج قبل معالجة هذا الانحراف.

## 2. جداول Production غير الموجودة في Staging

- الهوية والخصوصية: `users`, `profile_private_details`, `user_presence`
- الصداقة والمجتمعات: `friend_requests`, `communities`, `community_members`, `community_posts`, `notifications`, `live_sessions`
- المراسلة: `call_signals`, `chat_members`, `chat_messages`, `chats`, `direct_call_signals`, `direct_messages`, `messages`, `messaging_bookmarks`, `messaging_message_reactions`, `messaging_moderators`, `messaging_pins`, `messaging_poll_options`, `messaging_poll_votes`, `messaging_polls`, `messaging_space_meta`, `messaging_topics`
- WHATSMYGRAM: `whatsmygram_call_signals`, `whatsmygram_chat_members`, `whatsmygram_chats`, `whatsmygram_messages`
- الاجتماعات: `meeting_chair_transfers`, `meeting_messages`, `meeting_minutes`, `meeting_participants`, `meeting_transcripts`, `meetings`
- المحتوى: `reel_comments`, `reel_reactions`, `reels`, `stories`
- الدول والترجمة: `supported_countries`, `translation_cache`, `translation_catalog`, `translation_usage`
- إدارة المنصة: `platform_feature_registry`, `platform_spaces`

## 3. اختلافات في الجداول المشتركة

### profiles
- Production يتضمن حقول onboarding/الموقع الإضافية: `first_name`, `last_name`, `profile_completed`, `study_place`, `work_place`, `public_nationality_code`, `public_living_country_code`, `public_living_region`, `public_living_city`, `show_living_location`.
- Production لديه UNIQUE على `username`، لكنه لا يثبت وحده التفرد بعد توحيد حالة الأحرف.
- Staging لديه CHECK على صيغة username `^[a-zA-Z0-9_]{3,30}$`، بينما لا يظهر هذا القيد ضمن تعريف Production الذي تمت مراجعته.
- لا يجوز تشغيل onboarding أو username availability على Staging باعتبارها مطابقة لـProduction.

### posts
- Production: `content` إلزامي، مع CHECK لطول لا يتجاوز 5000.
- Staging: `content` له default نص فارغ، و`updated_at` موجود.
- الوسائط: Production يستخدم `media_url` و`media_type` مع قيد image/video؛ Staging يسمح image/video/audio/file.
- يلزم توحيد contract المنتج قبل توصيل واجهة نشر مشتركة.

### post_comments
- Production يسمح `parent_comment_id` للتعليقات المتداخلة، ويضع حدّاً يصل إلى 2000 حرف.
- Staging لا يحتوي `parent_comment_id` ويضع حداً يصل إلى 1000 حرف، ولديه `updated_at`.
- لذلك لا يجوز تفعيل الردود المتداخلة في Staging قبل migration واختبارها.

### supported_locales
- Production policy تقرأ `enabled`، بينما مخطط Staging يعرض `is_active`.
- Production policy اسمها `supported_locales_read_enabled`، وStaging policy اسمها `Public can read active supported locales`.
- يجب مراجعة تعريف الجدول والسياسة الفعلية قبل توحيدها. لا تفترض الواجهة اسم عمود واحداً عبر البيئتين.

## 4. سياسات RLS التي تمت مراجعتها

على الجداول المشتركة الستة، كلا البيئتين لديهما سياسات مستخدم موثقة للقراءة والكتابة، مع اختلافات في أسماء السياسات. سياسات profiles وposts وcomments وreactions تسمح بالقراءة للمستخدم المصادق، وتقيّد الكتابة/التحديث/الحذف بملكية الصف. user_preferences مقيدة بملكية user_id. supported_locales متاحة للقراءة العامة للسجلات المفعلة.

هذه مراجعة نص السياسات فقط وليست إثباتاً لاختبارات منع الوصول بين مستخدمين. يلزم RLS integration tests بحسابين مستقلين، بما فيها محاولات UPDATE مع تبديل owner وقراءة سجلات مستخدم آخر.

## 5. Edge Functions

Production يحتوي:
- `livekit-token` (JWT verification مفعّل)
- `turn-credentials` (JWT verification مفعّل)
- `translate-text` (JWT verification مفعّل)
- `meetings-token` (JWT verification مفعّل)
- `meeting-ai-minutes` (JWT verification مفعّل)

Staging لا يحتوي Edge Functions. لا تُنسخ أسرار أو إعدادات مزودات من Production تلقائياً؛ أنشئ Secrets مستقلة لـStaging بعد مراجعة المصدر والاستخدام والصلاحيات.

## 6. قرار التنفيذ

1. إبقاء كل التغييرات الحالية على GitHub branch فقط.
2. عدم تنفيذ migration على Production.
3. بناء Migration plan من سجل Production وStaging، مع التمييز بين migrations المشتركة والاختلافات المقصودة.
4. تطبيق schema migrations على Staging تدريجياً، ثم التحقق من الأعمدة والقيود والفهارس والسياسات.
5. نشر Edge Functions إلى Staging بنسخ مراجعة وأسرار منفصلة.
6. تنفيذ RLS tests وAuth tests وStorage tests على Staging.
7. لا تُنسخ بيانات المستخدمين الحقيقية من Production إلى Staging.
8. بعد اكتمال الاختبارات، يُعاد فحص الانحراف ويجب أن تكون الفروق المتبقية موثقة ومقصودة.

## 7. ما لم يحدث

- لم تُنفذ أي DDL أو DML.
- لم تتغير RLS أو grants أو Auth providers.
- لم تُحذف أو تُعدل أي بيانات.
- لم تُنشر أي Edge Function.
- هذا التقرير snapshot بتاريخ الفحص، ويجب تحديثه قبل أول migration.

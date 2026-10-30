> **الحالة الحالية (2026-10-31):** آخر خط أساس اجتاز الاختبار هو HEAD `a837aee766da87a3a050fcdde6f01e90eba41dc1` عبر Run #104 [41139860543](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41139860543)، والوظيفتان الرئيسيتان نجحتا. هذا المستند أدناه هو خط أساس تاريخي لتفاصيل الفروقات، والمرجع التنفيذي الحالي للأمن والاختبارات هو [AUDIT-20261031.md](./AUDIT-20261031.md). بوابة A ما زالت مفتوحة. PR #54 مفتوح Draft، ولا دمج أو نشر أو تعديل Production. أي commit توثيقي لاحق يحتاج CI جديداً على HEAD الناتج.

> **تنبيه تحديث (2026-10-31):** هذا المستند يسجل خط أساس تاريخياً قديماً، ولا يمثل الأعداد أو الحالة الحالية. المرجع الأحدث هو [AUDIT-20261031.md](./AUDIT-20261031.md)، ويتضمن الجرد الحالي للأعمدة والقيود والفهارس وسياسات RLS والمشغلات وStorage وEdge Functions. لا تُنفذ أي Migration اعتماداً على هذا المستند القديم وحده.

# تقرير اختلاف مخططات Production وStaging

تاريخ خط الأساس: 2026-10-30
آخر تحديث: بعد Migration Staging رقم 20261030024521

## 1. ملخص البيئتين

| المؤشر | Production | Staging |
|---|---:|---:|
| الجداول العامة | 51 | 8 |
| Migration history | 45 | 7 |
| Edge Functions | 5 | 0 |
| اللغات | 60 | 14 |
| الدول | 205 | 205 |
| صفوف الترجمة | 2,820 | 0 |
| حسابات Auth المرصودة | 3 | 3 |

البيئتان على PostgreSQL 17.11. Staging ما زال بيئة تحقق جزئية وليس نسخة مطابقة من Production.

## 2. الجداول التي لا تزال غائبة في Staging

- الهوية والتواجد القديم: users, user_presence.
- الصداقة والمجتمعات: friend_requests, communities, community_members, community_posts, notifications, live_sessions.
- المراسلة: call_signals, chat_members, chat_messages, chats, direct_call_signals, direct_messages, messages, messaging_bookmarks, messaging_message_reactions, messaging_moderators, messaging_pins, messaging_poll_options, messaging_poll_votes, messaging_polls, messaging_space_meta, messaging_topics.
- WHATSMYGRAM: whatsmygram_call_signals, whatsmygram_chat_members, whatsmygram_chats, whatsmygram_messages.
- الاجتماعات: meeting_chair_transfers, meeting_messages, meeting_minutes, meeting_participants, meeting_transcripts, meetings.
- المحتوى: reel_comments, reel_reactions, reels, stories.
- الترجمة: translation_cache, translation_catalog, translation_usage.
- إدارة المنصة: platform_feature_registry, platform_spaces.

لا تنشأ هذه الجداول دفعة واحدة. يجب مراجعة schema والاعتماديات والمفاتيح والسياسات قبل كل مجموعة.

## 3. Migrations المطبقة على Staging فقط

### المرحلة الأولى
Migration: 20261030022611_align_staging_core_schema_phase_1
- إضافة حقول استكمال الملف والموقع والتفضيلات، ودعم التعليق الأب وحدود النص، وعمود توافق supported_locales.enabled وفهارس المفاتيح الأجنبية.
- الاحتفاظ بأعمدة وقيود Staging الإضافية، ومنها username regex وفهرس lower(username) الفريد.
- لم تتغير سياسات الجداول الأساسية الستة.

### المرحلة الثانية
Migration: 20261030023659_create_private_profile_details_and_stage_countries
- إنشاء profile_private_details مع تاريخ الميلاد والجنس والجنسية ووسائل الاتصال الخاصة.
- إنشاء supported_countries وإدخال 205 سجلات مرجعية عامة من جدول الدول الموجود في Production. هذه ليست بيانات مستخدمين.
- وضع RLS على الجدولين الجديدين وإضافة سياسات منفصلة.
- منح المستخدم المصادق قراءة/حذف سجله الخاص وإدراج/تعديل الحقول المسموح بها فقط. حقلا verified_contact_method وcontact_verified_at غير قابلين للكتابة من دور المتصفح.
- جدول الدول متاح للقراءة العامة للسجلات المفعّلة فقط، ولا يملك anon صلاحية الإدراج.
- إضافة trigger لتحديث updated_at في profile_private_details.

### التحقق بعد المرحلتين
- Migration history في Staging أصبح 6، وعدد الجداول العامة 8.
- جدول الدول يحتوي 205 سجلات مفعّلة؛ لا رموز ISO أو رموز اتصال غير صالحة ضمن الفحوص المنفذة.
- profile_private_details يحتوي صفراً من سجلات المستخدمين.
- بقيت 3 ملفات شخصية و3 حسابات Auth؛ لم تنسخ أي بيانات مستخدمين من Production.
- RLS مفعّل على الجدولين الجديدين.
- صلاحية anon لقراءة جدول الدول موجودة ولا يملك صلاحية إدراج؛ anon لا يملك SELECT على جدول التفاصيل الخاصة.
- لم يكتمل اختبار كتابة runtime لجدول التفاصيل الخاصة؛ لذلك لا تُعلن بوابة API/RLS الخاصة به مكتملة. تم التحقق من السياسات وصلاحيات الأعمدة وصفرية البيانات.

## 4. اختلافات الجداول المشتركة

### profiles
- تمت إضافة حقول onboarding والموقع إلى Staging.
- Staging لديه CHECK لصيغة username ^[a-zA-Z0-9_]{3,30}$ وفهرس فريد على lower(username). Production لا يثبت ضماناً مكافئاً، وكشف الفحص السابق تعارضات بعد lower-case وصفّين username فارغ/NULL.
- سياسة قراءة profiles الحالية تسمح للمستخدمين المصادقين بقراءة صفوف الملفات الشخصية. RLS تتحكم بالصف لا بالعمود؛ لذلك show_living_location ليس حماية على مستوى العمود. يجب بناء عرض عام يحجب الموقع أو مراجعة grants/policy قبل إظهار هذه الحقول في المنتج. لا تعتمد الواجهة وحدها كحماية.
- تاريخ الميلاد وبيانات الاتصال معزولة في profile_private_details بسياسة قراءة خاصة بالمالك.

### posts
- حد النص الأعلى 5000 حرف.
- Staging يحتفظ بـcontent مع default نص فارغ وupdated_at.
- Staging يحتفظ بقيوده الإضافية على المحتوى والوسائط، ويسمح image/video/audio/file. مطابقة media contract تحتاج قراراً مستقلاً.

### post_comments
- أضيف parent_comment_id وحد 2000 حرف.
- Staging يحتفظ بـupdated_at الإضافي.

### supported_locales
- Staging لديه 14 لغة مقابل 60 في Production.
- أضيف enabled وتمت تعبئته من is_active مرة واحدة.
- سياسة القراءة العامة في Staging ما زالت تعتمد is_active = true. لا تعتمد التطبيق على enabled كمصدر نهائي قبل انتقال مزدوج الكتابة/trigger واختبار policy.

### user_preferences
- أضيفت حقول التفضيلات ومصادر الكشف والقيود الناقصة.
- بقيت حقول Staging الإضافية مثل share_location؛ يلزم مراجعة الاستخدام قبل ادعاء التطابق الكامل.

## 5. RLS: ما تحقق وما بقي

- تعريفات سياسات الجداول الأساسية الستة لم تتغير في المرحلتين.
- اختبار SQL مؤقت بدور authenticated وباستخدام هويتين مختلفتين أكد: صاحب الصف يستطيع التعديل؛ الحساب الآخر لا يستطيع التعديل أو الحذف أو الإدراج باسم المالك؛ المنشورات والتعليقات والتفاعلات قابلة للقراءة للمستخدم المصادق وفق policy؛ والتفضيلات لا تُقرأ من حساب آخر.
- انتهت معاملة الاختبار بـROLLBACK، وتم التحقق من عدم بقاء صفوف الاختبار.
- هذا اختبار RLS على PostgreSQL مع محاكاة claim لمستخدمين موجودين، وليس اختبار جلستي Auth منفصلتين عبر JWT وPostgREST.
- لم يكتمل بعد اختبار API الحقيقي بحسابين منفصلين، ولا اختبار runtime لجدول profile_private_details.

## 6. Edge Functions والبيانات

- Production يحتوي خمس Edge Functions: livekit-token, turn-credentials, translate-text, meetings-token, meeting-ai-minutes.
- Staging لا يحتوي Edge Functions حتى الآن.
- لم يتم نسخ بيانات مستخدمين من Production.
- تحذير Leaked Password Protection ما زال قائماً بسبب قيد خطة Free؛ لا يتم تجاوز ذلك في هذه المرحلة.
- تنبيهات Unused Index في Staging لا تعني حذف الفهارس؛ الجداول قليلة البيانات ولا تعطي workload ممثلاً.

## 7. قرارات التنفيذ

1. لا Migration أو DDL أو DML على Production.
2. لا حذف لأعمدة أو جداول Staging الزائدة.
3. لا نسخ بيانات مستخدمين حقيقيين إلى Staging.
4. لا تفعيل supported_locales.enabled قبل انتقال متزامن مع is_active.
5. لا تعلن RLS/Auth مكتملة قبل اختبار API برمزي JWT حقيقيين.
6. كل مرحلة لاحقة Migration موثقة وقابلة للاستعادة، وتبدأ على Staging.


## 8. تحديث بعد Migration استكمال الملف
- Migration `20261030024521_add_secure_profile_completion_rpc` تضيف `complete_mygram_profile` على Staging فقط.
- RPC تنفذ الحفظ الذري للملف العام والتفاصيل الخاصة وتفضيلات الموقع اعتماداً على `auth.uid()`.
- تم فحص SECURITY DEFINER وsearch_path الفارغ وصلاحيات التنفيذ: authenticated مسموح، anon غير مسموح.
- لا تغييرات على مخطط أو بيانات أو سياسات Production.


## Decision 04 delta | 2026-10-31

No migration was applied in this execution. Staging still reports 17 applied migrations, including `20261030201257_create_cached_ui_translation_service` and `20261030212710_restore_messenger_private_broadcast_triggers`. Production migration inventory remains distinct and was read-only inspected. A repository/ledger Migration Validator has not yet been implemented; do not infer full drift closure from the successful CI run.



## Applied migrations without matching repository files | 2026-10-31

A direct comparison of the current Staging migration ledger (17 rows) with the rebuild branch `supabase/migrations/` directory (13 SQL files) found four ledger entries with no matching file in the branch:

- `20261029200719_create_profile_for_new_auth_users`
- `20261029200728_revoke_public_execute_handle_new_user`
- `20261029211249_mygram_staging_profiles_rls_core`
- `20261029223828_create_supported_locales_public_read`

The remaining 13 Staging migration versions/names have matching branch files, including the corrected `20261030201257_create_cached_ui_translation_service.sql`.

These four entries are **applied-but-source-missing**, not proof of database corruption. Do not rewrite Staging migration history or invent replacement migrations. Recover the exact original SQL from a trusted migration backup/repository history, or record an explicitly approved baseline exception with provenance and checksums before a validator can pass. This remains an open P1 source-of-truth gap.


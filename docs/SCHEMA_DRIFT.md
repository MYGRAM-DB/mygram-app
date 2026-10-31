# DECISION 05 | LATEST VERIFIED SNAPSHOT | 2026-10-31

> This snapshot supersedes the preceding Decision 05 addendum for current state. Older entries remain historical evidence and are not deleted.

- Repository: `MYGRAM-DB/mygram-app`.
- Branch: `rebuild/phase-a-architecture`.
- Current tested HEAD: `8630647227ea0a21fca4f98c990acc4af168b57a`.
- [Run #115](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41149093354): **SUCCESS** on that exact HEAD. Both jobs completed successfully:
  1. `Typecheck, unit tests, Playwright, and production build`.
  2. `Real JWT, Profile Privacy, Storage, Messenger A/B/C, and Realtime`.
- [Run #114](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41147969397): **SUCCESS** on preceding HEAD `1b8a66b16f61984ee91350bfce400e25633026a7`.
- [Run #113](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41147962375): **CANCELLED**; not counted as pass or fail.
- **Critical test boundary:** Run #115, like Run #114, syntax-checks `tests/authz.integration.mjs` only. The Staging job invokes `qa-messenger-abc`, not `qa-authz-two-user`. AuthZ remains undeployed and unexecuted.
- MY-0401: **CLOSED** based on the repository owner's supplied API read-back evidence. Active rulesets: `main-branch-protection` ID `26248287`; `rebuild-branch-safety` ID `26248473`. Do not reopen absent contradictory evidence.
- PR #54: **Open / Draft / Not Merged**. No merge, Ready transition, close, or public release.
- Production remains **read-only**. No Production migration, data, Auth, Storage, Edge Function, configuration, or deployment changes.
- Gate A remains **OPEN**.

## AuthZ source review | static review only, not runtime verification

- Positive control observed: the function uses `jose.jwtVerify` with GitHub's remote JWKS, issuer and audience validation, and RS256; it checks expiry/not-before and repository/owner IDs.
- OIDC trust remains incomplete for Decision 05 acceptance: `workflow_ref` is checked with `startsWith`, not a pinned trusted workflow identity/SHA; the allowlist does not bind an immutable trusted workflow revision or independently establish the PR head repository provenance. The fixed branch and event claims alone are not accepted as proof against untrusted PR workflow changes. Add positive/negative claim tests and a trusted-workflow design before deployment.
- Replay guard hashes the presented OIDC token and inserts it into `qa_run_challenges`; duplicate/rejected insertion returns 409. Runtime replay behavior has not been tested.
- **Confirmed fixture defect:** `ensurePrivateRow` inserts `profile_private_details` using `session.client` (user JWT), which conflicts with Staging's lack of authenticated INSERT/UPDATE grants. The separate `tests/authz.integration.mjs` fixture helper also attempts a user-JWT INSERT. Both remain syntax-only/unexecuted.
- Required architecture: server-only admin client seeds and records each temporary fixture; every read/update/denial assertion remains on independent A/B/C JWT clients; admin is used for cleanup only.
- Cleanup currently records Auth user deletion errors and verifies private-row/avatar-object absence, but it does not independently query to prove each Auth user is absent after deletion. Cleanup calls also need per-resource exception isolation so one thrown cleanup operation cannot prevent later cleanup. Therefore `cleanup_complete` is not yet the complete evidence required by Decision 05.
- No source patch, function deployment, or Staging schema change is included in this documentation update. Do not deploy until the fixture, OIDC trust, cleanup verification, and runtime test design are reviewed.

## Remaining Gate A blockers

- MY-0402: correct fixtures and prove A/B/C real-JWT isolation, trusted-field denial, and cleanup on success/failure.
- MY-0404/0405: OIDC positive/negative/replay validation and an independent functional AuthZ CI job with a fresh token.
- Access-token expiry and refresh-token revocation runtime evidence.
- MY-0403 signed avatar URL authorization/expiry/block contract and tests.
- MY-0407: recover four source-missing migrations from trusted provenance or approve a documented baseline exception; Migration Validator is not implemented.
- Production `profiles` privacy remediation plan and Staging-tested proposal only; no Production change.
- SMTP/confirmation/password recovery/session journey and Staging rollback proof.

# DECISION 05 | CURRENT EXECUTION SNAPSHOT | 2026-10-31

> This is the controlling current-state addendum. Older entries below are retained as historical snapshots and must not override this section.

- Repository: `MYGRAM-DB/mygram-app`.
- Execution branch: `rebuild/phase-a-architecture`.
- Current HEAD at this snapshot: `1b8a66b16f61984ee91350bfce400e25633026a7`.
- [Run #114](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41147969397): **SUCCESS** on that exact HEAD. The build/verify job and existing Staging Security Suite both completed successfully.
- [Run #113](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41147962375): **CANCELLED** on `0d31424f1d2b47bfe483c536eab8139e3003e634`; it is neither a passing nor failing test result.
- Run #114 does **not** execute `qa-authz-two-user`. Its build job runs `node --check tests/authz.integration.mjs` only; the Staging job invokes `qa-messenger-abc`, not the AuthZ-specific function.
- MY-0401 branch protection: **CLOSED** based on the repository owner's supplied GitHub API read-back evidence. Active rulesets: `main-branch-protection` (ID `26248287`) and `rebuild-branch-safety` (ID `26248473`). See [main ruleset](https://github.com/MYGRAM-DB/mygram-app/rules/26248287) and [rebuild ruleset](https://github.com/MYGRAM-DB/mygram-app/rules/26248473). Do not reopen this task absent new contradictory evidence.
- PR #54: **Open / Draft / Not Merged**. No merge, Ready transition, close, or release is authorized.
- Production remains **read-only**. No Production migration, data, Auth, Storage, Edge Function, configuration, or deployment change is authorized.
- Gate A remains **OPEN**. AuthZ fixtures, real OIDC positive/negative/replay tests, independent AuthZ CI, access-token expiry and refresh-token revocation runtime tests, cleanup proof, signed avatar URL contract/tests, migration-source recovery or approved baseline, Migration Validator, Production privacy remediation plan, identity SMTP/recovery journey, and Staging rollback proof remain outstanding.
- AuthZ fixture defect remains confirmed: `ensurePrivateRow` attempts INSERT into `profile_private_details` with a user-scoped client although Staging authenticated grants do not permit client INSERT/UPDATE. Do not deploy this function until fixture setup is corrected using a server-only admin path and all authorization assertions remain real user JWT calls.
- No RLS weakening, public bucket, secret exposure, migration-history rewrite, or public deployment.

## Decision 05 schema provenance addendum

- Staging migration ledger count: **17**; migration source files on the execution branch: **13**.
- Four applied ledger entries remain source-missing: `20261029200719_create_profile_for_new_auth_users`, `20261029200728_revoke_public_execute_handle_new_user`, `20261029211249_mygram_staging_profiles_rls_core`, and `20261029223828_create_supported_locales_public_read`.
- No SQL has been invented or restored without a trusted source. No applied migration history has been rewritten.
- Recovery path: search trusted Git history and backups, identify provenance, calculate SHA-256 for any recovered original, and reconcile exact SQL/order with the Staging ledger. If originals cannot be recovered, submit a separately reviewed baseline exception with source evidence, checksums, and schema diff. It is not automatically considered closed.
- Migration Validator is not yet implemented or passed. It must detect missing, duplicate, reordered, and checksum-conflicting files and compare the repository migration set against the recorded Staging ledger without mutating either environment.
- Production remains read-only; no migration applied to Production or Staging as part of this documentation update.
# LATEST VERIFIED CI DELTA | 2026-10-31

- Last tested code/documentation baseline: `cf81c0543d97dc85c34ac5ae2abdd75f028f1073`.
- [Run #111](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41143795913) completed SUCCESS on that exact SHA. Both required existing jobs passed.
- Run #111 verify job passed product tests, Playwright, TypeScript, Vite build, and the current syntax-only integration checks.
- Run #111 Staging job passed the existing JWT/Profile Privacy/Storage/Messenger A/B/C/Realtime suite.
- Important: the AuthZ-specific `qa-authz-two-user` function remains undeployed and the independent AuthZ test remains unexecuted. Run #111 does not close that gap.
- PR #54 remains Open / Draft / Not Merged. Branch protection remains unverified and unapplied; rulesets API returned an empty list after the browser session timed out before save.
- No Production changes. Production `profiles` remains a confirmed overbroad authenticated SELECT path, with zero populated study/work fields and zero hidden-but-populated location rows in the audit-time aggregate.
- Four Staging-applied migrations have no matching branch source files; exact versions are documented below. No history rewrite.
- This documentation-only consolidation creates a newer branch HEAD; the next CI run must be checked against that resulting SHA rather than inheriting Run #111.

---

> **Current verified state (2026-10-31):** rebuild HEAD `47bede99b7ac368f4079cab9d705660f1c9b5749` passed [Run #110](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41143602523), both jobs SUCCESS. PR #54 remains Open / Draft / Not Merged. Branch protection is not applied or verified. Staging ledger: 17 migrations; branch source: 13 migration files; four applied entries are source-missing and listed in the Decision 04 delta below. No migration history rewrite or Production change occurred. Gate A remains OPEN.

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


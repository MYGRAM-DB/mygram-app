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

# CURRENT VERIFIED SNAPSHOT | DECISION 04 | 2026-10-31

- Repository: `MYGRAM-DB/mygram-app`.
- `main`: `d75fbdb6bf6f47ae70ffd1e975eaf9ba12ee7a61`.
- Rebuild branch: `rebuild/phase-a-architecture`.
- Current HEAD: `47bede99b7ac368f4079cab9d705660f1c9b5749`.
- [Run #110](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41143602523): **SUCCESS** on this exact HEAD; both build/verify and Staging security jobs passed.
- Run #107: SUCCESS on `e37881857cdc76b444da11a5887ad01e8699fc02`. Runs #108 and #109 were cancelled by newer commits.
- PR #54: Open / Draft / Not Merged. Do not merge.
- Branch protection: NOT VERIFIED / NOT APPLIED. Rulesets list is empty; browser setup timed out before saving; branch-protection endpoint access returned 403.
- `qa-authz-two-user`: source updated, but not deployed or executed. Current CI validates test syntax only. Fixture insertion must be corrected before deployment.
- Production P1 privacy path: authenticated SELECT grant + permissive `USING (true)` on `profiles` exposes all profile columns to signed-in users. Audit-time aggregate: 3 rows; study/work populated rows 0; hidden-but-populated location rows 0. No Production changes.
- Staging has safer base-table grants and a security-invoker/barrier public projection.
- Staging migration ledger 17 vs 13 repository migration files; 4 applied migrations are source-missing and documented in `SCHEMA_DRIFT.md`.
- No signed avatar URL access contract, independent AuthZ CI gate, migration validator, SMTP/recovery proof, or rollback proof yet.
- Gate A: OPEN. Production read-only. No public deployment.

---

# CURRENT VERIFIED SNAPSHOT | 2026-10-31

## تصحيح السجل التنفيذي | 2026-10-31

> هذا التصحيح هو المرجع الزمني الأحدث لهذا المستند، ويعلو على أي حالة أقدم أدناه.

- **HEAD الذي اجتاز Run #104:** `a837aee766da87a3a050fcdde6f01e90eba41dc1`.
- **Run #104:** [41139860543]( https://github.com/MYGRAM-DB/mygram-app/actions/runs/41139860543 )، الحالة النهائية **SUCCESS**، والوظيفتان الرئيسيتان ناجحتان:
  1. `Typecheck, unit tests, Playwright, and production build`: success. شملت الخطوات تثبيت الاعتماديات من lockfile، Playwright Chromium، اختبارات سجل المنتجات، اختبارات المتصفح، وفحص TypeScript وبناء Vite.
  2. `Real JWT, Profile Privacy, Storage, Messenger A/B/C, and Realtime`: success. نُفذت بوابة Staging الأمنية الحقيقية عبر GitHub OIDC.
- هذا يثبت نجاح Run #104 على SHA أعلاه، ولا يعني أن اختبار Auth المستقل `tests/authz.integration.mjs` أصبح بوابة مستقلة؛ خطوة هذا الملف في الوظيفة الأولى ما زالت تحقق الصياغة فقط.
- PR #54 ما زال **Open / Draft / غير مدمج**. لا دمج ولا نشر عام.
- `main` و`rebuild/phase-a-architecture` ما زالا بحاجة إلى تفعيل حماية الفروع والتحقق منها. لم تُجرَ أي أتمتة إدارية أو تغييرات حماية في هذه الجولة.
- لا تغييرات على Production، ولا migrations أو تغييرات Auth/Storage/Edge Functions عليه.
- عند إضافة هذا التصحيح التوثيقي إلى الفرع، سينشأ HEAD توثيقي أحدث من SHA الذي اجتاز Run #104؛ لذلك يجب أن يعمل CI مجدداً على HEAD الناتج قبل اعتماد ذلك HEAD. لا ننسب نجاح Run #104 إلى commit لم يُختبر بعد.

---


## Current repository state

- Repository: `MYGRAM-DB/mygram-app`.
- `main`: `d75fbdb6bf6f47ae70ffd1e975eaf9ba12ee7a61` (clean rebuild baseline).
- Rebuild branch: `rebuild/phase-a-architecture`.
- Last code/test baseline verified by Run #104: `a837aee766da87a3a050fcdde6f01e90eba41dc1`.
- PR #54: Open / Draft / not merged. Keep it Draft.
- Run #104: both jobs succeeded; see [Actions run 104](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41139860543).
- Branch protection: not yet enabled/verified; owner action required.
- Production: read-only; no changes.
- Release: blocked by policy and outstanding gates. Gate A remains OPEN.

## Open P1 gates

1. GitHub branch protection for `main` and the rebuild branch, followed by verification.
2. Independent two-account AuthZ integration test as an actual CI gate. Existing syntax validation is not execution.
3. Profile privacy contract: actual GRANT/RLS/column/view/API audit and A/B/C runtime coverage.
4. Avatar delivery contract: private original plus short-lived signed URL only for authorized viewers; test owner/allowed/denied.
5. Identity journey: password recovery, SMTP confirmation, avatar onboarding, session expiry/logout and username validation.
6. Migration filename/history validator and complete schema drift reconciliation.
7. Locale resource foundation and missing-key/RTL-LTR tests. Sixty locale rows are not sixty complete translations.
8. Rollback and restore evidence.

## Owner action

The repository owner must configure and verify branch rules in GitHub Settings. The current connection has not changed administrative protection settings. No browser automation was run.

## Historical status notes

# MYGRAM Execution Status

تاريخ التحديث: 2026-10-30 21:30 UTC

## الحالة العامة

إعادة التأسيس مستمرة على الفرع المستقل. PR #54 مفتوح بوضع Draft وغير مدمج. لا نشر Production ولا تعديل على قاعدة Production. آخر إصلاح منفذ يخص استعادة بث Messenger الخاص على Staging.

| المسار | الحالة | الدليل / الحاجز |
|---|---|---|
| A: Audit & Foundation | PARTIAL | المستودع MYGRAM-DB/mygram-app؛ main هو الأساس؛ إعادة البناء على rebuild/phase-a-architecture؛ فروق Production/Staging موثقة |
| B: Core Architecture | PARTIAL | React + TypeScript + Vite، سجل 9 منتجات، مسارات Hash، RTL عربي، مظهر داكن/فاتح |
| C: Identity & Auth | PARTIAL | تسجيل بريد أولي وonboarding وRPC ذرّية؛ لم يثبت بعد تدفق Auth/JWT من واجهة المستخدم مع SMTP فعلي واستعادة كلمة المرور |
| D: Social / MYGRAM FB | PARTIAL | موجز نصي، منشورات وتعليقات و8 تفاعلات، حذف المالك؛ لا رفع وسائط أو قصص/ريلز مكتملة؛ تحقق SQL سابق بمحاكاة 3 هويات |
| E: MYGRAM MESSENGER | PARTIAL | محادثات مباشرة A/B ورسائل ومرفقات خاصة وRLS؛ سياسات قناة Realtime موجودة؛ أضيفت Migration لاستعادة مشغلات بث الرسائل والمرفقات؛ اختبار JWT/REST/Storage/Realtime الحقيقي قيد إعادة التحقق |
| E2: WHATSMYGRAM | NOT IMPLEMENTED IN STAGING | لا مخطط مستقل أو واجهة وظيفية أو سياسات مستقلة بعد |
| F: Video | NOT IMPLEMENTED | منتجات الفيديو القصير والطويل والقصص والريلز غير مكتملة |
| G: AI & Meetings | NOT IMPLEMENTED IN STAGING | لا منتج AI أو Meetings متكامل على Staging |
| H: Wallet | NOT IMPLEMENTED IN STAGING | لا Wallet/Ledger/معاملات مالية على Staging |
| I: Tests | PARTIAL | Run #91: البناء وNode/Playwright وصياغة اختبارات التكامل نجحت؛ بوابة Staging الحقيقية فشلت عند بث Realtime. بعد إصلاح المشغلات بدأ Run #92؛ فحوص البناء وPlaywright نجحت، واختبار Staging كان queued عند آخر تحديث |
| J: Release | BLOCKED | PR #54 Draft؛ لا merge ولا نشر Production |

## Staging الحالي

- Supabase project: MYGRAM-STAGING، ref cbyvtehvaojxfcgpelir، الحالة ACTIVE_HEALTHY، PostgreSQL 17.
- 15 جدولاً عاماً وView عامة واحدة ضمن شريحة التأسيس الحالية.
- 16 migration مسجلة قبل إصلاح البث، ثم migration إضافية باسم restore_messenger_private_broadcast_triggers.
- supported_locales: 60 صفاً.
- supported_countries: 205 صفاً.
- لا يوجد translation_catalog في Staging؛ وجود قائمة اللغات لا يعني اكتمال ترجمة الواجهات.
- جداول ui_translation_cache وui_translation_daily_usage موجودة ومقفلة على service_role؛ لا توجد Edge Function ترجمة منشورة حالياً.
- Edge Function المنشورة الوحيدة في Staging: qa-messenger-abc.
- Storage buckets الخاصة: profile-avatars (5 MiB) وmessenger-attachments (25 MiB).
- جداول Messenger الأربع مفعّل عليها RLS. View public_profiles لديها security_invoker=true وsecurity_barrier=true.
- بعد تشغيل QA الفاشل السابق، سجلات التحقق أكدت حذف حسابات الاختبار الثلاثة والمحادثة وصورة الاختبار، وبقاء صفر مستخدمين qa-*.

## إصلاح Realtime الأخير

- السبب المثبت: جدول messenger_messages كان يفتقد trigger باسم messenger_messages_broadcast_insert، وجدول messenger_attachments كان يفتقد trigger باسم messenger_attachments_broadcast_insert. لذلك لم يصل بث INSERT إلى المشترك B رغم نجاح إنشاء الرسالة وفتح WebSocket.
- أضيف الملف supabase/migrations/20261030212710_restore_messenger_private_broadcast_triggers.sql إلى فرع إعادة البناء.
- طُبقت migration على MYGRAM-STAGING فقط.
- تحقق SQL بعد التطبيق من وجود المشغلين ودوالهما.
- لم تُفتح صلاحيات التنفيذ للمستخدمين؛ دوال trigger في mygram_private مع SECURITY DEFINER وsearch_path فارغ وREVOKE عن PUBLIC/anon/authenticated.
- لا نعلن نجاح Realtime حتى ينجح اختبار A/B/C الفعلي بعد الإصلاح.

## نتائج التحقق الحالية وحدودها

- GitHub Actions Run #91 (run id 41121506466): verify job نجح؛ staging-authz فشل بـHTTP 500.
- سجلات Supabase أظهرت أن إنشاء A/B/C وتسجيل دخولهم عبر Auth نجح، وقراءة الملف العام ورفع/تنزيل صورة A ومنع C نجحت، وإنشاء محادثة ورسالة A نجح. فشل الاختبار عند انتظار بث الرسالة إلى B.
- تم تنظيف حسابات A/B/C المؤقتة، والصورة، والمحادثة؛ فحص ما بعد التنظيف أعاد صفراً.
- GitHub Actions Run #92 (run id 41131151663) على commit 24f0285065d029ccdaa08964e708edbb976359e3: verify job نجح، واختبار Staging نجح 11/11 مع cleanup_complete=true.
- GitHub Actions Run #94 (run id 41131427123) على HEAD الحالي f8c5bbe5309f56e284ea8154feb1c82ccac5c037: كلا الوظيفتين verify وstaging-authz نجحتا. اختبار Staging نجح 11/11 وcleanup_complete=true. A وB اشتركا في Realtime ووصل بث رسالة A إلى B؛ C رُفض بـCHANNEL_ERROR؛ اختبارات REST وStorage ومنع انتحال المرسل وإضافة العضوية نجحت.
- اختبارات Playwright الحالية تختبر واجهة التأسيس والتنقل والمظهر وحالة عدم إعداد Supabase؛ لا تثبت تسجيل الدخول الفعلي أو واجهات المنتجات المكتملة.
- اختبار Auth/JWT منفصل للحسابين لم يُثبت بعد عبر Auth API/REST/Storage؛ ملف الاختبار موجود لكن workflow الحالي لا يشغله كمسار مستقل.

## Advisor / Security

- تحذير SECURITY DEFINER على public.complete_mygram_profile موثق ومقصود: EXECUTE مقيد بـauthenticated، الهوية من auth.uid() وsearch_path فارغ؛ يبقى اختبار JWT الحقيقي شرطاً قبل الدمج.
- RLS Enabled No Policy على qa_run_challenges وui_translation_cache وui_translation_daily_usage مقصود لأنها جداول خدمة server-side بلا وصول anon/authenticated.
- auth_leaked_password_protection غير مفعّل بسبب حدود خطة Supabase الحالية.
- مؤشرات unused_index معلومات أداء فقط؛ لم تُحذف فهارس.
- Production inventory تمت قراءته فقط؛ لم تنفذ عليه أي تغييرات.

## اللغات والدول

- Staging يملك 60 لغة و205 دول، لكن لا Translation Catalog ولا تغطية كاملة لكل مفاتيح الواجهة.
- الواجهة الحالية hard-coded بالعربية؛ لا تدّعي دعم 60 لغة فعلياً.
- يلزم بناء ملفات موارد مستقلة لكل لغة، تغطية كل النصوص وحالات الخطأ والوصول، وضبط RTL/LTR، ثم اختبارات تمنع fallback أو خلط اللغات.
- يلزم تدقيق رموز الاتصال وE.164 ومكتبة phone metadata؛ Phone Auth وOTP غير منفذين.

## ما بقي قبل أي دمج أو نشر

1. إتمام Run #92 والتحقق من بث Realtime الحقيقي: A وB يستقبلان؛ C يُرفض.
2. اختبار REST/Storage ورسائل ومرفقات A/B/C، والتأكد من التنظيف الكامل.
3. تشغيل اختبار Auth الحقيقي المنفصل للحسابين، دون استخدام حسابات شخصية.
4. SMTP ورسائل تأكيد البريد والاستعادة، ثم Phone Auth/OTP عند اختيار مزود SMS.
5. إكمال onboarding ورفع صورة الملف من الواجهة وربطها بالملف.
6. إكمال 60 لغة ترجمةً لا مجرد اختيار، واختبار 205 دولة ورموز الاتصال.
7. إكمال WHATSMYGRAM والمنتجات الاجتماعية والفيديو والاجتماعات وAI والمحفظة كلٌّ بمخططه وسياساته واختباراته.
8. مراجعة Schema Drift بين Production وStaging وخطة ترحيل تعويضية.
9. اختبارات Desktop/Mobile وA11y والأداء والأمن.
10. مراجعة Release مستقلة قبل تحويل PR من Draft أو دمجه.

## حدود الإنتاج والتراجع

- لا تغييرات على Production.
- لا merge ولا deploy.
- جميع تغييرات قاعدة البيانات الحالية محصورة في MYGRAM-STAGING.
- تراجع الكود عبر revert للـcommit على فرع العمل؛ وتراجع DDL عبر migration تعويضية مراجعة، لا حذف عشوائي للبيانات أو تعطيل RLS.


## Decision 04 verified update | 2026-10-31

- Current rebuild HEAD: `e37881857cdc76b444da11a5887ad01e8699fc02`.
- [Run #107](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41143033931): both current CI jobs passed on this exact SHA.
- PR #54 remains Open / Draft / Not Merged.
- OIDC/AuthZ source updated, but `qa-authz-two-user` remains undeployed and unexecuted. The runner still has a fixture-insert mismatch against Staging grants; do not deploy until corrected.
- Branch protection rulesets were not saved. Read-only rulesets listing is empty; direct branch-protection API is 403 for the connected integration.
- Confirmed P1 Production finding: authenticated can SELECT all columns of all `profiles` rows because of table grants plus permissive `USING (true)`; this includes study/work and location fields. Production remains untouched.
- Staging retains a safer split: no authenticated base-table profile SELECT, safe security-invoker/barrier public view, private details owner RLS.
- No signed avatar URL service, independent AuthZ CI gate, Migration Validator, SMTP/recovery journey, or rollback proof has been completed.
- Gate A: OPEN. No merge, no public deployment, no Production changes.



## Decision 04 correction | verified 2026-10-31 00:02 UTC

### MY-0401 branch protection
- Status: **CLOSED (owner-reported API read-back evidence)**.
- The repository owner supplied GitHub API read-back details for two Active rulesets:
  - `main-branch-protection`, ruleset ID `26248287`, target `main`.
  - `rebuild-branch-safety`, ruleset ID `26248473`, target `rebuild/phase-a-architecture`.
- Owner-supplied verification reports one required approval, stale approval dismissal, conversation resolution, required CI checks, branch-up-to-date requirement, deletion/force-push prevention, and empty bypass lists for `main`; rebuild ruleset blocks deletion and force-push while retaining the authorized direct-development path and empty bypass list.
- Evidence links: [main ruleset](https://github.com/MYGRAM-DB/mygram-app/rules/26248287), [rebuild ruleset](https://github.com/MYGRAM-DB/mygram-app/rules/26248473), [all rulesets](https://github.com/MYGRAM-DB/mygram-app/settings/rules).
- Audit provenance: these rule IDs and settings were supplied in the owner's report. The connected GitHub read-only surface used for this update does not expose a ruleset-read action, so this entry records owner-provided API read-back evidence and does not claim an independent connector read-back in this run.

### Run #112
- Status: **SUCCESS**, independently confirmed from GitHub Actions jobs for run ID `41144025980`.
- Head: `29bbf1dd60f8ea7c339063c43cc1a33c1ac5453f`.
- Both jobs completed successfully:
  1. `Typecheck, unit tests, Playwright, and production build`.
  2. `Real JWT, Profile Privacy, Storage, Messenger A/B/C, and Realtime`.
- The first job's AuthZ integration-file step is syntax validation only. The Staging job runs the existing Messenger/JWT/Profile Privacy/Storage/Realtime suite. Neither job invokes `qa-authz-two-user`; its deployment and runtime execution remain outstanding.
- [Run #112](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41144025980).

### PR #54
- Owner-reported state: Open / Draft / Not Merged, head `29bbf1d`, base `main`; preserve this state.
- No merge, close, Ready-for-review transition, or Production change is authorized by this correction.

### Gate A
- MY-0401 is closed based on the owner-supplied ruleset API read-back evidence above.
- Gate A remains **OPEN**. AuthZ fixture seeding, real OIDC acceptance/rejection/replay tests, token expiry and refresh revocation runtime tests, signed avatar URL authorization/expiry tests, AuthZ-specific independent CI, cleanup proof, four missing migration sources/baseline decision, Production privacy remediation plan, and identity SMTP/recovery tests remain open.
- Production remains read-only. The overbroad `profiles` SELECT path is an access-control finding; audit-time aggregates did not establish that study/work/hidden-location values were populated.

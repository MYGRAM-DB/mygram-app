# CURRENT VERIFIED SNAPSHOT | 2026-10-31

This snapshot supersedes the historical status notes below where values differ. Full evidence and the per-table drift inventory are in [AUDIT-20261031.md](./AUDIT-20261031.md).

- PR #54: Open / Draft / not merged; 130 commits, 61 changed files, 7,920 additions.
- main: d75fbdb6bf6f47ae70ffd1e975eaf9ba12ee7a61 (empty tree); rebuild HEAD after audit documentation: f25397a99f35ed0bfdad3733c4e83d26ec45ceea.
- Run #98 and Run #99 passed both CI jobs; Run #99 verified the migration filename correction. Run #100 is queued against the current documentation HEAD.
- Public schema counts: Production 51 tables / 46 migrations / 144 RLS policies / 18 public functions / 30 triggers / 5 Edge Functions. Staging 15 / 17 / 32 / 5 / 5 / 1.
- Staging has 60 locale rows and 205 country rows, but no translation_catalog. Production has 2,820 translation_catalog rows.
- SECURITY DEFINER inventory: Production 13, with 3 authenticated-executable meeting RPCs; Staging 4, with complete_mygram_profile authenticated-executable.
- All public tables observed have RLS enabled. Three Staging service-only tables have FORCE RLS and no client policies, with anon/authenticated table access revoked.
- Production Storage buckets differ materially from Staging: Production has public mygram-media and private mygram-private-messages; Staging has private profile-avatars and messenger-attachments.
- Both GitHub branches report protected=false. The current GitHub connection cannot write branch protection settings. Repository owner action is required.
- No Production changes, merge, or public deployment were performed.

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

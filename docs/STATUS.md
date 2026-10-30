# MYGRAM Execution Status

تاريخ التحديث: 2026-10-30

## الحالة العامة

المنصة ما زالت في مرحلة التأسيس. تم نقل أول شريحة من MYGRAM MESSENGER إلى Staging، لكن ذلك لا يعني اكتمال منتج المراسلة أو المنتجات التسعة.

| المسار | الحالة | الدليل / الحاجز |
|---|---|---|
| A: Audit & Foundation | PARTIAL | مستودع main وخط إعادة البناء موثقان؛ الفروق بين Production وStaging محفوظة |
| B: Core Architecture | PARTIAL | React + TypeScript + Vite، سجل المنتجات التسعة، RTL، المظهر الداكن/الفاتح |
| C: Identity & Auth | PARTIAL | تسجيل بريد أولي، onboarding، RPC ذرّية؛ JWT الحقيقي وSMTP واستعادة كلمة المرور مطلوبة |
| D: Social | PARTIAL | موجز نصي وواجهة منشورات وتعليقات وثمانية تفاعلات وحذف منشورات/تعليقات المالك؛ تحقق SQL ثلاثي الهويات ناجح، رفع الوسائط والعلاقات غير مكتملة |
| E: MYGRAM MESSENGER | PARTIAL | محادثات مباشرة A/B، رسائل، مرفقات خاصة، RLS وRealtime وواجهة أولية؛ اختبار JWT/WebSocket الحقيقي ينتظر أسرار QA |
| E2: WHATSMYGRAM | NOT IMPLEMENTED IN STAGING | لا توجد جداول أو سياسات مستقلة لهذا المنتج بعد |
| F: Video | NOT IMPLEMENTED | Tube وTikToks والريلز كمنتجات مكتملة غير منفذة |
| G: AI & Meetings | NOT IMPLEMENTED IN STAGING | لا توجد منظومة MYGRAM AI أو Meetings جديدة في Staging |
| H: Wallet | NOT IMPLEMENTED | لا جداول Wallet أو Ledger أو معاملات مالية |
| I: Tests | PARTIAL | CI Run #60 ناجح قبل واجهة MYGRAM FB؛ Run #71 فشل بسبب محدد Playwright ملتبس في رابط تسجيل الدخول، والإصلاح أُرسل في commit جديد ولم يُختبر بعد. اختبارات Auth/JWT وMessenger A/B/C الحقيقية ما زالت متخطاة لغياب أسرار QA |
| J: Release | BLOCKED | لا دمج PR #54 ولا نشر Production |

## مواءمة Staging الحالية

- المشروع: MYGRAM-STAGING (cbyvtehvaojxfcgpelir)، حالته ACTIVE_HEALTHY.
- قاعدة البيانات: PostgreSQL 17.
- الجداول العامة: 12، منها 8 للجذر/الهوية والاجتماعي و4 لـMessenger المباشر. أضيفت واجهتا View آمنتان للملفات العامة وحالة الملف الخاصة بالحساب الحالي.
- Migrations: 11.
- الدول المدعومة: 205.
- اللغات المسجلة: 14 فقط، بلا Translation Catalog كامل.
- يوجد 3 مستخدمي Auth مؤكدَي البريد. لم تتغير كلمات مرورهم، ولم تُنشأ لهم بيانات ملف شخصية دائمة في فحوص SQL.
- المخازن الخاصة: profile-avatars وmessenger-attachments. لا يُستخدم رابط Public للوسائط.
- لا توجد Edge Functions منشورة حالياً في Staging.
- لا توجد تغييرات Production. لم يتم نسخ بيانات Production إلى Staging.

## MYGRAM FB: ما تم بناؤه\n\n- واجهة موجز نصي في src/components/SocialFeedWorkspace.tsx مرتبطة بالمسار /products/fb.\n- إنشاء منشور نصي حتى 5000 حرف، عرض آخر 50 منشوراً، عرض أسماء أصحابها عبر public_profiles، التعليق حتى 2000 حرف، وثمانية تفاعلات: like/love/haha/care/wow/sad/angry/fire.\n- حذف المنشور وتعليق المستخدم لنفسه فقط وفق RLS. لا يوجد دعم لرفع الصور/الفيديو في هذه الواجهة بعد.\n- تحقق SQL ثلاثي الهويات داخل Transaction/Rollback: B قرأ منشور A وتعليقاً وتفاعلاً؛ C لم يتمكن من تعديل منشور A أو حذف تعليق/تفاعل B؛ لم تُترك بيانات اختبار دائمة.\n\n## MYGRAM MESSENGER: ما تم بناؤه

- messenger_conversations: محادثة مباشرة ذات طرفين، مع ترتيب ثابت لمعرفي العضوين ومنع تكرار زوج المحادثة.
- messenger_participants: العضوية تُنشأ داخل Trigger موثوق، والعميل يملك القراءة فقط ولا يستطيع إضافة نفسه أو غيره.
- messenger_messages: رسائل نصية ورسائل مرتبطة بوسائط؛ هوية المرسل مرتبطة بـauth.uid()، والرسالة غير قابلة للتعديل أو الحذف من العميل في هذه المرحلة.
- messenger_attachments: بيانات وصفية مرتبطة برسالة ومحادثة محددتين.
- bucket خاصة messenger-attachments، حد 25 MiB، وقائمة MIME محددة للصورة والفيديو والصوت وPDF.
- قنوات Realtime خاصة باسم messenger:<conversation-id>:messages. صلاحية الاشتراك مبنية على عضوية الطرفين، والبث ناتج عن Database Triggers لا عن رسائل Broadcast يرسلها العميل مباشرة.
- واجهة React أولية في src/components/MessengerWorkspace.tsx: فتح محادثة باسم المستخدم، قائمة المحادثات، الرسائل، المرفقات، وروابط مؤقتة للتحميل.
- جميع الجداول الأربع في Messenger لديها RLS. لا يملك العميل صلاحية الكتابة في جدول العضوية أو تعديل/حذف الرسائل.

## نتائج اختبار A/B/C المحاكي داخل قاعدة البيانات (2026-10-30)

تم إنشاء محادثة A/B ومرفق مؤقت داخل معاملة PostgreSQL مع ثلاث هويات claims مختلفة، ثم ROLLBACK:

| العملية | A | B | C |
|---|---:|---:|---:|
| رؤية المحادثة | منشئ | 1 صف | 0 صفوف |
| رؤية الأعضاء | عضو | عضوان | 0 صفوف |
| رؤية الرسائل | يرسل | يرى رسائل المحادثة | 0 صفوف |
| رؤية ميتاداتا المرفق | عضو | 1 صف | 0 صفوف |
| رؤية كائن Storage | المالك | 1 كائن | 0 كائنات |
| أهلية قناة Realtime الخاصة | true | true | false |
| انتحال هوية A من C | غير مطبق | غير مطبق | BLOCKED |
| إضافة C نفسه كعضو | غير مطبق | غير مطبق | BLOCKED |
| إنشاء محادثة A/B من C | غير مطبق | غير مطبق | BLOCKED |

- تم تأكيد أن B يستطيع قراءة الرسائل والعضوية والمرفقات بينما C لا يرى أي صف متعلق بالمحادثة.
- مُنع C من إرسال رسالة بانتحال A، ومن إضافة نفسه إلى جدول العضوية، ومن إنشاء محادثة يكون طرفاها A وB.
- فحص Storage أكد أن C لا يرى كائن المرفق.
- محاكاة Realtime استخدمت شرط العضوية نفسه الموجود في سياسة RLS للقناة. لم يتم بعد اختبار اتصال WebSocket حقيقي بثلاثة JWT.
- تحقق بعد ROLLBACK أكد بقاء صفر محادثات، صفر أعضاء، صفر رسائل، صفر ميتاداتا مرفقات، وصفر كائنات في bucket Messenger.
- هذا اختبار قاعدة بيانات بمحاكاة claims وليس اختبار REST/Auth API أو Storage API أو WebSocket حقيقي.

## اختبارات التكامل المضافة ولم تُشغّل بعد

- tests/authz.integration.mjs: اختبار حسابين فعليين عبر Auth API وREST وStorage.
- tests/messenger-three-party.integration.mjs: اختبار A/B/C عبر ثلاث جلسات JWT، REST، Storage، ومحاولة الانضمام إلى قناة Realtime خاصة.
- تشغيل اختبار Messenger يتطلب أسرار GitHub Actions: MYGRAM_STAGING_PUBLISHABLE_KEY وبيانات دخول حسابات A وB وC المخصصة للاختبار.
- متغير GitHub Actions المطلوب: MYGRAM_MESSENGER_ABC_TESTS=true.
- الاختبار مثبت على Staging ref المحدد، ويستخدم Publishable Key فقط. ينشئ أو يعيد استخدام محادثة ثابتة بين A وB، ورسالتين ثابتتين، وكائن مرفق ثابتاً مخصصاً للحسابات الثلاثة. تبقى هذه كـQA fixture في Staging لإعادة تشغيل الاختبار دون تضخم السجلات.
- لم تتم إضافة أو قراءة أي كلمة مرور بواسطة المساعد.

## Auth / Profile / Storage الحالي

- Migration 20261030171814_secure_public_profile_projection ألغت القراءة المباشرة من public.profiles لـanon وauthenticated، وأنشأت public_profiles لعرض الحقول المسموح بها فقط مع حجب بيانات السكن إلا عند موافقة صاحب الملف، وmy_profile_state لحالة إكمال ملف المستخدم الحالي فقط. اختبار SQL بدور authenticated أكد منع القراءة المباشرة، وظهور 3 ملفات عامة آمنة، وصف حالة واحد للحساب الحالي، وعدم ظهور حقول الدراسة/العمل أو بيانات السكن دون موافقة. الواجهة الجديدة تستخدم هذين الـView بدل الجدول الأساسي.
- حقول إثبات البريد والهاتف verified_contact_method وcontact_verified_at غير قابلة للتحديث من anon أو authenticated حسب column privileges.
- complete_mygram_profile دالة SECURITY DEFINER مع search_path فارغ، EXECUTE لـauthenticated فقط، والهوية مستمدة من auth.uid().
- تنبيه Advisor على الدالة أعلاه موثق؛ يبقى اختبار REST/JWT شرطاً قبل الدمج.
- حماية كلمات المرور المسرّبة ما زالت غير مفعلة بسبب حدود الخطة الحالية.
- اختبار البريد الحقيقي، SMTP، استعادة كلمة المرور، Phone Auth وOTP لم يكتمل.
- Storage الصور الشخصية: خاص، 5 MiB.
- Storage مرفقات Messenger: خاص، 25 MiB.

## Advisor / Performance

- تحذير SECURITY DEFINER الوحيد في Advisor هو complete_mygram_profile، وهو مقصود ومقيد كما هو موثق أعلاه.
- auth_leaked_password_protection ما زال WARN غير معالج.
- بعد إضافة الفهارس، لم يعد Advisor يعرض unindexed_foreign_keys على جداول Messenger.
- تبقى معلومات unused_index لأن Staging لا يحمل حركة إنتاجية كافية. لم نحذف أية فهارس.

## ما زال مطلوباً للوصول إلى الهدف الأصلي

1. تشغيل اختبارات Auth الحقيقية بحسابين مستقلين، وMessenger بثلاثة JWT عبر REST/Storage/WebSocket.
2. ضبط SMTP واختبار إنشاء حساب جديد، رسالة التأكيد، تسجيل الدخول، استعادة كلمة المرور.
3. إكمال تجربة Messenger: حذف/أرشفة المحادثة لكل طرف، إيصالات القراءة، الكتابة الآن، البحث، الحظر/طلبات المراسلة، المحادثات الجماعية والمكالمات.
4. بناء WHATSMYGRAM كمجال مستقل تماماً، بمخططه وسياساته واختباراته الخاصة.
5. إكمال العلاقات الاجتماعية وطلبات الصداقة والحظر، ثم ربط قواعد السماح بالمراسلة.
6. استكمال نشر الصور والقصص والفيديو القصير والطويل والاجتماعات والذكاء الاصطناعي.
7. إكمال 60 لغة وترجمة جميع الشاشات، واختبار RTL/LTR لكل لغة.
8. محفظة مستقلة بعقود Ledger ومراجعة أمنية ومالية قبل أي أموال حقيقية.
9. توحيد اختبارات Desktop/Mobile وA11y والأداء والأمن لكل منتج.
10. مراجعة Schema Drift بين Production وStaging قبل أي ترحيل نهائي.

## حدود الإنتاج والتراجع

- كل migrations والاختبارات المذكورة نُفذت في MYGRAM-STAGING فقط.
- لا تغييرات Production على الجداول أو البيانات أو Auth أو Storage أو Functions.
- PR #54 يبقى Draft ومفتوحاً، ولا merge أو deploy.
- تراجع التطبيق يتم عبر revert لفرع العمل؛ وتغييرات Staging تتراجع بـMigration تعويضية مُراجعة، لا بحذف عشوائي.

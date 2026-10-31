# MYGRAM Master Execution Plan
## النسخة التنفيذية 1.1 · 30 أكتوبر 2026

هذه الوثيقة هي مرجع بناء MYGRAM من الأساس حتى الإطلاق. تُنفّذ على دفعات صغيرة متتابعة، ولا تُعتبر أي وحدة مكتملة لمجرد وجود جدول أو شاشة. كل وحدة تحتاج: مخططاً موثقاً، صلاحيات، واجهة، اختبارات، سجلات أخطاء، وموافقة بوابة القبول.

---

## 1. الهدف النهائي

منظومة MYGRAM واحدة بهوية وحساب موحدين، وتسعة منتجات مترابطة من خلال خدمات مشتركة، لكن مع حدود بيانات وصلاحيات مستقلة:

1. MYGRAM AI
2. MYGRAM FB
3. MYGRAM INSTA
4. MYGRAM MESSENGER
5. WHATSMYGRAM
6. MYGRAM TWITTY
7. MYGRAM TUBE
8. MYGRAM TIKTOKS
9. MYGRAM MEETING

الشعار التشغيلي: Everything you need is here.

النتيجة المستهدفة: تجربة Web متجاوبة أولاً، قابلة للتثبيت كتطبيق PWA، ثم حزمة Android مستقرة عند اجتياز اختبارات الويب. لا يُعلن الإطلاق العام قبل إكمال الأمن والخصوصية والاعتمادية والاختبارات.

## 2. ثوابت الحوكمة والحماية

- المستودع: MYGRAM-DB/mygram-app.
- فرع إعادة البناء: rebuild/phase-a-architecture.
- PR الحالي: #54، مفتوح ومسودة، وليس إذناً بالدمج.
- قاعدة التطوير والاختبار: MYGRAM-STAGING فقط (cbyvtehvaojxfcgpelir).
- Production ref: rocztskcyakvekokftfx، قراءة metadata فقط عند الحاجة، بلا تعديل مخطط أو بيانات أو سياسات أو Auth أو Storage أو Functions.
- يمنع نسخ بيانات مستخدمي Production إلى Staging.
- لا merge ولا deploy إلى Production قبل إكمال بوابات الجودة والأمن واعتماد تقرير الفرق.
- migrations إضافية فقط، مع أسماء ثابتة وRollback plan ومراجعة قبل التطبيق.
- لا حذف جداول أو أعمدة أو فهارس أو سجلات لمجرد حل خطأ؛ يلزم قياس أثر وإثبات.
- كل جدول API مكشوف يحتاج GRANT أدنى وRLS وسياسات اختبارية لكل عملية.
- يمنع وضع service_role أو sb_secret أو كلمات المرور في الكود أو المتصفح أو المحادثة.
- العميل يستخدم Publishable Key فقط. أي أسرار مزود أو عمليات امتيازية تكون على خادم/Edge Function.
- لا تستخدم بيانات QA الشخصية أو حسابات Production. يجب تسمية حسابات الاختبار وبيان أثر كل اختبار قبل تشغيله.
- لا تعتبر SQL claims simulation اختبار JWT. لا تعتبر نجاح TypeScript أو Build دليلاً على نجاح Auth أو Storage أو Realtime.
- لا تُترك بيانات اختبارات دائمة إلا كـfixture مخصصة ومذكورة في STATUS.
- كل عملية مالية مستقبلية تحتاج دفتر قيود مزدوج ومراجعة محاسبية/قانونية منفصلة.

## 3. لغات البرمجة والتقنيات المعتمدة

### 3.1 الواجهة الأمامية

| التقنية | الاستخدام | القاعدة |
|---|---|---|
| TypeScript | لغة التطبيق الرئيسية | strict typing، لا any غير مبرر |
| React + TSX | مكونات وشاشات الويب | مكونات صغيرة حسب المنتج، لا منطق عمل داخل JSX |
| CSS | التصميم والاستجابة | CSS variables design tokens، لا خلط مكتبات تصميم عشوائية |
| HTML5 | الهيكل الدلالي | عناصر semantic، نماذج قابلة للوصول، labels وARIA صحيحة |
| JSON | إعدادات ثابتة وعقود بيانات | تحقق من schemas قبل اعتماد ملفات configuration |

### 3.2 الخادم وقاعدة البيانات

| التقنية | الاستخدام | القاعدة |
|---|---|---|
| PostgreSQL SQL | الجداول والفهارس والقيود وRLS وViews | كل تغيير عبر Migration موثقة |
| PL/pgSQL | الدوال الذرية وTriggers | search_path فارغ للدوال الحساسة، مراجع مؤهلة بالكامل |
| TypeScript على Deno | Supabase Edge Functions | JWT verification، تحقق المدخلات، secrets server-only |
| Node.js ESM | أدوات البناء والاختبارات | إصدارات مثبتة وnpm lockfile |

### 3.3 التشغيل والمنصة

| التقنية | الاستخدام |
|---|---|
| YAML | GitHub Actions CI/CD |
| Bash | أوامر CI وأدوات التهيئة المحدودة |
| Playwright | اختبارات المتصفح Desktop/Mobile |
| Node Test Runner | اختبارات الوحدات والتحقق من registry |
| Supabase JS | Auth وPostgREST وStorage وRealtime من الواجهة |
| PWA / Service Worker | التثبيت والتخزين المؤقت الآمن بعد إتمام دورة الجلسة |
| Kotlin | جسر Android أصلي عند الحاجة عبر Capacitor، وليس بديلاً عن منطق TypeScript |
| Python | عامل معالجة مستقل للمهام الثقيلة عند الحاجة فقط (وسائط/AI batch)، لا يستخدم لواجهة الويب ولا يضاف بلا حاجة تشغيلية |
| FFmpeg | ترميز وتحويل الوسائط داخل عامل معالجة معزول، وليس داخل المتصفح أو Postgres |

لا نضيف Flutter/Dart أو React Native أو Go أو لغات أخرى لمجرد التنويع. إذا ظهرت حاجة لخدمة عالية الحمل، يكتب قرار معماري ADR يبرر اللغة والخدمة وتكلفتها قبل التنفيذ.

## 4. بنية المستودع المستهدفة

- src/app: تركيب التطبيق والتوجيه وحالة الجلسة.
- src/components: عناصر UI مشتركة.
- src/features/<product>: منطق وشاشات كل منتج.
- src/services: عميل API وطبقة Auth وStorage وRealtime.
- src/lib: التحقق، التنسيق، التاريخ، الصلاحيات المشتركة.
- src/i18n: locale loader، الرسائل، pluralization، اتجاه الكتابة.
- src/styles: tokens، theme، responsive primitives.
- src/types: أنواع API وDB وdomain.
- supabase/migrations: مخطط قاعدة البيانات وسياساتها.
- supabase/functions: وظائف الخادم.
- tests/unit: منطق الوحدات.
- tests/integration: REST/Auth/Storage/Realtime.
- e2e: تدفقات المستخدم الحقيقية.
- docs: المعمارية والأمن والتشغيل وقرارات ADR وتقارير القبول.

لا تخلط منطق منتج بآخر. تُستخدم حزم المشتركات عبر واجهات معتمدة، لا import عشوائي لبيانات منتج آخر.

## 5. خدمات المنصة المشتركة

### 5.1 الهوية والحسابات
- تسجيل بالبريد وكلمة مرور، تأكيد البريد، إعادة تعيين كلمة المرور، تغيير بيانات الدخول.
- هاتف وOTP بعد إعداد مزود SMS والتحقق من الكلفة ومعدلات الإرسال.
- username فريد واسم أول/أخير وبيانات ملف عامة.
- جلسات مستمرة، تعدد الأجهزة، تسجيل الخروج من جهاز/كل الأجهزة، إدارة الجلسات.
- استرداد الحساب وتغيير البريد/الهاتف مع إعادة تحقق.
- CAPTCHA وrate limiting وقيود كلمات المرور وفق قدرات الخطة.

### 5.2 الملفات الشخصية والخصوصية
- public profile projection آمن.
- private details منفصلة.
- صور شخصية وغلاف وتفضيلات.
- خصوصية حسب الحقل: عام، متابعون/أصدقاء، خاص.
- موافقة صريحة منفصلة على الموقع.
- عدم نشر تاريخ الميلاد أو الهاتف أو البريد أو تفاصيل حساسة افتراضياً.
- الحظر والإبلاغ وإخفاء المحتوى وإدارة الجلسات.

### 5.3 العلاقات الاجتماعية
- friend requests، قبول/رفض/إلغاء.
- متابعة/إلغاء متابعة إن كان المنتج يحتاجها.
- block/unblock.
- mute/restrict.
- اقتراحات أشخاص بإذن مناسب.
- قوائم الأصدقاء والمقربين والعلاقات المشتركة.
- اختبار منع التواصل والتفاعل عند الحظر.

### 5.4 الدول والهواتف والموقع
- 205 دولة في Staging حالياً.
- التحقق من رموز ISO calling codes ومناطق التوقيت والبادئات الوطنية.
- اختيار البلد يدوياً، مع auto-detect اختياري.
- عدم اعتبار IP تحديداً دقيقاً؛ توضيح أنه تقريبي.
- GPS يتطلب إذناً صريحاً وقت الاستخدام.
- لا تُشارك إحداثيات أو عنواناً دقيقاً دون موافقة خاصة.
- اختبار تنسيق E.164، وتكرار رموز الدول، وتغطية أرقام المحمول.

### 5.5 اللغات والاتجاه
- الهدف 60 لغة كاملة، بينما Staging يحتوي حالياً 14 لغة.
- كل شاشة ورسالة خطأ وإشعار وبريد ورسالة نظام لها ترجمة.
- لا خلط بين اللغات داخل واجهة لغة واحدة.
- RTL للعربية والعبرية وغيرها وفق locale، وLTR لبقية اللغات.
- pluralization، التواريخ، الأرقام، العملات، المناطق الزمنية، أسماء الدول.
- مراجعة بشرية للمصطلحات الحساسة، وعدم اعتبار ترجمة آلية خام مكتملة.
- اختبار مفاتيح مفقودة وoverflow وخطوط fallback لكل لغة.

### 5.6 خدمات عامة أخرى
- Notification service: داخل التطبيق، push، بريد، ورسائل هاتف وفق opt-in.
- Search service: مستخدمون، منشورات، وسائط، محادثات، مجموعات.
- Media service: upload، metadata، moderation، processing، CDN/private delivery.
- Moderation: reports، spam controls، blocklists، abuse review، audit.
- Analytics: أحداث مجمعة تقلل البيانات الشخصية.
- Admin console: صلاحيات موظفين دقيقة، audit log، فصل مهام الدعم عن بيانات المستخدم.
- Billing/subscriptions: فقط بعد تحديد provider وسياسات الاسترجاع والضرائب.

## 6. مواصفات المنتجات التسعة

### 6.1 MYGRAM FB
- موجز Home وFollowing وDiscover.
- منشورات نص وصورة وفيديو وملفات متعددة.
- التعليقات والردود المتداخلة والتعديل والحذف بصلاحية.
- تفاعلات متعددة مع منع تفاعل مكرر من الحساب نفسه.
- صفحات ومجموعات وأدوار مشرف/عضو.
- صداقة ومتابعة واقتراحات.
- Stories وفق مدة احتفاظ وخيارات جمهور.
- تقارير وإبلاغ وإخفاء ومكافحة spam.
- قبول: API + RLS + UI + اختبارات مستخدمين اثنين وثالث غير مخول + حذف/تعديل المالك.

### 6.2 MYGRAM INSTA
- ملف مرئي وشبكة صور.
- رفع صور متعددة وفيديو قصير.
- Stories مع مدة/أرشفة/Highlights.
- Reels وموجز عمودي.
- تعليقات وتفاعلات ومشاركة وحفظ.
- أدوات قص/مرشحات على جهة العميل بحذر.
- حقوق النشر والبلاغات ومراجعة المحتوى.
- قبول: رفع/عرض/حذف/خصوصية وStorage وMobile performance.

### 6.3 MYGRAM MESSENGER
- محادثات فردية وجماعية.
- inbox، unread counts، pinned، archive.
- رسائل نصية، صور، ملفات، صوتيات، فيديو.
- voice notes، reactions، replies، forward.
- edit/delete/unsend وفق سياسة زمنية معلنة.
- delivered/read receipts، typing، online presence.
- search داخل محادثة.
- block/report، طلبات مراسلة، إعدادات استقبال.
- مكالمات صوت/فيديو بعد اعتماد مزود WebRTC/SFU.
- تشفير أثناء النقل والتخزين، ودراسة E2EE منفصلة قبل ادعاء وجوده.
- قبول: A وB يستخدمان كل الوظائف، C لا يرى شيئاً ولا يشترك في Realtime ولا يحمل مرفقاً.

### 6.4 WHATSMYGRAM
- منتج مستقل عن Messenger في المخطط والـAPI وسياسات الوصول.
- ربط الهاتف والتحقق OTP.
- مزامنة جهات الاتصال بموافقة واضحة ومحدودة.
- محادثات ومجموعات ورسائل ووسائط وصوت.
- presence، receipts، block/report، backup.
- لا يقرأ جداول Messenger مباشرة ولا يستخدم RLS الخاصة به.
- قبول: رقم هاتف موثق، مستخدم غير مسجل، رقم غير مطابق، حظر، تغيير جهاز، وسيناريو C غير عضو.

### 6.5 MYGRAM TWITTY
- تدوينات قصيرة، ردود، اقتباس، إعادة نشر.
- hashtags، mentions، trending.
- قوائم ومتابعة وموجز.
- سياسة spam وحدود نشر وتبليغ.
- قبول: منع الانتحال، وتطبيق block، واختبارات ترتيب/بحث.

### 6.6 MYGRAM TUBE
- قنوات ومعلومات منشئ.
- رفع قابل للاستئناف.
- عامل ترميز إلى HLS/DASH حسب القرار التقني.
- thumbnails، captions/subtitles، metadata.
- قوائم تشغيل، اشتراك، سجل مشاهدة.
- تعليقات وبلاغات وحقوق نشر.
- مراقبة كلفة التخزين والنقل والترميز.
- قبول: رفع ملف، ترميز، تشغيل متكيف، وصول خاص/عام، حذف وتراجع.

### 6.7 MYGRAM TIKTOKS
- موجز فيديو قصير عمودي.
- تسجيل، رفع، قص، دمج صوت متاح الحقوق.
- تصنيف وموجّه توصية أولي شفاف.
- تفاعلات، تعليقات، مشاركة، حفظ.
- safety controls، age-appropriate restrictions، reports.
- قبول: أداء الهاتف، التحميل المسبق، استهلاك الشبكة، moderation وprivacy.

### 6.8 MYGRAM AI
- سجل محادثات منفصل لكل مستخدم.
- اختيار مزود/نموذج من الخادم دون كشف المفاتيح.
- حدود استخدام، تكلفة لكل مستخدم، quotas.
- رفع ملفات وفق قيود آمنة.
- أدوات كتابة وتلخيص وترجمة وتحليل.
- موافقات واضحة قبل إرسال بيانات خارج MYGRAM.
- حماية prompt injection وإخفاء الأسرار.
- سجلات usage ومراقبة التكلفة.
- قبول: اختبار صلاحيات، تسرب بيانات بين الحسابات، limits، billing metering، provider failure.

### 6.9 MYGRAM MEETING
- جدولة واجتماع فوري ورابط دعوة.
- organizer/host/co-host/participant/guest.
- lobby، mute، camera، screen share وفق دعم المتصفح.
- chat، reactions، recording إن سمح القانون والموافقة.
- قائمة الحضور والحظر وإغلاق الاجتماع.
- WebRTC مع SFU provider عند الحاجة.
- قبول: صلاحيات المضيف، منع guest من التحكم، reconnect، تعدد المشاركين، اختبار جودة الشبكة.

## 7. المجال المالي والمحفظة

يُعزل المجال المالي تماماً عن جداول المنتجات الاجتماعية والمراسلة.

- wallets، accounts، double-entry ledger، entries، transactions، holds، refunds، disputes.
- مبالغ بأعداد صحيحة بوحدة أصغر للعملة أو NUMERIC مضبوط، لا floating point.
- append-only ledger، لا تعديل أو حذف لقيد مرحّل.
- idempotency keys لمنع التكرار.
- reconciliation مع مزود الدفع والبنوك.
- حدود رصيد ومعاملات واحتيال.
- AML/KYC والعقوبات والضرائب والترخيص حسب الدولة.
- لا أموال حقيقية ولا تحويلات إنتاجية قبل رأي قانوني ومحاسبي، واختبار تسوية ومراجعة أمنية مستقلة.

## 8. نمط API وعقود البيانات

- REST/PostgREST للعمليات القياسية مع schema validation.
- RPC للعمليات الذرية فقط، مع auth.uid() وعدم الثقة بمعرف مستخدم يرسله العميل.
- Edge Functions للعمليات السرية والتكامل مع الأطراف الخارجية.
- Realtime private channels، مع RLS على realtime.messages.
- Storage private buckets، metadata مرتبط بالمورد، signed URLs قصيرة العمر.
- API contracts typed ومصدرة إلى TypeScript types.
- versioning للمسارات عند تغير العقد، وعدم كسر تطبيق منشور.
- كل endpoint يحدد: authentication، authorization، validation، rate limit، idempotency، audit، error codes.
- pagination بحد أقصى معروف، وترتيب ثابت، ومنع fetch غير محدود.
- لا تمنح client privileges على الجداول الداخلية أو membership tables أو ledger.

## 9. بنية قاعدة البيانات

- public schema فقط للجداول التي تحتاج Data API.
- private schema للـhelpers والدوال الداخلية غير المكشوفة.
- فصل product domains والحدود بينها.
- foreign keys وunique constraints وcheck constraints.
- RLS على كل جدول مكشوف.
- GRANT minimal لكل role وكل column.
- فهارس حسب أنماط الاستعلام الفعلية، مع مراقبة Advisor وEXPLAIN.
- migrations قابلة للتكرار حيث أمكن، واحتفاظ بأرقام migrations متناسقة بين الكود وStaging.
- seed data منفصل تماماً عن Production.
- نسخ احتياطي وخطة استعادة قبل أي مرحلة ذات بيانات مهمة.

## 10. واجهات المستخدم الأساسية

### 10.1 غلاف المنصة
- تسجيل/دخول/استعادة كلمة المرور.
- onboarding.
- Home/Explore.
- مركز الإشعارات.
- البحث العام.
- الملف الشخصي.
- إعدادات الحساب والخصوصية والأمان واللغة والمظهر.
- إدارة الأجهزة والجلسات.
- مركز المساعدة والإبلاغ.

### 10.2 مواصفات الواجهة
- Dark mode افتراضي، Light mode محفوظ.
- Mobile-first لكن يدعم Tablet/Desktop.
- RTL/LTR على مستوى الصفحة والمكوّن.
- حالات loading/empty/error/success لكل استعلام.
- لا تعطيل الأزرار دون سبب معلن.
- optimistic updates فقط مع rollback بصري عند فشل الخادم.
- focus keyboard وscreen readers وتباين WCAG.
- لا تعرض بيانات خاصة على بطاقات عامة.
- لا يظهر منتج بحالة Ready قبل اجتياز اختبارات قبول المنتج.

## 11. الاختبارات وبوابات النجاح

### Gate 0: سلامة الفرع
- lint/typecheck/unit/build.
- migrations موجودة ومطابقة لـStaging.
- لا Production writes.
- PR Draft.

### Gate 1: Auth
- signup، email confirmation، login، logout، refresh، reset.
- JWT identity and session lifecycle.
- phone OTP منفصل عند توفر مزود.
- لا تسرب أسرار في logs.

### Gate 2: RLS
- owner / member / non-member / anon / authenticated.
- select/insert/update/delete.
- row count أو denial code مضبوط حسب العملية.
- اختبار انتحال user_id والـIDs المخمنة.

### Gate 3: Storage
- owner upload/read/update/delete.
- unauthorized user read/download/overwrite/delete denied.
- MIME/size/path validation.
- signed URL expiry.
- cleanup test artifacts.

### Gate 4: Realtime
- authorized A/B subscribe.
- unauthorized C subscribe denied.
- broadcast events only after valid DB write.
- reconnect and unsubscribe.
- no channel name guessing bypass.

### Gate 5: UI
- Playwright desktop 1440px وmobile 390px وtablet.
- full user journey لكل منتج.
- page errors صفر.
- accessibility smoke، keyboard، RTL/LTR.
- all empty/error states.

### Gate 6: Performance & Reliability
- query plans والفهارس.
- load tests على Staging ببيانات اصطناعية.
- latency p50/p95، error rate، memory.
- media upload/resume/playback.
- retry/backoff وحدود rate.

### Gate 7: Security
- dependency audit وsecrets scan.
- XSS/CSRF/IDOR/SQL injection review.
- abuse controls وrate limits.
- storage isolation.
- privileged RPC review.
- incident/audit readiness.

### Gate 8: Release
- Migration rehearsal.
- rollback drill.
- schema diff Production/Staging.
- backup proof.
- release note وموافقة.
- فتح PR من Draft إلى Ready للمراجعة فقط عند اكتمال البوابات.
- الدمج والنشر عمليتان مستقلتان بموافقة صريحة.

## 12. ترتيب التنفيذ المعتمد

1. تثبيت CI الأخضر على أحدث commit وإصلاح أي E2E/build failure.
2. تحديث migrations والوثائق لتتطابق مع حالة Staging، ثم تدقيق أمن profiles وSocial وMessenger.
3. تجهيز حسابات QA مخصصة وActions Secrets بشكل آمن وتشغيل Auth JWT وMessenger A/B/C الحقيقيين.
4. ربط Auth وonboarding وpublic/private profile ورفع الصور، واختبار البريد/SMTP.
5. إكمال MYGRAM FB من موجز نصي إلى وسائط وعلاقات ومجموعات.
6. إكمال MYGRAM MESSENGER: رسائل، receipt، typing، block، مجموعات، بحث، مكالمات.
7. تنفيذ WHATSMYGRAM كبنية منفصلة، ثم OTP وcontact discovery.
8. تنفيذ INSTA وTWITTY وTUBE وTIKTOKS كوحدات مستقلة مع خدمة الوسائط.
9. تنفيذ AI وMEETING بعد تحديد المزودين والتكلفة والقيود.
10. إكمال Localization Catalog لـ60 لغة، مع اختبار الترجمة واتجاه العرض.
11. إنشاء Wallet/Ledger في Staging فقط بعد مراجعة المتطلبات القانونية والأمنية.
12. تدقيق شامل للمنصة، إطلاق تجريبي محدود، ثم release Production بموافقة مستقلة.

## 13. معايير إقفال كل وحدة

لا يُسمح بكتابة DONE إلا إذا توفرت جميع العناصر:
- Schema/Migration في Git.
- GRANT/RLS/Storage/Realtime security rules.
- API contracts وvalidation.
- واجهة حقيقية متصلة بالخدمة.
- unit + integration + E2E.
- حالات loading/error/empty.
- observability وaudit عند الحاجة.
- localization.
- desktop/mobile/accessibility checks.
- اختبار منع الحساب الثالث غير المخول.
- rollback plan.
- سجل الأدلة في docs/STATUS.md.

## 14. الحالة الفعلية في 30 أكتوبر 2026

- 205 دولة مفعّلة في Staging.
- 14 لغة مفعّلة فقط من هدف 60.
- 12 جدولاً عاماً في Staging، وكلها تحتاج متابعة حسب المجال؛ أربع منها خاصة بـMessenger.
- Messenger direct slice: schema، RLS، private Storage، private Realtime، وواجهة أولية. محاكاة SQL A/B/C نجحت، لكن JWT/WebSocket الحقيقي لم يُشغّل بعد.
- Profile privacy: base table SELECT مسحوب من client roles؛ public_profiles وmy_profile_state views مضافة ومجربة عبر SQL claims.
- MYGRAM FB: واجهة موجز نصي، نشر وتعليقات وثمانية تفاعلات وحذف المالك. اختبار SQL بثلاث هويات نجح داخل rollback.
- CI Run #60 نجح على commit أقدم من واجهة FB.
- Run #71 فشل بسبب strict locator في Playwright، وتم إرسال إصلاح محدد الاختبار، ويجب انتظار CI على HEAD الجديد لتأكيده.
- Auth integration وMessenger A/B/C الحقيقيان متخطيان بسبب عدم تهيئة Actions Secrets/Variables.
- WHATSMYGRAM وبقية منتجات الفيديو/AI/Wallet غير مكتملة في Staging.
- PR #54 يبقى Draft مفتوحاً، وProduction لم يتغير.

## 15. تقرير نهاية كل دفعة

يسجل التقرير:
- commits وfiles changed.
- migrations المطبقة وأرقامها.
- نتائج CI لكل job مع run URL.
- اختبارات Auth/RLS/Storage/Realtime الفعلية أو سبب Skip.
- حالات A/B/C وأكواد/أعداد الصفوف.
- المنتجات والواجهات التي أصبحت قابلة للاستخدام.
- العيوب المفتوحة وتصنيفها وشدة أثرها.
- أي تغييرات بيانات دائمة أو fixtures.
- المخاطر والقرارات المؤجلة.
- rollback plan.
- الخطوة التالية المحددة.

لا يُكتب "نجاح شامل" طالما هناك اختبار أساسي متخطى أو منتج غير منفذ.

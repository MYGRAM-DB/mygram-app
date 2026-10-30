# هندسة MYGRAM المعمارية

## 1. الهدف

بناء منظومة واحدة تضم تسعة منتجات مستقلة وظيفياً. يشترك المستخدم في هوية MYGRAM واحدة، لكن تسجيل الدخول الموحد لا يمنح المنتج صلاحية قراءة بيانات منتج آخر. لكل منتج واجهته ومساراته وقواعد الوصول إلى موارده.

## 2. المنتجات التسعة وحالة Staging

| المنتج | المسؤولية الأساسية | الحالة الحالية |
|---|---|---|
| MYGRAM AI | المحادثات الذكية، أدوات الكتابة والتحليل والمحتوى | غير منفذ في Staging |
| MYGRAM FB | موجز اجتماعي ومنشورات وتعليقات وتفاعلات ومجتمعات | posts/comments/reactions موجودة؛ المنتج غير مكتمل |
| MYGRAM INSTA | الصور والقصص والريلز | غير منفذ كمنتج في Staging |
| MYGRAM MESSENGER | مراسلة MYGRAM الفردية والجماعية والملفات ومزايا المحادثة | شريحة المحادثات المباشرة A/B موجودة في Staging مع RLS وStorage وRealtime وواجهة أولية |
| WHATSMYGRAM | مراسلة مستقلة مرتبطة بالهاتف | غير منفذ في Staging؛ يجب أن يبقى مستقلاً عن Messenger |
| MYGRAM TWITTY | تدوينات قصيرة وردود وإعادة نشر ووسوم | غير منفذ في Staging |
| MYGRAM TUBE | فيديو طويل وقنوات واشتراكات وقوائم تشغيل | غير منفذ في Staging |
| MYGRAM TIKTOKS | فيديو قصير عمودي وموجز توصيات | غير منفذ كمنتج في Staging |
| MYGRAM MEETING | اجتماعات ومشاركون وأدوار ورسائل ومحاضر | غير منفذ في Staging |

ملاحظة حدود المنتج: واجهة MYGRAM Chat المستقلة في النسخة التاريخية ليست منتجاً عاشراً. تُراجع وتُنقل مزاياها ضمن MYGRAM MESSENGER مع الحفاظ على فصل السياسات المطلوبة. WHATSMYGRAM يبقى منتجاً مستقلاً.

## 3. الخدمات المشتركة

- الهوية والجلسات والحسابات.
- ملفات المستخدمين وإعدادات الخصوصية.
- العلاقات الاجتماعية وطلبات الصداقة والحظر.
- اللغات والدول وأرقام الاتصال.
- تخزين الوسائط وإصدار الروابط وفق صلاحية المورد.
- الإشعارات وسجل الأحداث.
- البحث والفهرسة.
- البلاغات والإشراف وإدارة المحتوى.
- التسجيل الأمني وحدود الاستخدام.
- واجهات API وطبقة التكامل.
- إدارة الأجهزة والظهور والحالة.

## 4. حدود المنتجات

1. لكل منتج مسار مستقل تحت مساحة أسماء ثابتة، مثل /products/fb و/products/messenger.
2. لا يستخدم منتج جدولاً خاصاً بمنتج آخر مباشرة إلا من خلال خدمة مشتركة أو سياسة مشاركة موثقة.
3. لا يُعتمد معرف المنتج أو مصدر الرسالة الذي يرسله العميل وحده لتحديد الصلاحية. يجب التحقق من العضوية في قاعدة البيانات.
4. لا تُدمج جداول WHATSMYGRAM مع جداول MESSENGER.
5. لا تُنشأ منظومة هوية ثانية. auth.users.id هو المعرف الثابت.
6. تُعتمد public.profiles كواجهة الملف العام. public.users جدول توافق قديم يخضع للتدقيق قبل إيقاف استعماله، ولا يُنشأ له بديل جديد.
7. public.messages جدول قديم. لا يُستخدم في وظائف جديدة قبل تحديد سبب وجوده ومراجعته.
8. لا تُضاف جداول للمحفظة أو عملات قبل مواصفات WALLET المعتمدة.

## 5. بنية Messenger المباشرة في Staging

- messenger_conversations: محادثة مباشرة بطرفين، مع user_low/user_high بترتيب ثابت ومنع تكرار الزوج.
- messenger_participants: ينشأ صف عضوية الطرفين بواسطة Trigger داخلي في schema غير مكشوف للـData API. العميل يستطيع القراءة فقط.
- messenger_messages: الرسائل النصية ورسائل الوسائط. sender_id يطابق auth.uid()، والرسالة لا يمكن تعديلها أو حذفها من العميل في النسخة الحالية.
- messenger_attachments: metadata للمرفق، مرتبطة برسالة ومحادثة محددتين.
- messenger-attachments: Storage bucket خاصة بحد 25 MiB وMIME allow-list.
- Realtime: قناة خاصة باسم messenger:<conversation-id>:messages. سياسة realtime.messages تسمح بالاستقبال للعضوين فقط. البث ينشأ من Database Trigger، ولا يسمح للعميل بإرسال Broadcast حر إلى القناة.
- الواجهة: src/components/MessengerWorkspace.tsx، وتُحمّل عبر مسار منتج MYGRAM MESSENGER.

### حدود شريحة Messenger الحالية

هذه ليست بعد منظومة مراسلة كاملة. غير المنفذ: المجموعات، أرشفة المحادثة لكل طرف، حذف الرسائل/تعديلها، إيصالات القراءة، الكتابة الآن، الحظر وطلبات المراسلة، البحث، المكالمات الصوتية/المرئية، والمزامنة عبر الأجهزة.

## 6. تصور المكونات

MYGRAM Platform
- Identity & Account (Supabase Auth + profiles)
- Shared Platform Services: Preferences, Privacy, Relationships, Locale, Country, Phone metadata, Storage, Notifications, Search, Moderation, Reports, Audit, API
- Product Experiences: AI, FB, INSTA, MESSENGER, WHATSMYGRAM, TWITTY, TUBE, TIKTOKS, MEETING
- Financial Domain: Wallets, Ledger, Transactions, Treasury / Rewards (NOT IMPLEMENTED)

## 7. التقنية المعتمدة حالياً

- الواجهة: React + TypeScript + Vite.
- الهوية وقاعدة البيانات والتخزين وRealtime: Supabase.
- الاستضافة المستهدفة: GitHub Pages بعد بناء dist/ واستخدام Hash routing.
- الاختبارات: Node built-in، Playwright، RLS/REST/Storage/Realtime integration.
- لا يُفترض أن GitHub Pages يشغّل APIs أو مهام خادم. العمليات السرية تكون في Edge Functions أو خدمة خادم موثقة.
- جداول public الجديدة تحتاج RLS وصلاحيات Data API صريحة؛ لا يُفترض أنها أصبحت مكشوفة تلقائياً.

## 8. نموذج الأمن والتكامل

- العميل يستخدم Publishable Key فقط، وتُطبق RLS على القراءة والكتابة.
- لا يُمرّر Service Role Key أو Secret Key إلى المتصفح أو CI الاختباري.
- Edge Functions تستخدم JWT verification افتراضياً.
- تُستخدم معاملات Postgres ودوال ذرية للعمليات التي تتطلب اتساقاً.
- Realtime يستخدم private channels مع RLS على realtime.messages.
- Storage الخاص لا يتحول إلى Public URL. تُستخدم signed URLs قصيرة العمر بعد إثبات العضوية.
- العضوية الفعلية في المحادثة هي التي تمنح الوصول، لا معرفة conversation_id.

## 9. فصل الملف العام عن حالة الحساب الخاصة\n\n- public.profiles هو جدول الأساس الداخلي، ولا يقرأه عميل anon أو authenticated مباشرة في Staging.\n- public.public_profiles هو الإسقاط الآمن للملف العام؛ يعرض الاسم واسم المستخدم والنبذة والصورة والاهتمامات والجنسية العامة، ويعيد حقول السكن فارغة إلا عند الموافقة. لا يعرض بيانات الدراسة أو العمل ولا حالة إكمال الملف.\n- public.my_profile_state يعرض حالة إكمال الملف للحساب الحالي فقط.\n- إكمال الملف والكتابة على البيانات الأساسية يمران عبر complete_mygram_profile فقط، مع اشتقاق هوية المستخدم من auth.uid().\n\n## 10. الحالة الحالية

- فرع إعادة البناء مستقل؛ PR #54 مفتوح كمسودة وغير مدمج.
- Staging يضم حالياً 12 جدولاً عاماً و11 migrations، إضافة إلى View للملف العام وView لحالة الملف الخاصة.
- 205 دول مدعومة، و14 لغة مسجلة فقط.
- شريحة Messenger المباشرة نُفذت في Staging واختُبرت بمحاكاة ثلاث هويات claims داخل Transaction/Rollback. اختبار Auth JWT وRealtime WebSocket الحقيقي يبقى بوابة منفصلة. فصل الملف العام عن الخاص أضيف واختُبر بمحاكاة دور authenticated داخل معاملة قراءة فقط.
- Production لم يتغير.
- دعم 60 لغة كاملاً، WHATSMYGRAM، المنتجات المرئية والفيديو والاجتماعات والذكاء الاصطناعي والمحفظة غير مكتملة.

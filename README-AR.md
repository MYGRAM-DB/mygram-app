# MYGRAM 2.8 — إصدار إصلاح التكامل

تطبيق ويب ثابت على GitHub Pages مع Supabase (مصادقة، قاعدة بيانات، تخزين).

## ما تم إصلاحه
- `config.js` كان يعرّف `SUPABASE_URL` فقط بينما بقية الملفات تقرأ `supabaseUrl` و`supabaseKey` و`homeUrl` و`loginUrl` (قيم غير معرّفة فلا يبدأ الاتصال). أصبحت الصيغتان معرّفتين.
- `app.js` كان يستعلم عن جدول `profiles` بينما بقية الصفحات تستخدم `users`؛ تم التوحيد على `users`.
- توحيد اسم الـ bucket على `mygram-media`.
- لم يكن في المستودع أي ملف SQL؛ أُضيف `supabase/migrations/20261024000000_mygram_core.sql`.
- أُضيف `.nojekyll` وملف الفحص `tests/check.js` وworkflow يشغّله.

## التثبيت
1. **افحص البيانات القديمة أولاً** في Supabase SQL Editor: `select count(*) from public.users; select count(*) from public.messages;` وتأكد أن `users.id` من نوع `uuid`.
2. شغّل ملف الهجرة `supabase/migrations/20261024000000_mygram_core.sql` (آمن للتكرار ولا يحذف شيئاً).
3. Authentication ← URL Configuration: اجعل Site URL هو `https://mygram-db.github.io/mygram-app/` وأضفه مع `/home.html` إلى Redirect URLs.
4. ارفع محتويات مجلد `app/` إلى جذر المستودع (وليس ملف ZIP).
5. شغّل `node tests/check.js`.

## الحالة بصدق
مكتوب في الكود ولم يُختبر مباشرة على Supabase: التسجيل والدخول، إنشاء الملف تلقائياً، تعديل الملف والصور، المنشورات، التفاعلات، التعليقات، طلبات الصداقة، القصص، الريلز، الرسائل المباشرة (بدون realtime).
غير منفّذ: المجموعات، الصفحات، الإشعارات، الحظر والإبلاغ، الوقت الحقيقي، استعادة كلمة المرور، مساعد الذكاء الاصطناعي. البث المباشر مجرد عنصر نائب.

## استكشاف الأخطاء
- فشل الرفع: لم تُشغَّل الهجرة (الـ bucket والسياسات غير موجودة).
- الدخول ينجح لكن الملف فارغ: شغّل قسم backfill من الهجرة.
- رابط تأكيد البريد يفتح عنواناً خاطئاً: صحّح URL Configuration.

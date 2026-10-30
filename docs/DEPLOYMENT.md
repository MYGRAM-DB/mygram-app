# النشر وCI/CD

## 1. الحالة الحالية

- `main` هو الفرع الافتراضي.
- عند بداية التدقيق كان HEAD هو `d75fbdb6bf6f47ae70ffd1e975eaf9ba12ee7a61`، ورسالة الـcommit: `chore: clear legacy MYGRAM application for clean rebuild`.
- شجرة هذا الـcommit فارغة.
- إعداد حماية `main` وفحوصه المطلوبة غير مفعّل.
- PR رقم 30 مغلق وغير مدمج.
- فرع إعادة البناء الحالي مخصص لتأسيس الكود والاختبارات، وليس نشر إصدار إنتاجي.

## 2. سير التغيير

1. يبدأ العمل بفرع واضح من `main`.
2. يراجع التغيير ويختبر في بيئة Staging.
3. يفتح PR يتضمن وصفاً واختبارات ومخاطر وخطة رجوع.
4. لا يدمج أي تغيير فاشل أو Migration غير مراجعة.
5. لا يُنشر Production تلقائياً من التغييرات التأسيسية.
6. بعد اعتماد بوابات المستودع المطلوبة، يدمج إصدار جاهز إلى `main`.
7. ينشر Production فقط من إصدار اجتاز بوابات الإصدار المعتمدة.
8. ينفذ Smoke test بعد النشر ويسجل النتيجة.

## 3. CI الحالي

ملف `.github/workflows/ci.yml` ينفذ على PRs إلى main وpush إلى main:
- Node.js 22.16.0.
- إنشاء package-lock مؤقتاً داخل CI من الإصدارات المباشرة المثبتة.
- تثبيت الحزم عبر `npm ci`.
- اختبارات سجل المنتجات.
- TypeScript validation.
- Vite production build.
- رفع package-lock المولد كـArtifact مؤقت لتثبيته في المستودع بعد التحقق.

هذا الـWorkflow **لا ينشر إلى Production**. ملف النشر سينشأ بعد اجتياز اختبارات التطبيق والمصادقة والبيانات.

## 4. Staging وProduction

- مشروع Supabase `MYGRAM-STAGING` منفصل عن `MYGRAM-DB`.
- Staging غير مكافئ حالياً لمخطط Production: 6 جداول و14 لغة ولا Edge Functions.
- يجب ترحيل schema وEdge Functions والإعدادات اللازمة إلى Staging تدريجياً عبر Migrations موثقة.
- لا تُنسخ بيانات Production الشخصية إلى Staging بلا حاجة وصلاحية وإجراء حماية مناسب.

## 5. متطلبات CI المقبلة

- تثبيت package-lock نهائي وملتزم به.
- تدقيق TypeScript/JavaScript.
- Unit + Integration.
- Playwright Desktop + Mobile.
- اختبارات RLS على قاعدة اختبار.
- فحص الأسرار والاعتماديات.
- بناء الحزمة.
- منع النشر عند فشل بوابة مطلوبة.

## 6. تنبيه Supabase

أعلنت Supabase عن إزالة مجموعة فرعية قديمة من TLS 1.2 CBC ابتداءً من 10 نوفمبر 2026 على أقرب تقدير من تاريخ الإعلان. يجب استخدام متصفحات وأنظمة تشغيل ومكتبات TLS مدعومة. لا يؤثر ذلك على TLS 1.3 وفق الإعلان.

المصدر: [Supabase TLS deprecation notice](https://supabase.com/changelog/cbc-tls-ciphers-deprecated).

## 7. شروط الإطلاق

لا ينفذ نشر Production قبل:
- نجاح جميع اختبارات Staging المرتبطة بالتغيير.
- التحقق من RLS والبيانات.
- فحص الأسرار والأذونات.
- اختبار البريد والهاتف والمكالمات التي يعتمد عليها الإصدار.
- مراجعة Migration وخطة Rollback.
- نجاح Smoke بعد النشر.

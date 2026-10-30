# النشر وCI/CD

## 1. الحالة الحالية

- `main` هو الفرع الافتراضي.
- عند بداية التدقيق كان HEAD هو `d75fbdb6bf6f47ae70ffd1e975eaf9ba12ee7a61`، ورسالة الـcommit: `chore: clear legacy MYGRAM application for clean rebuild`.
- شجرة هذا الـcommit فارغة.
- لا يوجد فرع عمل آخر في GitHub عند الفحص.
- إعداد حماية `main` وفحوصه المطلوبة غير مفعّل.
- PR رقم 30 مغلق وغير مدمج. لا توجد PRs مفتوحة عند الفحص.
- لذلك لا توجد نسخة تطبيق على `main` يمكن اعتبارها صالحة للنشر الآن.

## 2. سير التغيير

1. يبدأ العمل بفرع واضح من `main`.
2. يراجع التغيير ويختبر في بيئة Staging.
3. يفتح PR يتضمن وصفاً واختبارات ومخاطر وخطة رجوع.
4. لا يدمج أي تغيير فاشل أو Migration غير مراجعة.
5. بعد تفعيل بوابات المستودع المطلوبة، يُدمج إلى `main`.
6. ينشر Production فقط بعد نجاح بوابات الاختبار.
7. ينفذ Smoke test بعد النشر ويسجل النتيجة.

## 3. Staging وProduction

- مشروع Supabase `MYGRAM-STAGING` منفصل عن `MYGRAM-DB`.
- Staging غير مكافئ حالياً لمخطط Production: 6 جداول و14 لغة ولا Edge Functions.
- يجب ترحيل schema وEdge Functions والإعدادات اللازمة إلى Staging تدريجياً عبر Migrations موثقة.
- لا تُنسخ بيانات Production الشخصية إلى Staging بلا حاجة وصلاحية وإجراء حماية مناسب.

## 4. متطلبات CI المستقبلية

- تدقيق TypeScript/JavaScript.
- تثبيت حزم بإصدارات مقفلة وlockfile ملتزم به.
- Unit + Integration.
- Playwright Desktop + Mobile.
- اختبارات RLS على قاعدة اختبار.
- فحص الأسرار والاعتماديات.
- بناء الحزمة.
- عدم نشر PR previews إلى Production.
- منع النشر عند فشل بوابة مطلوبة.

## 5. تنبيه Supabase

أعلنت Supabase عن إزالة مجموعة فرعية قديمة من TLS 1.2 CBC ابتداءً من 10 نوفمبر 2026 على أقرب تقدير من تاريخ الإعلان. يجب استخدام متصفحات وأنظمة تشغيل ومكتبات TLS مدعومة. لا يؤثر ذلك على TLS 1.3 وفق الإعلان.

المصدر: [Supabase TLS deprecation notice](https://supabase.com/changelog/cbc-tls-ciphers-deprecated).

## 6. شروط الإطلاق

لا ينفذ نشر Production قبل:
- نجاح جميع اختبارات Staging المرتبطة بالتغيير.
- التحقق من RLS والبيانات.
- فحص الأسرار والأذونات.
- اختبار البريد والهاتف والمكالمات التي يعتمد عليها الإصدار.
- مراجعة Migration وخطة Rollback.
- نجاح Smoke بعد النشر.

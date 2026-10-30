# سجل التغييرات

## 2026-10-30 | المرحلة A/B: التأسيس، الاختبارات، وقفل الاعتماديات

- إنشاء React وTypeScript وVite shell مع مسارات Hash.
- إضافة سجل مركزي للمنتجات التسعة واختبارات Node.
- إضافة خمسة اختبارات Playwright أولية.
- نجاح CI run #8: Node 4/4، Playwright 5/5، TypeScript، Vite build.
- توليد `package-lock.json` من package.json والالتزام به في الفرع؛ تم تحويل CI إلى `npm ci` من القفل.
- نجاح CI run #13 بعد اعتماد القفل: `npm ci` وNode وPlaywright وTypeScript وVite build.
- بقي PR #54 Draft وغير مدموج، ولا يوجد نشر Production.

## 2026-10-30 | Staging schema alignment phase 1

- تطبيق Migration `20261030022611_align_staging_core_schema_phase_1` على مشروع MYGRAM-STAGING فقط.
- إضافة حقول الملف الشخصي والتفضيلات، علاقة التعليقات المتداخلة، حدود النص، حقل توافق اللغات، وفهارس تغطية للمفاتيح الأجنبية.
- الاحتفاظ بأعمدة وقيود Staging الإضافية، بما فيها قيد username وفهرس التفرد غير الحساس لحالة الأحرف.
- إعادة فحص الأعمدة والقيود والفهارس والصفوف وRLS بعد Migration.
- لم تُعدّل Production أو بيانات مستخدميها أو سياساتها. لم تتغير سياسات Staging أو Auth أو Storage أو Edge Functions.
- انتقال `supported_locales.enabled` ما زال توافقياً؛ سياسة Staging الحالية تقرأ `is_active`.

## 2026-10-30 | المرحلة A: التدقيق الأولي

- تم فحص مشروعي Supabase Production وStaging بوضع القراءة فقط قبل مواءمة المرحلة الأولى.
- تم توثيق اختلاف 51 جدولاً عاماً في Production مقابل 6 في Staging، وخمس Edge Functions مقابل صفر.
- لم تُنسخ بيانات مستخدمين حقيقية من Production إلى Staging.

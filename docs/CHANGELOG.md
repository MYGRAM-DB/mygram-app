# سجل التغييرات

## 2026-10-30 | المرحلة A/B: التأسيس والاختبارات
- إنشاء React وTypeScript وVite shell مع مسارات Hash.
- إضافة سجل مركزي للمنتجات التسعة واختبارات Node.
- إضافة خمسة اختبارات Playwright أولية.
- نجاح CI #8 وCI #13: npm ci، Node 4/4، Playwright 5/5، TypeScript، Vite build.
- الالتزام بـpackage-lock.json وتشغيل CI من القفل نفسه.
- بقي PR #54 Draft وغير مدموج، ولا يوجد نشر Production.

## 2026-10-30 | Staging schema alignment phase 1
- تطبيق Migration 20261030022611_align_staging_core_schema_phase_1 على Staging فقط.
- إضافة حقول onboarding والتفضيلات وعلاقة التعليقات وحدود النص وفهارس FK.
- الاحتفاظ بأعمدة وقيود Staging الإضافية.
- عدم تغيير سياسات RLS أو Auth أو Storage أو Edge Functions.

## 2026-10-30 | Staging schema alignment phase 2
- تطبيق Migration 20261030023659_create_private_profile_details_and_stage_countries على Staging فقط.
- إنشاء جدول profile_private_details مع RLS للمالك فقط وصلاحيات أعمدة تمنع العميل من تغيير حقول التحقق.
- إنشاء جدول supported_countries وإدخال 205 سجلات مرجعية عامة من Production، دون نسخ أي بيانات مستخدمين.
- التحقق من عدد الدول، حقول الجدول، سياسات RLS، والصلاحيات.
- بقي PR #54 Draft وغير مدموج. لم يحدث أي تعديل على Production.

## 2026-10-30 | اختبارات صلاحيات أولية
- اختبار PostgreSQL role/claim بهويتين منفصلتين على profiles/posts/comments/reactions/user_preferences في Staging.
- منع تغيير/حذف/إنشاء صفوف الغير، والسماح بقراءة المحتوى وفق السياسات الحالية.
- تنفيذ جميع الكتابات الاختبارية داخل معاملة Rollback والتحقق من عدم بقاء الصفوف.
- اختبار JWT عبر Auth REST ما زال مطلوباً.


## 2026-10-30 | onboarding and username validation foundation
- فصل التسجيل الأولي إلى البريد وكلمة المرور فقط.
- إضافة مسار onboarding محمي للحسابات التي لم تكمل profile_completed.
- إضافة قائمة اختيار الدول من supported_countries (205 دولة في Staging).
- إضافة تحقق وتطبيع username في وحدة مستقلة واختبارات Node.
- إضافة نموذج حفظ يستدعي complete_mygram_profile، التي تحفظ الملف العام والتفاصيل الخاصة وتفضيلات الموقع في معاملة واحدة وتستمد الهوية من auth.uid().
- إضافة اختبارات Playwright لحماية المسار؛ لا تزال رحلة Auth الحقيقية والحفظ عبر REST بحاجة إلى اختبار E2E.
- CI run 40994126414 أخضر على commit b2ad90a2d9bd86917c44f59c7b038060651b22ea: npm ci، Node 8/8، Playwright 6/6، TypeScript وVite build.
- لا تغيير في Production، ولا نشر، ولا دمج PR #54.

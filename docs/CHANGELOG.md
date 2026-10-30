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

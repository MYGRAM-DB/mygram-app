# MYGRAM | Everything You Need Is Here

منظومة MYGRAM تُعاد هندستها لتضم تسعة منتجات مستقلة وظيفياً بهوية موحدة وخدمات مشتركة.

## الهيكل البرمجي الأولي

- React 19.3.1 + TypeScript 7.0.2 + Vite 8.3.5.
- لوحة تأسيسية تعرض المنتجات التسعة من سجل بيانات موحد.
- مسارات Hash لتناسب الاستضافة الثابتة على GitHub Pages.
- العربية وRTL افتراضياً في هذه المرحلة.
- الوضع الداكن افتراضياً مع تبديل إلى الوضع الفاتح.
- تهيئة Supabase Auth بالبريد الإلكتروني عند إعداد متغيرات البيئة.
- اختبارات Node للتحقق من سجل المنتجات التسعة.
- GitHub Actions للتحقق من TypeScript والاختبارات وبناء الحزمة.
- لا يوجد نشر آلي إلى Production في هذه المرحلة.

## تنبيه الحالة

البطاقات والمسارات الحالية هي هيكل تنقل وتعريف بالحالة، وليست منتجات مكتملة. المنتجات الموسومة PARTIAL لديها أجزاء من قاعدة البيانات أو الخدمات السابقة، لكن الواجهة الجديدة والاختبارات المتكاملة لم تكتمل. المنتجات الموسومة NOT IMPLEMENTED لم يبدأ تنفيذها.

واجهة اللغة في الهيكل الحالي عربية فقط. دعم 60 لغة كاملاً لم يُنجز بعد ولا يُدّعى هنا.

## التشغيل المحلي

المتطلبات: Node.js 22.12+ وnpm.

```bash
cp .env.example .env
# أضف VITE_SUPABASE_URL و VITE_SUPABASE_PUBLISHABLE_KEY
npm install
npm test
npm run build
npm run dev
```

استخدم Publishable Key فقط في المتصفح. لا تضع Service Role Key في متغير يبدأ بـ`VITE_` أو في أي كود عميل.

## النشر

يُنتج Vite مجلد `dist/` ويضبط المسار العام إلى `/mygram-app/`. لا يوجد نشر Production تلقائي من هذا الفرع. يجب اجتياز بوابات الاختبارات وStaging قبل اعتماد سير نشر الإنتاج.

## وثائق المشروع

ابدأ من [ARCHITECTURE](docs/ARCHITECTURE.md)، [DATABASE](docs/DATABASE.md)، [SECURITY](docs/SECURITY.md)، [AUTH](docs/AUTH.md)، [LOCALIZATION](docs/LOCALIZATION.md)، [TESTING](docs/TESTING.md)، [DEPLOYMENT](docs/DEPLOYMENT.md)، [ROLLBACK](docs/ROLLBACK.md)، [WALLET](docs/WALLET.md)، و[STATUS](docs/STATUS.md).

# MYGRAM Secure Test Activation Runbook
تاريخ الإصدار: 2026-10-30

## الهدف

تفعيل الاختبارات الحقيقية التي تظهر حالياً Skipped في GitHub Actions:
- حسابان JWT + Auth/RLS/Storage.
- ثلاثة حسابات JWT + Messenger REST/Storage/Realtime isolation.

لا تشارك كلمات المرور في دردشة أو commit. أدخلها مباشرة في GitHub Actions Secrets فقط.

## 1. تأكد أن حسابات الاختبار مخصصة لـStaging

مشروع Supabase المستهدف:
- MYGRAM-STAGING
- Ref: cbyvtehvaojxfcgpelir
- URL: https://cbyvtehvaojxfcgpelir.supabase.co

يلزم حسابان مستقلان لاختبار Auth/RLS/Storage، وثلاثة حسابات مستقلة A/B/C لاختبار Messenger.
يمكن إعادة استخدام الحسابين A وB ضمن الاختبارين فقط إذا كانا حسابي QA مخصصين، مع عدم استخدام حسابات Production أو حسابات شخصية تحمل بيانات حقيقية.

تنبيه مهم: الاختبار القديم tests/authz.integration.mjs يستدعي complete_mygram_profile لكل من A وB ويكتب ملفاً/تفاصيل خاصة دائمة للحسابين. لا تفعّله على حساب شخصي. يلزم تخصيص حسابين للاختبار وقبول أن يصبح ملفهما QA، أو تعديل الاختبار ليجهز سجلات خاصة مؤقتة وينظفها قبل استخدامه.

اختبار Messenger يترك عمداً fixture ثابتة: محادثة A/B ورسالتان وكائن مرفق. شغّله فقط على حسابات QA مخصصة.

## 2. أضف Repository Variable

في GitHub:
MYGRAM-DB/mygram-app → Settings → Secrets and variables → Actions → Variables

أضف:
- MYGRAM_STAGING_URL = https://cbyvtehvaojxfcgpelir.supabase.co

## 3. أضف Repository Secrets

في GitHub:
MYGRAM-DB/mygram-app → Settings → Secrets and variables → Actions → Secrets

أضف المفتاح العام القابل للنشر من مشروع Staging، لا Service Role ولا Secret API key:
- MYGRAM_STAGING_PUBLISHABLE_KEY

للاختبار الثنائي:
- MYGRAM_TEST_USER_A_EMAIL
- MYGRAM_TEST_USER_A_PASSWORD
- MYGRAM_TEST_USER_B_EMAIL
- MYGRAM_TEST_USER_B_PASSWORD

للاختبار الثلاثي:
- MYGRAM_MESSENGER_USER_A_EMAIL
- MYGRAM_MESSENGER_USER_A_PASSWORD
- MYGRAM_MESSENGER_USER_B_EMAIL
- MYGRAM_MESSENGER_USER_B_PASSWORD
- MYGRAM_MESSENGER_USER_C_EMAIL
- MYGRAM_MESSENGER_USER_C_PASSWORD

## 4. أضف مفاتيح تشغيل الاختبارات

في Settings → Secrets and variables → Actions → Variables أضف:
- MYGRAM_STAGING_AUTHZ_TESTS = true
- MYGRAM_MESSENGER_ABC_TESTS = true

بعد حفظ القيم، أعد تشغيل workflow أو ادفع commit إصلاح لاحق إلى PR #54. إذا كانت الحسابات والأسرار صحيحة سيبدأ GitHub تنفيذ الخطوتين بدلاً من Skip.

## 5. تفسير نتائج التشغيل

JWT/Auth:
- PASS فقط إذا نجح password sign-in للحسابين وأعاد هويتين مختلفتين، ونجحت عمليات profile/Storage المسموحة ورُفضت المحاولات المتقاطعة.
- لا يُعد فحص SQL claims بديلاً عن هذا الاختبار.

Messenger:
- PASS فقط إذا A وB سجلا الدخول بهويتين مختلفتين عن C، وتمكنا من إنشاء/قراءة المحادثة وإرسال الرسائل وقراءة مرفقها.
- يجب أن يرى C صفراً من المحادثة والعضوية والرسائل وmetadata.
- يجب أن يُرفض تنزيل المرفق، وانتحال sender_id، وإضافة C لنفسه، والاشتراك في قناة Realtime.
- الخطأ أو timeout في Realtime يعني FAIL، وليس Skip أو نجاحاً ضمنياً.

## 6. الحدود

- لا تستخدم sb_secret أو service_role.
- لا تضع أسرار في package.json أو .env committed أو workflow YAML.
- لا تشغّل الاختبارات على Production.
- لا تستخدم حسابات شخصية أو بيانات مستخدم حقيقية.
- لا تُدمج PR #54 بعد الاختبارات مباشرة؛ يلزم مراجعة التقرير الكامل وبوابة release مستقلة.

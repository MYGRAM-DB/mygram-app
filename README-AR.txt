MYGRAM — إعادة بناء الواجهة

الملفات في جذر الحزمة: index.html, styles.css, app.js, .nojekyll.
ارفع محتويات ZIP إلى جذر مستودع GitHub، وليس مجلد MYGRAM_REBUILD نفسه.

تنبيه: هذه الحزمة تستبدل ملفات الموقع الأمامية فقط. لا تحذف مشروع Supabase أو قاعدة البيانات أو الجداول؛ هذا لا يتم برفع ملفات الموقع.
GitHub Pages ينشر ملفات HTML/CSS/JS فقط، أما المصادقة والبيانات والتخزين فتعتمد على Supabase.

تتوقع الواجهة الجداول profiles, posts, stories, post_reactions, post_comments, direct_messages, reels. قد تختلف أعمدة posts أو direct_messages في قاعدة البيانات الفعلية، لذلك يجب اختبار كل ميزة بعد النشر.
رفع الصور/الفيديو يحتاج Storage buckets باسم post-media وstory-media وreels مع سياسات Storage آمنة. لا تضع مفتاح service_role في app.js. المفتاح الموجود هو Publishable key.

هذه نسخة أولية مبنية من الصفر، وليست ضمانًا بعدم وجود أخطاء أو بأن كل ميزات قاعدة البيانات متوافقة دون اختبارها على مشروع Supabase الفعلي.

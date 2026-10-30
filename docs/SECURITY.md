# الأمن والصلاحيات

## 1. قواعد لا تقبل الاستثناء

- RLS مفعّل على كل جدول في schema مكشوفة.
- الصلاحية تتحدد عبر GRANT وسياسة RLS معاً.
- لا تُستخدم user_metadata القابلة لتعديل المستخدم كمرجع صلاحيات.
- لا يظهر Service Role Key أو أي سر خادم في JavaScript أو ملفات عامة أو سجلات.
- لا تُعطّل RLS لحل خطأ وصول.
- كل UPDATE يحتاج سياسة قراءة متوافقة وقيود USING وWITH CHECK حسب الحالة.
- الروابط الخاصة للوسائط تكون قصيرة العمر ومقصورة على المالك أو المشاركين.

## 2. خط الأساس المقاس

- جميع الجداول العامة الـ51 في Production عليها RLS.
- لا يُسمح لـanon بقراءة جداول المحتوى والرسائل الخاصة وفق جرد GRANT الحالي؛ قوائم الدول واللغات وكتالوج الترجمة لها قراءة عامة مقصودة.
- لا توجد سياسة عامة بديلة تلغي الحاجة إلى فحص سياسات كل جدول.
- جميع الجداول العامة الـ12 الحالية في Staging عليها RLS.
- Production يحتوي حاوية mygram-media العامة وحاوية mygram-private-messages الخاصة وفق جرد Production السابق؛ لا تُستخدم هذه الحاويات لاختبارات Staging.
- Staging يحتوي حاويتين خاصتين: profile-avatars وmessenger-attachments. لا توجد حاويات عامة في Staging.
- حاوية profile-avatars تحد حجم الملف إلى 5 MiB وتقبل JPEG وPNG وWebP وAVIF فقط.

## 3. مراجعة SECURITY DEFINER

مستشار Supabase أظهر ثلاثة RPCs عامة متاحة للمستخدم المسجل:
- public.join_meeting(text,text)
- public.transfer_meeting_chair(uuid,uuid,text)
- public.update_meeting_status(uuid,text)

مراجعة أجسام الوظائف أظهرت فحوصاً لـauth.uid()، وقيوداً على صلاحيات المضيف/الرئيس، وانتقالات حالة الاجتماع. هذا فحص أولي وليس اعتماداً أمنياً. يجب إضافة اختبارات سلبية وإيجابية للتحقق من:
- مستخدم غير عضو أو بلا جلسة.
- مستخدم ليس مضيفاً ولا رئيساً.
- مشارك مغادر أو غير نشط.
- اجتماع منتهٍ أو ملغى.
- محاولات سباق أو إعادة طلب متكرر.

لا تُحوّلها إلى SECURITY INVOKER أو تسحب صلاحية EXECUTE قبل التحقق من تأثير ذلك على التدفق المشروع. تبقى ملاحظة المستشار مفتوحة إلى أن تنجح الاختبارات ويعاد تشغيل الفحص.

## 4. الدوال الخاصة

بعض دوال private المساعدة من نوع SECURITY DEFINER أظهرت EXECUTE لـanon في جرد Postgres. كونها في schema خاصة يقلل التعرض عبر Data API، لكنه لا يلغي ضرورة مراجعة صلاحيات schema ووجود أي مسار اتصال مباشر إليها. تُراجع دوال Trigger وHelpers وتُسحب الصلاحيات غير اللازمة في Migration مستقلة بعد اختبارها.

## 5. ملفات المستخدمين

- public.profiles هو جدول الأساس الداخلي؛ تم سحب صلاحية SELECT المباشرة منه عن anon وauthenticated. سياسة RLS على الجدول تقصر SELECT على صاحب الصف كحاجز دفاعي إضافي.\n- public.public_profiles هو View عام آمن للمستخدمين المصادقين: يعرض الهوية والاسم والنبذة والصورة والاهتمامات والجنسية العامة، ويُرجع بلد/منطقة/مدينة الإقامة NULL ما لم يوافق صاحب الملف. لا يتضمن study_place أو work_place أو profile_completed.\n- public.my_profile_state يعرض id وprofile_completed للحساب الحالي فقط عبر auth.uid().\n- فحص Staging داخل دور authenticated أكد: القراءة المباشرة من profiles مرفوضة؛ public_profiles يعرض 3 صفوف عامة؛ my_profile_state يعرض صفاً واحداً للحساب الحالي؛ حقول الدراسة والعمل غير موجودة في الإسقاط العام؛ ومعلومات السكن غير ظاهرة دون موافقة.\n- App.tsx يقرأ حالة الإكمال من my_profile_state، وMessengerWorkspace يقرأ المستخدمين من public_profiles.
- profile_private_details وحقول التفضيلات نطاق أكثر حساسية، مع سياسات صفوف تربط الوصول بـauth.uid().
- تم التحقق مباشرة من أن authenticated لا يملك UPDATE على العمودين verified_contact_method وcontact_verified_at، ولا يملك anon ذلك أيضاً.
- منح INSERT/UPDATE على profile_private_details محدود بأعمدة البيانات غير المرتبطة بإثبات التحقق؛ لا توجد صلاحية جدولية عامة للكتابة على كل الأعمدة.
- تم إغلاق خطر القراءة المباشرة من profiles في Staging عبر Migration 20261030171814_secure_public_profile_projection: سُحبت SELECT من الجدول الأساسي عن anon وauthenticated، وأضيف View public_profiles يعرض الأعمدة العامة فقط ويعيد حقول السكن NULL ما لم يوافق صاحب الملف عبر show_living_location. وأضيف View my_profile_state لإظهار profile_completed للحساب الحالي فقط. لا يحتوي الإسقاط العام على study_place أو work_place أو profile_completed.\n- التحقق بدور authenticated أكد أن SELECT المباشر على profiles مرفوض، وأن public_profiles متاح، وأن my_profile_state يعيد صفاً واحداً للمستخدم نفسه. يجب اختبار REST/JWT الفعلي لاحقاً قبل الدمج.
- يلزم معالجة تعارضات أسماء المستخدمين قبل تثبيت ضمان تفرد موحد في Production.

## 6. ضوابط RPC استكمال الملف

- complete_mygram_profile تعمل SECURITY DEFINER مع search_path فارغ، وتؤهل كل مرجع جدول/دالة باسم المخطط.
- EXECUTE مسحوب من PUBLIC وanon، وممنوح authenticated فقط.
- هوية الصفوف تُشتق من auth.uid()؛ لا يقبل RPC معرف مستخدم يرسله العميل.
- الحفظ ذري عبر profiles وprofile_private_details وuser_preferences.
- حقول إثبات البريد والهاتف لا تُكتب من هذه RPC ولا من حقول النموذج.
- Supabase Security Advisor يرصد authenticated_security_definer_function_executable على هذه الدالة. التحذير متوقع لأن التطبيق يحتاج استدعاء RPC للمستخدم المصادق لحفظ عدة جداول وحقول خاصة ذرياً؛ لا تُلغَ صلاحية authenticated عشوائياً لأن ذلك يعطل onboarding.
- قبول المخاطر مشروط بمراجعة كود الدالة، search_path الفارغ، تأهيل المراجع، اشتقاق الهوية من auth.uid()، التحقق الصارم من المدخلات، سحب EXECUTE من PUBLIC وanon، ثم اختبارات JWT فعلية قبل الدمج.
- تحذير auth_leaked_password_protection ما زال قائماً؛ لم يتم تفعيله أو الالتفاف عليه.

## 7. تخزين صور الملف الشخصي في Staging

Migration 20261030030822_profile_avatars_storage_security أنشأت bucket خاصة باسم profile-avatars وأربع سياسات على storage.objects:
- SELECT: المالك فقط.
- INSERT: المالك فقط.
- UPDATE: المالك فقط، مع تحقق USING وWITH CHECK.
- DELETE: المالك فقط.
- يجب أن يبدأ مسار الكائن بمعرف المستخدم: <auth.uid()>/<filename>.
- لا يسمح بالوصول العام أو anonymous.
- يجب استخدام signed URLs أو تنزيل مصادق عليه عند العرض.
- تم التحقق من وجود bucket خاصة، وحد 5 MiB، وأنواع MIME المسموحة، ووجود السياسات الأربع، وعدم وجود bucket عامة في Staging.
- لم تُنفذ بعد عمليات رفع/قراءة/تعديل/حذف فعلية عبر JWT؛ اختبار التكامل أدناه هو بوابة ذلك ولا يُعد نجاحاً قبل تشغيله بحسابين مستقلين.

## 8. اختبارات التكامل عبر JWT

أضيف tests/authz.integration.mjs وأمر npm run test:integration. الاختبار يستخدم حسابين مخصصين ومؤكدين مسبقاً في Staging، ومفتاح publishable فقط، ويغطي:
- تسجيل دخول مستقل لكل حساب والحصول على JWT مختلف.
- استكمال ملف كل حساب عبر RPC.
- قراءة التفاصيل الخاصة للمالك ومنع الحساب الآخر من قراءتها.
- منع تعديل الملف والتفاصيل الخاصة للحساب الآخر.
- رفض محاولات كتابة حقول إثبات البريد والهاتف.
- رفع صورة خاصة وقراءتها وتحديثها من المالك، ومنع المستخدم الآخر من قراءتها أو رفع ملف داخل مجلد المالك أو حذفه.
- تنظيف كائنات Storage التجريبية في finally.

يشغّل CI هذا الاختبار فقط عند تفعيل متغير المستودع MYGRAM_STAGING_AUTHZ_TESTS=true وتوفير المتغيرات/الأسرار التالية في GitHub Actions:
- Variable: MYGRAM_STAGING_URL
- Secrets: MYGRAM_STAGING_PUBLISHABLE_KEY، MYGRAM_TEST_USER_A_EMAIL، MYGRAM_TEST_USER_A_PASSWORD، MYGRAM_TEST_USER_B_EMAIL، MYGRAM_TEST_USER_B_PASSWORD.

الحسابان يجب أن يكونا حسابي QA مخصصين ومؤكدَي البريد في Staging، وليس حسابات حقيقية أو حسابات Production. الاختبار يغير بيانات الملف واسم المستخدم لهذين الحسابين ثم يزيل ملفات Storage المؤقتة. لا يحتاج إلى Service Role Key. لم يتم تشغيله بعد لعدم توفر حسابي QA مستقلين كأسرار CI.

هذا الاختبار لا يثبت تسليم رسالة تأكيد البريد إلى صندوق وارد فعلياً؛ اختبار SMTP/رسالة التأكيد وإعادة التعيين يبقى مساراً مستقلاً يحتاج صندوقي بريد يمكن الوصول إليهما.

## 9. ملاحظات أمنية حالية

- Supabase Advisor يرصد حماية كلمات المرور المسرّبة غير مفعّلة. لا تُفعّل عبر التفاف غير موثوق؛ يوثّق ذلك كخطر، وتُستخدم سياسات كلمات المرور وحدود المحاولات وCAPTCHA حيث تتوفر كطبقات إضافية.
- فهارس Messenger الخاصة بالمفاتيح الأجنبية أضيفت إلى Staging، ولم يعد Advisor يعرض unindexed_foreign_keys. تبقى unused_index INFO في بيئة لا تحمل نشاطاً إنتاجياً.
- لا تُحذف الفهارس التي تظهر غير مستخدمة في Advisor اعتماداً على تقرير منفرد أو قاعدة بيانات قليلة النشاط.

## 10. الاختبارات الإلزامية المتبقية

- اختبار Auth signup وemail confirmation وتسليم الرسالة عبر SMTP فعلي.
- اختبار UI login/onboarding، إضافة إلى REST/JWT.
- اختبار Storage integration بحسابين مستقلين وتشغيله في CI.
- اختبار RLS SELECT/INSERT/UPDATE/DELETE لكل دور مناسب.
- فحص صلاحيات Edge Functions وJWT.
- Rate limiting، والتحقق من المدخلات، وحدود الحجم والنوع.
- تدقيق الأسرار وسجلات الأخطاء.

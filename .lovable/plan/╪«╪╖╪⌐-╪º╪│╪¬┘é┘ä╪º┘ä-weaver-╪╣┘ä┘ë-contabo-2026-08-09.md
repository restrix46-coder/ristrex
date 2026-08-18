# خطة استقلال Weaver على Contabo

## الهدف
نشر Weaver بالكامل على الخادم `194.163.155.52` بدون اعتماد على Lovable Cloud للاستضافة أو Supabase للبيانات/الدخول. قاعدة البيانات تكون Postgres محلي داخل Docker، والدخول يكون بالرمز السري فقط (WEAVER_PASSCODE) عبر جلسة JWT محلية.

## الحالة الحالية
- التطبيق يعمل على Lovable Cloud ويستخدم Supabase Auth و Supabase Data API.
- مفتاح `SUPABASE_SERVICE_ROLE_KEY` غير قابل للنقل إلى الخادم الخارجي، لذلك لا يمكن نشر التطبيق مباشرة وهو يعتمد على Supabase Admin.
- الاتصال بالخادم Contabo يعمل (SSH بمفتاح Ed25519).

## المراحل

### المرحلة 1: دخول محلي بديل
1. إنشاء `src/lib/auth/jwt.ts` لتوقيع/تحقيق رموز JWT.
2. تحديث `src/lib/passcode.functions.ts`: بدلاً من `supabaseAdmin.auth.admin.generateLink`، يُصدر رمز JWT لمرة واحدة.
3. تحديث `src/routes/auth.tsx`: بدلاً من `supabase.auth.verifyOtp`، يُرسل الرمز إلى الخادم للتحقق ويحفظ الجلسة في كوكي.
4. إنشاء `src/lib/auth/session.ts` لقراءة الجلسة من الكوكي واستخدامها في دوال الخادم.

### المرحلة 2: قاعدة بيانات محلية
1. إضافة حزمة `postgres` (أو `pg`) كعميل Postgres للخادم.
2. كتابة `deploy/db/init/01-schema.sql` لإنشاء الجداول الأساسية:
   - `projects`, `messages`, `specs`, `tasks`, `runs`, `executors`, `files`, `file_versions`, `checkpoints`, `project_memory`, `project_secrets`, `custom_skills`, `bots`, `scheduled_jobs`, `site_views`, `site_reactions`.
3. إنشاء `src/lib/db/postgres.ts` لإدارة الاتصال والاستعلامات.
4. تحديث `src/lib/chat-auth.server.ts` ليُرجع عميل Postgres بدلاً من `SupabaseClient`.

### المرحلة 3: تحويل طبقة البيانات
1. استبدال `supabaseAdmin` في المسارات والوظائف الرئيسية بـ SQL مباشر عبر `src/lib/db/postgres.ts`.
2. تبدأ الملفات الأكثر أهمية:
   - `src/routes/_authenticated/route.tsx` (التحقق من الدخول).
   - `src/routes/_authenticated/app.tsx` (قائمة المشاريع).
   - `src/routes/_authenticated/c/$threadId.tsx` (الدردشة والملفات).
   - `src/lib/serve-site.server.ts` (عرض المواقع المنشورة).
   - `src/routes/api/public/executor/$action.ts` (التنفيذ الخارجي).
3. نقل منطق RLS إلى التطبيق (التحقق من أن المستخدم هو المالك).

### المرحلة 4: تحويل قواعد بيانات المشاريع (wv_<id>)
1. تعديل `src/lib/target-supabase.server.ts` ليستخدم Postgres المحلي بدلاً من Supabase RPC.
2. إنشاء مخططات `wv_<id>` داخل قاعدة البيانات المحلية باستخدام `CREATE SCHEMA`.
3. تطبيق `GRANT` مناسب للخدمة داخل Postgres.

### المرحلة 5: النشر على Contabo
1. تعديل `deploy/nginx/nginx.conf` ليعمل على HTTP باستخدام IP (بدون SSL مؤقتًا) أو بالدومين عند تحديده لاحقًا.
2. تحديث `deploy/.env` بقيم محلية: `DATABASE_URL`, `POSTGRES_*`, `OPENROUTER_API_KEY`, `WEAVER_PASSCODE`, `WEAVER_OWNER_EMAIL`, `EXECUTOR_TOKEN`.
3. تشغيل `deploy.sh` لنقل الملفات وبناء التطبيق.
4. التحقق من أن التطبيق يعمل على `http://194.163.155.52`.

### المرحلة 6: ترحيل البيانات (اختياري لاحقًا)
- إذا أراد المستخدم نقل المشاريع القديمة من Supabase إلى Postgres المحلي، يُنفّذ ترحيل يدوي باستخدام `pg_dump` و `pg_restore` بعد اكتمال الاستقلال.

## النتيجة المتوقعة
- Weaver يعمل على `194.163.155.52`.
- دخول برمز سري فقط.
- قاعدة بيانات محلية داخل الخادم.
- لا حاجة لـ Lovable Cloud Supabase للتشغيل.

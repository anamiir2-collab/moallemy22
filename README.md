# مُعلّمي | Moallemy

نظام إدارة متكامل **أونلاين** للمدرسين في مصر — إدارة الطلاب والمجموعات والحصص والحضور والمدفوعات والتقارير — مبني على **Supabase** مع دعم كامل للعمل دون اتصال (Offline-first).

## المميزات

- ✅ **عربي بالكامل + RTL** — تصميم أصلي من اليمين لليسار
- ✅ **حسابات حقيقية سحابية** — تسجيل دخول بـ **رقم الهاتف + PIN** أو **البريد الإلكتروني + كلمة مرور** عبر Supabase Auth
- ✅ **استعادة كلمة المرور** — رابط إعادة تعيين يصل إلى بريد حسابات البريد الإلكتروني
- ✅ **مزامنة سحابية** — بياناتك على كل أجهزتك (Supabase PostgreSQL + RLS)
- ✅ **أمان RLS** — كل معلم يرى ويعدّل بياناته **فقط** (مفروض على مستوى قاعدة البيانات)
- ✅ **Offline-first** — التطبيق يعمل دون إنترنت، والتغييرات تُرفع تلقائيًا عند عودة الاتصال
- ✅ **PWA** — قابل للتثبيت كتطبيق على الهاتف
- ✅ **وضع داكن** — Light / Dark Mode
- ✅ **وضع تجريبي** — بيانات تجريبية محلية لا تُزامن مع السحابة

## الدخول: هاتف + PIN أو بريد + كلمة مرور

شاشة الدخول والتسجيل فيها مبدّل: **بالهاتف** (الافتراضي) أو **بالبريد**.

### 1) الهاتف + PIN (كما هي تمامًا)

الواجهة كما هي تمامًا (رقم هاتف + رمز مرور). داخليًا يتحول النظام إلى حساب Supabase:

| الواجهة | الداخلية |
|---------|----------|
| رقم الهاتف `01012345678` | بريد صناعي ثابت `01012345678@phone.moallemy.app` |
| PIN (4-6 أرقام) | كلمة مرور مشتقة قوية (لا يُخزَّن PIN مكشوفًا أبدًا) |

بهذا يمكن الدخول من **أي جهاز** برقم الهاتف نفسه، وبريد الاسترداد (اختياري في نموذج التسجيل) يُحفظ في ملف المعلم.

### 2) البريد الإلكتروني + كلمة مرور (جديد)

- حساب بريد حقيقي في Supabase Auth — البريد هو الهوية وكلمة المرور 6 أحرف على الأقل
- رابط **نسيت كلمة المرور؟** يرسل رسالة إعادة تعيين إلى البريد
- فتح الرابط يعيد فتح التطبيق بنموذج «تعيين كلمة مرور جديدة» ثم الدخول تلقائيًا
- رقم الهاتف اختياري في حسابات البريد (للتواصل والتقارير فقط)

> الحسابان منفصلان تمامًا: حساب الهاتف لا يتحول لبريد تلقائيًا، والعكس. بيانات كل معلم محمية بـ RLS عبر `teacher_id` مهما كانت طريقة الدخول.

## إعداد Supabase

الإعدادات موجودة مركزيًا في `js/supabase-config.js`:

```js
SUPABASE_URL = 'https://secejwjzxfjgjozpteld.supabase.co'
SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_...'   // مفتاح عام آمن بحكم RLS
```

**تنبيه أمني:** المفتاح أعلاه Publishable Key وهو مُصمَّم ليكون ظاهرًا في الواجهة — الحماية الحقيقية من سياسات **RLS** في قاعدة البيانات. يُمنع منعًا باتًا وضع أي **Service Role Key** في هذا المشروع أو في GitHub.

### المخطط والسياسات
`supabase/schema.sql` يحتوي توثيقًا كاملًا للمخطط (16 جدولًا بنمط JSONB موحّد) وسياسات RLS وTrigger إنشاء ملف المعلم تلقائيًا — استخدمه لإعادة الإعداد على أي مشروع آخر.

### متطلبات لوحة التحكم
- Authentication → Providers → Email: **تعطيل Confirm email** (حتى يعمل دخول الهاتف + PIN والتسجيل الفوري بالبريد دون تأكيد).
- **روابط إعادة تعيين كلمة المرور:** Authentication → URL Configuration → أضف رابط موقعك إلى **Redirect URLs** (مثل `https://<username>.github.io/moallemy/`) حتى يعود المستخدم للتطبيق بعد فتح الرابط.
- لإضافة مستخدمي جدد لا شيء مطلوب — التسجيل مفتوح من شاشة إنشاء الحساب.

## بنية المزامنة

```
Storage (LocalStorage Cache)  ←→  Cloud.js  ←→  Supabase
      كتابة فورية                    طابور Dirty      upsert/delete
      تعمل أوفلاين                   debounce 2.5s     Last-Write-Wins
```

- كل تعديل يُكتب محليًا فورًا ثم يُوسم ويُرفع خلال ~2.5 ثانية (أو فور عودة الاتصال)
- عند الدخول من جهاز جديد: سحب كامل ثم دمج (آخر كتابة تفوز بحسب `updatedAt`)
- "مسح جميع البيانات" من الإعدادات يمسح الجهاز **والسحابة** معًا

## النشر على GitHub Pages

1. ارفع محتويات المشروع إلى مستودع GitHub (بدون `node_modules/`)
2. Settings → Pages → Branch: `main` / Folder: `/root`
3. التطبيق سيعمل على `https://<username>.github.io/<repo>/`

لا حاجة لأي خطوة build — مكتبة Supabase مضمّنة محليًا في `js/vendor/supabase.js`.

> ملاحظة: الحزم `@supabase/ssr` ومكوّن shadcn الخاص بـ Next.js مُثبّتان في `package.json` حسب الطلب، لكنهما غير مستخدمين في كود الواجهة لأن المشروع Vanilla JS عمدًا (انظر الالتزام بالبنية الحالية).

## التشغيل محليًا

```bash
cd moallemy
python3 -m http.server 8000
# افتح http://localhost:8000
```

## البنية

```
moallemy/
├── index.html              # الصفحة الرئيسية
├── manifest.json           # PWA manifest
├── service-worker.js       # Service Worker (v1.1.0 — يخزّن ملفات Supabase أيضًا)
├── package.json            # @supabase/supabase-js + @supabase/ssr
├── supabase/
│   └── schema.sql          # توثيق المخطط + RLS + Trigger
├── scripts/
│   └── copy-supabase-umd.js  # نسخ حزمة UMD إلى js/vendor (postinstall)
├── css/                    # (كما هي — بدون تعديل)
├── js/
│   ├── vendor/
│   │   └── supabase.js     # حزمة supabase-js UMD محلية (بدون CDN)
│   ├── supabase-config.js  # الملف المركزي للاتصال بـ Supabase
│   ├── storage.js          # التخزين المحلي (Cache) + خطاف وسم المزامنة
│   ├── cloud.js            # محرك المزامنة (رفع/سحب/LWW/طابور أوفلاين)
│   ├── auth.js             # المصادقة عبر Supabase Auth + Demo Data
│   ├── app.js              # App Shell + Routing + UI helpers
│   ├── dashboard.js        # (كما هي كل صفحات التطبيق)
│   ├── students.js / groups.js / lessons.js / attendance.js
│   ├── assignments.js / exams.js / payments.js / reports.js
│   ├── calendar.js / notifications.js
│   └── settings.js         # الإعدادات + حالة المزامنة + تغيير PIN آمن
└── assets/icons/           # أيقونات PWA
```

## ما الذي تغيّر في هذه النسخة (v1.1.0)

| الملف | الحالة | السبب |
|-------|--------|-------|
| js/supabase-config.js | جديد | ملف الاتصال المركزي |
| js/cloud.js | جديد | محرك المزامنة السحابية |
| js/vendor/supabase.js | جديد | حزمة UMD محلية للأوفلاين وGitHub Pages |
| package.json | جديد | تثبيت الحزم الرسمية |
| supabase/schema.sql | جديد | توثيق المخطط وسياسات RLS |
| scripts/copy-supabase-umd.js | جديد | أتمتة نسخ الحزمة |
| .gitignore | جديد | استثناء node_modules |
| js/auth.js | معدّل | مصادقة سحابية حقيقية (هاتف+PIN) + ترحيل البيانات القديمة |
| js/storage.js | معدّل | خطاف إبلاغ Cloud عند كل تغيير |
| js/app.js | معدّل | انتظار استعادة الجلسة قبل إظهار الشاشة |
| js/settings.js | معدّل | صف حالة المزامنة + تغيير PIN آمن + مسح سحابي |
| index.html | معدّل | سكربتات Supabase الثلاثة |
| service-worker.js | معدّل | v1.1.0 + الملفات الجديدة في الكاش |
| css/* + باقي وحدات الصفحات | بدون تعديل | الواجهة والوظائف كما هي 100% |

## التقنيات

- HTML5, CSS3 (Variables, Grid, Flexbox)
- JavaScript ES6+ (Vanilla, no frameworks)
- Supabase (PostgreSQL + Auth + RLS)
- Chart.js للرسوم البيانية
- PWA (manifest + service worker)

## الإصدار

1.1.0 — سبتمبر 2026 — التحول لنظام أونلاين عبر Supabase

# مُعلّمي | Moallemy

نظام إدارة متكامل للمدرسين في مصر — إدارة الطلاب والمجموعات والحصص والحضور والمدفوعات والتقارير.

## المميزات

- ✅ **عربي بالكامل + RTL** — تصميم أصلي من اليمين لليسار
- ✅ **Mobile First** — مصمم للهاتف أولًا ثم التابلت والديسكتوب
- ✅ **PWA** — قابل للتثبيت كتطبيق على الهاتف مع دعم Offline
- ✅ **حفظ البيانات** — LocalStorage مع إمكانية الاستبدال بقاعدة بيانات سحابية
- ✅ **وضع داكن** — Light / Dark Mode
- ✅ **بدون backend** — يعمل بالكامل في المتصفح

## الوحدات

| الوحدة | الوظائف |
|--------|---------|
| الرئيسية | إحصائيات، حصص اليوم، تنبيهات، إجراءات سريعة |
| الطلاب | بحث، فلاتر، ملف طالب كامل، إحصائيات فردية |
| المجموعات | إنشاء، حصص متكررة، تبويبات (طلاب/حصص/اختبارات/مدفوعات) |
| الحصص | جدولة، بدء حصة، تسجيل حضور سريع |
| الحضور | تسجيل، تنبيهات الغياب المتكرر، سجل |
| الاختبارات | إضافة، إدخال درجات، متوسطات، إحصائيات |
| الواجبات | تكليف، متابعة التسليم، درجات |
| المدفوعات | دفعات، إيصالات، تقارير مالية |
| التقارير | تقرير طالب/مجموعة، تحليلات، WhatsApp |
| التقويم | شهري/أسبوعي/يومي مع أحداث |
| الإعدادات | حساب، أمان، نسخ احتياطي JSON/CSV |

## النشر على GitHub Pages

1. ارفع محتويات مجلد `moallemy/` إلى مستودع GitHub
2. اذهب لإعدادات المستودع → Pages
3. اختر Branch: `main` و Folder: `/root`
4. حفظ — التطبيق سيعمل على `https://<username>.github.io/<repo>/`

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
├── service-worker.js       # Service Worker (offline cache)
├── css/
│   ├── style.css           # CSS Variables + base
│   ├── components.css      # مكوّنات قابلة لإعادة الاستخدام
│   ├── animations.css      # حركات
│   └── responsive.css      # Mobile → Tablet → Desktop
├── js/
│   ├── storage.js          # طبقة التخزين (LocalStorage)
│   ├── auth.js             # مصادقة + Onboarding + Demo Data
│   ├── app.js              # App Shell + Routing + UI helpers
│   ├── dashboard.js        # الصفحة الرئيسية
│   ├── students.js         # الطلاب
│   ├── groups.js           # المجموعات
│   ├── lessons.js          # الحصص
│   ├── attendance.js       # الحضور
│   ├── assignments.js      # الواجبات
│   ├── exams.js            # الاختبارات
│   ├── payments.js         # المدفوعات
│   ├── reports.js          # التقارير
│   ├── calendar.js         # التقويم
│   ├── notifications.js    # الإشعارات
│   └── settings.js         # الإعدادات
└── assets/icons/           # أيقونات PWA
```

## التطوير المستقبلي

طبقة Storage مُصممة بحيث يمكن استبدالها بـ Supabase / Firebase دون إعادة بناء التطبيق. كل الوظائف تستخدم `Storage.get/set/list/insert/update/removeById` فقط.

## التقنيات

- HTML5, CSS3 (Variables, Grid, Flexbox)
- JavaScript ES6+ (Vanilla, no frameworks)
- Chart.js (CDN) للرسوم البيانية
- Google Fonts (Cairo)
- PWA (manifest + service worker)

## الإصدار

1.0.0 — سبتمبر 2026

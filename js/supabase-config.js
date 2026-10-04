/* ============================================
   مُعلّمي | supabase-config.js
   الملف المركزي للاتصال بـ Supabase
   --------------------------------------------
   ملاحظة أمنية: المفتاح أدناه Publishable Key
   وهو مُصمَّم ليكون عامًا (مثل Firebase API Key).
   الأمان الحقيقي يعتمد على RLS في قاعدة البيانات:
   كل معلم يرى ويعدّل بياناته فقط.
   ⚠️ ممنوع منعًا باتًا وضع أي Service Role Key هنا.
   ============================================ */

(function () {
  'use strict';

  // ===== الإعدادات =====
  const SUPABASE_URL = 'https://secejwjzxfjgjozpteld.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_yRvbXije9GeeLjMesgOTNw_hu35TSpe';

  // نطاق البريد الصناعي لدخول "هاتف + PIN"
  // كل حساب يُنشأ داخليًا كبريد: <رقم الهاتف>@PHONE_DOMAIN
  // هذا يحفظ واجهة الدخول الحالية (هاتف + PIN) دون أي تغيير في التصميم،
  // ويسمح بتسجيل الدخول من أي جهاز برقم الهاتف نفسه.
  const PHONE_DOMAIN = 'phone.moallemy.app';

  const SYNC_TABLES = [
    'students', 'groups', 'lessons', 'attendance',
    'assignments', 'submissions', 'exams', 'grades',
    'payments', 'evaluations', 'receipts',
    'notifications', 'announcements', 'settings'
  ];

  // ===== التحقق من تحميل مكتبة supabase-js =====
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('[Supabase] مكتبة supabase-js غير محمّلة — تحقق من js/vendor/supabase.js');
    window.SupabaseReady = false;
    return;
  }

  // ===== إنشاء العميل المركزي =====
  let client;
  try {
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,          // حفظ الجلسة في LocalStorage (يدعم الأوفلاين)
        autoRefreshToken: true,
        detectSessionInUrl: true,      // مطلوب لالتقاط جلسة رابط استعادة كلمة المرور (مطلوب لا يؤثر على الروابط العادية)
        storageKey: 'moallemy-auth'
      }
    });
    window.SupabaseReady = true;
  } catch (err) {
    console.error('[Supabase] فشل إنشاء العميل:', err);
    window.SupabaseReady = false;
  }

  // التقاط هاش الصفحة فورًا قبل أي معالجة داخلية للمكتبة
  // (روابط استعادة كلمة المرور تصل بهاش type=recovery قد تستهلكه المكتبة لاحقًا)
  window.__moallemyInitialHash = window.location.hash || '';

  // ===== أدوات مساعدة للربط هاتف+PIN مع Supabase Auth =====
  // بريد صناعي ثابت لكل رقم هاتف
  function phoneToEmail(phone) {
    return (phone || '').trim() + '@' + PHONE_DOMAIN;
  }

  // اشتقاق كلمة مرور قوية وثابتة من PIN (لا يُخزَّن PIN مكشوفًا أبدًا)
  // PIN (4-6 أرقام) + بادئة/لاحقة ثابتة = كلمة مرور 12+ حرفًا
  function pinToPassword(pin) {
    return 'mlmy#' + String(pin || '').trim() + '#2024';
  }

  // كشف نوع الحساب من بريد المصادقة المخزن في Supabase
  // حسابات الهاتف تُخزَّن داخليًا كبريد صناعي على نطاق PHONE_DOMAIN
  function isPhoneAccountEmail(email) {
    return String(email || '').toLowerCase().indexOf('@' + PHONE_DOMAIN) !== -1;
  }

  // ===== الواجهة العامة =====
  const SupabaseConfig = {
    url: SUPABASE_URL,
    anonKey: SUPABASE_PUBLISHABLE_KEY,
    tables: SYNC_TABLES,
    phoneDomain: PHONE_DOMAIN,
    phoneToEmail,
    pinToPassword,
    isPhoneAccountEmail,

    get client() { return client; },

    isReady() {
      return window.SupabaseReady === true && !!client;
    },

    // رسالة خطأ عربية موحدة لأخطاء المصادقة
    // mode: 'phone' (افتراضي) أو 'email' — لتخصيص نص الرسالة حسب طريقة الدخول
    authErrorMessage(err, mode) {
      const msg = (err && (err.message || err.error_description || err.msg)) || '';
      const isEmail = mode === 'email';
      if (/Invalid login credentials/i.test(msg)) return isEmail ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة' : 'رقم الهاتف أو رمز المرور غير صحيح';
      if (/Email not confirmed/i.test(msg)) return 'لم يتم تأكيد البريد الإلكتروني — تحقق من بريدك الإلكتروني (وبريد الرسائل غير المرغوبة)';
      if (/User already registered|already been registered/i.test(msg)) return isEmail ? 'هذا البريد مسجل بالفعل، جرّب تسجيل الدخول' : 'هذا الحساب مسجل بالفعل، جرّب تسجيل الدخول';
      if (/Password should be at least/i.test(msg)) return isEmail ? 'كلمة المرور قصيرة، استخدم 6 أحرف على الأقل' : 'رمز المرور ضعيف، استخدم 4 أرقام على الأقل';
      if (/Email address .* is invalid|looks invalid|invalid format/i.test(msg)) return isEmail ? 'البريد الإلكتروني غير صحيح' : 'رقم الهاتف غير صحيح';
      if (/Signup requires a valid password/i.test(msg)) return isEmail ? 'كلمة المرور مطلوبة' : 'رمز المرور مطلوب';
      if (/rate limit|too many requests/i.test(msg)) return 'محاولات كثيرة — انتظر قليلًا ثم حاول مرة أخرى';
      if (/Failed to fetch|NetworkError|load failed/i.test(msg)) return 'لا يوجد اتصال بالإنترنت — ستعمل البيانات محليًا وستُزامن تلقائيًا';
      return msg || 'حدث خطأ غير متوقع، حاول مرة أخرى';
    }
  };

  window.SupabaseConfig = SupabaseConfig;
})();

/* ============================================
   مُعلّمي | auth.js
   نظام المصادقة عبر Supabase Auth + Onboarding
   --------------------------------------------
   طريقتان للدخول:
   1) الهاتف + PIN — داخليًا: الهاتف يُحوَّل لبريد صناعي ثابت،
      وPIN يُشتق منه كلمة مرور قوية (لا يُخزَّن PIN مكشوفًا)
   2) البريد + كلمة مرور حقيقية (6 أحرف على الأقل)
      مع إعادة تعيين كلمة المرور عبر رابط بريدي
   - الجلسة تُحفظ محليًا (أوفلاين) وتُستعاد تلقائيًا
   - ترحيل تلقائي: بيانات النسخة المحلية القديمة تُرفع
     إلى الحساب عند أول تسجيل دخول/إنشاء حساب
   ============================================ */

const Auth = (function () {
  let currentTeacher = null;
  let restoring = null; // وعد استعادة الجلسة
  let loginMethod = 'phone'; // طريقة الدخول الحالية: phone | email
  let regMethod = 'phone';   // طريقة التسجيل الحالية: phone | email
  let recoveryPending = false; // جلسة قادمة من رابط استعادة كلمة المرور

  // ===== أدوات داخلية =====
  function sb() {
    return (window.SupabaseConfig && SupabaseConfig.isReady()) ? SupabaseConfig.client : null;
  }

  function authReady() {
    return !!(sb() && window.Cloud);
  }

  function setLoading(formId, on, textBusy) {
    const form = document.getElementById(formId);
    if (!form) return;
    const btn = form.querySelector('button[type="submit"]');
    if (!btn) return;
    if (on) {
      btn.dataset.origText = btn.textContent;
      btn.textContent = textBusy || 'جارٍ المعالجة...';
      btn.disabled = true;
    } else {
      btn.textContent = btn.dataset.origText || btn.textContent;
      btn.disabled = false;
    }
  }

  // جلب بيانات الحساب من teacher_profiles (لأجهزة جديدة بلا كاش)
  async function fetchProfileAsTeacher(user) {
    const c = sb();
    if (!c) return null;
    try {
      const { data, error } = await c.from('teacher_profiles')
        .select('name,phone,email,subject,stage,governorate,logo,bio,created_at')
        .eq('id', user.id).maybeSingle();
      if (error) return null;
      return {
        id: user.id,
        name: (data && data.name) || (user.user_metadata && user.user_metadata.full_name) || 'مدرس',
        subject: (data && data.subject) || '',
        stage: (data && data.stage) || null,
        governorate: (data && data.governorate) || null,
        phone: (data && data.phone) || (user.user_metadata && user.user_metadata.phone) || '',
        email: (data && data.email) || null,
        logo: (data && data.logo) || null,
        bio: (data && data.bio) || '',
        createdAt: (data && data.created_at) ? new Date(data.created_at).getTime() : Date.now(),
        updatedAt: Date.now()
      };
    } catch (_) {
      return null;
    }
  }

  // تنظيف كاش جهاز تابع لحساب آخر (خصوصية الأجهزة المشتركة)
  // لا يمسّ كاش نفس الحساب ولا بيانات الترحيل القديمة (t_) لنفس رقم الهاتف
  function clearLocalForOtherAccount(user, incomingPhone) {
    const cached = Storage.get(Storage.KEYS.teacher, null);
    if (!cached || !user) return false;
    const sameId = cached.id === user.id;
    const legacySamePhone = String(cached.id || '').indexOf('t_') === 0 &&
      incomingPhone && cached.phone === incomingPhone;
    if (sameId || legacySamePhone) return false;
    Cloud.suspend();
    Storage.clearAll();
    Cloud.resume();
    return true;
  }

  // استنتاج طريقة المصادقة من بريد المستخدم المخزن في Supabase
  function inferAuthMethod(user) {
    return SupabaseConfig.isPhoneAccountEmail(user && user.email) ? 'phone' : 'email';
  }

  // إثراء كائن المعلم ببيانات الهوية (طريقة الدخول + بريد المصادقة الفعلي)
  function withAuthInfo(teacher, user) {
    if (!teacher || !user) return teacher;
    const t = Object.assign({}, teacher);
    t.authMethod = inferAuthMethod(user);
    t.authEmail = user.email || '';
    if (t.authMethod === 'phone') {
      // استخراج رقم الهاتف من البريد الصناعي إن لم يوجد في الملف
      const fromEmail = String(t.authEmail).split('@')[0];
      if (!t.phone && fromEmail) t.phone = fromEmail;
    } else if (!t.email && t.authEmail) {
      t.email = t.authEmail;
    }
    return t;
  }

  // ترحيل بيانات النسخة المحلية القديمة إلى الحساب السحابي
  function migrateLegacyIfNeeded(user, phone) {
    const cached = Storage.get(Storage.KEYS.teacher, null);
    if (!cached) return;
    const samePhone = cached.phone === phone;
    const legacyId = cached.id && String(cached.id).indexOf('t_') === 0;
    if (samePhone && (legacyId || cached.id !== user.id)) {
      // نفس المعلم على هذا الجهاز قبل التحديث — اربط بياناته المحلية بحسابه السحابي وارفعها
      const updated = Object.assign({}, cached, {
        id: user.id,
        pin: undefined,           // لا يُخزَّن PIN مكشوفًا بعد الآن
        updatedAt: Date.now()
      });
      delete updated.pin;
      Storage.set(Storage.KEYS.teacher, updated);
      currentTeacher = updated;
      Cloud.syncEverything();
      UI.toast('تم رفع بياناتك المحلية إلى حسابك السحابي', 'success');
    }
  }

  // ===== الاستعادة عند فتح التطبيق =====
  function restoreSession() {
    if (restoring) return restoring;
    restoring = (async () => {
      const cached = Storage.get(Storage.KEYS.teacher, null);
      const demo = Storage.isDemoMode();

      // الوضع التجريبي يعمل محليًا دون حساب
      if (demo && cached) {
        currentTeacher = cached;
        return;
      }

      const c = sb();
      if (!c) { bindDone(); return; }

      try {
        // مهلة قصيرة حتى لا تعلق شاشة البداية عند الأوفلاين
        const session = await Promise.race([
          c.auth.getSession().then(res => (res.data && res.data.session) || null),
          new Promise(resolve => setTimeout(() => resolve(null), 4000))
        ]);

        if (session && session.user) {
          const user = session.user;
          const userPhone = (user.user_metadata && user.user_metadata.phone) ||
            (SupabaseConfig.isPhoneAccountEmail(user.email) ? String(user.email || '').split('@')[0] : '');
          const cachedIsLegacy = !!(cached && String(cached.id || '').indexOf('t_') === 0);
          if (cached && cached.id === user.id) {
            currentTeacher = cached; // استعادة سريعة من الكاش (أوفلاين ودّي)
          } else if (cached && !cachedIsLegacy) {
            // كاش حساب آخر على هذا الجهاز — امسحه واستعرض الملف من السحابة
            clearLocalForOtherAccount(user, userPhone);
            currentTeacher = await fetchProfileAsTeacher(user);
          } else {
            // بيانات ترحيل قديمة (t_) أو لا كاش — اسحب الملف السحابي مع إبقاء القديم للترحيل
            currentTeacher = await fetchProfileAsTeacher(user) || cached;
          }
          if (!currentTeacher) {
            currentTeacher = {
              id: user.id, name: 'مدرس', subject: '', phone: userPhone || '',
              createdAt: Date.now(), updatedAt: Date.now()
            };
          }
          if (currentTeacher.id !== user.id) currentTeacher.id = user.id;
          currentTeacher = withAuthInfo(currentTeacher, user);
          Storage.set(Storage.KEYS.teacher, currentTeacher);
          Storage.setDemoMode(false);
          Cloud.init(user.id, { silent: true });
        } else {
          currentTeacher = null;
        }
      } catch (err) {
        console.warn('[Auth] session restore:', err);
        currentTeacher = cached || null; // أوفلاين: الكاش المحلي كافٍ
      }
      bindDone();
    })();
    return restoring;
  }

  function bindDone() { /* علامة اكتمال الاستعادة (للاستخدام المستقبلي) */ }

  // ===== واجهة الوحدة =====
  function init() {
    const t = Storage.get(Storage.KEYS.teacher);
    if (t && t.id && Storage.isDemoMode()) {
      currentTeacher = t;
    }
    bindEvents();
    renderAuthForm();
    // رابط استعادة كلمة المرور؟ اعرض نموذج التعيين فورًا بدل شاشة الدخول
    if (checkRecoveryLink()) {
      showRecoveryScreen();
      return Promise.resolve();
    }
    return restoreSession();
  }

  // معالجة الهاش الوارد من رابط الاستعادة في البريد
  // الهاش يُلتقط مبكرًا في supabase-config.js قبل استهلاكه من المكتبة
  function checkRecoveryLink() {
    const h = (window.__moallemyInitialHash || location.hash || '');
    if (h.indexOf('type=recovery') !== -1) return true;
    if (h.indexOf('error_description=') !== -1 || h.indexOf('error=') !== -1) {
      const m = /error_description=([^&]+)/.exec(h);
      const desc = m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
      UI.toast(desc || 'رابط الاستعادة غير صالح أو منتهي — اطلب رابطًا جديدًا', 'error', 5000);
      try { history.replaceState(null, '', location.pathname + location.search); } catch (_) { }
    }
    return false;
  }

  function isLogged() { return !!currentTeacher && !recoveryPending; }
  function getTeacher() { return currentTeacher; }
  function isRestoring() { return !!restoring; }

  function logout() {
    UI.confirm('هل تريد تسجيل الخروج؟', async () => {
      try {
        if (authReady() && !Storage.isDemoMode()) {
          await Cloud.flush();               // ارفع المعلق قبل الخروج
          Cloud.suspend();
          await sb().auth.signOut();
        } else if (window.Cloud) {
          Cloud.suspend();
        }
      } catch (err) {
        console.warn('[Auth] logout:', err);
      }
      currentTeacher = null;
      Storage.clearAll();                    // خصوصية الأجهزة المشتركة — البيانات آمنة في السحابة
      location.reload();
    }, { title: 'تسجيل الخروج', confirmText: 'خروج', danger: false });
  }

  function updateTeacher(updates) {
    if (!currentTeacher) return null;
    currentTeacher = Object.assign({}, currentTeacher, updates, { updatedAt: Date.now() });
    Storage.set(Storage.KEYS.teacher, currentTeacher);
    return currentTeacher;
  }

  // التحقق من بيانات الاعتماد الحالية عبر إعادة المصادقة (آمن — بلا مقارنات محلية)
  // secret = PIN لحسابات الهاتف، أو كلمة المرور الحالية لحسابات البريد
  async function verifyCredential(secret) {
    const c = sb();
    if (!c || !currentTeacher) return false;
    try {
      const t = currentTeacher;
      const email = t.authMethod === 'email'
        ? t.authEmail
        : SupabaseConfig.phoneToEmail(t.phone);
      const password = t.authMethod === 'email'
        ? secret
        : SupabaseConfig.pinToPassword(secret);
      const { error } = await c.auth.signInWithPassword({ email, password });
      return !error;
    } catch (_) {
      return false;
    }
  }

  // تغيير بيانات الاعتماد = تحديث كلمة مرور Supabase
  // (حسابات الهاتف: PIN جديد يُشتق منه كلمة المرور — حسابات البريد: كلمة مرور جديدة مباشرة)
  async function changeCredential(current, next) {
    const c = sb();
    if (!c) return { ok: false, message: 'الخدمة السحابية غير متاحة حاليًا' };
    const method = (currentTeacher && currentTeacher.authMethod) || 'phone';
    const okCurrent = await verifyCredential(current);
    if (!okCurrent) {
      return { ok: false, message: method === 'email' ? 'كلمة المرور الحالية غير صحيحة' : 'الرمز الحالي غير صحيح' };
    }
    try {
      const password = method === 'email' ? next : SupabaseConfig.pinToPassword(next);
      const { error } = await c.auth.updateUser({ password });
      if (error) return { ok: false, message: SupabaseConfig.authErrorMessage(error, method) };
      return { ok: true };
    } catch (err) {
      return { ok: false, message: SupabaseConfig.authErrorMessage(err, method) };
    }
  }

  function renderAuthForm() {
    // Populate subjects
    const subjects = Storage.get(Storage.KEYS.subjects, []);
    const subSel = document.getElementById('reg-subject');
    if (subSel) {
      subSel.innerHTML = '<option value="">اختر المادة</option>' +
        subjects.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
    }

    // Stages
    const stages = Storage.get(Storage.KEYS.stages, []);
    const stageSel = document.getElementById('reg-stage');
    if (stageSel) {
      stageSel.innerHTML = '<option value="">الكل</option>' +
        stages.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    }

    // Governorates
    const govSel = document.getElementById('reg-gov');
    if (govSel) {
      govSel.innerHTML = '<option value="">اختر المحافظة</option>' +
        Seeds.governorates.map(g => `<option value="${g}">${g}</option>`).join('');
    }
  }

  function bindEvents() {
    // Tabs الرئيسية (دخول/تسجيل) — فقط الأزرار ذات data-tab حتى لا تتأثر مبدّلات الطريقة
    document.querySelectorAll('.auth-tab[data-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        document.querySelectorAll('.auth-tab[data-tab]').forEach(t => t.classList.toggle('active', t === tab));
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        document.getElementById(target + '-form').classList.add('active');
      });
    });

    // مبدّل طريقة الدخول (هاتف / بريد)
    const loginMethodWrap = document.getElementById('login-method');
    if (loginMethodWrap) {
      loginMethodWrap.querySelectorAll('.auth-tab').forEach(btn => {
        btn.addEventListener('click', () => setLoginMethod(btn.dataset.method));
      });
    }

    // مبدّل طريقة التسجيل (هاتف / بريد)
    const regMethodWrap = document.getElementById('reg-method');
    if (regMethodWrap) {
      regMethodWrap.querySelectorAll('.auth-tab').forEach(btn => {
        btn.addEventListener('click', () => setRegisterMethod(btn.dataset.method));
      });
    }

    // Login
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', handleLogin);
    }

    // Register
    const regForm = document.getElementById('register-form');
    if (regForm) {
      regForm.addEventListener('submit', handleRegister);
    }

    // نسيت كلمة المرور (حسابات البريد)
    const forgotBtn = document.getElementById('forgot-pass');
    if (forgotBtn) {
      forgotBtn.addEventListener('click', handleForgotPassword);
    }

    // نموذج تعيين كلمة مرور جديدة (من رابط الاستعادة)
    const recForm = document.getElementById('recovery-form');
    if (recForm) {
      recForm.addEventListener('submit', handleRecoverySubmit);
    }

    // Demo
    const demoBtn = document.getElementById('try-demo');
    if (demoBtn) {
      demoBtn.addEventListener('click', startDemoMode);
    }
  }

  // ===== مبدّل طريقة الدخول =====
  function setLoginMethod(method) {
    loginMethod = method === 'email' ? 'email' : 'phone';
    const wrap = document.getElementById('login-method');
    if (wrap) {
      wrap.querySelectorAll('.auth-tab').forEach(b => b.classList.toggle('active', b.dataset.method === loginMethod));
    }
    const isEmail = loginMethod === 'email';
    document.getElementById('login-phone-field').classList.toggle('hidden', isEmail);
    document.getElementById('login-email-field').classList.toggle('hidden', !isEmail);
    document.getElementById('login-pin-field').classList.toggle('hidden', isEmail);
    document.getElementById('login-password-field').classList.toggle('hidden', !isEmail);
    const forgot = document.getElementById('forgot-pass');
    if (forgot) forgot.classList.toggle('hidden', !isEmail);
    // متطلبات HTML تُفعَّل للحقول الظاهرة فقط حتى لا تعيق الإرسال
    document.getElementById('login-phone').required = !isEmail;
    document.getElementById('login-pin').required = !isEmail;
    document.getElementById('login-email').required = isEmail;
    document.getElementById('login-password').required = isEmail;
  }

  // ===== مبدّل طريقة التسجيل =====
  function setRegisterMethod(method) {
    regMethod = method === 'email' ? 'email' : 'phone';
    const wrap = document.getElementById('reg-method');
    if (wrap) {
      wrap.querySelectorAll('.auth-tab').forEach(b => b.classList.toggle('active', b.dataset.method === regMethod));
    }
    const isEmail = regMethod === 'email';
    document.getElementById('reg-pin-row').classList.toggle('hidden', isEmail);
    document.getElementById('reg-pass-row').classList.toggle('hidden', !isEmail);
    document.getElementById('reg-phone').required = !isEmail;
    document.getElementById('reg-email').required = isEmail;
    const phoneLabel = document.getElementById('reg-phone-label');
    const emailLabel = document.getElementById('reg-email-label');
    if (phoneLabel) phoneLabel.textContent = isEmail ? 'رقم الهاتف (اختياري)' : 'رقم الهاتف *';
    if (emailLabel) emailLabel.textContent = isEmail ? 'البريد الإلكتروني *' : 'البريد الإلكتروني (اختياري)';
  }

  // ===== تسجيل الدخول (هاتف+PIN أو بريد+كلمة مرور عبر Supabase) =====
  async function handleLogin(e) {
    e.preventDefault();
    const isEmail = loginMethod === 'email';
    const phone = document.getElementById('login-phone').value.trim();
    const pin = document.getElementById('login-pin').value.trim();
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;

    if (isEmail) {
      if (!email) { UI.toast('أدخل البريد الإلكتروني', 'error'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { UI.toast('البريد الإلكتروني غير صحيح', 'error'); return; }
      if (!password) { UI.toast('أدخل كلمة المرور', 'error'); return; }
    } else {
      if (!phone || !pin) { UI.toast('من فضلك أدخل رقم الهاتف ورمز المرور', 'error'); return; }
    }

    const c = sb();
    if (!c) {
      UI.toast('خدمة الدخول غير متاحة حاليًا — تحقق من الاتصال وأعد تحميل الصفحة', 'error');
      return;
    }

    setLoading('login-form', true, 'جارٍ الدخول...');
    try {
      const credentials = isEmail
        ? { email, password }
        : { email: SupabaseConfig.phoneToEmail(phone), password: SupabaseConfig.pinToPassword(pin) };
      const { data, error } = await c.auth.signInWithPassword(credentials);

      if (error) {
        // دعم كاش نفس الجهاز عند انقطاع الإنترنت فقط
        const cached = Storage.get(Storage.KEYS.teacher, null);
        const offline = !navigator.onLine;
        const cacheMatch = cached && (
          (isEmail && String(cached.email || '').toLowerCase() === email && String(cached.id || '').indexOf('t_') !== 0) ||
          (!isEmail && cached.phone === phone)
        );
        if (offline && cacheMatch) {
          currentTeacher = cached;
          UI.toast('وضع عدم الاتصال: تم الدخول من الذاكرة المحلية', 'info');
          onAuthSuccess();
          return;
        }
        UI.toast(SupabaseConfig.authErrorMessage(error, loginMethod), 'error');
        return;
      }

      const user = data.user;
      clearLocalForOtherAccount(user, isEmail ? '' : phone);

      // كاش نفس الجهاز؟
      const cached2 = Storage.get(Storage.KEYS.teacher, null);
      if (cached2 && cached2.id === user.id) {
        currentTeacher = cached2;
      } else {
        currentTeacher = await fetchProfileAsTeacher(user);
        if (currentTeacher) Storage.set(Storage.KEYS.teacher, currentTeacher);
      }
      if (!currentTeacher) {
        currentTeacher = isEmail
          ? { id: user.id, name: (user.user_metadata && user.user_metadata.full_name) || 'مدرس', subject: '', phone: '', email, createdAt: Date.now(), updatedAt: Date.now() }
          : { id: user.id, name: 'مدرس', subject: '', phone, createdAt: Date.now(), updatedAt: Date.now() };
        Storage.set(Storage.KEYS.teacher, currentTeacher);
      }
      currentTeacher = withAuthInfo(currentTeacher, user);
      Storage.set(Storage.KEYS.teacher, currentTeacher);

      Storage.setDemoMode(false);

      // مزامنة أولية ثم دخول التطبيق
      UI.toast('جارٍ تحميل بياناتك...', 'info', 1600);
      await Cloud.init(user.id, { silent: true });
      if (!isEmail) migrateLegacyIfNeeded(user, phone);
      onAuthSuccess();
    } catch (err) {
      UI.toast(SupabaseConfig.authErrorMessage(err, loginMethod), 'error');
    } finally {
      setLoading('login-form', false);
    }
  }

  // ===== إنشاء حساب جديد (هاتف+PIN أو بريد+كلمة مرور) =====
  async function handleRegister(e) {
    e.preventDefault();
    const isEmail = regMethod === 'email';
    const name = document.getElementById('reg-name').value.trim();
    const subject = document.getElementById('reg-subject').value;
    const stage = document.getElementById('reg-stage').value;
    const gov = document.getElementById('reg-gov').value;
    const phone = document.getElementById('reg-phone').value.trim();
    const email = document.getElementById('reg-email').value.trim().toLowerCase();
    const pin = document.getElementById('reg-pin').value.trim();
    const pin2 = document.getElementById('reg-pin2').value.trim();
    const pass = document.getElementById('reg-pass').value;
    const pass2 = document.getElementById('reg-pass2').value;

    // Validation
    if (!name || name.length < 3) { UI.toast('أدخل اسمًا صحيحًا', 'error'); return; }
    if (!subject) { UI.toast('اختر المادة', 'error'); return; }
    if (isEmail) {
      if (!email) { UI.toast('أدخل البريد الإلكتروني', 'error'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { UI.toast('البريد الإلكتروني غير صحيح', 'error'); return; }
      if (!pass || pass.length < 6) { UI.toast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error'); return; }
      if (pass !== pass2) { UI.toast('كلمتا المرور غير متطابقتين', 'error'); return; }
      if (phone && !/^01[0-2,5]\d{8}$/.test(phone)) { UI.toast('رقم الهاتف غير صحيح (مثال: 01012345678)', 'error'); return; }
    } else {
      if (!/^01[0-2,5]\d{8}$/.test(phone)) { UI.toast('رقم الهاتف غير صحيح (مثال: 01012345678)', 'error'); return; }
      if (pin.length < 4) { UI.toast('رمز المرور يجب أن يكون 4 أرقام على الأقل', 'error'); return; }
      if (pin !== pin2) { UI.toast('رمزا المرور غير متطابقين', 'error'); return; }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { UI.toast('البريد الإلكتروني غير صحيح', 'error'); return; }
    }

    const c = sb();
    if (!c) {
      UI.toast('خدمة إنشاء الحسابات غير متاحة حاليًا — تحقق من الاتصال', 'error');
      return;
    }

    setLoading('register-form', true, 'جارٍ إنشاء الحساب...');
    try {
      const signupEmail = isEmail ? email : SupabaseConfig.phoneToEmail(phone);
      const signupPassword = isEmail ? pass : SupabaseConfig.pinToPassword(pin);
      const { data, error } = await c.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        options: { data: { full_name: name, phone: phone } }
      });

      if (error) {
        UI.toast(SupabaseConfig.authErrorMessage(error, regMethod), 'error');
        return;
      }

      const user = data.user;
      if (!user || !data.session) {
        // تأكيد البريد مفعّل في Supabase — يجب فتح رسالة التأكيد أولًا
        UI.toast('تم إرسال رابط تأكيد إلى بريدك الإلكتروني — أكّده ثم سجّل الدخول', 'info', 5000);
        switchTab('login');
        setLoginMethod('email');
        const le = document.getElementById('login-email');
        if (le && email) le.value = email;
        return;
      }

      clearLocalForOtherAccount(user, isEmail ? '' : phone);

      const teacher = {
        id: user.id,
        name,
        subject,
        stage: stage || null,
        governorate: gov || null,
        phone: phone || '',
        email: email || null,
        logo: null,
        bio: '',
        authMethod: isEmail ? 'email' : 'phone',
        authEmail: user.email || signupEmail,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      Storage.set(Storage.KEYS.teacher, teacher);
      currentTeacher = teacher;
      Storage.setDemoMode(false);

      // حفظ بيانات الحساب في السحابة + رفع أي بيانات محلية قديمة لنفس الهاتف
      try {
        await c.from('teacher_profiles').upsert({
          id: user.id,
          name: teacher.name,
          phone: teacher.phone || null,
          email: teacher.email,
          subject: teacher.subject,
          stage: teacher.stage,
          governorate: teacher.governorate,
          logo: null,
          bio: '',
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
      } catch (perr) {
        console.warn('[Auth] profile upsert:', perr);
      }

      await Cloud.init(user.id, { silent: true });
      if (!isEmail) migrateLegacyIfNeeded(user, phone);
      Cloud.syncEverything();

      UI.toast('تم إنشاء الحساب بنجاح', 'success');
      setTimeout(onAuthSuccess, 600);
    } catch (err) {
      UI.toast(SupabaseConfig.authErrorMessage(err, regMethod), 'error');
    } finally {
      setLoading('register-form', false);
    }
  }

  function startDemoMode() {
    if (confirm('سيتم تحميل بيانات تجريبية. يمكنك مسحها لاحقًا من الإعدادات. متابعة؟')) {
      if (window.Cloud) Cloud.suspend();     // البيانات التجريبية لا تُزامن
      DemoData.load();
      const teacher = Storage.get(Storage.KEYS.teacher);
      currentTeacher = teacher;
      Storage.setDemoMode(true);
      UI.toast('تم تفعيل الوضع التجريبي', 'success');
      setTimeout(onAuthSuccess, 600);
    }
  }

  function switchTab(tab) {
    document.querySelectorAll('.auth-tab[data-tab]').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    document.getElementById(tab + '-form').classList.add('active');
  }

  // ===== نسيت كلمة المرور (حسابات البريد فقط) =====
  async function handleForgotPassword() {
    const input = document.getElementById('login-email');
    const email = ((input && input.value) || '').trim().toLowerCase();
    if (!email) {
      UI.toast('أدخل بريدك الإلكتروني في الحقل أعلاه ثم اضغط "نسيت كلمة المرور"', 'info', 3500);
      if (input) input.focus();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      UI.toast('البريد الإلكتروني غير صحيح', 'error');
      return;
    }
    const c = sb();
    if (!c) { UI.toast('الخدمة غير متاحة حاليًا — تحقق من الاتصال', 'error'); return; }
    const btn = document.getElementById('forgot-pass');
    const orig = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'جارٍ الإرسال...'; }
    try {
      const redirectTo = location.origin + location.pathname;
      const { error } = await c.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) {
        UI.toast(SupabaseConfig.authErrorMessage(error, 'email'), 'error');
      } else {
        UI.toast('إذا كان البريد مسجلًا فستصلك رسالة بها رابط إعادة تعيين كلمة المرور — تحقق من صندوق الوارد وبريد الرسائل غير المرغوبة', 'success', 6000);
      }
    } catch (err) {
      UI.toast(SupabaseConfig.authErrorMessage(err, 'email'), 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = orig; }
    }
  }

  // ===== شاشة تعيين كلمة مرور جديدة (من رابط البريد) =====
  function showRecoveryScreen() {
    recoveryPending = true;
    document.querySelectorAll('#auth-screen .auth-tabs').forEach(t => t.classList.add('hidden'));
    document.querySelectorAll('.auth-form').forEach(f => { f.classList.remove('active'); f.classList.add('hidden'); });
    const rec = document.getElementById('recovery-form');
    if (rec) { rec.classList.remove('hidden'); rec.classList.add('active'); }
    const demo = document.getElementById('try-demo');
    if (demo) demo.classList.add('hidden');
  }

  // العودة لشاشة الدخول العادية بعد إلغاء/انتهاء الاستعادة
  function showAuthScreenNormal() {
    recoveryPending = false;
    document.querySelectorAll('#auth-screen .auth-tabs').forEach(t => t.classList.remove('hidden'));
    const rec = document.getElementById('recovery-form');
    if (rec) { rec.classList.add('hidden'); rec.classList.remove('active'); }
    const loginForm = document.getElementById('login-form');
    if (loginForm) { loginForm.classList.remove('hidden'); loginForm.classList.add('active'); }
    const demo = document.getElementById('try-demo');
    if (demo) demo.classList.remove('hidden');
  }

  async function handleRecoverySubmit(e) {
    e.preventDefault();
    const pass = document.getElementById('recovery-pass').value;
    const pass2 = document.getElementById('recovery-pass2').value;
    if (!pass || pass.length < 6) { UI.toast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error'); return; }
    if (pass !== pass2) { UI.toast('كلمتا المرور غير متطابقتين', 'error'); return; }
    const c = sb();
    if (!c) { UI.toast('الخدمة غير متاحة حاليًا — تحقق من الاتصال', 'error'); return; }
    setLoading('recovery-form', true, 'جارٍ الحفظ...');
    try {
      const { error } = await c.auth.updateUser({ password: pass });
      if (error) {
        UI.toast(SupabaseConfig.authErrorMessage(error, 'email'), 'error');
        return;
      }
      recoveryPending = false;
      try { history.replaceState(null, '', location.pathname + location.search); } catch (_) { }
      UI.toast('تم تعيين كلمة المرور الجديدة بنجاح', 'success');
      // الجلسة جاهزة من رابط الاستعادة — ادخل التطبيق مباشرة
      const session = await c.auth.getSession();
      const user = session && session.data && session.data.session && session.data.session.user;
      if (user) {
        if (!currentTeacher || currentTeacher.id !== user.id) {
          const cached = Storage.get(Storage.KEYS.teacher, null);
          currentTeacher = (cached && cached.id === user.id)
            ? cached
            : (await fetchProfileAsTeacher(user) || { id: user.id, name: 'مدرس', subject: '', phone: '', createdAt: Date.now(), updatedAt: Date.now() });
          currentTeacher = withAuthInfo(currentTeacher, user);
          Storage.set(Storage.KEYS.teacher, currentTeacher);
          Storage.setDemoMode(false);
          await Cloud.init(user.id, { silent: true });
        }
        onAuthSuccess();
      } else {
        showAuthScreenNormal();
        switchTab('login');
        setLoginMethod('email');
      }
    } catch (err) {
      UI.toast(SupabaseConfig.authErrorMessage(err, 'email'), 'error');
    } finally {
      setLoading('recovery-form', false);
    }
  }

  function onAuthSuccess() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    if (typeof App !== 'undefined' && App.onAuthSuccess) {
      App.onAuthSuccess();
    }
  }

  return {
    init, isLogged, getTeacher, isRestoring, logout, updateTeacher,
    verifyPIN: verifyCredential, changePIN: changeCredential,
    setLoginMethod, setRegisterMethod, showRecoveryScreen, renderAuthForm
  };
})();

// ===== Demo Data =====
const DemoData = {
  load() {
    // Create teacher
    const teacher = {
      id: Storage.uid('t_'),
      name: 'أ/ أحمد محمود',
      subject: 'الرياضيات',
      stage: 'secondary',
      governorate: 'القاهرة',
      phone: '01012345678',
      email: 'ahmed@example.com',
      logo: null,
      bio: 'مدرس رياضيات للمرحلة الثانوية - خبرة 12 عامًا',
      createdAt: Date.now()
    };
    Storage.set(Storage.KEYS.teacher, teacher);

    // Subjects
    Seeds.ensureSeeds();

    // Create groups
    const groups = [
      { id: 'g1', name: 'مجموعة الأولى الثانوي - الأحد/الأربعاء', stageId: 'secondary', className: 'الأول الثانوي', subject: 'الرياضيات', section: 'علمي', days: ['sunday', 'wednesday'], time: '18:00', duration: 90, location: 'السنتر - قاعة 1', price: 600, maxStudents: 15, level: 'متوسط', notes: '' },
      { id: 'g2', name: 'مجموعة الثانية الثانوي - السبت/الثلاثاء', stageId: 'secondary', className: 'الثاني الثانوي', subject: 'الرياضيات', section: 'علمي', days: ['saturday', 'tuesday'], time: '17:00', duration: 120, location: 'السنتر - قاعة 2', price: 800, maxStudents: 12, level: 'متقدم', notes: '' },
      { id: 'g3', name: 'مجموعة الثالثة الإعدادي - الجمعة', stageId: 'preparatory', className: 'الثالث الإعدادي', subject: 'الرياضيات', section: 'عام', days: ['friday'], time: '16:00', duration: 90, location: 'السنتر - قاعة 3', price: 500, maxStudents: 20, level: 'متوسط', notes: '' }
    ];
    Storage.set(Storage.KEYS.groups, groups);

    // Create students
    const studentNames = [
      ['محمد أحمد علي', 'g1', 'نشط'],
      ['فاطمة محمد خالد', 'g1', 'نشط'],
      ['عبدالله محمود إبراهيم', 'g1', 'نشط'],
      ['سارة عمرو حسن', 'g1', 'نشط'],
      ['يوسف خالد سعيد', 'g2', 'نشط'],
      ['مريم أحمد فؤاد', 'g2', 'نشط'],
      ['علي حسن عبدالرحمن', 'g2', 'نشط'],
      ['حبيبة مصطفى كامل', 'g2', 'متوقف'],
      ['آدم شريف زكي', 'g3', 'نشط'],
      ['ملك وليد سالم', 'g3', 'نشط'],
      ['عمر هاني فتحي', 'g3', 'نشط'],
      ['جنى أيمن طلعت', 'g3', 'نشط']
    ];

    const students = studentNames.map((s, i) => ({
      id: 'st_' + (i + 1),
      name: s[0],
      groupId: s[1],
      stageId: groups.find(g => g.id === s[1]).stageId,
      className: groups.find(g => g.id === s[1]).className,
      section: groups.find(g => g.id === s[1]).section,
      subject: groups.find(g => g.id === s[1]).subject,
      school: 'مدرسة تجريبية',
      governorate: 'القاهرة',
      studentPhone: '',
      parentName: 'ولي أمر ' + s[0].split(' ')[0],
      parentPhone: '010' + (10000000 + i).toString(),
      subscriptionDate: new Date(Date.now() - (30 + i) * 86400000).toISOString().slice(0, 10),
      subscriptionAmount: groups.find(g => g.id === s[1]).price,
      status: s[2],
      notes: '',
      createdAt: Date.now() - (30 + i) * 86400000
    }));
    Storage.set(Storage.KEYS.students, students);

    // Lessons - generate for last 14 days and next 7 days
    const lessons = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let d = -14; d <= 7; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() + d);
      const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
      groups.forEach(g => {
        if (g.days.includes(dayName)) {
          const [h, m] = g.time.split(':').map(Number);
          const start = new Date(date);
          start.setHours(h, m, 0, 0);
          const end = new Date(start);
          end.setMinutes(end.getMinutes() + g.duration);
          const isPast = d < 0;
          const isToday = d === 0;
          lessons.push({
            id: 'l_' + lessons.length,
            groupId: g.id,
            date: date.toISOString().slice(0, 10),
            startTime: g.time,
            endTime: end.toTimeString().slice(0, 5),
            duration: g.duration,
            location: g.location,
            topic: '',
            notes: '',
            status: isPast ? 'completed' : (isToday ? 'scheduled' : 'scheduled'),
            createdAt: Date.now()
          });
        }
      });
    }
    Storage.set(Storage.KEYS.lessons, lessons);

    // Attendance for past lessons
    const attendance = [];
    lessons.filter(l => l.status === 'completed').forEach(l => {
      students.filter(s => s.groupId === l.groupId).forEach(s => {
        const rand = Math.random();
        let status = 'present';
        if (rand < 0.1) status = 'absent';
        else if (rand < 0.18) status = 'late';
        else if (rand < 0.22) status = 'excused';
        attendance.push({
          id: Storage.uid('att_'),
          lessonId: l.id,
          groupId: l.groupId,
          studentId: s.id,
          date: l.date,
          status,
          createdAt: Date.now()
        });
      });
    });
    Storage.set(Storage.KEYS.attendance, attendance);

    // Exams
    const exams = [
      { id: 'e1', name: 'اختبار الوحدة الأولى', groupId: 'g1', subject: 'الرياضيات', date: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10), topic: 'الجبر', maxGrade: 20, createdAt: Date.now() },
      { id: 'e2', name: 'اختبار شهري', groupId: 'g2', subject: 'الرياضيات', date: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10), topic: 'التفاضل', maxGrade: 30, createdAt: Date.now() },
      { id: 'e3', name: 'اختبار قصير', groupId: 'g3', subject: 'الرياضيات', date: new Date(Date.now() + 1 * 86400000).toISOString().slice(0, 10), topic: 'الهندسة', maxGrade: 15, createdAt: Date.now() }
    ];
    Storage.set(Storage.KEYS.exams, exams);

    // Grades
    const grades = [];
    exams.forEach(e => {
      const groupStudents = students.filter(s => s.groupId === e.groupId);
      groupStudents.forEach(s => {
        const score = Math.floor(Math.random() * (e.maxGrade - 5)) + 5;
        grades.push({
          id: Storage.uid('gr_'),
          examId: e.id,
          studentId: s.id,
          groupId: e.groupId,
          score,
          maxGrade: e.maxGrade,
          notes: '',
          createdAt: Date.now()
        });
      });
    });
    Storage.set(Storage.KEYS.grades, grades);

    // Assignments
    const assignments = [
      { id: 'a1', name: 'وحل تمارين صفحة 25', groupId: 'g1', topic: 'الجبر', assignedDate: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10), dueDate: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10), maxGrade: 10, createdAt: Date.now() },
      { id: 'a2', name: 'ملزمة المراجعة', groupId: 'g2', topic: 'التفاضل', assignedDate: new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 10), dueDate: new Date(Date.now() + 1 * 86400000).toISOString().slice(0, 10), maxGrade: 20, createdAt: Date.now() }
    ];
    Storage.set(Storage.KEYS.assignments, assignments);

    // Submissions
    const submissions = [];
    assignments.forEach(a => {
      students.filter(s => s.groupId === a.groupId).forEach(s => {
        const rand = Math.random();
        let status = 'submitted';
        if (rand < 0.2) status = 'not_submitted';
        else if (rand < 0.3) status = 'late';
        submissions.push({
          id: Storage.uid('sub_'),
          assignmentId: a.id,
          studentId: s.id,
          groupId: a.groupId,
          status,
          score: status === 'submitted' ? Math.floor(Math.random() * (a.maxGrade - 3)) + 3 : null,
          submittedAt: status === 'submitted' ? new Date().toISOString() : null,
          notes: '',
          createdAt: Date.now()
        });
      });
    });
    Storage.set(Storage.KEYS.submissions, submissions);

    // Payments
    const payments = [];
    students.forEach(s => {
      const g = groups.find(g => g.id === s.groupId);
      // Current month
      const monthStart = new Date();
      monthStart.setDate(1);
      const isPaid = Math.random() > 0.3;
      const isPartial = !isPaid && Math.random() > 0.5;
      payments.push({
        id: Storage.uid('pay_'),
        studentId: s.id,
        groupId: s.groupId,
        month: monthStart.toISOString().slice(0, 7),
        required: g.price,
        paid: isPaid ? g.price : (isPartial ? Math.floor(g.price * 0.5) : 0),
        method: 'كاش',
        date: isPaid || isPartial ? new Date(Date.now() - Math.random() * 10 * 86400000).toISOString().slice(0, 10) : null,
        notes: '',
        createdAt: Date.now()
      });
    });
    Storage.set(Storage.KEYS.payments, payments);

    // Notifications
    const notifications = [
      { id: Storage.uid('n_'), type: 'lesson', title: 'حصة اليوم', message: 'لديك 3 حصص مجدولة اليوم', read: false, createdAt: Date.now() - 3600000 },
      { id: Storage.uid('n_'), type: 'payment', title: 'مدفوعات مستحقة', message: '5 طلاب لم يسددوا رسوم هذا الشهر', read: false, createdAt: Date.now() - 7200000 },
      { id: Storage.uid('n_'), type: 'absence', title: 'تنبيه غياب', message: 'محمد أحمد غاب عن آخر 3 حصص', read: false, createdAt: Date.now() - 86400000 }
    ];
    Storage.set(Storage.KEYS.notifications, notifications);
  }
};

window.Auth = Auth;
window.DemoData = DemoData;

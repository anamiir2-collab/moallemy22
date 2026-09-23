/* ============================================
   مُعلّمي | auth.js
   Supabase Authentication + Onboarding
   ============================================ */

const Auth = (function () {
  'use strict';

  let currentTeacher = null;
  let initialized = false;
  let authListener = null;

  /* ============================================
     Helpers
     ============================================ */

  function getSupabase() {
    if (!window.supabaseClient) {
      console.error('Supabase client is not initialized.');
      return null;
    }

    return window.supabaseClient;
  }

  function normalizePhone(phone) {
    let value = String(phone || '').trim().replace(/\s+/g, '');

    if (value.startsWith('+20')) {
      return value;
    }

    if (value.startsWith('0020')) {
      return '+' + value.substring(2);
    }

    if (value.startsWith('20') && value.length === 12) {
      return '+' + value;
    }

    if (value.startsWith('0')) {
      return '+20' + value.substring(1);
    }

    return value;
  }

  function localPhone(phone) {
    const value = String(phone || '').trim();

    if (value.startsWith('+20')) {
      return '0' + value.substring(3);
    }

    return value;
  }

  function showLoading(button, text) {
    if (!button) return;

    if (!button.dataset.originalText) {
      button.dataset.originalText = button.innerHTML;
    }

    button.disabled = true;
    button.innerHTML = text || 'جاري التنفيذ...';
  }

  function hideLoading(button) {
    if (!button) return;

    button.disabled = false;

    if (button.dataset.originalText) {
      button.innerHTML = button.dataset.originalText;
      delete button.dataset.originalText;
    }
  }

  function getFormButton(form) {
    if (!form) return null;

    return form.querySelector(
      'button[type="submit"], input[type="submit"]'
    );
  }

  /* ============================================
     Init
     ============================================ */

  async function init() {
    bindEvents();
    renderAuthForm();

    const supabase = getSupabase();

    if (!supabase) {
      console.warn('Supabase غير متاح، سيتم استخدام الوضع المحلي فقط.');

      const localTeacher = Storage.get(Storage.KEYS.teacher);

      if (localTeacher && localTeacher.id) {
        currentTeacher = localTeacher;
      }

      initialized = true;

      if (currentTeacher) {
        onAuthSuccess();
      }

      return;
    }

    /*
      مراقبة حالة تسجيل الدخول من Supabase
    */
    if (!authListener) {
      const result = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log('Supabase Auth:', event);

          if (event === 'SIGNED_OUT') {
            currentTeacher = null;
            return;
          }

          if (
            session &&
            session.user &&
            (
              event === 'SIGNED_IN' ||
              event === 'INITIAL_SESSION' ||
              event === 'TOKEN_REFRESHED'
            )
          ) {
            await loadTeacherFromCloud(session.user);

            if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
              onAuthSuccess();
            }
          }
        }
      );

      authListener = result.data.subscription;
    }

    /*
      قراءة الجلسة الحالية
    */
    const {
      data: { session },
      error
    } = await supabase.auth.getSession();

    if (error) {
      console.error('getSession error:', error);
      initialized = true;
      return;
    }

    if (session && session.user) {
      await loadTeacherFromCloud(session.user);
      initialized = true;
      onAuthSuccess();
      return;
    }

    initialized = true;
  }

  /* ============================================
     Teacher / Profile
     ============================================ */

  async function loadTeacherFromCloud(user) {
    if (!user) return null;

    const supabase = getSupabase();

    if (!supabase) return null;

    try {
      /*
        تحميل بيانات المدرس من teacher_profiles
      */
      const { data, error } = await supabase
        .from('teacher_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('تحميل بيانات المدرس فشل:', error);
      }

      const metadata = user.user_metadata || {};

      const teacher = {
        id: user.id,

        name:
          data?.name ||
          metadata.name ||
          'مدرس',

        subject:
          data?.subject ||
          metadata.subject ||
          '',

        stage:
          data?.stage ||
          metadata.stage ||
          null,

        governorate:
          data?.governorate ||
          metadata.governorate ||
          null,

        phone:
          localPhone(
            data?.phone ||
            user.phone ||
            metadata.phone ||
            ''
          ),

        email:
          data?.email ||
          user.email ||
          metadata.email ||
          null,

        logo:
          data?.logo ||
          null,

        bio:
          data?.bio ||
          '',

        createdAt:
          data?.created_at ||
          user.created_at ||
          Date.now(),

        updatedAt:
          data?.updated_at ||
          Date.now()
      };

      currentTeacher = teacher;

      /*
        حفظ نسخة محلية للواجهة فقط.
        كلمة المرور / PIN لا يتم تخزينها.
      */
      Storage.set(Storage.KEYS.teacher, teacher);

      /*
        إخبار Storage بالمستخدم الحالي
        حتى يبدأ تحميل بياناته من Supabase.
      */
      if (
        typeof Storage.initCloud === 'function'
      ) {
        await Storage.initCloud(user.id);
      }

      return teacher;

    } catch (error) {
      console.error('loadTeacherFromCloud:', error);
      return null;
    }
  }

  function isLogged() {
    return !!currentTeacher;
  }

  function getTeacher() {
    return currentTeacher;
  }

  /* ============================================
     Logout
     ============================================ */

  async function logout() {
    const supabase = getSupabase();

    try {
      if (supabase) {
        const { error } = await supabase.auth.signOut();

        if (error) {
          console.error('Logout error:', error);
          UI.toast('حدث خطأ أثناء تسجيل الخروج', 'error');
          return;
        }
      }

      currentTeacher = null;

      Storage.remove(Storage.KEYS.teacher);

      if (
        typeof Storage.clearUserCache === 'function'
      ) {
        Storage.clearUserCache();
      }

      location.reload();

    } catch (error) {
      console.error('logout:', error);
      UI.toast('حدث خطأ أثناء تسجيل الخروج', 'error');
    }
  }

  /* ============================================
     Update Teacher
     ============================================ */

  async function updateTeacher(updates) {
    if (!currentTeacher) return null;

    const supabase = getSupabase();

    const updatedTeacher = {
      ...currentTeacher,
      ...updates,
      updatedAt: Date.now()
    };

    currentTeacher = updatedTeacher;

    /*
      تحديث النسخة المحلية
    */
    Storage.set(
      Storage.KEYS.teacher,
      updatedTeacher
    );

    /*
      تحديث Supabase
    */
    if (supabase && currentTeacher.id) {
      const profileUpdates = {
        name: updatedTeacher.name || null,
        subject: updatedTeacher.subject || null,
        stage: updatedTeacher.stage || null,
        governorate: updatedTeacher.governorate || null,
        phone: updatedTeacher.phone || null,
        email: updatedTeacher.email || null,
        logo: updatedTeacher.logo || null,
        bio: updatedTeacher.bio || null
      };

      const { error } = await supabase
        .from('teacher_profiles')
        .upsert(
          {
            id: currentTeacher.id,
            ...profileUpdates
          },
          {
            onConflict: 'id'
          }
        );

      if (error) {
        console.error(
          'تحديث بيانات المدرس فشل:',
          error
        );
      }
    }

    return currentTeacher;
  }

  /* ============================================
     Render Auth Forms
     ============================================ */

  function renderAuthForm() {
    /*
      Subjects
    */
    const subjects = Storage.get(
      Storage.KEYS.subjects,
      []
    );

    const subSel =
      document.getElementById('reg-subject');

    if (subSel) {
      subSel.innerHTML =
        '<option value="">اختر المادة</option>' +
        subjects
          .map(
            s =>
              `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`
          )
          .join('');
    }

    /*
      Stages
    */
    const stages = Storage.get(
      Storage.KEYS.stages,
      []
    );

    const stageSel =
      document.getElementById('reg-stage');

    if (stageSel) {
      stageSel.innerHTML =
        '<option value="">الكل</option>' +
        stages
          .map(
            s =>
              `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`
          )
          .join('');
    }

    /*
      Governorates
    */
    const govSel =
      document.getElementById('reg-gov');

    if (
      govSel &&
      typeof Seeds !== 'undefined' &&
      Array.isArray(Seeds.governorates)
    ) {
      govSel.innerHTML =
        '<option value="">اختر المحافظة</option>' +
        Seeds.governorates
          .map(
            g =>
              `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`
          )
          .join('');
    }
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /* ============================================
     Events
     ============================================ */

  function bindEvents() {
    /*
      Tabs
    */
    document
      .querySelectorAll('.auth-tab')
      .forEach(tab => {
        tab.addEventListener('click', () => {
          const target = tab.dataset.tab;
          switchTab(target);
        });
      });

    /*
      Login
    */
    const loginForm =
      document.getElementById('login-form');

    if (loginForm) {
      loginForm.addEventListener(
        'submit',
        handleLogin
      );
    }

    /*
      Register
    */
    const regForm =
      document.getElementById('register-form');

    if (regForm) {
      regForm.addEventListener(
        'submit',
        handleRegister
      );
    }

    /*
      Demo
    */
    const demoBtn =
      document.getElementById('try-demo');

    if (demoBtn) {
      demoBtn.addEventListener(
        'click',
        startDemoMode
      );
    }
  }

  /* ============================================
     Login
     ============================================ */

  async function handleLogin(e) {
    e.preventDefault();

    const phoneInput =
      document.getElementById('login-phone');

    const pinInput =
      document.getElementById('login-pin');

    const phone =
      phoneInput?.value.trim() || '';

    const pin =
      pinInput?.value.trim() || '';

    if (!phone || !pin) {
      UI.toast(
        'من فضلك أدخل رقم الهاتف ورمز المرور',
        'error'
      );
      return;
    }

    if (!/^01[0-2,5]\d{8}$/.test(phone)) {
      UI.toast(
        'رقم الهاتف غير صحيح (مثال: 01012345678)',
        'error'
      );
      return;
    }

    const supabase = getSupabase();

    if (!supabase) {
      UI.toast(
        'خدمة تسجيل الدخول غير متاحة حاليًا',
        'error'
      );
      return;
    }

    const form =
      document.getElementById('login-form');

    const button =
      getFormButton(form);

    showLoading(button, 'جاري تسجيل الدخول...');

    try {
      const normalizedPhone =
        normalizePhone(phone);

      const {
        data,
        error
      } = await supabase.auth.signInWithPassword({
        phone: normalizedPhone,
        password: pin
      });

      if (error) {
        console.error(
          'Supabase login error:',
          error
        );

        let message =
          'رقم الهاتف أو رمز المرور غير صحيح';

        const errorText =
          String(error.message || '').toLowerCase();

        if (
          errorText.includes('email') &&
          errorText.includes('confirm')
        ) {
          message =
            'يجب تأكيد الحساب أولًا';
        }

        UI.toast(message, 'error');
        return;
      }

      if (!data?.user) {
        UI.toast(
          'تعذر تسجيل الدخول',
          'error'
        );
        return;
      }

      await loadTeacherFromCloud(
        data.user
      );

      Storage.setDemoMode(false);

      UI.toast(
        'تم تسجيل الدخول بنجاح',
        'success'
      );

      setTimeout(
        onAuthSuccess,
        300
      );

    } catch (error) {
      console.error(
        'handleLogin:',
        error
      );

      UI.toast(
        'حدث خطأ أثناء تسجيل الدخول',
        'error'
      );

    } finally {
      hideLoading(button);
    }
  }

  /* ============================================
     Register
     ============================================ */

  async function handleRegister(e) {
    e.preventDefault();

    const name =
      document
        .getElementById('reg-name')
        ?.value.trim() || '';

    const subject =
      document
        .getElementById('reg-subject')
        ?.value || '';

    const stage =
      document
        .getElementById('reg-stage')
        ?.value || '';

    const gov =
      document
        .getElementById('reg-gov')
        ?.value || '';

    const phone =
      document
        .getElementById('reg-phone')
        ?.value.trim() || '';

    const email =
      document
        .getElementById('reg-email')
        ?.value.trim() || '';

    const pin =
      document
        .getElementById('reg-pin')
        ?.value.trim() || '';

    const pin2 =
      document
        .getElementById('reg-pin2')
        ?.value.trim() || '';

    /*
      Validation
    */

    if (!name || name.length < 3) {
      UI.toast(
        'أدخل اسمًا صحيحًا',
        'error'
      );
      return;
    }

    if (!subject) {
      UI.toast(
        'اختر المادة',
        'error'
      );
      return;
    }

    if (!/^01[0-2,5]\d{8}$/.test(phone)) {
      UI.toast(
        'رقم الهاتف غير صحيح (مثال: 01012345678)',
        'error'
      );
      return;
    }

    if (pin.length < 4) {
      UI.toast(
        'رمز المرور يجب أن يكون 4 أرقام على الأقل',
        'error'
      );
      return;
    }

    if (!/^\d+$/.test(pin)) {
      UI.toast(
        'رمز المرور يجب أن يحتوي على أرقام فقط',
        'error'
      );
      return;
    }

    if (pin !== pin2) {
      UI.toast(
        'رمزا المرور غير متطابقين',
        'error'
      );
      return;
    }

    if (
      email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      UI.toast(
        'البريد الإلكتروني غير صحيح',
        'error'
      );
      return;
    }

    const supabase = getSupabase();

    if (!supabase) {
      UI.toast(
        'خدمة إنشاء الحساب غير متاحة حاليًا',
        'error'
      );
      return;
    }

    const form =
      document.getElementById('register-form');

    const button =
      getFormButton(form);

    showLoading(
      button,
      'جاري إنشاء الحساب...'
    );

    try {
      const normalizedPhone =
        normalizePhone(phone);

      /*
        إنشاء حساب Supabase Auth
      */

      const {
        data,
        error
      } = await supabase.auth.signUp({
        phone: normalizedPhone,
        password: pin,

        options: {
          data: {
            name,
            subject,
            stage: stage || null,
            governorate: gov || null,
            phone: normalizedPhone,
            email: email || null
          }
        }
      });

      if (error) {
        console.error(
          'Supabase signup error:',
          error
        );

        let message =
          'تعذر إنشاء الحساب';

        const errorText =
          String(error.message || '').toLowerCase();

        if (
          errorText.includes('already registered') ||
          errorText.includes('already been registered') ||
          errorText.includes('user already registered')
        ) {
          message =
            'رقم الهاتف مسجل بالفعل. حاول تسجيل الدخول';
        }

        if (
          errorText.includes('password') &&
          errorText.includes('weak')
        ) {
          message =
            'رمز المرور ضعيف. استخدم رمزًا أقوى';
        }

        UI.toast(
          message,
          'error'
        );

        return;
      }

      if (!data?.user) {
        UI.toast(
          'تعذر إنشاء الحساب',
          'error'
        );
        return;
      }

      /*
        تحديث ملف المدرس
      */

      const profile = {
        id: data.user.id,
        name,
        subject,
        stage: stage || null,
        governorate: gov || null,
        phone: normalizedPhone,
        email: email || null,
        logo: null,
        bio: ''
      };

      const {
        error: profileError
      } = await supabase
        .from('teacher_profiles')
        .upsert(
          profile,
          {
            onConflict: 'id'
          }
        );

      if (profileError) {
        console.error(
          'teacher_profiles error:',
          profileError
        );
      }

      /*
        لو Supabase فعّل تأكيد الهاتف
      */
      if (!data.session) {
        UI.toast(
          'تم إنشاء الحساب. إذا ظهر طلب تأكيد الهاتف، أكمل التأكيد ثم سجل الدخول.',
          'success'
        );

        switchTab('login');

        const loginPhone =
          document.getElementById('login-phone');

        if (loginPhone) {
          loginPhone.value = phone;
        }

        return;
      }

      /*
        يوجد Session مباشرة
      */

      currentTeacher = {
        id: data.user.id,
        name,
        subject,
        stage: stage || null,
        governorate: gov || null,
        phone,
        email: email || null,
        logo: null,
        bio: '',
        createdAt:
          data.user.created_at ||
          Date.now()
      };

      Storage.set(
        Storage.KEYS.teacher,
        currentTeacher
      );

      Storage.setDemoMode(false);

      /*
        تشغيل التخزين السحابي
      */

      if (
        typeof Storage.initCloud === 'function'
      ) {
        await Storage.initCloud(
          data.user.id
        );
      }

      UI.toast(
        'تم إنشاء الحساب بنجاح',
        'success'
      );

      setTimeout(
        onAuthSuccess,
        500
      );

    } catch (error) {
      console.error(
        'handleRegister:',
        error
      );

      UI.toast(
        'حدث خطأ أثناء إنشاء الحساب',
        'error'
      );

    } finally {
      hideLoading(button);
    }
  }

  /* ============================================
     Demo Mode
     ============================================ */

  function startDemoMode() {
    UI.confirm(
      'سيتم تحميل بيانات تجريبية. يمكنك مسحها لاحقًا من الإعدادات. متابعة؟',

      () => {
        DemoData.load();

        const teacher =
          Storage.get(
            Storage.KEYS.teacher
          );

        currentTeacher = teacher;

        Storage.setDemoMode(true);

        UI.toast(
          'تم تفعيل الوضع التجريبي',
          'success'
        );

        setTimeout(
          onAuthSuccess,
          600
        );
      },

      {
        title: 'الوضع التجريبي',
        confirmText: 'متابعة',
        danger: false
      }
    );
  }

  /* ============================================
     Tabs
     ============================================ */

  function switchTab(tab) {
    document
      .querySelectorAll('.auth-tab')
      .forEach(t => {
        t.classList.toggle(
          'active',
          t.dataset.tab === tab
        );
      });

    document
      .querySelectorAll('.auth-form')
      .forEach(f => {
        f.classList.remove('active');
      });

    const form =
      document.getElementById(
        tab + '-form'
      );

    if (form) {
      form.classList.add('active');
    }
  }

  /* ============================================
     Auth Success
     ============================================ */

  function onAuthSuccess() {
    const authScreen =
      document.getElementById(
        'auth-screen'
      );

    const mainApp =
      document.getElementById(
        'main-app'
      );

    if (authScreen) {
      authScreen.classList.add('hidden');
    }

    if (mainApp) {
      mainApp.classList.remove('hidden');
    }

    if (
      typeof App !== 'undefined' &&
      App.onAuthSuccess
    ) {
      App.onAuthSuccess();
    }
  }

  return {
    init,
    isLogged,
    getTeacher,
    logout,
    updateTeacher,
    renderAuthForm
  };
})();


/* ============================================
   Demo Data
   ============================================ */

const DemoData = {

  load() {

    /*
      Create teacher
    */

    const teacher = {
      id: Storage.uid('t_'),
      name: 'أ/ أحمد محمود',
      subject: 'الرياضيات',
      stage: 'secondary',
      governorate: 'القاهرة',
      phone: '01012345678',
      email: 'ahmed@example.com',
      pin: '1234',
      logo: null,
      bio: 'مدرس رياضيات للمرحلة الثانوية - خبرة 12 عامًا',
      createdAt: Date.now()
    };

    Storage.set(
      Storage.KEYS.teacher,
      teacher
    );

    /*
      Seeds
    */

    Seeds.ensureSeeds();

    /*
      Groups
    */

    const groups = [
      {
        id: 'g1',
        name: 'مجموعة الأولى الثانوي - الأحد/الأربعاء',
        stageId: 'secondary',
        className: 'الأول الثانوي',
        subject: 'الرياضيات',
        section: 'علمي',
        days: ['sunday', 'wednesday'],
        time: '18:00',
        duration: 90,
        location: 'السنتر - قاعة 1',
        price: 600,
        maxStudents: 15,
        level: 'متوسط',
        notes: ''
      },

      {
        id: 'g2',
        name: 'مجموعة الثانية الثانوي - السبت/الثلاثاء',
        stageId: 'secondary',
        className: 'الثاني الثانوي',
        subject: 'الرياضيات',
        section: 'علمي',
        days: ['saturday', 'tuesday'],
        time: '17:00',
        duration: 120,
        location: 'السنتر - قاعة 2',
        price: 800,
        maxStudents: 12,
        level: 'متقدم',
        notes: ''
      },

      {
        id: 'g3',
        name: 'مجموعة الثالثة الإعدادي - الجمعة',
        stageId: 'preparatory',
        className: 'الثالث الإعدادي',
        subject: 'الرياضيات',
        section: 'عام',
        days: ['friday'],
        time: '16:00',
        duration: 90,
        location: 'السنتر - قاعة 3',
        price: 500,
        maxStudents: 20,
        level: 'متوسط',
        notes: ''
      }
    ];

    Storage.set(
      Storage.KEYS.groups,
      groups
    );

    /*
      Students
    */

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

    const students =
      studentNames.map((s, i) => {

        const group =
          groups.find(
            g => g.id === s[1]
          );

        return {
          id: 'st_' + (i + 1),
          name: s[0],
          groupId: s[1],
          stageId: group.stageId,
          className: group.className,
          section: group.section,
          subject: group.subject,
          school: 'مدرسة تجريبية',
          governorate: 'القاهرة',
          studentPhone: '',
          parentName:
            'ولي أمر ' +
            s[0].split(' ')[0],
          parentPhone:
            '010' +
            (10000000 + i).toString(),
          subscriptionDate:
            new Date(
              Date.now() -
              (30 + i) *
              86400000
            )
              .toISOString()
              .slice(0, 10),

          subscriptionAmount:
            group.price,

          status: s[2],
          notes: '',

          createdAt:
            Date.now() -
            (30 + i) *
            86400000
        };
      });

    Storage.set(
      Storage.KEYS.students,
      students
    );

    /*
      Lessons
    */

    const lessons = [];

    const today = new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );

    for (
      let d = -14;
      d <= 7;
      d++
    ) {

      const date =
        new Date(today);

      date.setDate(
        date.getDate() + d
      );

      const dayName =
        [
          'sunday',
          'monday',
          'tuesday',
          'wednesday',
          'thursday',
          'friday',
          'saturday'
        ][date.getDay()];

      groups.forEach(g => {

        if (
          !g.days.includes(dayName)
        ) {
          return;
        }

        const [h, m] =
          g.time
            .split(':')
            .map(Number);

        const start =
          new Date(date);

        start.setHours(
          h,
          m,
          0,
          0
        );

        const end =
          new Date(start);

        end.setMinutes(
          end.getMinutes() +
          g.duration
        );

        const isPast =
          d < 0;

        lessons.push({
          id:
            'l_' +
            lessons.length,

          groupId:
            g.id,

          date:
            date
              .toISOString()
              .slice(0, 10),

          startTime:
            g.time,

          endTime:
            end
              .toTimeString()
              .slice(0, 5),

          duration:
            g.duration,

          location:
            g.location,

          topic: '',
          notes: '',

          status:
            isPast
              ? 'تمت'
              : 'مجدولة',

          createdAt:
            Date.now()
        });
      });
    }

    Storage.set(
      Storage.KEYS.lessons,
      lessons
    );

    /*
      Attendance
    */

    const attendance = [];

    lessons
      .filter(
        l => l.status === 'تمت'
      )
      .forEach(l => {

        students
          .filter(
            s =>
              s.groupId ===
              l.groupId
          )
          .forEach(s => {

            const rand =
              Math.random();

            let status =
              'حاضر';

            if (rand < 0.1) {
              status = 'غائب';
            } else if (
              rand < 0.18
            ) {
              status = 'متأخر';
            } else if (
              rand < 0.22
            ) {
              status = 'غياب بعذر';
            }

            attendance.push({
              id:
                Storage.uid(
                  'att_'
                ),

              lessonId:
                l.id,

              groupId:
                l.groupId,

              studentId:
                s.id,

              date:
                l.date,

              status,

              createdAt:
                Date.now()
            });
          });
      });

    Storage.set(
      Storage.KEYS.attendance,
      attendance
    );

    /*
      Exams
    */

    const exams = [
      {
        id: 'e1',
        name: 'اختبار الوحدة الأولى',
        groupId: 'g1',
        subject: 'الرياضيات',
        date:
          new Date(
            Date.now() -
            7 *
            86400000
          )
            .toISOString()
            .slice(0, 10),
        topic: 'الجبر',
        maxGrade: 20,
        createdAt: Date.now()
      },

      {
        id: 'e2',
        name: 'اختبار شهري',
        groupId: 'g2',
        subject: 'الرياضيات',
        date:
          new Date(
            Date.now() -
            3 *
            86400000
          )
            .toISOString()
            .slice(0, 10),
        topic: 'التفاضل',
        maxGrade: 30,
        createdAt: Date.now()
      },

      {
        id: 'e3',
        name: 'اختبار قصير',
        groupId: 'g3',
        subject: 'الرياضيات',
        date:
          new Date(
            Date.now() +
            1 *
            86400000
          )
            .toISOString()
            .slice(0, 10),
        topic: 'الهندسة',
        maxGrade: 15,
        createdAt: Date.now()
      }
    ];

    Storage.set(
      Storage.KEYS.exams,
      exams
    );

    /*
      Grades
    */

    const grades = [];

    exams.forEach(e => {

      const groupStudents =
        students.filter(
          s =>
            s.groupId ===
            e.groupId
        );

      groupStudents.forEach(s => {

        const score =
          Math.floor(
            Math.random() *
            (e.maxGrade - 5)
          ) + 5;

        grades.push({
          id:
            Storage.uid('gr_'),

          examId:
            e.id,

          studentId:
            s.id,

          groupId:
            e.groupId,

          type:
            'اختبار',

          title:
            e.name,

          score,

          maxGrade:
            e.maxGrade,

          date:
            e.date,

          notes: '',

          createdAt:
            Date.now()
        });
      });
    });

    /*
      Continuous evaluation
    */

    const g1Students =
      students.filter(
        s =>
          s.groupId === 'g1'
      );

    g1Students.forEach(
      (s, si) => {

        for (
          let w = 4;
          w >= 1;
          w--
        ) {

          const base =
            55 +
            (si % 4) *
            8 +
            (4 - w) *
            4;

          const pct =
            Math.min(
              95,
              base +
              Math.floor(
                Math.random() *
                10
              )
            );

          grades.push({
            id:
              Storage.uid(
                'gr_'
              ),

            examId:
              null,

            studentId:
              s.id,

            groupId:
              'g1',

            type:
              'تقييم مستمر',

            title:
              'تقييم أسبوعي ' +
              w,

            score:
              Math.round(
                20 *
                pct /
                100
              ),

            maxGrade:
              20,

            date:
              new Date(
                Date.now() -
                w *
                7 *
                86400000
              )
                .toISOString()
                .slice(0, 10),

            notes: '',

            createdAt:
              Date.now()
          });
        }
      }
    );

    Storage.set(
      Storage.KEYS.grades,
      grades
    );

    /*
      Assignments
    */

    const assignments = [
      {
        id: 'a1',
        name: 'وحل تمارين صفحة 25',
        groupId: 'g1',
        topic: 'الجبر',
        assignedDate:
          new Date(
            Date.now() -
            5 *
            86400000
          )
            .toISOString()
            .slice(0, 10),

        dueDate:
          new Date(
            Date.now() -
            2 *
            86400000
          )
            .toISOString()
            .slice(0, 10),

        maxGrade: 10,
        createdAt: Date.now()
      },

      {
        id: 'a2',
        name: 'ملزمة المراجعة',
        groupId: 'g2',
        topic: 'التفاضل',

        assignedDate:
          new Date(
            Date.now() -
            4 *
            86400000
          )
            .toISOString()
            .slice(0, 10),

        dueDate:
          new Date(
            Date.now() +
            1 *
            86400000
          )
            .toISOString()
            .slice(0, 10),

        maxGrade: 20,
        createdAt: Date.now()
      }
    ];

    Storage.set(
      Storage.KEYS.assignments,
      assignments
    );

    /*
      Submissions
    */

    const submissions = [];

    assignments.forEach(a => {

      students
        .filter(
          s =>
            s.groupId ===
            a.groupId
        )
        .forEach(s => {

          const rand =
            Math.random();

          let status =
            'submitted';

          if (rand < 0.2) {
            status =
              'not_submitted';
          } else if (
            rand < 0.3
          ) {
            status =
              'late';
          }

          submissions.push({
            id:
              Storage.uid(
                'sub_'
              ),

            assignmentId:
              a.id,

            studentId:
              s.id,

            groupId:
              a.groupId,

            status,

            score:
              status ===
              'submitted'
                ? Math.floor(
                    Math.random() *
                    (a.maxGrade - 3)
                  ) + 3
                : null,

            submittedAt:
              status ===
              'submitted'
                ? new Date().toISOString()
                : null,

            notes: '',

            createdAt:
              Date.now()
          });
        });
    });

    Storage.set(
      Storage.KEYS.submissions,
      submissions
    );

    /*
      Payments
    */

    const payments = [];

    students.forEach(s => {

      const g =
        groups.find(
          x =>
            x.id ===
            s.groupId
        );

      const monthStart =
        new Date();

      monthStart.setDate(1);

      const isPaid =
        Math.random() >
        0.3;

      const isPartial =
        !isPaid &&
        Math.random() >
          0.5;

      payments.push({
        id:
          Storage.uid(
            'pay_'
          ),

        studentId:
          s.id,

        groupId:
          s.groupId,

        month:
          monthStart
            .toISOString()
            .slice(0, 7),

        required:
          g.price,

        paid:
          isPaid
            ? g.price
            : (
                isPartial
                  ? Math.floor(
                      g.price *
                      0.5
                    )
                  : 0
              ),

        method:
          'كاش',

        date:
          isPaid ||
          isPartial
            ? new Date(
                Date.now() -
                Math.random() *
                10 *
                86400000
              )
                .toISOString()
                .slice(0, 10)
            : null,

        notes: '',

        createdAt:
          Date.now()
      });
    });

    Storage.set(
      Storage.KEYS.payments,
      payments
    );

    /*
      Notifications
    */

    const notifications = [
      {
        id:
          Storage.uid('n_'),

        type:
          'lesson',

        title:
          'حصة اليوم',

        message:
          'لديك 3 حصص مجدولة اليوم',

        read: false,

        createdAt:
          Date.now() -
          3600000
      },

      {
        id:
          Storage.uid('n_'),

        type:
          'payment',

        title:
          'مدفوعات مستحقة',

        message:
          '5 طلاب لم يسددوا رسوم هذا الشهر',

        read: false,

        createdAt:
          Date.now() -
          7200000
      },

      {
        id:
          Storage.uid('n_'),

        type:
          'absence',

        title:
          'تنبيه غياب',

        message:
          'محمد أحمد غاب عن آخر 3 حصص',

        read: false,

        createdAt:
          Date.now() -
          86400000
      }
    ];

    Storage.set(
      Storage.KEYS.notifications,
      notifications
    );

    /*
      Notes
    */

    const notes = [
      {
        id:
          Storage.uid('nt_'),

        studentId:
          'st_1',

        text:
          'مشارك ممتاز في الحصة، يحتاج تدريبًا إضافيًا على المسائل المطولة.',

        type:
          'ملاحظة',

        createdAt:
          Date.now() -
          3 *
          86400000
      },

      {
        id:
          Storage.uid('nt_'),

        studentId:
          'st_1',

        text:
          'حقق تقدمًا واضحًا في اختبار الوحدة الأولى مقارنة بالمستوى السابق.',

        type:
          'إنجاز',

        createdAt:
          Date.now() -
          7 *
          86400000
      },

      {
        id:
          Storage.uid('nt_'),

        studentId:
          'st_5',

        text:
          'الالتزام بالواجبات تحسن هذا الشهر - يستحق التحفيز.',

        type:
          'إنجاز',

        createdAt:
          Date.now() -
          2 *
          86400000
      },

      {
        id:
          Storage.uid('nt_'),

        studentId:
          'st_8',

        text:
          'متوقف عن الدراسة مؤقتًا - تم إبلاغ ولي الأمر بموعد العودة.',

        type:
          'متابعة',

        createdAt:
          Date.now() -
          5 *
          86400000
      }
    ];

    Storage.set(
      Storage.KEYS.notes,
      notes
    );

    /*
      Goals
    */

    const goals = [
      {
        id:
          Storage.uid('gl_'),

        studentId:
          'st_1',

        title:
          'إتقان حل مسائل التفاضل المطولة',

        target:
          'درجة كاملة في المسائل المطولة',

        dueDate:
          new Date(
            Date.now() +
            21 *
            86400000
          )
            .toISOString()
            .slice(0, 10),

        status:
          'قيد التنفيذ',

        createdAt:
          Date.now()
      },

      {
        id:
          Storage.uid('gl_'),

        studentId:
          'st_5',

        title:
          'الالتزام بتسليم جميع الواجبات',

        target:
          '100% التزام',

        dueDate:
          new Date(
            Date.now() +
            14 *
            86400000
          )
            .toISOString()
            .slice(0, 10),

        status:
          'قيد التنفيذ',

        createdAt:
          Date.now()
      }
    ];

    Storage.set(
      Storage.KEYS.goals,
      goals
    );
  }
};


/* ============================================
   Global
   ============================================ */

window.Auth = Auth;
window.DemoData = DemoData;
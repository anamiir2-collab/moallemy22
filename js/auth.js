/* ============================================
   مُعلّمي | auth.js
   نظام المصادقة و Onboarding
   ============================================ */

const Auth = (function () {
  let currentTeacher = null;

  function init() {
    // Load saved teacher
    const t = Storage.get(Storage.KEYS.teacher);
    if (t && t.id) {
      currentTeacher = t;
    }
    bindEvents();
    renderAuthForm();
  }

  function isLogged() { return !!currentTeacher; }

  function getTeacher() { return currentTeacher; }

  function logout() {
    currentTeacher = null;
    Storage.remove(Storage.KEYS.teacher);
    location.reload();
  }

  function updateTeacher(updates) {
    if (!currentTeacher) return null;
    currentTeacher = { ...currentTeacher, ...updates, updatedAt: Date.now() };
    Storage.set(Storage.KEYS.teacher, currentTeacher);
    return currentTeacher;
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
    // Tabs
    document.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t === tab));
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        document.getElementById(target + '-form').classList.add('active');
      });
    });

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

    // Demo
    const demoBtn = document.getElementById('try-demo');
    if (demoBtn) {
      demoBtn.addEventListener('click', startDemoMode);
    }
  }

  function handleLogin(e) {
    e.preventDefault();
    const phone = document.getElementById('login-phone').value.trim();
    const pin = document.getElementById('login-pin').value.trim();

    if (!phone || !pin) {
      UI.toast('من فضلك أدخل رقم الهاتف ورمز المرور', 'error');
      return;
    }

    const teacher = Storage.get(Storage.KEYS.teacher);
    if (!teacher) {
      UI.toast('لا يوجد حساب مسجل. أنشئ حسابًا أولًا', 'warning');
      switchTab('register');
      return;
    }

    if (teacher.phone !== phone) {
      UI.toast('رقم الهاتف غير مطابق', 'error');
      return;
    }

    if (teacher.pin !== pin) {
      UI.toast('رمز المرور غير صحيح', 'error');
      return;
    }

    currentTeacher = teacher;
    onAuthSuccess();
  }

  function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const subject = document.getElementById('reg-subject').value;
    const stage = document.getElementById('reg-stage').value;
    const gov = document.getElementById('reg-gov').value;
    const phone = document.getElementById('reg-phone').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const pin = document.getElementById('reg-pin').value.trim();
    const pin2 = document.getElementById('reg-pin2').value.trim();

    // Validation
    if (!name || name.length < 3) { UI.toast('أدخل اسمًا صحيحًا', 'error'); return; }
    if (!subject) { UI.toast('اختر المادة', 'error'); return; }
    if (!/^01[0-2,5]\d{8}$/.test(phone)) { UI.toast('رقم الهاتف غير صحيح (مثال: 01012345678)', 'error'); return; }
    if (pin.length < 4) { UI.toast('رمز المرور يجب أن يكون 4 أرقام على الأقل', 'error'); return; }
    if (pin !== pin2) { UI.toast('رمزا المرور غير متطابقين', 'error'); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { UI.toast('البريد الإلكتروني غير صحيح', 'error'); return; }

    const teacher = {
      id: Storage.uid('t_'),
      name,
      subject,
      stage: stage || null,
      governorate: gov || null,
      phone,
      email: email || null,
      pin,
      logo: null,
      bio: '',
      createdAt: Date.now()
    };

    Storage.set(Storage.KEYS.teacher, teacher);
    currentTeacher = teacher;
    UI.toast('تم إنشاء الحساب بنجاح', 'success');
    setTimeout(onAuthSuccess, 600);
  }

  function startDemoMode() {
    UI.confirm(
      'سيتم تحميل بيانات تجريبية. يمكنك مسحها لاحقًا من الإعدادات. متابعة؟',
      () => {
        DemoData.load();
        const teacher = Storage.get(Storage.KEYS.teacher);
        currentTeacher = teacher;
        Storage.setDemoMode(true);
        UI.toast('تم تفعيل الوضع التجريبي', 'success');
        setTimeout(onAuthSuccess, 600);
      },
      { title: 'الوضع التجريبي', confirmText: 'متابعة', danger: false }
    );
  }

  function switchTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    document.getElementById(tab + '-form').classList.add('active');
  }

  function onAuthSuccess() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    if (typeof App !== 'undefined' && App.onAuthSuccess) {
      App.onAuthSuccess();
    }
  }

  return { init, isLogged, getTeacher, logout, updateTeacher, renderAuthForm };
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
      pin: '1234',
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
            // الحالات بالعربية لتتطابق مع بقية التطبيق
            status: isPast ? 'تمت' : 'مجدولة',
            createdAt: Date.now()
          });
        }
      });
    }
    Storage.set(Storage.KEYS.lessons, lessons);

    // Attendance for past lessons - الحالات بالعربية لتتطابق مع بقية التطبيق
    const attendance = [];
    lessons.filter(l => l.status === 'تمت').forEach(l => {
      students.filter(s => s.groupId === l.groupId).forEach(s => {
        const rand = Math.random();
        let status = 'حاضر';
        if (rand < 0.1) status = 'غائب';
        else if (rand < 0.18) status = 'متأخر';
        else if (rand < 0.22) status = 'غياب بعذر';
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

    // Grades - بتواريخ متدرجة لدعم تحليل الاتجاه الزمني
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
          type: 'اختبار',
          title: e.name,
          score,
          maxGrade: e.maxGrade,
          date: e.date,
          notes: '',
          createdAt: Date.now()
        });
      });
    });

    // درجات تقييم مستمر إضافية على مدى الأسابيع الماضية (لدعم الاتجاه)
    const g1Students = students.filter(s => s.groupId === 'g1');
    g1Students.forEach((s, si) => {
      for (let w = 4; w >= 1; w--) {
        const base = 55 + (si % 4) * 8 + (4 - w) * 4; // تحسن تدريجي
        const pct = Math.min(95, base + Math.floor(Math.random() * 10));
        grades.push({
          id: Storage.uid('gr_'),
          examId: null,
          studentId: s.id,
          groupId: 'g1',
          type: 'تقييم مستمر',
          title: 'تقييم أسبوعي ' + w,
          score: Math.round(20 * pct / 100),
          maxGrade: 20,
          date: new Date(Date.now() - w * 7 * 86400000).toISOString().slice(0, 10),
          notes: '',
          createdAt: Date.now()
        });
      }
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

    // ملاحظات المدرس (للتبويب الجديد في ملف الطالب)
    const notes = [
      { id: Storage.uid('nt_'), studentId: 'st_1', text: 'مشارك ممتاز في الحصة، يحتاج تدريبًا إضافيًا على المسائل المطولة.', type: 'ملاحظة', createdAt: Date.now() - 3 * 86400000 },
      { id: Storage.uid('nt_'), studentId: 'st_1', text: 'حقق تقدمًا واضحًا في اختبار الوحدة الأولى مقارنة بالمستوى السابق.', type: 'إنجاز', createdAt: Date.now() - 7 * 86400000 },
      { id: Storage.uid('nt_'), studentId: 'st_5', text: 'الالتزام بالواجبات تحسن هذا الشهر - يستحق التحفيز.', type: 'إنجاز', createdAt: Date.now() - 2 * 86400000 },
      { id: Storage.uid('nt_'), studentId: 'st_8', text: 'متوقف عن الدراسة مؤقتًا - تم إبلاغ ولي الأمر بموعد العودة.', type: 'متابعة', createdAt: Date.now() - 5 * 86400000 }
    ];
    Storage.set(Storage.KEYS.notes, notes);

    // أهداف (لتبويب خطة التحسين)
    const goals = [
      { id: Storage.uid('gl_'), studentId: 'st_1', title: 'إتقان حل مسائل التفاضل المطولة', target: 'درجة كاملة في المسائل المطولة', dueDate: new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10), status: 'قيد التنفيذ', createdAt: Date.now() },
      { id: Storage.uid('gl_'), studentId: 'st_5', title: 'الالتزام بتسليم جميع الواجبات', target: '100% التزام', dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10), status: 'قيد التنفيذ', createdAt: Date.now() }
    ];
    Storage.set(Storage.KEYS.goals, goals);
  }
};

window.Auth = Auth;
window.DemoData = DemoData;

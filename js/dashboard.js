/* ============================================
   مُعلّمي | dashboard.js
   الصفحة الرئيسية - إحصائيات + حصص اليوم + تنبيهات + يحتاج متابعة
   ============================================ */

const Dashboard = {
  render() {
    const today = Utils.today();
    const students = Storage.list(Storage.KEYS.students);
    const groups = Storage.list(Storage.KEYS.groups);
    const lessons = Storage.list(Storage.KEYS.lessons);
    const todayLessons = lessons.filter(l => l.date === today);
    const attendance = Storage.list(Storage.KEYS.attendance, a => a.date === today);
    const payments = Storage.list(Storage.KEYS.payments);

    const totalStudents = students.length;
    const activeStudents = students.filter(s => s.status === 'نشط').length;
    const todayPresent = attendance.filter(a => a.status === 'حاضر').length;
    const todayAbsent = attendance.filter(a => a.status === 'غائب').length;
    const todayRevenue = payments.filter(p => p.date === today).reduce((sum, p) => sum + (p.paid || 0), 0);
    const outstanding = payments.reduce((sum, p) => sum + Math.max(0, (p.required || 0) - (p.paid || 0)), 0);

    const alerts = this.getAlerts();
    const needsAttention = AIAnalysis.needsAttention();
    const quickActions = [
      { icon: 'user', label: 'إضافة طالب', action: 'add-student', color: '' },
      { icon: 'groups', label: 'مجموعة', action: 'add-group', color: 'gold' },
      { icon: 'check', label: 'حضور', action: 'quick-attendance', color: 'success' },
      { icon: 'exam', label: 'اختبار', action: 'add-exam', color: 'warning' },
      { icon: 'assignment', label: 'واجب', action: 'add-assignment', color: 'info' },
      { icon: 'payment', label: 'دفعة', action: 'quick-payment', color: 'gold' },
      { icon: 'report', label: 'تقرير', action: 'add-report', color: '' }
    ];

    return `
      <div class="page-header">
        <h1 class="page-title">الرئيسية</h1>
        <p class="page-subtitle">نظرة عامة على نشاطك اليوم</p>
      </div>

      <div class="stats-grid stagger">
        <div class="stat-card" onclick="App.navigate('students')">
          <div class="stat-icon">${Icons.get('students', 20)}</div>
          <div class="stat-value">${totalStudents}</div>
          <div class="stat-label">إجمالي الطلاب</div>
        </div>

        <div class="stat-card gold" onclick="App.navigate('groups')">
          <div class="stat-icon">${Icons.get('groups', 20)}</div>
          <div class="stat-value">${groups.length}</div>
          <div class="stat-label">المجموعات</div>
        </div>

        <div class="stat-card info">
          <div class="stat-icon">${Icons.get('calendar', 20)}</div>
          <div class="stat-value">${todayLessons.length}</div>
          <div class="stat-label">حصص اليوم</div>
        </div>

        <div class="stat-card success">
          <div class="stat-icon">${Icons.get('attendance', 20)}</div>
          <div class="stat-value">${todayPresent}</div>
          <div class="stat-label">حضور اليوم</div>
        </div>

        <div class="stat-card danger">
          <div class="stat-icon">${Icons.get('x', 20)}</div>
          <div class="stat-value">${todayAbsent}</div>
          <div class="stat-label">غياب اليوم</div>
        </div>

        <div class="stat-card gold">
          <div class="stat-icon">${Icons.get('payment', 20)}</div>
          <div class="stat-value">${UI.money(todayRevenue).replace(' ج.م', '')}</div>
          <div class="stat-label">دخل اليوم (ج.م)</div>
        </div>

        <div class="stat-card warning">
          <div class="stat-icon">${Icons.get('warn', 20)}</div>
          <div class="stat-value">${UI.money(outstanding).replace(' ج.م', '')}</div>
          <div class="stat-label">مستحقات (ج.م)</div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">${Icons.get('trendUp', 20)}</div>
          <div class="stat-value">${activeStudents}</div>
          <div class="stat-label">طالب نشط</div>
        </div>
      </div>

      <div class="section">
        <div class="section-header">
          <h2 class="section-title">إجراءات سريعة</h2>
        </div>
        <div class="quick-actions stagger">
          ${quickActions.map(a => `
            <button class="quick-action" data-action="${a.action}">
              <div class="quick-action-icon ${a.color}">${Icons.get(a.icon, 20)}</div>
              <span>${a.label}</span>
            </button>
          `).join('')}
        </div>
      </div>

      ${alerts.length ? `
        <div class="section">
          <div class="section-header">
            <h2 class="section-title">تنبيهات مهمة</h2>
            <span class="badge badge-danger">${alerts.length}</span>
          </div>
          <div class="stagger">
            ${alerts.map(a => `
              <div class="alert alert-${a.type}">
                <div class="alert-icon">${Icons.get(a.icon, 20)}</div>
                <div class="alert-body">
                  <strong>${a.title}</strong>
                  ${a.message}
                  ${a.action ? `<div style="margin-top: 6px;"><button class="btn btn-text btn-sm" style="padding: 4px 0;" data-alert-action="${a.action.id}" data-alert-data="${a.action.data || ''}">${a.action.label}</button></div>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${needsAttention.length ? `
        <div class="section">
          <div class="section-header">
            <h2 class="section-title">يحتاج متابعة</h2>
            <span class="badge badge-warning">${needsAttention.length}</span>
          </div>
          <div class="stagger">
            ${needsAttention.slice(0, 3).map(item => `
              <div class="alert alert-${item.reasons[0].severity}">
                <div class="alert-icon">${Icons.get(item.reasons[0].severity === 'danger' ? 'warn' : 'info', 20)}</div>
                <div class="alert-body">
                  <strong>${Utils.escapeHTML(item.student.name)}</strong>
                  ${item.reasons.map(r => Utils.escapeHTML(r.label)).join(' • ')}
                  <div style="display:flex; gap:8px; margin-top:8px; flex-wrap:wrap;">
                    <button class="btn btn-text btn-sm" style="padding:4px 0;" data-attention-profile="${item.student.id}">فتح الملف ←</button>
                    <button class="btn btn-text btn-sm" style="padding:4px 0;" data-attention-plan="${item.student.id}">خطة تحسين</button>
                    <button class="btn btn-text btn-sm" style="padding:4px 0;" data-attention-report="${item.student.id}">تقرير</button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
          ${needsAttention.length > 3 ? `
            <button class="btn btn-outline btn-block" style="margin-top: var(--space-3);" data-nav-needs="1">
              عرض كل الطلاب الذين يحتاجون متابعة (${needsAttention.length})
            </button>
          ` : ''}
        </div>
      ` : ''}

      <div class="section">
        <div class="section-header">
          <h2 class="section-title">حصص اليوم</h2>
          <span class="badge">${todayLessons.length}</span>
        </div>
        ${todayLessons.length === 0 ? UI.emptyState(
          Icons.get('coffee', 36),
          'يبدو أن جدولك هادئ اليوم',
          'لا توجد حصص مجدولة. استمتع بيومك أو أضف حصة جديدة.',
          'إضافة حصة',
          'add-lesson'
        ) : `
          <div class="stagger">
            ${todayLessons.map(l => this.renderLessonCard(l)).join('')}
          </div>
        `}
      </div>
    `;
  },

  // ===== صفحة "يحتاج متابعة" الكاملة =====
  renderNeeds() {
    const items = AIAnalysis.needsAttention();
    const actionLabels = { contact: 'تواصل مع ولي الأمر', plan: 'خطة تحسين', profile: 'فتح الملف', assignment: 'متابعة الواجبات' };

    return `
      <div class="page-header">
        <h1 class="page-title">يحتاج متابعة</h1>
        <p class="page-subtitle">طلاب لديهم مؤشرات سلبية تحتاج انتباهك - مرتبة حسب الأهمية</p>
      </div>

      ${items.length === 0 ? UI.emptyState(
        Icons.get('check', 36),
        'لا يوجد من يحتاج متابعة',
        'جميع الطلاب على الحالة الراجية وفق البيانات المتاحة.'
      ) : `
        <div class="stagger">
          ${items.map(item => {
            const data = AIAnalysis.prepare(item.student.id);
            const perf = AIAnalysis.performance(data);
            return `
              <div class="card needs-card">
                <div class="needs-header">
                  <div class="list-item-avatar">${Utils.escapeHTML(UI.initials(item.student.name))}</div>
                  <div style="flex:1; min-width:0;">
                    <div style="font-weight:700;">${Utils.escapeHTML(item.student.name)}</div>
                    <div style="font-size:var(--font-size-xs); color:var(--text-tertiary);">
                      ${Utils.escapeHTML(item.student.className || '')} • حضور ${item.attRate != null ? item.attRate + '%' : '—'} ${perf.score != null ? '• أداء ' + perf.score + '%' : ''}
                    </div>
                  </div>
                  <span class="badge badge-${item.reasons[0].severity === 'danger' ? 'danger' : (item.reasons[0].severity === 'warning' ? 'warning' : 'info')}">
                    ${item.reasons.length} سبب
                  </span>
                </div>
                <ul style="margin: var(--space-3) 0; padding-inline-start: 18px; font-size: var(--font-size-sm); color: var(--text-secondary);">
                  ${item.reasons.map(r => `<li style="margin-bottom:3px;">${Utils.escapeHTML(r.label)}</li>`).join('')}
                </ul>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                  <button class="btn btn-outline btn-sm" data-attention-profile="${item.student.id}">${Icons.get('user', 14)} الملف</button>
                  <button class="btn btn-outline btn-sm" data-attention-plan="${item.student.id}">${Icons.get('target', 14)} خطة تحسين</button>
                  <button class="btn btn-whatsapp btn-sm" data-attention-report="${item.student.id}">${Icons.get('whatsapp', 14)} تقرير ولي الأمر</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    `;
  },

  renderLessonCard(lesson) {
    const group = Storage.find(Storage.KEYS.groups, lesson.groupId);
    if (!group) return '';
    const studentCount = Storage.list(Storage.KEYS.students, s => s.groupId === group.id && s.status === 'نشط').length;
    const todayAttendance = Storage.list(Storage.KEYS.attendance, a => a.lessonId === lesson.id).length;
    const isCompleted = lesson.status === 'تمت' || todayAttendance > 0;

    return `
      <div class="lesson-card ${lesson.status === 'تمت' ? 'completed' : ''}" data-lesson="${lesson.id}">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap: var(--space-2); margin-bottom: var(--space-2);">
          <div style="flex:1;">
            <h3 style="font-weight: 700; color: var(--text-primary); font-size: var(--font-size-md); margin-bottom: 4px;">${Utils.escapeHTML(group.name)}</h3>
            <p style="font-size: var(--font-size-xs); color: var(--text-tertiary);">${Utils.escapeHTML(group.subject)} • ${Utils.escapeHTML(group.className)}${group.section ? ' • ' + Utils.escapeHTML(group.section) : ''}</p>
          </div>
          ${UI.lessonStatusBadge(lesson.status)}
        </div>
        <div style="display:flex; flex-wrap:wrap; gap: var(--space-3); margin-top: var(--space-3); font-size: var(--font-size-xs); color: var(--text-secondary);">
          <span style="display:inline-flex; align-items:center; gap:4px;">
            ${Icons.get('clock', 14)}
            ${UI.formatTime(lesson.startTime)} - ${UI.formatTime(lesson.endTime)}
          </span>
          <span style="display:inline-flex; align-items:center; gap:4px;">
            ${Icons.get('students', 14)}
            ${studentCount} طالب
          </span>
          ${lesson.location ? `
            <span style="display:inline-flex; align-items:center; gap:4px;">
              ${Icons.get('location', 14)}
              ${Utils.escapeHTML(lesson.location)}
            </span>
          ` : ''}
        </div>
        ${!isCompleted ? `
          <button class="btn btn-primary btn-block" style="margin-top: var(--space-3);" data-start-lesson="${lesson.id}">
            بدء الحصة وتسجيل الحضور
          </button>
        ` : `
          <button class="btn btn-secondary btn-block" style="margin-top: var(--space-3);" data-lesson-detail="${lesson.id}">
            عرض التفاصيل
          </button>
        `}
      </div>
    `;
  },

  getAlerts() {
    const alerts = [];
    const students = Storage.list(Storage.KEYS.students);
    const payments = Storage.list(Storage.KEYS.payments);
    const lessons = Storage.list(Storage.KEYS.lessons);
    const exams = Storage.list(Storage.KEYS.exams);
    const submissions = Storage.list(Storage.KEYS.submissions);
    const settings = Storage.get(Storage.KEYS.settings, {});
    const threshold = settings.absenceAlertThreshold || 3;

    // Outstanding payments
    const outstandingStudents = students.filter(s => {
      const studentPayments = payments.filter(p => p.studentId === s.id);
      const totalRequired = studentPayments.reduce((sum, p) => sum + (p.required || 0), 0);
      const totalPaid = studentPayments.reduce((sum, p) => sum + (p.paid || 0), 0);
      return totalRequired - totalPaid > 0;
    });
    if (outstandingStudents.length > 0) {
      alerts.push({
        type: 'warning',
        icon: 'payment',
        title: `${outstandingStudents.length} طالب لديهم اشتراك مستحق`,
        message: 'يحتاجون لمتابعة المدفوعات هذا الشهر',
        action: { id: 'go-payments', label: 'عرض المدفوعات' }
      });
    }

    // Absent students
    const completedLessons = lessons.filter(l => l.status === 'تمت');
    students.forEach(s => {
      const studentAtt = Storage.list(Storage.KEYS.attendance, a => a.studentId === s.id && a.status === 'غائب');
      const groupLessons = completedLessons.filter(l => l.groupId === s.groupId).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, threshold);
      if (groupLessons.length >= threshold) {
        const recentAbsences = groupLessons.filter(gl => studentAtt.some(a => a.lessonId === gl.id)).length;
        if (recentAbsences >= threshold) {
          alerts.push({
            type: 'danger',
            icon: 'warn',
            title: `${Utils.escapeHTML(s.name)} غاب عن آخر ${threshold} حصص`,
            message: 'ينصح بالتواصل مع ولي الأمر',
            action: { id: 'contact-parent', data: s.id, label: 'تجهيز رسالة لولي الأمر' }
          });
        }
      }
    });

    // Tomorrow's exams
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    const tomorrowExams = exams.filter(e => e.date === tomorrowStr);
    if (tomorrowExams.length > 0) {
      alerts.push({
        type: 'info',
        icon: 'exam',
        title: `اختبار ${Utils.escapeHTML(tomorrowExams[0].name)} غدًا`,
        message: `لمجموعة ${Utils.escapeHTML(Storage.find(Storage.KEYS.groups, tomorrowExams[0].groupId)?.name || '')}`,
        action: { id: 'go-exams', label: 'عرض الاختبارات' }
      });
    }

    // Pending submissions
    const pending = submissions.filter(s => s.status === 'not_submitted' || s.status === 'late').length;
    if (pending > 0) {
      alerts.push({
        type: 'warning',
        icon: 'assignment',
        title: `${pending} واجب لم يتم تسليمه`,
        message: 'طلاب بحاجة لمتابعة الواجبات',
        action: { id: 'go-assignments', label: 'عرض الواجبات' }
      });
    }

    // Backup reminder (أسبوع بدون نسخة احتياطية)
    const meta = Storage.getMeta();
    const lastBackup = meta.lastBackupAt || null;
    if (!lastBackup || (Date.now() - lastBackup) > 7 * 86400000) {
      alerts.push({
        type: 'info',
        icon: 'database',
        title: 'لم تأخذ نسخة احتياطية مؤخرًا',
        message: 'بياناتك محفوظة في هذا الجهاز فقط - صدّر نسخة احتياطية للحفاظ عليها',
        action: { id: 'go-backup', label: 'إنشاء نسخة الآن' }
      });
    }

    return alerts.slice(0, 6);
  },

  bindNeeds() {
    document.querySelectorAll('[data-attention-profile]').forEach(btn => {
      btn.addEventListener('click', () => Students.openProfile(btn.dataset.attentionProfile));
    });
    document.querySelectorAll('[data-attention-plan]').forEach(btn => {
      btn.addEventListener('click', () => {
        Students.openProfile(btn.dataset.attentionPlan);
        setTimeout(() => {
          const tab = document.querySelector('#profile-tabs [data-tab="plan"]');
          if (tab) tab.click();
        }, 150);
      });
    });
    document.querySelectorAll('[data-attention-report]').forEach(btn => {
      btn.addEventListener('click', () => ParentReport.open(btn.dataset.attentionReport));
    });
  },

  bind() {
    // Quick actions
    document.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        switch (action) {
          case 'add-student': Students.openAddForm(); break;
          case 'add-group': Groups.openAddForm(); break;
          case 'quick-attendance': Attendance.openQuick(); break;
          case 'add-exam': Exams.openAddForm(); break;
          case 'add-assignment': Assignments.openAddForm(); break;
          case 'quick-payment': Payments.openQuick(); break;
          case 'add-report': Reports.openGenerator(); break;
          case 'add-lesson': Lessons.openAddForm(); break;
        }
      });
    });

    // Start lesson
    document.querySelectorAll('[data-start-lesson]').forEach(btn => {
      btn.addEventListener('click', () => Lessons.startLesson(btn.dataset.startLesson));
    });

    // Lesson detail
    document.querySelectorAll('[data-lesson-detail]').forEach(btn => {
      btn.addEventListener('click', () => Lessons.openDetail(btn.dataset.lessonDetail));
    });

    // Alert actions
    document.querySelectorAll('[data-alert-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.alertAction;
        const data = btn.dataset.alertData;
        if (action === 'go-payments') App.navigate('payments');
        else if (action === 'go-exams') App.navigate('exams');
        else if (action === 'go-assignments') App.navigate('assignments');
        else if (action === 'go-backup') { App.navigate('settings'); setTimeout(() => { document.getElementById('backup-section')?.scrollIntoView({ behavior: 'smooth' }); }, 200); }
        else if (action === 'contact-parent') ParentReport.open(data);
      });
    });

    // Needs attention actions
    this.bindNeeds();

    // Needs page nav
    document.querySelectorAll('[data-nav-needs]').forEach(btn => {
      btn.addEventListener('click', () => App.navigate('needs'));
    });

    // Empty state button
    document.querySelector('[data-action="add-lesson"]')?.addEventListener('click', () => Lessons.openAddForm());
  }
};

window.Dashboard = Dashboard;

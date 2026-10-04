/* ============================================
   مُعلّمي | dashboard.js
   الصفحة الرئيسية - إحصائيات + حصص اليوم + تنبيهات
   ============================================ */

const Dashboard = {
  render() {
    const today = new Date().toISOString().slice(0, 10);
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
    const quickActions = [
      { icon: '👤', label: 'إضافة طالب', action: 'add-student', color: '' },
      { icon: '👥', label: 'مجموعة', action: 'add-group', color: 'gold' },
      { icon: '✓', label: 'حضور', action: 'quick-attendance', color: 'success' },
      { icon: '📝', label: 'اختبار', action: 'add-exam', color: 'warning' },
      { icon: '📋', label: 'واجب', action: 'add-assignment', color: 'info' },
      { icon: '💰', label: 'دفعة', action: 'quick-payment', color: 'gold' },
      { icon: '📊', label: 'تقرير', action: 'add-report', color: '' }
    ];

    return `
      <div class="page-header">
        <h1 class="page-title">الرئيسية</h1>
        <p class="page-subtitle">نظرة عامة على نشاطك اليوم</p>
      </div>

      <div class="stats-grid stagger">
        <div class="stat-card" onclick="App.navigate('students')">
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          </div>
          <div class="stat-value">${totalStudents}</div>
          <div class="stat-label">إجمالي الطلاب</div>
        </div>

        <div class="stat-card gold" onclick="App.navigate('groups')">
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          </div>
          <div class="stat-value">${groups.length}</div>
          <div class="stat-label">المجموعات</div>
        </div>

        <div class="stat-card info">
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          </div>
          <div class="stat-value">${todayLessons.length}</div>
          <div class="stat-label">حصص اليوم</div>
        </div>

        <div class="stat-card success">
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div class="stat-value">${todayPresent}</div>
          <div class="stat-label">حضور اليوم</div>
        </div>

        <div class="stat-card danger">
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
          <div class="stat-value">${todayAbsent}</div>
          <div class="stat-label">غياب اليوم</div>
        </div>

        <div class="stat-card gold">
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div class="stat-value">${UI.money(todayRevenue).replace(' ج.م', '')}</div>
          <div class="stat-label">دخل اليوم (ج.م)</div>
        </div>

        <div class="stat-card warning">
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v2m0 4h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
          </div>
          <div class="stat-value">${UI.money(outstanding).replace(' ج.م', '')}</div>
          <div class="stat-label">مستحقات (ج.م)</div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
          </div>
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
              <div class="quick-action-icon ${a.color}">${a.icon}</div>
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
                <div class="alert-icon">${a.icon}</div>
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

      <div class="section">
        <div class="section-header">
          <h2 class="section-title">حصص اليوم</h2>
          <span class="badge">${todayLessons.length}</span>
        </div>
        ${todayLessons.length === 0 ? UI.emptyState(
          '☕',
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
            <h3 style="font-weight: 700; color: var(--text-primary); font-size: var(--font-size-md); margin-bottom: 4px;">${group.name}</h3>
            <p style="font-size: var(--font-size-xs); color: var(--text-tertiary);">${group.subject} • ${group.className}${group.section ? ' • ' + group.section : ''}</p>
          </div>
          ${UI.lessonStatusBadge(lesson.status)}
        </div>
        <div style="display:flex; flex-wrap:wrap; gap: var(--space-3); margin-top: var(--space-3); font-size: var(--font-size-xs); color: var(--text-secondary);">
          <span style="display:inline-flex; align-items:center; gap:4px;">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${UI.formatTime(lesson.startTime)} - ${UI.formatTime(lesson.endTime)}
          </span>
          <span style="display:inline-flex; align-items:center; gap:4px;">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            ${studentCount} طالب
          </span>
          ${lesson.location ? `
            <span style="display:inline-flex; align-items:center; gap:4px;">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              ${lesson.location}
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
    const assignments = Storage.list(Storage.KEYS.assignments);
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
        icon: '💰',
        title: `${outstandingStudents.length} طالب لديهم اشتراك مستحق`,
        message: 'يحتاجون لمتابعة المدفوعات هذا الشهر',
        action: { id: 'go-payments', label: 'عرض المدفوعات →' }
      });
    }

    // Absent students
    const completedLessons = lessons.filter(l => l.status === 'تمت');
    students.forEach(s => {
      const studentAtt = Storage.list(Storage.KEYS.attendance, a => a.studentId === s.id && a.status === 'غائب');
      // Get last N lessons
      const groupLessons = completedLessons.filter(l => l.groupId === s.groupId).sort((a,b) => b.date.localeCompare(a.date)).slice(0, threshold);
      if (groupLessons.length >= threshold) {
        const recentAbsences = groupLessons.filter(gl => studentAtt.some(a => a.lessonId === gl.id)).length;
        if (recentAbsences >= threshold) {
          alerts.push({
            type: 'danger',
            icon: '⚠️',
            title: `${s.name} غاب عن آخر ${threshold} حصص`,
            message: 'ينصح بالتواصل مع ولي الأمر',
            action: { id: 'contact-parent', data: s.id, label: 'تجهيز رسالة لولي الأمر →' }
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
        icon: '📝',
        title: `اختبار ${tomorrowExams[0].name} غدًا`,
        message: `لمجموعة ${Storage.find(Storage.KEYS.groups, tomorrowExams[0].groupId)?.name || ''}`,
        action: { id: 'go-exams', label: 'عرض الاختبارات →' }
      });
    }

    // Pending submissions
    const pending = submissions.filter(s => s.status === 'not_submitted' || s.status === 'late').length;
    if (pending > 0) {
      alerts.push({
        type: 'warning',
        icon: '📋',
        title: `${pending} واجب لم يتم تسليمه`,
        message: 'طلاب بحاجة لمتابعة الواجبات',
        action: { id: 'go-assignments', label: 'عرض الواجبات →' }
      });
    }

    return alerts.slice(0, 5);
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
        else if (action === 'contact-parent') Reports.contactParent(data);
      });
    });

    // Empty state button
    document.querySelector('[data-action="add-lesson"]')?.addEventListener('click', () => Lessons.openAddForm());
  }
};

window.Dashboard = Dashboard;

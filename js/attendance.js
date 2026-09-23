/* ============================================
   مُعلّمي | attendance.js
   الحضور - تسجيل سريع، سجل، تنبيهات
   ============================================ */

const Attendance = {
  render() {
    const today = new Date().toISOString().slice(0, 10);
    const att = Storage.list(Storage.KEYS.attendance, a => a.date === today);
    const settings = Storage.get(Storage.KEYS.settings, {});
    const threshold = settings.absenceAlertThreshold || 3;

    // Students with consecutive absences
    const students = Storage.list(Storage.KEYS.students, s => s.status === 'نشط');
    const absStudents = students.filter(s => {
      const lessons = Storage.list(Storage.KEYS.lessons, l => l.groupId === s.groupId && l.status === 'تمت').sort((a, b) => b.date.localeCompare(a.date)).slice(0, threshold);
      if (lessons.length < threshold) return false;
      const sAtt = Storage.list(Storage.KEYS.attendance, a => a.studentId === s.id);
      return lessons.every(l => sAtt.some(a => a.lessonId === l.id && a.status === 'غائب'));
    });

    return `
      <div class="page-header">
        <h1 class="page-title">الحضور</h1>
        <p class="page-subtitle">تسجيل ومتابعة حضور الطلاب</p>
      </div>

      <div class="action-row" style="margin-bottom: var(--space-5);">
        <button class="btn btn-primary" style="flex:1;" onclick="Attendance.openQuick()">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          تسجيل حضور سريع
        </button>
      </div>

      <div class="stats-grid stagger" style="margin-bottom: var(--space-5);">
        <div class="stat-card success">
          <div class="stat-value">${att.filter(a => a.status === 'حاضر').length}</div>
          <div class="stat-label">حاضر اليوم</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-value">${att.filter(a => a.status === 'غائب').length}</div>
          <div class="stat-label">غائب اليوم</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-value">${att.filter(a => a.status === 'متأخر').length}</div>
          <div class="stat-label">متأخر اليوم</div>
        </div>
        <div class="stat-card info">
          <div class="stat-value">${absStudents.length}</div>
          <div class="stat-label">كثير الغياب</div>
        </div>
      </div>

      ${absStudents.length > 0 ? `
        <div class="section">
          <div class="section-header">
            <h2 class="section-title">⚠️ تنبيهات الغياب</h2>
            <span class="badge badge-danger">${absStudents.length}</span>
          </div>
          <div class="stagger">
            ${absStudents.map(s => {
              const sAtt = Storage.list(Storage.KEYS.attendance, a => a.studentId === s.id && a.status === 'غائب');
              const lastLessons = Storage.list(Storage.KEYS.lessons, l => l.groupId === s.groupId && l.status === 'تمت').sort((a, b) => b.date.localeCompare(a.date)).slice(0, threshold);
              const absentCount = lastLessons.filter(l => sAtt.some(a => a.lessonId === l.id)).length;
              return `
                <div class="alert alert-danger">
                  <div class="alert-icon">⚠️</div>
                  <div class="alert-body">
                    <strong>${s.name}</strong>
                    غاب عن آخر ${absentCount} حصص - ينصح بالتواصل مع ولي الأمر
                    <div style="margin-top:6px;">
                      <button class="btn btn-text btn-sm" style="padding:4px 0;" onclick="Reports.contactParent('${s.id}')">تجهيز رسالة لولي الأمر →</button>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}

      <div class="section">
        <div class="section-header">
          <h2 class="section-title">سجل اليوم</h2>
        </div>
        ${att.length === 0 ? UI.emptyState('✓', 'لا يوجد سجل حضور اليوم', 'ابدأ بتسجيل حضور إحدى الحصص.').replace('class="empty-state"', 'class="empty-state" style="padding: var(--space-6);"') : `
          <div class="list stagger">
            ${att.sort((a, b) => (a.studentId || '').localeCompare(b.studentId)).map(a => {
              const s = Storage.find(Storage.KEYS.students, a.studentId);
              const lesson = Storage.find(Storage.KEYS.lessons, a.lessonId);
              const group = lesson ? Storage.find(Storage.KEYS.groups, lesson.groupId) : null;
              return `
                <div class="list-item">
                  <div class="avatar avatar-sm">${UI.initials(s ? s.name : '؟')}</div>
                  <div class="list-item-body">
                    <div class="list-item-title">${s ? s.name : '—'}</div>
                    <div class="list-item-subtitle">${group ? group.name : ''} • ${UI.formatTime(lesson ? lesson.startTime : '')}</div>
                  </div>
                  ${UI.attendanceBadge(a.status)}
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;
  },

  bind() {},

  openQuick() {
    const today = new Date().toISOString().slice(0, 10);
    const todayLessons = Storage.list(Storage.KEYS.lessons, l => l.date === today);
    if (todayLessons.length === 0) {
      // Show all groups to pick
      const groups = Storage.list(Storage.KEYS.groups);
      if (groups.length === 0) {
        UI.toast('لا توجد مجموعات. أنشئ مجموعة أولًا', 'warning');
        return;
      }
      UI.modal({
        title: 'تسجيل حضور',
        body: `
          <p style="color:var(--text-secondary);margin-bottom:var(--space-3);">لا توجد حصص مجدولة اليوم. اختر مجموعة لتسجيل الحضور:</p>
          <div class="list">
            ${groups.map(g => `
              <div class="list-item clickable" data-group="${g.id}">
                <div class="list-item-avatar">${g.subject ? g.subject[0] : 'م'}</div>
                <div class="list-item-body">
                  <div class="list-item-title">${g.name}</div>
                  <div class="list-item-subtitle">${g.subject} • ${g.className}</div>
                </div>
              </div>
            `).join('')}
          </div>
        `
      });
      document.querySelectorAll('[data-group]').forEach(el => {
        el.addEventListener('click', () => {
          // Create lesson for today
          const g = Storage.find(Storage.KEYS.groups, el.dataset.group);
          const [h, m] = g.time.split(':').map(Number);
          const end = new Date();
          end.setHours(h, m + g.duration, 0, 0);
          const lesson = Storage.insert(Storage.KEYS.lessons, {
            groupId: g.id,
            date: today,
            startTime: g.time,
            endTime: end.toTimeString().slice(0, 5),
            duration: g.duration,
            location: g.location,
            topic: '',
            notes: '',
            status: 'مجدولة'
          });
          UI.closeModal();
          setTimeout(() => Lessons.startLesson(lesson.id), 300);
        });
      });
      return;
    }

    if (todayLessons.length === 1) {
      Lessons.startLesson(todayLessons[0].id);
      return;
    }

    UI.modal({
      title: 'اختر الحصة',
      body: `
        <div class="list">
          ${todayLessons.map(l => {
            const g = Storage.find(Storage.KEYS.groups, l.groupId);
            const students = Storage.list(Storage.KEYS.students, s => s.groupId === l.groupId && s.status === 'نشط').length;
            const existing = Storage.list(Storage.KEYS.attendance, a => a.lessonId === l.id).length;
            return `
              <div class="list-item clickable" data-lesson="${l.id}">
                <div class="list-item-avatar">${g.subject ? g.subject[0] : 'م'}</div>
                <div class="list-item-body">
                  <div class="list-item-title">${g.name}</div>
                  <div class="list-item-subtitle">${UI.formatTime(l.startTime)} • ${students} طالب ${existing > 0 ? '• ✓ تم' : ''}</div>
                </div>
                ${existing > 0 ? '<span class="badge badge-success">تم</span>' : ''}
              </div>
            `;
          }).join('')}
        </div>
      `
    });
    document.querySelectorAll('[data-lesson]').forEach(el => {
      el.addEventListener('click', () => {
        UI.closeModal();
        setTimeout(() => Lessons.startLesson(el.dataset.lesson), 300);
      });
    });
  }
};

window.Attendance = Attendance;

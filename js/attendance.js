/* ============================================
   مُعلّمي | attendance.js
   الحضور - تسجيل سريع، سجل، تقارير فترات، تنبيهات
   ============================================ */

const Attendance = {
  period: 'today', // today | week | month

  render() {
    const today = Utils.today();
    const settings = Storage.get(Storage.KEYS.settings, {});
    const threshold = settings.absenceAlertThreshold || 3;

    const att = Storage.list(Storage.KEYS.attendance, a => a.date === today);

    // Students with consecutive absences
    const students = Storage.list(Storage.KEYS.students, s => s.status === 'نشط');
    const absStudents = students.filter(s => {
      const lessons = Storage.list(Storage.KEYS.lessons, l => l.groupId === s.groupId && l.status === 'تمت').sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, threshold);
      if (lessons.length < threshold) return false;
      const sAtt = Storage.list(Storage.KEYS.attendance, a => a.studentId === s.id);
      return lessons.every(l => sAtt.some(a => a.lessonId === l.id && a.status === 'غائب'));
    });

    return `
      <div class="page-header">
        <h1 class="page-title">الحضور</h1>
        <p class="page-subtitle">تسجيل ومتابعة حضور الطلاب</p>
      </div>

      <div class="action-row" style="margin-bottom: var(--space-4);">
        <button class="btn btn-primary" style="flex:1;" onclick="Attendance.openQuick()">
          ${Icons.get('check', 18)}
          تسجيل حضور سريع
        </button>
      </div>

      <div class="tabs" id="att-period-tabs">
        <button class="tab ${this.period === 'today' ? 'active' : ''}" data-period="today">اليوم</button>
        <button class="tab ${this.period === 'week' ? 'active' : ''}" data-period="week">هذا الأسبوع</button>
        <button class="tab ${this.period === 'month' ? 'active' : ''}" data-period="month">هذا الشهر</button>
      </div>
      <div id="att-period-content">${this.renderPeriod()}</div>

      ${absStudents.length > 0 ? `
        <div class="section">
          <div class="section-header">
            <h2 class="section-title">تنبيهات الغياب</h2>
            <span class="badge badge-danger">${absStudents.length}</span>
          </div>
          <div class="stagger">
            ${absStudents.map(s => {
              const sAtt = Storage.list(Storage.KEYS.attendance, a => a.studentId === s.id && a.status === 'غائب');
              const lastLessons = Storage.list(Storage.KEYS.lessons, l => l.groupId === s.groupId && l.status === 'تمت').sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, threshold);
              const absentCount = lastLessons.filter(l => sAtt.some(a => a.lessonId === l.id)).length;
              return `
                <div class="alert alert-danger">
                  <div class="alert-icon">${Icons.get('warn', 20)}</div>
                  <div class="alert-body">
                    <strong>${Utils.escapeHTML(s.name)}</strong>
                    غاب عن آخر ${absentCount} حصص - ينصح بالتواصل مع ولي الأمر
                    <div style="margin-top:6px;">
                      <button class="btn btn-text btn-sm" style="padding:4px 0;" onclick="ParentReport.open('${s.id}')">تجهيز تقرير لولي الأمر</button>
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
        ${att.length === 0 ? UI.emptyState(Icons.get('attendance', 36), 'لا يوجد سجل حضور اليوم', 'ابدأ بتسجيل حضور إحدى الحصص.') : `
          <div class="list stagger">
            ${att.sort((a, b) => (a.studentId || '').localeCompare(b.studentId)).map(a => {
              const s = Storage.find(Storage.KEYS.students, a.studentId);
              const lesson = Storage.find(Storage.KEYS.lessons, a.lessonId);
              const group = lesson ? Storage.find(Storage.KEYS.groups, lesson.groupId) : null;
              return `
                <div class="list-item">
                  <div class="avatar avatar-sm">${Utils.escapeHTML(UI.initials(s ? s.name : '؟'))}</div>
                  <div class="list-item-body">
                    <div class="list-item-title">${s ? Utils.escapeHTML(s.name) : '—'}</div>
                    <div class="list-item-subtitle">${group ? Utils.escapeHTML(group.name) : ''} • ${UI.formatTime(lesson ? lesson.startTime : '')}</div>
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

  /* ===== تقرير الفترة (يومي/أسبوعي/شهري) ===== */
  renderPeriod() {
    const start = this.period === 'week' ? Utils.startOfWeek()
      : (this.period === 'month' ? Utils.startOfMonth() : Utils.today());
    const att = Storage.list(Storage.KEYS.attendance, a => a.date >= start);

    if (att.length === 0) {
      return `
        <div class="card" style="margin-bottom: var(--space-4); text-align:center; color:var(--text-tertiary); padding: var(--space-4);">
          لا توجد بيانات حضور في هذه الفترة بعد
        </div>
      `;
    }

    const groups = Storage.list(Storage.KEYS.groups);
    const present = att.filter(a => a.status === 'حاضر').length;
    const absent = att.filter(a => a.status === 'غائب').length;
    const late = att.filter(a => a.status === 'متأخر').length;
    const excused = att.filter(a => a.status === 'غياب بعذر').length;
    const rate = Math.round((present / att.length) * 100);

    // توزيع الحضور حسب المجموعة
    const groupRows = groups.map(g => {
      const gAtt = att.filter(a => a.groupId === g.id);
      if (!gAtt.length) return null;
      const gPresent = gAtt.filter(a => a.status === 'حاضر').length;
      return {
        name: g.name,
        total: gAtt.length,
        absent: gAtt.filter(a => a.status === 'غائب').length,
        rate: Math.round((gPresent / gAtt.length) * 100)
      };
    }).filter(Boolean).sort((a, b) => a.rate - b.rate);

    // أكثر الطلاب غيابًا في الفترة
    const absentByStudent = {};
    att.filter(a => a.status === 'غائب').forEach(a => {
      absentByStudent[a.studentId] = (absentByStudent[a.studentId] || 0) + 1;
    });
    const topAbsent = Object.entries(absentByStudent)
      .map(([sid, count]) => ({ student: Storage.find(Storage.KEYS.students, sid), count }))
      .filter(x => x.student)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return `
      <div class="card" style="margin-bottom: var(--space-4);">
        <div class="stats-grid" style="grid-template-columns: repeat(4, 1fr);">
          <div class="stat-card success"><div class="stat-value">${present}</div><div class="stat-label">حاضر</div></div>
          <div class="stat-card danger"><div class="stat-value">${absent}</div><div class="stat-label">غائب</div></div>
          <div class="stat-card warning"><div class="stat-value">${late}</div><div class="stat-label">متأخر</div></div>
          <div class="stat-card info"><div class="stat-value">${excused}</div><div class="stat-label">بعذر</div></div>
        </div>
        <div style="text-align:center; margin-top: var(--space-3);">
          <span class="badge ${rate >= 80 ? 'badge-success' : (rate >= 65 ? 'badge-warning' : 'badge-danger')}" style="font-size: var(--font-size-sm); padding: 6px 14px;">
            نسبة الحضور العامة: ${rate}%
          </span>
        </div>
      </div>

      ${groupRows.length ? `
        <div class="card" style="margin-bottom: var(--space-4);">
          <h3 class="card-title" style="margin-bottom: var(--space-3);">الحضور حسب المجموعة</h3>
          ${groupRows.map(r => `
            <div style="margin-bottom: var(--space-3);">
              <div style="display:flex; justify-content:space-between; font-size: var(--font-size-xs); margin-bottom: 4px;">
                <span style="font-weight:600;">${Utils.escapeHTML(r.name)}</span>
                <span style="color:var(--text-tertiary);">${r.rate}% • ${r.absent} غياب</span>
              </div>
              <div class="progress-track">
                <div class="progress-fill ${r.rate >= 80 ? '' : (r.rate >= 65 ? 'warning' : 'danger')}" style="width: ${r.rate}%;"></div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${topAbsent.length ? `
        <div class="card">
          <h3 class="card-title" style="margin-bottom: var(--space-2);">أكثر الطلاب غيابًا</h3>
          ${topAbsent.map(x => `
            <div class="list-item">
              <div class="avatar avatar-sm">${Utils.escapeHTML(UI.initials(x.student.name))}</div>
              <div class="list-item-body">
                <div class="list-item-title">${Utils.escapeHTML(x.student.name)}</div>
              </div>
              <span class="badge badge-danger">${x.count} غياب</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
  },

  bind() {
    const tabs = document.getElementById('att-period-tabs');
    if (tabs) {
      tabs.addEventListener('click', (e) => {
        const tab = e.target.closest('.tab');
        if (!tab) return;
        this.period = tab.dataset.period;
        tabs.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
        document.getElementById('att-period-content').innerHTML = this.renderPeriod();
      });
    }
  },

  openQuick() {
    const today = Utils.today();
    const todayLessons = Storage.list(Storage.KEYS.lessons, l => l.date === today);
    if (todayLessons.length === 0) {
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
                <div class="list-item-avatar">${Utils.escapeHTML((g.subject || 'م')[0])}</div>
                <div class="list-item-body">
                  <div class="list-item-title">${Utils.escapeHTML(g.name)}</div>
                  <div class="list-item-subtitle">${Utils.escapeHTML(g.subject)} • ${Utils.escapeHTML(g.className)}</div>
                </div>
              </div>
            `).join('')}
          </div>
        `
      });
      document.querySelectorAll('#modal-content [data-group]').forEach(el => {
        el.addEventListener('click', () => {
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
                <div class="list-item-avatar">${Utils.escapeHTML((g && g.subject ? g.subject : 'م')[0])}</div>
                <div class="list-item-body">
                  <div class="list-item-title">${g ? Utils.escapeHTML(g.name) : '—'}</div>
                  <div class="list-item-subtitle">${UI.formatTime(l.startTime)} • ${students} طالب ${existing > 0 ? '• تم' : ''}</div>
                </div>
                ${existing > 0 ? '<span class="badge badge-success">تم</span>' : ''}
              </div>
            `;
          }).join('')}
        </div>
      `
    });
    document.querySelectorAll('#modal-content [data-lesson]').forEach(el => {
      el.addEventListener('click', () => {
        UI.closeModal();
        setTimeout(() => Lessons.startLesson(el.dataset.lesson), 300);
      });
    });
  }
};

window.Attendance = Attendance;

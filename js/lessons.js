/* ============================================
   مُعلّمي | lessons.js
   الحصص - جدولة، بدء حصة، حصص متكررة
   ============================================ */

const Lessons = {
  render() {
    const lessons = Storage.list(Storage.KEYS.lessons);
    const today = new Date().toISOString().slice(0, 10);
    const todayLessons = lessons.filter(l => l.date === today);
    const upcoming = lessons.filter(l => l.date > today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 10);
    const past = lessons.filter(l => l.date < today).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);

    return `
      <div class="page-header">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <h1 class="page-title">الحصص</h1>
            <p class="page-subtitle">${lessons.length} حصة مجدولة</p>
          </div>
          <button class="btn btn-primary" onclick="Lessons.openAddForm()">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            حصة
          </button>
        </div>
      </div>

      <div class="tabs" id="lessons-tabs">
        <button class="tab active" data-tab="today">اليوم (${todayLessons.length})</button>
        <button class="tab" data-tab="upcoming">القادمة</button>
        <button class="tab" data-tab="past">السابقة</button>
      </div>

      <div id="lessons-tab-content">
        ${this.renderList(todayLessons, 'لا توجد حصص اليوم', 'يبدو أن جدولك هادئ اليوم.')}
      </div>
    `;
  },

  bind() {
    const tabs = document.querySelectorAll('#lessons-tabs .tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.toggle('active', t === tab));
        const t = tab.dataset.tab;
        const lessons = Storage.list(Storage.KEYS.lessons);
        const today = new Date().toISOString().slice(0, 10);
        let list = [];
        let emptyTitle = '', emptyText = '';
        if (t === 'today') {
          list = lessons.filter(l => l.date === today);
          emptyTitle = 'لا توجد حصص اليوم';
          emptyText = 'يبدو أن جدولك هادئ اليوم.';
        } else if (t === 'upcoming') {
          list = lessons.filter(l => l.date > today).sort((a, b) => a.date.localeCompare(b.date));
          emptyTitle = 'لا توجد حصص قادمة';
          emptyText = 'أضف حصة جديدة لجدولتها.';
        } else {
          list = lessons.filter(l => l.date < today).sort((a, b) => b.date.localeCompare(a.date));
          emptyTitle = 'لا توجد حصص سابقة';
          emptyText = 'لم تبدأ أي حصص بعد.';
        }
        document.getElementById('lessons-tab-content').innerHTML = this.renderList(list, emptyTitle, emptyText);
        this.bindListEvents();
      });
    });
    this.bindListEvents();
  },

  bindListEvents() {
    document.querySelectorAll('[data-start-lesson]').forEach(el => {
      el.addEventListener('click', () => this.startLesson(el.dataset.startLesson));
    });
    document.querySelectorAll('[data-lesson-detail]').forEach(el => {
      el.addEventListener('click', () => this.openDetail(el.dataset.lessonDetail));
    });
  },

  renderList(lessons, emptyTitle, emptyText) {
    if (!lessons.length) return UI.emptyState(Icons.get('lessons', 36), emptyTitle, emptyText);
    return `<div class="stagger">${lessons.map(l => this.renderCard(l)).join('')}</div>`;
  },

  renderCard(l) {
    const group = Storage.find(Storage.KEYS.groups, l.groupId);
    if (!group) return '';
    const studentCount = Storage.list(Storage.KEYS.students, s => s.groupId === group.id && s.status === 'نشط').length;
    const att = Storage.list(Storage.KEYS.attendance, a => a.lessonId === l.id);
    const isCompleted = l.status === 'تمت' || att.length > 0;

    return `
      <div class="lesson-card ${l.status === 'تمت' ? 'completed' : ''} ${l.status === 'ملغاة' ? 'cancelled' : ''} ${l.status === 'مؤجلة' ? 'postponed' : ''}" data-lesson-card="${l.id}">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap: var(--space-2); margin-bottom: var(--space-2);">
          <div style="flex:1;">
            <h3 style="font-weight: 700; color: var(--text-primary); font-size: var(--font-size-md); margin-bottom: 4px;">${group.name}</h3>
            <p style="font-size: var(--font-size-xs); color: var(--text-tertiary);">${UI.formatDate(l.date, { weekday: true })}</p>
          </div>
          ${UI.lessonStatusBadge(l.status)}
        </div>
        <div style="display:flex; flex-wrap:wrap; gap: var(--space-3); margin-top: var(--space-3); font-size: var(--font-size-xs); color: var(--text-secondary);">
          <span style="display:inline-flex; align-items:center; gap:4px;">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${UI.formatTime(l.startTime)} - ${UI.formatTime(l.endTime)}
          </span>
          <span style="display:inline-flex; align-items:center; gap:4px;">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            ${studentCount} طالب
          </span>
          ${l.location ? `<span>${Icons.get('location', 13)} ${Utils.escapeHTML(l.location)}</span>` : ''}
        </div>
        ${l.topic ? `<p style="margin-top:8px;font-size:13px;color:var(--text-secondary);">${Icons.get('book', 13)} ${Utils.escapeHTML(l.topic)}</p>` : ''}
        ${att.length > 0 ? `<p style="margin-top:6px;font-size:12px;color:var(--color-success);">✓ تم تسجيل حضور ${att.length} طالب</p>` : ''}
        ${!isCompleted && l.status === 'مجدولة' ? `
          <button class="btn btn-primary btn-block" style="margin-top: var(--space-3);" data-start-lesson="${l.id}">بدء الحصة</button>
        ` : `
          <button class="btn btn-secondary btn-block" style="margin-top: var(--space-3);" data-lesson-detail="${l.id}">عرض التفاصيل</button>
        `}
      </div>
    `;
  },

  openAddForm(groupId = '') {
    const groups = Storage.list(Storage.KEYS.groups);
    if (groups.length === 0) {
      UI.toast('أنشئ مجموعة أولًا', 'warning');
      return;
    }

    UI.modal({
      title: 'إضافة حصة جديدة',
      body: `
        <form id="add-lesson-form">
          <div class="field">
            <label>المجموعة <span class="required">*</span></label>
            <select name="groupId" required>
              ${groups.map(g => `<option value="${g.id}" ${g.id === groupId ? 'selected' : ''}>${g.name}</option>`).join('')}
            </select>
          </div>
          <div class="field-row">
            <div class="field">
              <label>التاريخ <span class="required">*</span></label>
              <input type="date" name="date" required value="${new Date().toISOString().slice(0, 10)}">
            </div>
            <div class="field">
              <label>الوقت <span class="required">*</span></label>
              <input type="time" name="startTime" required>
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label>المدة (دقيقة)</label>
              <input type="number" name="duration" value="90" min="30">
            </div>
            <div class="field">
              <label>الحالة</label>
              <select name="status">
                <option value="مجدولة">مجدولة</option>
                <option value="تعويض">تعويض</option>
              </select>
            </div>
          </div>
          <div class="field">
            <label>المكان</label>
            <input type="text" name="location" placeholder="مكان الحصة">
          </div>
          <div class="field">
            <label>موضوع الدرس</label>
            <input type="text" name="topic" placeholder="مثال: الفصل الأول - الجبر">
          </div>
          <div class="field">
            <label>ملاحظات</label>
            <textarea name="notes" placeholder="ملاحظات..."></textarea>
          </div>
          <div class="action-row" style="margin-top: var(--space-4);">
            <button type="button" class="btn btn-secondary" onclick="UI.closeModal()" style="flex:1">إلغاء</button>
            <button type="submit" class="btn btn-primary" style="flex:1">حفظ</button>
          </div>
        </form>
      `
    });

    // Auto-fill from group
    document.querySelector('[name="groupId"]').addEventListener('change', (e) => {
      const g = Storage.find(Storage.KEYS.groups, e.target.value);
      if (g) {
        document.querySelector('[name="startTime"]').value = g.time;
        document.querySelector('[name="duration"]').value = g.duration;
        document.querySelector('[name="location"]').value = g.location || '';
      }
    });
    // Trigger for pre-selected group
    if (groupId) document.querySelector('[name="groupId"]').dispatchEvent(new Event('change'));

    document.getElementById('add-lesson-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = Object.fromEntries(fd.entries());
      const g = Storage.find(Storage.KEYS.groups, data.groupId);
      data.duration = parseInt(data.duration) || 90;
      const [h, m] = data.startTime.split(':').map(Number);
      const end = new Date(`2000-01-01T${data.startTime}`);
      end.setMinutes(end.getMinutes() + data.duration);
      data.endTime = end.toTimeString().slice(0, 5);
      if (!data.location && g) data.location = g.location;
      Storage.insert(Storage.KEYS.lessons, data);
      UI.toast('تمت إضافة الحصة بنجاح', 'success');
      UI.closeModal();
      if (App.currentPage === 'lessons') App.navigate('lessons');
    });
  },

  startLesson(lessonId) {
    const lesson = Storage.find(Storage.KEYS.lessons, lessonId);
    if (!lesson) return;
    const group = Storage.find(Storage.KEYS.groups, lesson.groupId);
    const students = Storage.list(Storage.KEYS.students, s => s.groupId === lesson.groupId && s.status === 'نشط');
    const existingAtt = Storage.list(Storage.KEYS.attendance, a => a.lessonId === lessonId);

    UI.modal({
      title: 'بدء الحصة وتسجيل الحضور',
      body: `
        <div class="detail-header" style="margin-bottom: var(--space-4); padding: var(--space-4);">
          <h3 style="color:#fff;font-size:var(--font-size-md);margin-bottom:4px;">${group.name}</h3>
          <p style="color:rgba(255,255,255,0.9);font-size:var(--font-size-sm);">${UI.formatDate(lesson.date, { weekday: true })} • ${UI.formatTime(lesson.startTime)}</p>
          <p style="color:rgba(255,255,255,0.7);font-size:var(--font-size-xs);margin-top:6px;">${students.length} طالب • ${lesson.location || ''}</p>
        </div>

        <div class="field">
          <label>موضوع الدرس</label>
          <input type="text" id="lesson-topic" value="${lesson.topic || ''}" placeholder="ما الذي ستشرحه؟">
        </div>

        <div class="field">
          <label>ملاحظات الحصة</label>
          <textarea id="lesson-notes" placeholder="ملاحظات...">${lesson.notes || ''}</textarea>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin: var(--space-4) 0 var(--space-3);">
          <h4 style="font-weight:700;">الحضور (${students.length})</h4>
          <button class="btn btn-text btn-sm" id="mark-all-present">تحديد الكل حاضر</button>
        </div>

        ${students.length === 0 ? UI.emptyState(Icons.get('students', 36), 'لا يوجد طلاب', 'لا توجد طلاب نشطين في هذه المجموعة.') : `
          <div id="attendance-list" style="display:flex; flex-direction:column; gap: var(--space-2); margin-bottom: var(--space-4);">
            ${students.map(s => {
              const ex = existingAtt.find(a => a.studentId === s.id);
              return `
                <div class="card" style="padding: var(--space-3); display:flex; align-items:center; gap: var(--space-3);">
                  <div class="avatar avatar-sm">${UI.initials(s.name)}</div>
                  <div style="flex:1; min-width:0;">
                    <div style="font-weight:600;font-size:var(--font-size-sm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.name}</div>
                  </div>
                  <div style="display:flex; gap:4px;" data-att-group="${s.id}">
                    ${[
                      { v: 'حاضر', l: 'حاضر', c: 'success' },
                      { v: 'غائب', l: 'غائب', c: 'danger' },
                      { v: 'متأخر', l: 'متأخر', c: 'warning' },
                      { v: 'غياب بعذر', l: 'بعذر', c: 'info' }
                    ].map(o => `
                      <button type="button" class="chip ${ex && ex.status === o.v ? 'active' : ''}" data-student="${s.id}" data-status="${o.v}" style="padding: 6px 10px; font-size:11px;">${o.l}</button>
                    `).join('')}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}

        <div class="action-row">
          <button type="button" class="btn btn-secondary" onclick="UI.closeModal()" style="flex:1">إلغاء</button>
          <button type="button" class="btn btn-primary" id="save-attendance" style="flex:1">حفظ الحضور وإنهاء</button>
        </div>
      `
    });

    // Bind attendance buttons
    const attState = {};
    existingAtt.forEach(a => attState[a.studentId] = a.status);
    document.querySelectorAll('[data-att-group]').forEach(group => {
      group.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          group.querySelectorAll('button').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          attState[btn.dataset.student] = btn.dataset.status;
        });
      });
    });

    // Mark all present
    document.getElementById('mark-all-present')?.addEventListener('click', () => {
      students.forEach(s => {
        attState[s.id] = 'حاضر';
      });
      document.querySelectorAll('[data-att-group]').forEach(group => {
        group.querySelectorAll('button').forEach(b => {
          b.classList.toggle('active', b.dataset.status === 'حاضر');
        });
      });
      UI.toast('تم تحديد الكل حاضر', 'success', 1500);
    });

    // Save
    document.getElementById('save-attendance').addEventListener('click', () => {
      const topic = document.getElementById('lesson-topic').value.trim();
      const notes = document.getElementById('lesson-notes').value.trim();

      // Update lesson
      Storage.update(Storage.KEYS.lessons, lessonId, { topic, notes, status: 'تمت' });

      // Update attendance
      students.forEach(s => {
        const status = attState[s.id] || 'حاضر';
        const existing = existingAtt.find(a => a.studentId === s.id);
        if (existing) {
          Storage.update(Storage.KEYS.attendance, existing.id, { status });
        } else {
          Storage.insert(Storage.KEYS.attendance, {
            lessonId,
            groupId: lesson.groupId,
            studentId: s.id,
            date: lesson.date,
            status
          });
        }
      });

      UI.toast(`تم حفظ حضور ${students.length} طالب`, 'success');
      UI.closeModal();
      // Refresh current view
      if (App.currentPage === 'lessons') App.navigate('lessons');
      else if (App.currentPage === 'dashboard') App.navigate('dashboard');
    });
  },

  openDetail(lessonId) {
    const l = Storage.find(Storage.KEYS.lessons, lessonId);
    if (!l) return;
    const group = Storage.find(Storage.KEYS.groups, l.groupId);
    const att = Storage.list(Storage.KEYS.attendance, a => a.lessonId === lessonId);
    const present = att.filter(a => a.status === 'حاضر').length;
    const absent = att.filter(a => a.status === 'غائب').length;
    const late = att.filter(a => a.status === 'متأخر').length;

    UI.modal({
      title: 'تفاصيل الحصة',
      body: `
        <div class="card" style="margin-bottom: var(--space-3);">
          <h3 style="font-weight:700;margin-bottom:8px;">${group.name}</h3>
          <div style="display:grid; gap:6px; font-size: var(--font-size-sm);">
            <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-tertiary);">التاريخ</span><span>${UI.formatDate(l.date, { weekday: true })}</span></div>
            <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-tertiary);">الوقت</span><span>${UI.formatTime(l.startTime)} - ${UI.formatTime(l.endTime)}</span></div>
            ${l.location ? `<div style="display:flex; justify-content:space-between;"><span style="color:var(--text-tertiary);">المكان</span><span>${l.location}</span></div>` : ''}
            <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-tertiary);">الحالة</span>${UI.lessonStatusBadge(l.status)}</div>
          </div>
        </div>

        ${l.topic ? `<div class="card" style="margin-bottom: var(--space-3);"><p style="color:var(--text-tertiary);font-size:var(--font-size-xs);">موضوع الدرس</p><p style="margin-top:4px;">${l.topic}</p></div>` : ''}

        ${att.length > 0 ? `
          <div class="stats-grid" style="margin-bottom: var(--space-3);">
            <div class="stat-card success"><div class="stat-value">${present}</div><div class="stat-label">حاضر</div></div>
            <div class="stat-card danger"><div class="stat-value">${absent}</div><div class="stat-label">غائب</div></div>
            <div class="stat-card warning"><div class="stat-value">${late}</div><div class="stat-label">متأخر</div></div>
          </div>
          <div class="list">
            ${att.map(a => {
              const s = Storage.find(Storage.KEYS.students, a.studentId);
              return `
                <div class="list-item">
                  <div class="avatar avatar-sm">${UI.initials(s ? s.name : '؟')}</div>
                  <div class="list-item-body">
                    <div class="list-item-title">${s ? s.name : '—'}</div>
                  </div>
                  ${UI.attendanceBadge(a.status)}
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}

        <div class="action-row" style="margin-top: var(--space-4);">
          ${l.status === 'مجدولة' ? `<button class="btn btn-primary" style="flex:1;" onclick="UI.closeModal(); Lessons.startLesson('${l.id}')">بدء الحصة</button>` : ''}
          <button class="btn btn-secondary" style="flex:1;" onclick="Lessons.changeStatus('${l.id}')">تغيير الحالة</button>
        </div>
      `
    });
  },

  changeStatus(lessonId) {
    UI.modal({
      title: 'تغيير حالة الحصة',
      body: `
        <div class="list">
          ${['مجدولة', 'تمت', 'ملغاة', 'مؤجلة', 'تعويض'].map(s => `
            <div class="list-item clickable" data-status="${s}">
              <div class="list-item-body"><div class="list-item-title">${s}</div></div>
              ${UI.lessonStatusBadge(s)}
            </div>
          `).join('')}
        </div>
      `
    });
    document.querySelectorAll('[data-status]').forEach(el => {
      el.addEventListener('click', () => {
        Storage.update(Storage.KEYS.lessons, lessonId, { status: el.dataset.status });
        UI.toast('تم تحديث حالة الحصة', 'success');
        UI.closeModal();
        if (App.currentPage === 'lessons') App.navigate('lessons');
      });
    });
  }
};

window.Lessons = Lessons;

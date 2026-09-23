/* ============================================
   مُعلّمي | groups.js
   إدارة المجموعات + صفحة المجموعة
   ============================================ */

const Groups = {
  render() {
    const groups = Storage.list(Storage.KEYS.groups);
    const students = Storage.list(Storage.KEYS.students);

    return `
      <div class="page-header">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <h1 class="page-title">المجموعات</h1>
            <p class="page-subtitle">${groups.length} مجموعة</p>
          </div>
          <button class="btn btn-primary" onclick="Groups.openAddForm()">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            إضافة
          </button>
        </div>
      </div>

      <div id="groups-list"></div>
    `;
  },

  bind() {
    this.renderList();
  },

  renderList() {
    const container = document.getElementById('groups-list');
    if (!container) return;
    const groups = Storage.list(Storage.KEYS.groups);
    const students = Storage.list(Storage.KEYS.students);

    if (groups.length === 0) {
      container.innerHTML = UI.emptyState(
        Icons.get('groups', 36),
        'لا توجد مجموعات',
        'أنشئ أول مجموعة وابدأ تنظيم حصصك.',
        '+ إنشاء مجموعة',
        'add'
      );
      container.querySelector('[data-action="add"]')?.addEventListener('click', () => this.openAddForm());
      return;
    }

    container.innerHTML = `<div class="list stagger">${groups.map(g => this.renderCard(g, students)).join('')}</div>`;
    container.querySelectorAll('[data-group]').forEach(el => {
      el.addEventListener('click', () => this.openGroup(el.dataset.group));
    });
  },

  renderCard(g, students) {
    const groupStudents = students.filter(s => s.groupId === g.id);
    const activeStudents = groupStudents.filter(s => s.status === 'نشط').length;
    const available = Math.max(0, (g.maxStudents || 0) - activeStudents);
    const today = new Date();
    const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][today.getDay()];
    const todayLesson = Storage.list(Storage.KEYS.lessons, l => l.groupId === g.id && l.date === today.toISOString().slice(0, 10));

    const dayMap = { 'sunday':'أحد','monday':'إثنين','tuesday':'ثلاثاء','wednesday':'أربعاء','thursday':'خميس','friday':'جمعة','saturday':'سبت' };

    return `
      <div class="list-item clickable" data-group="${g.id}">
        <div class="quick-action-icon">${g.subject ? g.subject[0] : 'م'}</div>
        <div class="list-item-body">
          <div class="list-item-title">${g.name}</div>
          <div class="list-item-subtitle">${g.subject} • ${g.className}${g.section ? ' • ' + g.section : ''}</div>
          <div style="display:flex; gap:6px; margin-top:6px; flex-wrap:wrap;">
            <span class="badge">${activeStudents} طالب</span>
            <span class="badge badge-info">${(g.days || []).map(d => dayMap[d] || d).join(' / ')}</span>
            <span class="badge badge-gold">${UI.formatTime(g.time)}</span>
            ${todayLesson.length ? '<span class="badge badge-success">حصة اليوم</span>' : ''}
          </div>
        </div>
        <div class="list-item-action">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-tertiary); transform: scaleX(-1);"><path d="m9 18 6-6-6-6"/></svg>
        </div>
      </div>
    `;
  },

  openAddForm() {
    const stages = Storage.get(Storage.KEYS.stages, []);
    const subjects = Storage.get(Storage.KEYS.subjects, []);
    const days = [
      { id: 'saturday', name: 'السبت' },
      { id: 'sunday', name: 'الأحد' },
      { id: 'monday', name: 'الإثنين' },
      { id: 'tuesday', name: 'الثلاثاء' },
      { id: 'wednesday', name: 'الأربعاء' },
      { id: 'thursday', name: 'الخميس' },
      { id: 'friday', name: 'الجمعة' }
    ];

    UI.modal({
      title: 'إنشاء مجموعة جديدة',
      body: `
        <form id="add-group-form">
          <div class="field">
            <label>اسم المجموعة <span class="required">*</span></label>
            <input type="text" name="name" required placeholder="مثال: مجموعة الأول الثانوي - السبت/الأربعاء">
          </div>
          <div class="field-row">
            <div class="field">
              <label>المرحلة</label>
              <select name="stageId" id="group-stage">
                ${stages.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label>الصف <span class="required">*</span></label>
              <select name="className" id="group-class" required></select>
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label>الشعبة</label>
              <input type="text" name="section" placeholder="علمي / أدبي / عام">
            </div>
            <div class="field">
              <label>المادة <span class="required">*</span></label>
              <select name="subject" required>
                ${subjects.map(s => `<option value="${s.name}">${s.name}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="field">
            <label>أيام الدروس <span class="required">*</span></label>
            <div style="display: grid; grid-template-columns: repeat(4,1fr); gap: 6px;">
              ${days.map(d => `
                <label style="display:flex; align-items:center; justify-content:center; gap:4px; padding: var(--space-2); background: var(--color-surface-2); border: 1.5px solid var(--color-surface-3); border-radius: var(--radius-sm); font-size: var(--font-size-xs); cursor: pointer;">
                  <input type="checkbox" name="days" value="${d.id}" style="width:auto;"> ${d.name}
                </label>
              `).join('')}
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label>وقت الدرس <span class="required">*</span></label>
              <input type="time" name="time" required>
            </div>
            <div class="field">
              <label>المدة (دقيقة)</label>
              <input type="number" name="duration" value="90" min="30" max="240">
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label>مكان الدرس</label>
              <input type="text" name="location" placeholder="السنتر - قاعة 1">
            </div>
            <div class="field">
              <label>مستوى المجموعة</label>
              <select name="level">
                <option value="مبتدئ">مبتدئ</option>
                <option value="متوسط" selected>متوسط</option>
                <option value="متقدم">متقدم</option>
              </select>
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label>السعر الشهري (ج.م)</label>
              <input type="number" name="price" min="0" placeholder="500">
            </div>
            <div class="field">
              <label>الحد الأقصى للطلاب</label>
              <input type="number" name="maxStudents" min="1" value="15">
            </div>
          </div>
          <div class="field">
            <label>ملاحظات</label>
            <textarea name="notes" placeholder="ملاحظات عن المجموعة..."></textarea>
          </div>
          <label style="display:flex; align-items:center; gap: var(--space-2); margin: var(--space-3) 0; padding: var(--space-3); background: var(--color-primary-soft); border-radius: var(--radius-sm); font-size: var(--font-size-sm);">
            <input type="checkbox" name="autoLessons" checked style="width:auto;">
            <span>توليد حصص تلقائية للأسبوع القادم بناءً على الأيام المختارة</span>
          </label>
          <div class="action-row">
            <button type="button" class="btn btn-secondary" onclick="UI.closeModal()" style="flex:1">إلغاء</button>
            <button type="submit" class="btn btn-primary" style="flex:1">إنشاء المجموعة</button>
          </div>
        </form>
      `
    });

    // Populate classes on stage change
    const stageSel = document.getElementById('group-stage');
    const classSel = document.getElementById('group-class');
    const updateClasses = () => {
      const stage = stages.find(s => s.id === stageSel.value);
      classSel.innerHTML = stage ? stage.levels.map(l => `<option>${l}</option>`).join('') : '<option value="">اختر المرحلة</option>';
    };
    updateClasses();
    stageSel.addEventListener('change', updateClasses);

    document.getElementById('add-group-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveGroup(new FormData(e.target));
    });
  },

  saveGroup(formData) {
    const data = Object.fromEntries(formData.entries());
    data.days = formData.getAll('days');
    data.autoLessons = formData.get('autoLessons') === 'on';
    data.duration = parseInt(data.duration) || 90;
    data.price = parseFloat(data.price) || 0;
    data.maxStudents = parseInt(data.maxStudents) || 15;

    if (!data.name || !data.days.length || !data.time) {
      UI.toast('أكمل البيانات المطلوبة', 'error');
      return;
    }

    const newGroup = Storage.insert(Storage.KEYS.groups, data);

    // Auto-generate lessons for next 4 weeks
    if (data.autoLessons) {
      this.generateRecurringLessons(newGroup, 4);
    }

    UI.toast('تم إنشاء المجموعة بنجاح', 'success');
    UI.closeModal();
    this.renderList();
    Notifications.add('group', 'مجموعة جديدة', `تمت إضافة ${newGroup.name}`, newGroup.id);
  },

  generateRecurringLessons(group, weeksAhead = 4) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const existingLessons = Storage.list(Storage.KEYS.lessons, l => l.groupId === group.id);
    const existingDates = new Set(existingLessons.map(l => l.date));

    for (let d = 0; d < weeksAhead * 7; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() + d);
      const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
      if (!group.days.includes(dayName)) continue;
      const dateStr = date.toISOString().slice(0, 10);
      if (existingDates.has(dateStr)) continue;
      const [h, m] = group.time.split(':').map(Number);
      const end = new Date(date);
      end.setHours(h, m + group.duration, 0, 0);
      Storage.insert(Storage.KEYS.lessons, {
        groupId: group.id,
        date: dateStr,
        startTime: group.time,
        endTime: end.toTimeString().slice(0, 5),
        duration: group.duration,
        location: group.location,
        topic: '',
        notes: '',
        status: 'مجدولة'
      });
    }
  },

  openGroup(id) {
    const g = Storage.find(Storage.KEYS.groups, id);
    if (!g) return;
    const students = Storage.list(Storage.KEYS.students, s => s.groupId === id);
    const lessons = Storage.list(Storage.KEYS.lessons, l => l.groupId === id);
    const att = Storage.list(Storage.KEYS.attendance, a => a.groupId === id);
    const payments = Storage.list(Storage.KEYS.payments, p => p.groupId === id);
    const exams = Storage.list(Storage.KEYS.exams, e => e.groupId === id);

    const activeStudents = students.filter(s => s.status === 'نشط').length;
    const available = Math.max(0, (g.maxStudents || 0) - activeStudents);
    const attRate = att.length ? Math.round(att.filter(a => a.status === 'حاضر').length / att.length * 100) : 0;
    const totalPaid = payments.reduce((sum, p) => sum + (p.paid || 0), 0);
    const totalReq = payments.reduce((sum, p) => sum + (p.required || 0), 0);
    const outstanding = totalReq - totalPaid;

    const dayMap = { 'sunday':'أحد','monday':'إثنين','tuesday':'ثلاثاء','wednesday':'أربعاء','thursday':'خميس','friday':'جمعة','saturday':'سبت' };

    const container = document.getElementById('page-container');
    container.innerHTML = `
      <div class="page">
        <div class="toolbar" style="margin-bottom: var(--space-3);">
          <button class="icon-btn" onclick="App.navigate('groups')">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
          </button>
          <span style="font-weight: 700; flex:1;">تفاصيل المجموعة</span>
          <button class="icon-btn" onclick="Groups.openEditForm('${g.id}')" aria-label="تعديل">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        </div>

        <div class="detail-header">
          <div class="detail-avatar">${g.subject ? g.subject[0] : 'م'}</div>
          <h2 class="detail-title">${g.name}</h2>
          <p class="detail-subtitle">${g.subject} • ${g.className}${g.section ? ' • ' + g.section : ''}</p>
          <div class="detail-meta">
            <span class="detail-meta-item">${Icons.get('calendar', 13)} ${(g.days || []).map(d => dayMap[d] || d).join(' / ')}</span>
            <span class="detail-meta-item">${Icons.get('clock', 13)} ${UI.formatTime(g.time)}</span>
            ${g.location ? `<span class="detail-meta-item">${Icons.get('location', 13)} ${Utils.escapeHTML(g.location)}</span>` : ''}
          </div>
        </div>

        <div class="stats-grid stagger">
          <div class="stat-card">
            <div class="stat-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div>
            <div class="stat-value">${activeStudents}</div>
            <div class="stat-label">طالب نشط</div>
          </div>
          <div class="stat-card info">
            <div class="stat-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg></div>
            <div class="stat-value">${available}</div>
            <div class="stat-label">أماكن متاحة</div>
          </div>
          <div class="stat-card ${attRate >= 70 ? 'success' : 'warning'}">
            <div class="stat-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
            <div class="stat-value">${attRate}%</div>
            <div class="stat-label">متوسط الحضور</div>
          </div>
          <div class="stat-card ${outstanding > 0 ? 'warning' : 'success'}">
            <div class="stat-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
            <div class="stat-value">${UI.money(outstanding).replace(' ج.م', '')}</div>
            <div class="stat-label">مستحقات (ج.م)</div>
          </div>
        </div>

        <div class="action-row" style="margin-bottom: var(--space-5);">
          <button class="btn btn-primary" onclick="Lessons.openAddForm('${g.id}')">+ حصة</button>
          <button class="btn btn-outline" onclick="Students.openAddForm()">+ طالب</button>
          <button class="btn btn-outline" onclick="Exams.openAddForm('${g.id}')">+ اختبار</button>
          <button class="btn btn-outline" onclick="Reports.openGroupReport('${g.id}')">${Icons.get('report', 16)} تقرير</button>
        </div>

        <div class="tabs" id="group-tabs">
          <button class="tab active" data-tab="students">الطلاب (${students.length})</button>
          <button class="tab" data-tab="lessons">الحصص (${lessons.length})</button>
          <button class="tab" data-tab="exams">الاختبارات (${exams.length})</button>
          <button class="tab" data-tab="payments">المدفوعات</button>
        </div>

        <div id="group-tab-content">
          ${this.renderStudentsTab(students)}
        </div>
      </div>
    `;

    container.querySelectorAll('#group-tabs .tab').forEach(tab => {
      tab.addEventListener('click', () => {
        container.querySelectorAll('#group-tabs .tab').forEach(t => t.classList.toggle('active', t === tab));
        const t = tab.dataset.tab;
        let html = '';
        if (t === 'students') html = this.renderStudentsTab(students);
        else if (t === 'lessons') html = this.renderLessonsTab(lessons);
        else if (t === 'exams') html = this.renderExamsTab(exams);
        else if (t === 'payments') html = this.renderPaymentsTab(payments);
        document.getElementById('group-tab-content').innerHTML = html;
        // Bind
        document.getElementById('group-tab-content').querySelectorAll('[data-student]').forEach(el => {
          el.addEventListener('click', () => Students.openProfile(el.dataset.student));
        });
        document.getElementById('group-tab-content').querySelectorAll('[data-start-lesson]').forEach(el => {
          el.addEventListener('click', () => Lessons.startLesson(el.dataset.startLesson));
        });
      });
    });

    container.querySelectorAll('[data-student]').forEach(el => {
      el.addEventListener('click', () => Students.openProfile(el.dataset.student));
    });
    container.querySelectorAll('[data-start-lesson]').forEach(el => {
      el.addEventListener('click', () => Lessons.startLesson(el.dataset.startLesson));
    });
  },

  renderStudentsTab(students) {
    if (!students.length) return UI.emptyState(Icons.get('students', 36), 'لا يوجد طلاب', 'أضف طلابًا لهذه المجموعة.', '+ إضافة طالب', 'add-student');
    return `<div class="list stagger">${students.map(s => `
      <div class="list-item clickable" data-student="${s.id}">
        <div class="list-item-avatar">${UI.initials(s.name)}</div>
        <div class="list-item-body">
          <div class="list-item-title">${s.name}</div>
          <div class="list-item-subtitle">${s.parentName} • ${s.parentPhone}</div>
        </div>
        ${UI.studentStatus(s.status)}
      </div>
    `).join('')}</div>`;
  },

  renderLessonsTab(lessons) {
    if (!lessons.length) return UI.emptyState(Icons.get('lessons', 36), 'لا توجد حصص', 'لم يتم جدولة حصص بعد.');
    const sorted = [...lessons].sort((a, b) => b.date.localeCompare(a.date));
    return `<div class="list stagger">${sorted.map(l => {
      const att = Storage.list(Storage.KEYS.attendance, a => a.lessonId === l.id).length;
      return `
        <div class="lesson-card ${l.status === 'تمت' ? 'completed' : ''}">
          <div style="display:flex; justify-content:space-between; align-items:start; gap:8px;">
            <div>
              <div style="font-weight:700;">${UI.formatDate(l.date, { weekday: true })}</div>
              <div style="font-size:12px;color:var(--text-tertiary);margin-top:2px;">${UI.formatTime(l.startTime)} - ${UI.formatTime(l.endTime)}${l.location ? ' • ' + l.location : ''}</div>
            </div>
            ${UI.lessonStatusBadge(l.status)}
          </div>
          ${l.topic ? `<p style="margin-top:8px;font-size:13px;color:var(--text-secondary);">${Icons.get('book', 13)} ${Utils.escapeHTML(l.topic)}</p>` : ''}
          ${att > 0 ? `<p style="margin-top:6px;font-size:12px;color:var(--text-tertiary);">✓ تم تسجيل حضور ${att} طالب</p>` : ''}
          ${l.status === 'مجدولة' ? `<button class="btn btn-primary btn-block" style="margin-top:8px;" data-start-lesson="${l.id}">بدء الحصة</button>` : ''}
        </div>
      `;
    }).join('')}</div>`;
  },

  renderExamsTab(exams) {
    if (!exams.length) return UI.emptyState(Icons.get('exam', 36), 'لا توجد اختبارات', 'لم تُضف اختبارات لهذه المجموعة.');
    return `<div class="list stagger">${exams.map(e => {
      const grades = Storage.list(Storage.KEYS.grades, g => g.examId === e.id);
      const avg = grades.length ? Math.round(grades.reduce((s, g) => s + g.score / g.maxGrade * 100, 0) / grades.length) : 0;
      return `
        <div class="list-item">
          <div class="list-item-body">
            <div class="list-item-title">${e.name}</div>
            <div class="list-item-subtitle">${UI.formatDate(e.date)} • ${grades.length} طالب • متوسط ${avg}%</div>
          </div>
          <span class="badge badge-info">${e.maxGrade} درجة</span>
        </div>
      `;
    }).join('')}</div>`;
  },

  renderPaymentsTab(payments) {
    if (!payments.length) return UI.emptyState(Icons.get('wallet', 36), 'لا توجد مدفوعات', 'لم تسجل أي مدفوعات.');
    return `<div class="list stagger">${payments.map(p => {
      const s = Storage.find(Storage.KEYS.students, p.studentId);
      const st = UI.paymentStatus(p.paid || 0, p.required || 0);
      return `
        <div class="list-item">
          <div class="list-item-body">
            <div class="list-item-title">${s ? s.name : '—'}</div>
            <div class="list-item-subtitle">${p.month} • مدفوع: ${UI.money(p.paid)} من ${UI.money(p.required)}</div>
          </div>
          <span class="badge badge-${st.cls}">${st.label}</span>
        </div>
      `;
    }).join('')}</div>`;
  },

  openEditForm(id) {
    const g = Storage.find(Storage.KEYS.groups, id);
    if (!g) return;
    const stages = Storage.get(Storage.KEYS.stages, []);
    const subjects = Storage.get(Storage.KEYS.subjects, []);
    const days = [
      { id: 'saturday', name: 'السبت' },
      { id: 'sunday', name: 'الأحد' },
      { id: 'monday', name: 'الإثنين' },
      { id: 'tuesday', name: 'الثلاثاء' },
      { id: 'wednesday', name: 'الأربعاء' },
      { id: 'thursday', name: 'الخميس' },
      { id: 'friday', name: 'الجمعة' }
    ];

    UI.modal({
      title: 'تعديل بيانات المجموعة',
      body: `
        <form id="edit-group-form">
          <input type="hidden" name="id" value="${g.id}">
          <div class="field">
            <label>اسم المجموعة <span class="required">*</span></label>
            <input type="text" name="name" required value="${g.name || ''}">
          </div>
          <div class="field-row">
            <div class="field">
              <label>المرحلة</label>
              <select name="stageId">${stages.map(s => `<option value="${s.id}" ${g.stageId === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}</select>
            </div>
            <div class="field">
              <label>الصف</label>
              <input type="text" name="className" value="${g.className || ''}">
            </div>
          </div>
          <div class="field-row">
            <div class="field"><label>الشعبة</label><input type="text" name="section" value="${g.section || ''}"></div>
            <div class="field"><label>المادة</label><select name="subject">${subjects.map(s => `<option value="${s.name}" ${g.subject === s.name ? 'selected' : ''}>${s.name}</option>`).join('')}</select></div>
          </div>
          <div class="field">
            <label>أيام الدروس</label>
            <div style="display: grid; grid-template-columns: repeat(4,1fr); gap: 6px;">
              ${days.map(d => `
                <label style="display:flex; align-items:center; justify-content:center; gap:4px; padding: var(--space-2); background: var(--color-surface-2); border: 1.5px solid var(--color-surface-3); border-radius: var(--radius-sm); font-size: var(--font-size-xs); cursor: pointer;">
                  <input type="checkbox" name="days" value="${d.id}" ${g.days && g.days.includes(d.id) ? 'checked' : ''} style="width:auto;"> ${d.name}
                </label>
              `).join('')}
            </div>
          </div>
          <div class="field-row">
            <div class="field"><label>الوقت</label><input type="time" name="time" value="${g.time || ''}"></div>
            <div class="field"><label>المدة</label><input type="number" name="duration" value="${g.duration || 90}"></div>
          </div>
          <div class="field-row">
            <div class="field"><label>المكان</label><input type="text" name="location" value="${g.location || ''}"></div>
            <div class="field"><label>السعر</label><input type="number" name="price" value="${g.price || 0}"></div>
          </div>
          <div class="field-row">
            <div class="field"><label>الحد الأقصى</label><input type="number" name="maxStudents" value="${g.maxStudents || 15}"></div>
            <div class="field"><label>المستوى</label><select name="level">
              <option value="مبتدئ" ${g.level === 'مبتدئ' ? 'selected' : ''}>مبتدئ</option>
              <option value="متوسط" ${g.level === 'متوسط' ? 'selected' : ''}>متوسط</option>
              <option value="متقدم" ${g.level === 'متقدم' ? 'selected' : ''}>متقدم</option>
            </select></div>
          </div>
          <div class="field"><label>ملاحظات</label><textarea name="notes">${g.notes || ''}</textarea></div>
          <div class="action-row" style="margin-top: var(--space-4);">
            <button type="button" class="btn btn-secondary" onclick="UI.closeModal()" style="flex:1">إلغاء</button>
            <button type="submit" class="btn btn-primary" style="flex:1">حفظ</button>
          </div>
        </form>
      `
    });

    document.getElementById('edit-group-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = Object.fromEntries(fd.entries());
      data.days = fd.getAll('days');
      data.duration = parseInt(data.duration) || 90;
      data.price = parseFloat(data.price) || 0;
      data.maxStudents = parseInt(data.maxStudents) || 15;
      Storage.update(Storage.KEYS.groups, g.id, data);
      UI.toast('تم تحديث بيانات المجموعة', 'success');
      UI.closeModal();
      this.openGroup(g.id);
    });
  }
};

window.Groups = Groups;

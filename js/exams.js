/* ============================================
   مُعلّمي | exams.js
   الاختبارات + إدخال الدرجات + إحصائيات
   ============================================ */

const Exams = {
  render() {
    const exams = Storage.list(Storage.KEYS.exams);
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = exams.filter(e => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
    const past = exams.filter(e => e.date < today).sort((a, b) => b.date.localeCompare(a.date));
    // الامتحانات المولدة بالذكاء الاصطناعي — مخزنة منفصلة ولا تلمس الاختبارات العادية
    const aiExams = Storage.list(Storage.KEYS.aiExams || 'ai_exams');

    return `
      <div class="page-header">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <h1 class="page-title">الاختبارات</h1>
            <p class="page-subtitle">${exams.length} اختبار</p>
          </div>
          <button class="btn btn-primary" onclick="Exams.openAddForm()">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            اختبار
          </button>
        </div>
      </div>

      <button class="btn btn-gold btn-block" onclick="AIGenerator.openGenerator()" style="margin-bottom: var(--space-4);">
        ✨ توليد امتحان بالذكاء الاصطناعي
      </button>

      <div class="tabs" id="exams-tabs">
        <button class="tab active" data-tab="upcoming">القادمة (${upcoming.length})</button>
        <button class="tab" data-tab="past">السابقة (${past.length})</button>
        <button class="tab" data-tab="ai">الذكاء الاصطناعي (${aiExams.length})</button>
      </div>

      <div id="exams-tab-content">
        ${this.renderList(upcoming, 'لا توجد اختبارات قادمة', 'أضف اختبارًا جديدًا للمجموعات.')}
      </div>
    `;
  },

  bind() {
    const tabs = document.querySelectorAll('#exams-tabs .tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.toggle('active', t === tab));
        const t = tab.dataset.tab;
        const today = new Date().toISOString().slice(0, 10);
        const exams = Storage.list(Storage.KEYS.exams);
        let list = [];
        if (t === 'upcoming') list = exams.filter(e => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
        else if (t === 'past') list = exams.filter(e => e.date < today).sort((a, b) => b.date.localeCompare(a.date));
        else if (t === 'ai') {
          // تبويب الامتحانات المولدة بالذكاء الاصطناعي (مخزن منفصل)
          document.getElementById('exams-tab-content').innerHTML = window.AIGenerator
            ? AIGenerator.renderSavedTab()
            : UI.emptyState('✨', 'غير متاح', 'لم يتم تحميل وحدة الذكاء الاصطناعي.');
          if (window.AIGenerator) AIGenerator.bindSavedTab();
          return;
        }
        document.getElementById('exams-tab-content').innerHTML = this.renderList(list, 'لا توجد اختبارات', '');
        this.bindListEvents();
      });
    });
    this.bindListEvents();
  },

  bindListEvents() {
    document.querySelectorAll('[data-exam]').forEach(el => {
      el.addEventListener('click', () => this.openDetail(el.dataset.exam));
    });
  },

  renderList(exams, emptyTitle, emptyText) {
    if (!exams.length) return UI.emptyState('📝', emptyTitle, emptyText || '');
    return `<div class="list stagger">${exams.map(e => this.renderCard(e)).join('')}</div>`;
  },

  renderCard(e) {
    const group = Storage.find(Storage.KEYS.groups, e.groupId);
    const grades = Storage.list(Storage.KEYS.grades, g => g.examId === e.id);
    const isPast = new Date(e.date) < new Date();
    const avg = grades.length ? Math.round(grades.reduce((s, g) => s + g.score / g.maxGrade * 100, 0) / grades.length) : 0;
    return `
      <div class="list-item clickable" data-exam="${e.id}">
        <div class="quick-action-icon ${isPast ? 'success' : 'warning'}">📝</div>
        <div class="list-item-body">
          <div class="list-item-title">${e.name}</div>
          <div class="list-item-subtitle">${group ? group.name : ''} • ${UI.formatDate(e.date)}</div>
          <div style="display:flex; gap:6px; margin-top:6px; flex-wrap:wrap;">
            <span class="badge badge-info">${e.maxGrade} درجة</span>
            ${grades.length ? `<span class="badge badge-${avg >= 70 ? 'success' : (avg >= 60 ? 'warning' : 'danger')}">متوسط ${avg}%</span>` : ''}
            <span class="badge">${grades.length} طالب</span>
          </div>
        </div>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-tertiary); transform: scaleX(-1);"><path d="m9 18 6-6-6-6"/></svg>
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
      title: 'إضافة اختبار',
      body: `
        <form id="add-exam-form">
          <div class="field">
            <label>اسم الاختبار <span class="required">*</span></label>
            <input type="text" name="name" required placeholder="مثال: اختبار الوحدة الأولى">
          </div>
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
              <label>الدرجة النهائية <span class="required">*</span></label>
              <input type="number" name="maxGrade" required min="1" value="20">
            </div>
          </div>
          <div class="field">
            <label>الدرس / الوحدة</label>
            <input type="text" name="topic" placeholder="مثال: الوحدة الأولى - الجبر">
          </div>
          <div class="field">
            <label>ملاحظات</label>
            <textarea name="notes" placeholder="ملاحظات..."></textarea>
          </div>
          <div class="action-row">
            <button type="button" class="btn btn-secondary" onclick="UI.closeModal()" style="flex:1">إلغاء</button>
            <button type="submit" class="btn btn-primary" style="flex:1">حفظ</button>
          </div>
        </form>
      `
    });

    // Auto-fill subject from group
    document.querySelector('[name="groupId"]').addEventListener('change', (e) => {
      const g = Storage.find(Storage.KEYS.groups, e.target.value);
      if (g) {
        // We could pre-fill if needed
      }
    });

    document.getElementById('add-exam-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target).entries());
      const group = Storage.find(Storage.KEYS.groups, data.groupId);
      data.subject = group ? group.subject : '';
      data.maxGrade = parseFloat(data.maxGrade) || 20;
      Storage.insert(Storage.KEYS.exams, data);
      UI.toast('تمت إضافة الاختبار بنجاح', 'success');
      UI.closeModal();
      Notifications.add('exam', 'اختبار جديد', `${data.name} - ${UI.formatDate(data.date)}`, data.id);
      if (App.currentPage === 'exams') App.navigate('exams');
    });
  },

  openDetail(examId) {
    const exam = Storage.find(Storage.KEYS.exams, examId);
    if (!exam) return;
    const group = Storage.find(Storage.KEYS.groups, exam.groupId);
    const students = Storage.list(Storage.KEYS.students, s => s.groupId === exam.groupId && s.status === 'نشط');
    const grades = Storage.list(Storage.KEYS.grades, g => g.examId === examId);
    const avg = grades.length ? Math.round(grades.reduce((s, g) => s + g.score / g.maxGrade * 100, 0) / grades.length) : 0;
    const highest = grades.length ? Math.max(...grades.map(g => g.score / g.maxGrade * 100)) : 0;
    const lowest = grades.length ? Math.min(...grades.map(g => g.score / g.maxGrade * 100)) : 0;

    UI.modal({
      title: 'تفاصيل الاختبار',
      body: `
        <div class="card" style="margin-bottom: var(--space-4);">
          <h3 style="font-weight:700;margin-bottom:8px;">${exam.name}</h3>
          <div style="display:grid; gap:6px; font-size: var(--font-size-sm);">
            <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-tertiary);">المجموعة</span><span>${group ? group.name : '—'}</span></div>
            <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-tertiary);">التاريخ</span><span>${UI.formatDate(exam.date)}</span></div>
            <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-tertiary);">الدرجة النهائية</span><span style="font-weight:700;">${exam.maxGrade}</span></div>
            ${exam.topic ? `<div style="display:flex; justify-content:space-between;"><span style="color:var(--text-tertiary);">الموضوع</span><span>${exam.topic}</span></div>` : ''}
          </div>
        </div>

        ${grades.length > 0 ? `
          <div class="stats-grid" style="margin-bottom: var(--space-4);">
            <div class="stat-card ${avg >= 70 ? 'success' : (avg >= 60 ? 'warning' : 'danger')}">
              <div class="stat-value">${avg}%</div>
              <div class="stat-label">المتوسط</div>
            </div>
            <div class="stat-card success">
              <div class="stat-value">${Math.round(highest)}%</div>
              <div class="stat-label">أعلى درجة</div>
            </div>
            <div class="stat-card danger">
              <div class="stat-value">${Math.round(lowest)}%</div>
              <div class="stat-label">أقل درجة</div>
            </div>
            <div class="stat-card info">
              <div class="stat-value">${grades.length}</div>
              <div class="stat-label">طالب</div>
            </div>
          </div>
        ` : ''}

        <div class="section-header" style="margin-bottom: var(--space-3);">
          <h3 class="section-title">درجات الطلاب</h3>
          <button class="btn btn-primary btn-sm" onclick="Exams.openGradeEntry('${examId}')">إدخال / تعديل الدرجات</button>
        </div>

        ${grades.length === 0 ? UI.emptyState('📝', 'لم تُسجل درجات', 'اضغط زر إدخال الدرجات لتسجيل درجات الطلاب.') : `
          <div class="list">
            ${grades.map(g => {
              const s = Storage.find(Storage.KEYS.students, g.studentId);
              const pct = UI.gradePercentage(g.score, g.maxGrade);
              const letter = UI.gradeLetter(pct);
              return `
                <div class="list-item">
                  <div class="avatar avatar-sm">${UI.initials(s ? s.name : '؟')}</div>
                  <div class="list-item-body">
                    <div class="list-item-title">${s ? s.name : '—'}</div>
                    <div class="list-item-subtitle">${g.score} / ${g.maxGrade}</div>
                  </div>
                  <div style="text-align:center;">
                    <div style="font-weight:700; color: var(--color-${letter.cls === 'success' ? 'success' : (letter.cls === 'warning' ? 'warning' : 'danger')});">${Math.round(pct)}%</div>
                    <span class="badge badge-${letter.cls}">${letter.label}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      `
    });
  },

  openGradeEntry(examId) {
    const exam = Storage.find(Storage.KEYS.exams, examId);
    if (!exam) return;
    const students = Storage.list(Storage.KEYS.students, s => s.groupId === exam.groupId && s.status === 'نشط');
    const existingGrades = Storage.list(Storage.KEYS.grades, g => g.examId === examId);

    UI.modal({
      title: `إدخال درجات: ${exam.name}`,
      body: `
        <p style="color:var(--text-secondary); margin-bottom: var(--space-3); font-size: var(--font-size-sm);">الدرجة النهائية: ${exam.maxGrade}</p>
        <div id="grade-entry-list" style="display:flex; flex-direction:column; gap: var(--space-2); margin-bottom: var(--space-4);">
          ${students.map(s => {
            const g = existingGrades.find(g => g.studentId === s.id);
            return `
              <div class="card" style="padding: var(--space-3); display:flex; align-items:center; gap: var(--space-3);">
                <div class="avatar avatar-sm">${UI.initials(s.name)}</div>
                <div style="flex:1; min-width:0;">
                  <div style="font-weight:600; font-size: var(--font-size-sm); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${s.name}</div>
                </div>
                <input type="number" min="0" max="${exam.maxGrade}" step="0.5" value="${g ? g.score : ''}" placeholder="—" data-student-grade="${s.id}" style="width: 70px; padding: var(--space-2); background: var(--color-surface-2); border: 1.5px solid var(--color-surface-3); border-radius: var(--radius-sm); text-align: center; font-weight: 700;">
                <span style="font-size: var(--font-size-xs); color: var(--text-tertiary);">/ ${exam.maxGrade}</span>
              </div>
            `;
          }).join('')}
        </div>
        <div class="action-row">
          <button type="button" class="btn btn-secondary" onclick="UI.closeModal()" style="flex:1">إلغاء</button>
          <button type="button" class="btn btn-primary" id="save-grades" style="flex:1">حفظ الدرجات</button>
        </div>
      `
    });

    document.getElementById('save-grades').addEventListener('click', () => {
      const inputs = document.querySelectorAll('[data-student-grade]');
      let count = 0;
      inputs.forEach(input => {
        const studentId = input.dataset.studentGrade;
        const scoreStr = input.value.trim();
        if (scoreStr === '') return;
        const score = parseFloat(scoreStr);
        if (isNaN(score) || score < 0 || score > exam.maxGrade) return;

        const existing = existingGrades.find(g => g.studentId === studentId);
        if (existing) {
          Storage.update(Storage.KEYS.grades, existing.id, { score });
        } else {
          Storage.insert(Storage.KEYS.grades, {
            examId,
            studentId,
            groupId: exam.groupId,
            score,
            maxGrade: exam.maxGrade,
            notes: ''
          });
        }
        count++;
      });
      UI.toast(`تم حفظ ${count} درجة ✓`, 'success');
      UI.closeModal();
      this.openDetail(examId);
    });
  }
};

window.Exams = Exams;

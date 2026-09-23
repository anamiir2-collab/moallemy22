/* ============================================
   مُعلّمي | students.js
   إدارة الطلاب - بحث، فلاتر، ملف طالب كامل (10 تبويبات)
   ============================================ */

const Students = {
  filters: { search: '', stage: '', subject: '', status: '' },
  currentStudent: null,
  profileTab: 'info',

  render() {
    const students = Storage.list(Storage.KEYS.students);

    return `
      <div class="page-header">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <h1 class="page-title">الطلاب</h1>
            <p class="page-subtitle">${students.length} طالب مسجل</p>
          </div>
          <button class="btn btn-primary" onclick="Students.openAddForm()">
            ${Icons.get('plus', 18)}
            إضافة
          </button>
        </div>
      </div>

      <div class="search-bar">
        ${Icons.get('search', 18)}
        <input type="search" id="student-search" placeholder="ابحث بالاسم أو رقم الهاتف..." value="${Utils.escapeHTML(this.filters.search)}">
      </div>

      <div class="chips" id="stage-chips">
        <button class="chip ${this.filters.status === 'نشط' ? 'active' : ''}" data-status="نشط">نشط</button>
        <button class="chip ${this.filters.status === 'متوقف' ? 'active' : ''}" data-status="متوقف">متوقف</button>
        <button class="chip ${this.filters.status === 'منسحب' ? 'active' : ''}" data-status="منسحب">منسحب</button>
        <button class="chip ${this.filters.status === 'كثير الغياب' ? 'active' : ''}" data-status="كثير الغياب">كثير الغياب</button>
        <button class="chip ${this.filters.status === 'متأخر الدفع' ? 'active' : ''}" data-status="متأخر الدفع">متأخر الدفع</button>
        <button class="chip ${!this.filters.status ? 'active' : ''}" data-status="">الكل</button>
      </div>

      <div id="students-list"></div>
    `;
  },

  bind() {
    const search = document.getElementById('student-search');
    if (search) {
      search.addEventListener('input', Utils.debounce((e) => {
        this.filters.search = e.target.value;
        this.renderList();
      }, 250));
    }

    document.querySelectorAll('[data-status]').forEach(chip => {
      chip.addEventListener('click', () => {
        this.filters.status = chip.dataset.status;
        document.querySelectorAll('[data-status]').forEach(c => c.classList.toggle('active', c === chip));
        this.renderList();
      });
    });

    this.renderList();
  },

  renderList() {
    const container = document.getElementById('students-list');
    if (!container) return;

    let students = Storage.list(Storage.KEYS.students);

    // Apply search
    if (this.filters.search) {
      const q = this.filters.search.toLowerCase();
      students = students.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.parentPhone && s.parentPhone.includes(q)) ||
        (s.studentPhone && s.studentPhone.includes(q))
      );
    }

    // Apply status filter
    if (this.filters.status) {
      if (this.filters.status === 'كثير الغياب') {
        const settings = Storage.get(Storage.KEYS.settings, {});
        const threshold = settings.absenceAlertThreshold || 3;
        students = students.filter(s => {
          const att = Storage.list(Storage.KEYS.attendance, a => a.studentId === s.id && a.status === 'غائب');
          return att.length >= threshold;
        });
      } else if (this.filters.status === 'متأخر الدفع') {
        students = students.filter(s => {
          const pays = Storage.list(Storage.KEYS.payments, p => p.studentId === s.id);
          const req = pays.reduce((sum, p) => sum + (p.required || 0), 0);
          const paid = pays.reduce((sum, p) => sum + (p.paid || 0), 0);
          return req - paid > 0;
        });
      } else {
        students = students.filter(s => s.status === this.filters.status);
      }
    }

    if (students.length === 0) {
      container.innerHTML = UI.emptyState(
        Icons.get('students', 36),
        'لا يوجد طلاب',
        'ابدأ بإضافة أول طالب إلى حسابك.',
        '+ إضافة طالب',
        'add'
      );
      const btn = container.querySelector('[data-action="add"]');
      if (btn) btn.addEventListener('click', () => this.openAddForm());
      return;
    }

    // Sort by name
    students.sort((a, b) => a.name.localeCompare(b.name, 'ar'));

    container.innerHTML = `<div class="list stagger">${students.map(s => this.renderCard(s)).join('')}</div>`;

    container.querySelectorAll('[data-student]').forEach(el => {
      el.addEventListener('click', () => this.openProfile(el.dataset.student));
    });
  },

  renderCard(s) {
    const group = Storage.find(Storage.KEYS.groups, s.groupId);
    const att = Storage.list(Storage.KEYS.attendance, a => a.studentId === s.id);
    const present = att.filter(a => a.status === 'حاضر').length;
    const attRate = att.length ? Math.round((present / att.length) * 100) : 100;

    return `
      <div class="list-item clickable" data-student="${s.id}">
        <div class="list-item-avatar">${Utils.escapeHTML(UI.initials(s.name))}</div>
        <div class="list-item-body">
          <div class="list-item-title">${Utils.escapeHTML(s.name)}</div>
          <div class="list-item-subtitle">${Utils.escapeHTML(s.className || '')}${group ? ' • ' + Utils.escapeHTML(group.name) : ''}</div>
          <div style="display:flex; gap:6px; margin-top:6px; align-items:center;">
            ${UI.studentStatus(s.status)}
            ${attRate < 70 && att.length > 0 ? `<span class="badge badge-danger">حضور ${attRate}%</span>` : ''}
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
    const groups = Storage.list(Storage.KEYS.groups);

    if (groups.length === 0) {
      UI.toast('أنشئ مجموعة أولًا قبل إضافة الطلاب', 'warning');
      setTimeout(() => Groups.openAddForm(), 1000);
      return;
    }

    UI.modal({
      title: 'إضافة طالب جديد',
      body: `
        <form id="add-student-form">
          <div class="field">
            <label>الاسم الرباعي <span class="required">*</span></label>
            <input type="text" name="name" required placeholder="مثال: محمد أحمد علي حسن">
          </div>
          <div class="field-row">
            <div class="field">
              <label>المرحلة <span class="required">*</span></label>
              <select name="stageId" required onchange="Students.updateClasses(this)">
                <option value="">اختر</option>
                ${stages.map(s => `<option value="${s.id}">${Utils.escapeHTML(s.name)}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label>الصف <span class="required">*</span></label>
              <select name="className" id="class-select" required disabled><option value="">اختر المرحلة أولًا</option></select>
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
                ${subjects.map(s => `<option value="${Utils.escapeHTML(s.name)}">${Utils.escapeHTML(s.name)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="field">
            <label>المجموعة <span class="required">*</span></label>
            <select name="groupId" required>
              ${groups.map(g => `<option value="${g.id}">${Utils.escapeHTML(g.name)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>المدرسة</label>
            <input type="text" name="school" placeholder="اسم المدرسة">
          </div>
          <div class="field">
            <label>المحافظة</label>
            <select name="governorate">
              <option value="">اختر</option>
              ${Seeds.governorates.map(g => `<option value="${Utils.escapeHTML(g)}">${Utils.escapeHTML(g)}</option>`).join('')}
            </select>
          </div>
          <div class="field-row">
            <div class="field">
              <label>رقم الطالب</label>
              <input type="tel" name="studentPhone" inputmode="numeric" placeholder="01xxxxxxxxx">
            </div>
            <div class="field">
              <label>اسم ولي الأمر <span class="required">*</span></label>
              <input type="text" name="parentName" required placeholder="اسم ولي الأمر">
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label>رقم ولي الأمر <span class="required">*</span></label>
              <input type="tel" name="parentPhone" inputmode="numeric" required placeholder="01xxxxxxxxx">
            </div>
            <div class="field">
              <label>تاريخ الاشتراك</label>
              <input type="date" name="subscriptionDate" value="${Utils.today()}">
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label>قيمة الاشتراك (ج.م)</label>
              <input type="number" name="subscriptionAmount" min="0" placeholder="500">
            </div>
            <div class="field">
              <label>الحالة</label>
              <select name="status">
                <option value="نشط">نشط</option>
                <option value="متوقف">متوقف</option>
                <option value="منسحب">منسحب</option>
              </select>
            </div>
          </div>
          <div class="field">
            <label>ملاحظات</label>
            <textarea name="notes" placeholder="أي ملاحظات إضافية..."></textarea>
          </div>
          <div class="action-row" style="margin-top: var(--space-4);">
            <button type="button" class="btn btn-secondary" onclick="UI.closeModal()" style="flex:1">إلغاء</button>
            <button type="submit" class="btn btn-primary" style="flex:1">حفظ الطالب</button>
          </div>
        </form>
      `
    });

    document.getElementById('add-student-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveStudent(new FormData(e.target));
    });
  },

  updateClasses(select) {
    const stages = Storage.get(Storage.KEYS.stages, []);
    const stage = stages.find(s => s.id === select.value);
    const classSel = document.getElementById('class-select');
    if (stage) {
      classSel.innerHTML = '<option value="">اختر</option>' + stage.levels.map(l => `<option>${Utils.escapeHTML(l)}</option>`).join('');
      classSel.disabled = false;
    }
  },

  saveStudent(formData) {
    const data = Object.fromEntries(formData.entries());
    if (!data.name || data.name.length < 3) { UI.toast('أدخل اسمًا صحيحًا', 'error'); return; }
    if (!Utils.isEgyptPhone(data.parentPhone)) { UI.toast('رقم ولي الأمر غير صحيح', 'error'); return; }

    // Auto-fill subscription amount from group if not provided
    if (!data.subscriptionAmount) {
      const group = Storage.find(Storage.KEYS.groups, data.groupId);
      data.subscriptionAmount = group ? group.price : 0;
    }

    // Sync subject & className with group's defaults if not set
    const group = Storage.find(Storage.KEYS.groups, data.groupId);
    if (group) {
      if (!data.subject) data.subject = group.subject;
      if (!data.className) data.className = group.className;
      if (!data.stageId) data.stageId = group.stageId;
    }

    // [إصلاح] insert يعيد الطالب بمعرفه النهائي - الربط الصحيح للدفعة
    const student = Storage.insert(Storage.KEYS.students, data);

    // Generate this month's payment record linked to the real student id
    const month = Utils.currentMonth();
    Storage.insert(Storage.KEYS.payments, {
      studentId: student.id,
      groupId: student.groupId,
      month,
      required: parseFloat(data.subscriptionAmount) || 0,
      paid: 0,
      method: '',
      date: null,
      notes: ''
    });

    UI.toast('تم حفظ الطالب بنجاح', 'success');
    UI.closeModal();
    this.renderList();
    Notifications.add('student', 'طالب جديد', `تمت إضافة ${data.name}`, student.id);
  },

  /* ============================================
     فتح ملف الطالب (صفحة مستقلة عبر Router)
     ============================================ */
  openProfile(id) {
    const student = Storage.find(Storage.KEYS.students, id);
    if (!student) return;
    this.currentStudent = student;
    this.profileTab = 'info';
    App.navigate('profile');
  },

  // تُستدعى من Router عند navigate('profile')
  renderProfilePage() {
    const s = Storage.find(Storage.KEYS.students, this.currentStudent && this.currentStudent.id);
    if (!s) return App.pages.students();
    this.currentStudent = s;
    this.renderProfile(s);
  },

  renderProfile(s) {
    const group = Storage.find(Storage.KEYS.groups, s.groupId);
    const data = AIAnalysis.prepare(s.id);
    if (!data) return;
    const perf = AIAnalysis.performance(data);
    const trend = AI.trendLabel(data.gradeTrend);

    const attRate = data.attStats.rate != null ? data.attStats.rate : 100;
    const remaining = data._remaining;

    const container = document.getElementById('page-container');
    container.innerHTML = `
      <div class="page">
        <div class="toolbar" style="margin-bottom: var(--space-3);">
          <button class="icon-btn" onclick="App.navigate('students')" aria-label="رجوع">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" style="transform: scaleX(-1);"><path d="m9 18 6-6-6-6"/></svg>
          </button>
          <span style="font-weight: 700; flex: 1;">ملف الطالب</span>
          <button class="icon-btn" onclick="Students.openEditForm('${s.id}')" aria-label="تعديل">
            ${Icons.get('edit', 20)}
          </button>
          <button class="icon-btn" onclick="Students.confirmDelete('${s.id}')" aria-label="حذف">
            ${Icons.get('trash', 20)}
          </button>
        </div>

        <div class="detail-header">
          <div class="detail-avatar">${Utils.escapeHTML(UI.initials(s.name))}</div>
          <h2 class="detail-title">${Utils.escapeHTML(s.name)}</h2>
          <p class="detail-subtitle">${Utils.escapeHTML(s.className || '')}${s.section ? ' • ' + Utils.escapeHTML(s.section) : ''}${s.subject ? ' • ' + Utils.escapeHTML(s.subject) : ''}</p>
          <div class="detail-meta">
            ${UI.studentStatus(s.status)}
            ${group ? `<span class="detail-meta-item">${Icons.get('groups', 14)} ${Utils.escapeHTML(group.name)}</span>` : ''}
            ${s.parentPhone ? `<span class="detail-meta-item">${Icons.get('phone', 14)} <span dir="ltr">${Utils.escapeHTML(s.parentPhone)}</span></span>` : ''}
          </div>
        </div>

        <div class="stats-grid stagger">
          <div class="stat-card ${perf.score != null ? (perf.score >= 70 ? 'success' : (perf.score >= 60 ? 'warning' : 'danger')) : ''}">
            <div class="stat-icon">${Icons.get('award', 20)}</div>
            <div class="stat-value">${perf.score != null ? perf.score + '%' : '—'}</div>
            <div class="stat-label">متوسط الأداء</div>
          </div>
          <div class="stat-card ${attRate >= 70 ? 'success' : 'danger'}">
            <div class="stat-icon">${Icons.get('attendance', 20)}</div>
            <div class="stat-value">${data.attStats.total ? attRate + '%' : '—'}</div>
            <div class="stat-label">نسبة الحضور</div>
          </div>
          <div class="stat-card ${trend.cls ? trend.cls : ''}">
            <div class="stat-icon">${Icons.get(trend.icon, 20)}</div>
            <div class="stat-value">${trend.change}</div>
            <div class="stat-label">${trend.text}</div>
          </div>
        </div>

        <div class="action-row" style="margin-bottom: var(--space-4); flex-wrap: wrap;">
          <button class="btn btn-outline btn-sm" onclick="Students.openAddGrade('${s.id}')">
            ${Icons.get('plus', 16)} درجة
          </button>
          <button class="btn btn-outline btn-sm" onclick="Students.openAddNote('${s.id}')">
            ${Icons.get('note', 16)} ملاحظة
          </button>
          <button class="btn btn-outline btn-sm" onclick="Reports.openStudentReport('${s.id}')">
            ${Icons.get('file', 16)} تقرير
          </button>
          <button class="btn btn-whatsapp btn-sm" onclick="ParentReport.open('${s.id}')">
            ${Icons.get('whatsapp', 16)} ولي الأمر
          </button>
        </div>

        <div class="tabs" id="profile-tabs">
          <button class="tab ${this.profileTab === 'info' ? 'active' : ''}" data-tab="info">البيانات</button>
          <button class="tab ${this.profileTab === 'attendance' ? 'active' : ''}" data-tab="attendance">الحضور</button>
          <button class="tab ${this.profileTab === 'grades' ? 'active' : ''}" data-tab="grades">الدرجات</button>
          <button class="tab ${this.profileTab === 'assignments' ? 'active' : ''}" data-tab="assignments">الواجبات</button>
          <button class="tab ${this.profileTab === 'exams' ? 'active' : ''}" data-tab="exams">الاختبارات</button>
          <button class="tab ${this.profileTab === 'payments' ? 'active' : ''}" data-tab="payments">المدفوعات</button>
          <button class="tab ${this.profileTab === 'notes' ? 'active' : ''}" data-tab="notes">الملاحظات</button>
          <button class="tab ${this.profileTab === 'reports' ? 'active' : ''}" data-tab="reports">التقارير</button>
          <button class="tab ${this.profileTab === 'ai' ? 'active' : ''}" data-tab="ai">تحليل AI</button>
          <button class="tab ${this.profileTab === 'plan' ? 'active' : ''}" data-tab="plan">خطة التحسين</button>
        </div>

        <div id="profile-tab-content">
          ${this.renderTab(s, 'info')}
        </div>
      </div>
    `;

    // Bind tabs (event delegation على شريط التبويبات)
    const tabsBar = document.getElementById('profile-tabs');
    tabsBar.addEventListener('click', (e) => {
      const tab = e.target.closest('.tab');
      if (!tab) return;
      this.profileTab = tab.dataset.tab;
      tabsBar.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
      document.getElementById('profile-tab-content').innerHTML = this.renderTab(s, this.profileTab);
      this.bindTab(s, this.profileTab);
    });
  },

  renderTab(s, tab) {
    const data = AIAnalysis.prepare(s.id);
    switch (tab) {
      case 'info': return this.renderInfoTab(s, data);
      case 'attendance': return this.renderAttendanceTab(data.attendance);
      case 'grades': return this.renderGradesTab(data);
      case 'assignments': return this.renderAssignmentsTab(data.assignments, data.assignmentStats);
      case 'exams': return this.renderExamsTab(data);
      case 'payments': return this.renderPaymentsTab(s.id);
      case 'notes': return this.renderNotesTab(s.id);
      case 'reports': return this.renderReportsTab(s.id);
      case 'ai': return this.renderAITab(s.id);
      case 'plan': return this.renderPlanTab(s.id);
      default: return '';
    }
  },

  bindTab(s, tab) {
    // أحداث خاصة ببعض التبويبات
    if (tab === 'grades') {
      document.getElementById('add-grade-btn')?.addEventListener('click', () => this.openAddGrade(s.id));
      document.querySelectorAll('[data-del-grade]').forEach(btn => {
        btn.addEventListener('click', () => {
          const gid = btn.dataset.delGrade;
          UI.confirm('حذف هذه الدرجة نهائيًا؟', () => {
            Storage.removeById(Storage.KEYS.grades, gid);
            UI.toast('تم حذف الدرجة', 'success');
            this.renderProfile(s);
          }, { title: 'حذف درجة' });
        });
      });
    } else if (tab === 'notes') {
      document.getElementById('add-note-btn')?.addEventListener('click', () => this.openAddNote(s.id));
      document.querySelectorAll('[data-del-note]').forEach(btn => {
        btn.addEventListener('click', () => {
          Storage.removeById(Storage.KEYS.notes, btn.dataset.delNote);
          UI.toast('تم حذف الملاحظة', 'success');
          this.renderProfile(s);
        });
      });
    } else if (tab === 'plan') {
      document.getElementById('gen-plan-btn')?.addEventListener('click', () => {
        const plan = AI.generateImprovementPlan(s.id);
        this._lastPlan = plan;
        document.getElementById('plan-content').innerHTML = this.renderPlanBody(plan);
        this.bindPlanActions(s);
      });
      document.getElementById('add-goal-btn')?.addEventListener('click', () => this.openAddGoal(s.id));
      this.bindPlanActions(s);
    } else if (tab === 'ai') {
      document.getElementById('run-ai-btn')?.addEventListener('click', () => {
        const box = document.getElementById('ai-result');
        box.innerHTML = `<div class="card" style="text-align:center; color:var(--text-tertiary);">${Icons.get('refresh', 22)} جارٍ التحليل...</div>`;
        setTimeout(() => {
          const result = AI.generateStudentAnalysis(s.id);
          box.innerHTML = this.renderAIResult(result);
        }, 350);
      });
      document.getElementById('ai-to-report-btn')?.addEventListener('click', () => ParentReport.open(s.id));
    } else if (tab === 'reports') {
      document.getElementById('new-report-btn')?.addEventListener('click', () => Reports.openStudentReport(s.id));
      document.getElementById('parent-report-btn')?.addEventListener('click', () => ParentReport.open(s.id));
      document.querySelectorAll('[data-open-report]').forEach(el => {
        el.addEventListener('click', () => Reports.viewSaved(el.dataset.openReport));
      });
      document.querySelectorAll('[data-del-report]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          UI.confirm('حذف هذا التقرير من السجل؟', () => {
            Storage.removeById(Storage.KEYS.reports, btn.dataset.delReport);
            UI.toast('تم حذف التقرير', 'success');
            this.renderProfile(s);
          }, { title: 'حذف تقرير' });
        });
      });
    }
  },

  // ===== 1) تبويب البيانات + Timeline =====
  renderInfoTab(s, data) {
    const group = data.studentProfile.groupName;
    const timeline = AIAnalysis.timeline(s.id, 12);

    return `
      <div class="card" style="margin-bottom: var(--space-4);">
        <h3 class="card-title" style="margin-bottom: var(--space-3);">البيانات الأساسية</h3>
        <div style="display: grid; gap: var(--space-2); font-size: var(--font-size-sm);">
          ${this.row('المدرسة', s.school || '—')}
          ${this.row('المحافظة', s.governorate || '—')}
          ${this.row('ولي الأمر', s.parentName || '—')}
          ${this.row('رقم ولي الأمر', s.parentPhone || '—', true)}
          ${this.row('تاريخ الاشتراك', s.subscriptionDate ? UI.formatDate(s.subscriptionDate) : '—')}
          ${this.row('قيمة الاشتراك', s.subscriptionAmount != null ? UI.money(s.subscriptionAmount) : '—')}
        </div>
      </div>

      ${s.notes ? `
        <div class="card" style="margin-bottom: var(--space-4);">
          <h3 class="card-title" style="margin-bottom: var(--space-2);">ملاحظات عامة</h3>
          <p style="color: var(--text-secondary); font-size: var(--font-size-sm); line-height: 1.6;">${Utils.escapeHTML(s.notes)}</p>
        </div>
      ` : ''}

      <div class="card">
        <h3 class="card-title" style="margin-bottom: var(--space-3);">آخر المستجدات</h3>
        ${timeline.length === 0 ? `<p style="color:var(--text-tertiary); font-size:var(--font-size-sm); text-align:center; padding: var(--space-4);">لا توجد أحداث مسجلة بعد</p>` : `
          <div class="timeline">
            ${timeline.map(ev => `
              <div class="timeline-item">
                <div class="timeline-icon ${ev.cls}">${Icons.get(ev.icon, 14)}</div>
                <div class="timeline-body">
                  <div class="timeline-text">${Utils.escapeHTML(ev.text)}</div>
                  <div class="timeline-date">${ev.date ? UI.formatDate(ev.date) : (ev.ts ? UI.relativeTime(ev.ts) : '')}</div>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  },

  row(label, value, ltr = false) {
    return `
      <div style="display:flex; justify-content:space-between; padding: var(--space-2) 0; border-bottom: 1px solid var(--color-surface-3);">
        <span style="color: var(--text-tertiary);">${label}</span>
        <span style="font-weight: 600; ${ltr ? 'direction:ltr;' : ''}">${Utils.escapeHTML(value)}</span>
      </div>
    `;
  },

  // ===== 2) تبويب الحضور =====
  renderAttendanceTab(attendance) {
    if (!attendance.length) return UI.emptyState(Icons.get('attendance', 36), 'لا يوجد سجل حضور', 'لم يتم تسجيل حضور بعد لهذا الطالب.');
    const sorted = [...attendance].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return `
      <div class="stats-grid" style="margin-bottom: var(--space-4);">
        <div class="stat-card success"><div class="stat-value">${attendance.filter(a => a.status === 'حاضر').length}</div><div class="stat-label">حاضر</div></div>
        <div class="stat-card danger"><div class="stat-value">${attendance.filter(a => a.status === 'غائب').length}</div><div class="stat-label">غائب</div></div>
        <div class="stat-card warning"><div class="stat-value">${attendance.filter(a => a.status === 'متأخر').length}</div><div class="stat-label">متأخر</div></div>
        <div class="stat-card info"><div class="stat-value">${attendance.filter(a => a.status === 'غياب بعذر').length}</div><div class="stat-label">بعذر</div></div>
      </div>
      <div class="list stagger">${sorted.map(a => {
        const lesson = Storage.find(Storage.KEYS.lessons, a.lessonId);
        const group = lesson ? Storage.find(Storage.KEYS.groups, lesson.groupId) : null;
        return `
          <div class="list-item">
            <div class="list-item-body">
              <div class="list-item-title">${UI.formatDate(a.date, { weekday: true })}</div>
              <div class="list-item-subtitle">${group ? Utils.escapeHTML(group.name) : ''}${lesson ? ' • ' + UI.formatTime(lesson.startTime) : ''}</div>
            </div>
            ${UI.attendanceBadge(a.status)}
          </div>
        `;
      }).join('')}</div>`;
  },

  // ===== 3) تبويب الدرجات (مستقلة + اختبارات) =====
  renderGradesTab(data) {
    const grades = data.allGrades;
    if (!grades.length) {
      return UI.emptyState(Icons.get('exam', 36), 'لا توجد درجات', 'أضف أول درجة لهذا الطالب.', 'إضافة درجة', 'grade');
    }
    const sorted = [...grades].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    const examAvg = data.allGrades.filter(g => g.type === 'اختبار' || g.examId);
    const contAvg = data.allGrades.filter(g => g.type === 'تقييم مستمر' || g.type === 'مشاركة');

    return `
      <div class="action-row" style="margin-bottom: var(--space-3);">
        <button class="btn btn-primary btn-sm" id="add-grade-btn" style="flex:1;">${Icons.get('plus', 16)} إضافة درجة</button>
      </div>
      <div class="stats-grid" style="margin-bottom: var(--space-4);">
        <div class="stat-card info"><div class="stat-value">${examAvg.length ? Math.round(examAvg.reduce((s, g) => s + g.pct, 0) / examAvg.length) + '%' : '—'}</div><div class="stat-label">متوسط الاختبارات</div></div>
        <div class="stat-card gold"><div class="stat-value">${contAvg.length ? Math.round(contAvg.reduce((s, g) => s + g.pct, 0) / contAvg.length) + '%' : '—'}</div><div class="stat-label">التقييم المستمر</div></div>
      </div>
      <div class="list stagger">${sorted.map(g => {
        const letter = UI.gradeLetter(g.pct);
        return `
          <div class="list-item">
            <div class="list-item-body">
              <div class="list-item-title">${Utils.escapeHTML(g.title || 'درجة')}</div>
              <div class="list-item-subtitle">
                <span class="badge" style="font-size:10px; padding:1px 6px;">${Utils.escapeHTML(g.type || 'اختبار')}</span>
                ${g.date ? UI.formatDate(g.date) : ''}
              </div>
            </div>
            <div style="text-align:center; display:flex; align-items:center; gap:8px;">
              <div>
                <div style="font-weight: 800; font-size:var(--font-size-sm); color: var(--color-${letter.cls});">${g.score} / ${g.maxGrade}</div>
                <span class="badge badge-${letter.cls}">${Math.round(g.pct)}%</span>
              </div>
              <button class="icon-btn" data-del-grade="${g.id}" aria-label="حذف الدرجة" style="width:32px; height:32px;">${Icons.get('trash', 15)}</button>
            </div>
          </div>
        `;
      }).join('')}</div>`;
  },

  openAddGrade(studentId) {
    const s = Storage.find(Storage.KEYS.students, studentId);
    if (!s) return;
    UI.modal({
      title: 'إضافة درجة للطالب',
      body: `
        <form id="add-grade-form">
          <input type="hidden" name="studentId" value="${studentId}">
          <div class="field-row">
            <div class="field">
              <label>النوع <span class="required">*</span></label>
              <select name="type" required>
                ${Seeds.gradeTypes.map(t => `<option value="${t}">${t}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label>التاريخ</label>
              <input type="date" name="date" value="${Utils.today()}">
            </div>
          </div>
          <div class="field">
            <label>الوصف <span class="required">*</span></label>
            <input type="text" name="title" required placeholder="مثال: تقييم أسبوعي - الجبر">
          </div>
          <div class="field-row">
            <div class="field">
              <label>الدرجة <span class="required">*</span></label>
              <input type="number" name="score" min="0" step="0.5" required>
            </div>
            <div class="field">
              <label>الدرجة النهائية <span class="required">*</span></label>
              <input type="number" name="maxGrade" min="1" step="0.5" value="10" required>
            </div>
          </div>
          <div class="field">
            <label>ملاحظات</label>
            <textarea name="notes" placeholder="اختياري..."></textarea>
          </div>
          <div class="action-row">
            <button type="button" class="btn btn-secondary" onclick="UI.closeModal()" style="flex:1">إلغاء</button>
            <button type="submit" class="btn btn-primary" style="flex:1">حفظ الدرجة</button>
          </div>
        </form>
      `
    });
    document.getElementById('add-grade-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.target).entries());
      if (parseFloat(d.score) > parseFloat(d.maxGrade)) {
        UI.toast('الدرجة أكبر من الدرجة النهائية', 'error');
        return;
      }
      Storage.insert(Storage.KEYS.grades, {
        studentId,
        examId: null,
        groupId: s.groupId,
        type: d.type,
        title: d.title,
        score: parseFloat(d.score),
        maxGrade: parseFloat(d.maxGrade),
        date: d.date || Utils.today(),
        notes: d.notes || ''
      });
      UI.toast('تم حفظ الدرجة', 'success');
      UI.closeModal();
      const cur = Storage.find(Storage.KEYS.students, studentId);
      if (App.currentPage === 'profile') this.renderProfile(cur);
    });
  },

  // ===== 4) تبويب الواجبات =====
  renderAssignmentsTab(subs, stats) {
    if (!subs.length) return UI.emptyState(Icons.get('assignment', 36), 'لا توجد واجبات', 'لم يتم تكليف هذا الطالب بأي واجبات بعد.');
    const statusMap = {
      'submitted': ['success', 'تم التسليم'],
      'not_submitted': ['danger', 'لم يبدأ'],
      'late': ['warning', 'متأخر'],
      'reviewed': ['info', 'تمت المراجعة']
    };
    return `
      <div class="stat-card ${stats.rate >= 80 ? 'success' : (stats.rate >= 60 ? 'warning' : 'danger')}" style="margin-bottom: var(--space-4);">
        <div class="stat-value">${stats.rate != null ? stats.rate + '%' : '—'}</div>
        <div class="stat-label">نسبة الالتزام بالواجبات</div>
      </div>
      <div class="list stagger">${subs.map(sub => {
        const a = Storage.find(Storage.KEYS.assignments, sub.assignmentId);
        const [cls, label] = statusMap[sub.status] || ['info', sub.status];
        return `
          <div class="list-item">
            <div class="list-item-body">
              <div class="list-item-title">${a ? Utils.escapeHTML(a.name) : 'واجب'}</div>
              <div class="list-item-subtitle">${a ? UI.formatDate(a.dueDate) : ''}${sub.score != null && a ? ' • ' + sub.score + '/' + a.maxGrade : ''}</div>
            </div>
            <span class="badge badge-${cls}">${label}</span>
          </div>
        `;
      }).join('')}</div>`;
  },

  // ===== 5) تبويب الاختبارات =====
  renderExamsTab(data) {
    const grades = data.allGrades.filter(g => g.examId);
    if (!grades.length) return UI.emptyState(Icons.get('exam', 36), 'لا توجد درجات اختبارات', 'لم يشارك الطالب في اختبارات مسجلة بعد.');
    const sorted = [...grades].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    return `<div class="list stagger">${sorted.map(g => {
      const exam = Storage.find(Storage.KEYS.exams, g.examId);
      const letter = UI.gradeLetter(g.pct);
      return `
        <div class="list-item">
          <div class="list-item-body">
            <div class="list-item-title">${exam ? Utils.escapeHTML(exam.name) : 'اختبار'}</div>
            <div class="list-item-subtitle">${UI.formatDate(g.date || (exam ? exam.date : ''))} • ${g.score} / ${g.maxGrade}</div>
          </div>
          <div style="text-align:center;">
            <div style="font-weight: 800; color: var(--color-${letter.cls});">${Math.round(g.pct)}%</div>
            <span class="badge badge-${letter.cls}">${letter.label}</span>
          </div>
        </div>
      `;
    }).join('')}</div>`;
  },

  // ===== 6) تبويب المدفوعات =====
  renderPaymentsTab(studentId) {
    const payments = Storage.list(Storage.KEYS.payments, p => p.studentId === studentId);
    if (!payments.length) return UI.emptyState(Icons.get('wallet', 36), 'لا توجد مدفوعات', 'لم تسجل أي مدفوعات لهذا الطالب.');
    const totalReq = payments.reduce((s, p) => s + (p.required || 0), 0);
    const totalPaid = payments.reduce((s, p) => s + (p.paid || 0), 0);
    const sorted = [...payments].sort((a, b) => (b.month || '').localeCompare(a.month || ''));
    return `
      <div class="stats-grid" style="margin-bottom: var(--space-4);">
        <div class="stat-card success"><div class="stat-value">${UI.money(totalPaid).replace(' ج.م', '')}</div><div class="stat-label">المدفوع</div></div>
        <div class="stat-card ${totalReq - totalPaid > 0 ? 'warning' : ''}"><div class="stat-value">${UI.money(totalReq - totalPaid).replace(' ج.م', '')}</div><div class="stat-label">المتبقي</div></div>
      </div>
      <div class="list stagger">${sorted.map(p => {
        const st = UI.paymentStatus(p.paid || 0, p.required || 0);
        return `
          <div class="list-item">
            <div class="list-item-body">
              <div class="list-item-title">${p.month || '—'}</div>
              <div class="list-item-subtitle">مدفوع: ${UI.money(p.paid)} من ${UI.money(p.required)}</div>
            </div>
            <span class="badge badge-${st.cls}">${st.label}</span>
          </div>
        `;
      }).join('')}</div>`;
  },

  // ===== 7) تبويب الملاحظات =====
  renderNotesTab(studentId) {
    const notes = Storage.list(Storage.KEYS.notes, n => n.studentId === studentId)
      .sort((a, b) => b.createdAt - a.createdAt);
    const typeCls = { 'ملاحظة': 'info', 'إنجاز': 'success', 'شكوى': 'danger', 'متابعة': 'warning' };

    return `
      <div class="action-row" style="margin-bottom: var(--space-3);">
        <button class="btn btn-primary btn-sm" id="add-note-btn" style="flex:1;">${Icons.get('plus', 16)} إضافة ملاحظة</button>
      </div>
      ${notes.length === 0
        ? UI.emptyState(Icons.get('note', 36), 'لا توجد ملاحظات', 'سجل ملاحظاتك عن الطالب لتبقى مرجعًا لك.')
        : `<div class="list stagger">${notes.map(n => `
            <div class="list-item">
              <div class="list-item-body">
                <div class="list-item-title">
                  <span class="badge badge-${typeCls[n.type] || ''}" style="font-size:10px; margin-inline-end:6px;">${Utils.escapeHTML(n.type || 'ملاحظة')}</span>
                  ${Utils.escapeHTML(n.text)}
                </div>
                <div class="list-item-subtitle">${UI.relativeTime(n.createdAt)}</div>
              </div>
              <button class="icon-btn" data-del-note="${n.id}" aria-label="حذف" style="width:32px; height:32px;">${Icons.get('trash', 15)}</button>
            </div>
          `).join('')}</div>`
      }
    `;
  },

  openAddNote(studentId) {
    UI.modal({
      title: 'إضافة ملاحظة عن الطالب',
      body: `
        <form id="add-note-form">
          <div class="field">
            <label>النوع</label>
            <select name="type">
              <option value="ملاحظة">ملاحظة</option>
              <option value="إنجاز">إنجاز</option>
              <option value="شكوى">شكوى</option>
              <option value="متابعة">متابعة</option>
            </select>
          </div>
          <div class="field">
            <label>النص <span class="required">*</span></label>
            <textarea name="text" required placeholder="اكتب ملاحظتك هنا..."></textarea>
          </div>
          <div class="action-row">
            <button type="button" class="btn btn-secondary" onclick="UI.closeModal()" style="flex:1">إلغاء</button>
            <button type="submit" class="btn btn-primary" style="flex:1">حفظ</button>
          </div>
        </form>
      `
    });
    document.getElementById('add-note-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.target).entries());
      if (!d.text.trim()) { UI.toast('اكتب نص الملاحظة', 'error'); return; }
      Storage.insert(Storage.KEYS.notes, { studentId, text: d.text.trim(), type: d.type });
      UI.toast('تم حفظ الملاحظة', 'success');
      UI.closeModal();
      const cur = Storage.find(Storage.KEYS.students, studentId);
      if (App.currentPage === 'profile') this.renderProfile(cur);
    });
  },

  // ===== 8) تبويب التقارير =====
  renderReportsTab(studentId) {
    const reports = Storage.list(Storage.KEYS.reports, r => r.studentId === studentId)
      .sort((a, b) => b.createdAt - a.createdAt);
    return `
      <div class="action-row" style="margin-bottom: var(--space-3);">
        <button class="btn btn-primary btn-sm" id="new-report-btn" style="flex:1;">${Icons.get('file', 16)} تقرير جديد</button>
        <button class="btn btn-whatsapp btn-sm" id="parent-report-btn" style="flex:1;">${Icons.get('whatsapp', 16)} تقرير ولي الأمر</button>
      </div>
      ${reports.length === 0
        ? UI.emptyState(Icons.get('file', 36), 'لا توجد تقارير محفوظة', 'التقارير التي تنشئها وتحفظها ستظهر هنا.')
        : `<div class="list stagger">${reports.map(r => `
            <div class="list-item clickable" data-open-report="${r.id}">
              <div class="list-item-avatar">${Icons.get('file', 18)}</div>
              <div class="list-item-body">
                <div class="list-item-title">${Utils.escapeHTML(r.title || r.type)}</div>
                <div class="list-item-subtitle">${Utils.escapeHTML(r.type || '')} • ${UI.relativeTime(r.createdAt)}${r.aiGenerated ? ' • تحليل ذكي' : ''}</div>
              </div>
              <button class="icon-btn" data-del-report="${r.id}" aria-label="حذف" style="width:32px; height:32px;">${Icons.get('trash', 15)}</button>
            </div>
          `).join('')}</div>`
      }
    `;
  },

  // ===== 9) تبويب تحليل AI =====
  renderAITab(studentId) {
    const settings = Storage.get(Storage.KEYS.settings, {});
    const aiOff = settings.aiEnabled === false;
    return `
      ${aiOff ? `
        <div class="alert alert-info" style="margin-bottom: var(--space-3);">
          <div class="alert-icon">${Icons.get('info', 20)}</div>
          <div class="alert-body">التحليل الذكي معطل من الإعدادات. يمكنك تفعيله من: الإعدادات ← إعدادات التقارير.</div>
        </div>
      ` : ''}
      <div class="action-row" style="margin-bottom: var(--space-3);">
        <button class="btn btn-primary btn-sm" id="run-ai-btn" style="flex:1;" ${aiOff ? 'disabled' : ''}>
          ${Icons.get('brain', 16)} تحليل الأداء الآن
        </button>
        <button class="btn btn-outline btn-sm" id="ai-to-report-btn" style="flex:1;">
          ${Icons.get('whatsapp', 16)} تقرير ولي الأمر
        </button>
      </div>
      <div id="ai-result">
        ${this.renderAIResult(AI.generateStudentAnalysis(studentId), true)}
      </div>
    `;
  },

  renderAIResult(result, compact = false) {
    if (!result) {
      return UI.emptyState(Icons.get('brain', 36), 'لا توجد بيانات', 'تعذر تحميل بيانات الطالب للتحليل.');
    }
    const { data, perf, analysis } = result;
    const trend = AI.trendLabel(data.gradeTrend);

    if (compact && !analysis.strengths.length && !analysis.weaknesses.length && data.allGrades.length === 0 && data.attStats.total === 0) {
      return `
        <div class="alert alert-info">
          <div class="alert-icon">${Icons.get('info', 20)}</div>
          <div class="alert-body">لا توجد بيانات كافية بعد (درجات/حضور/واجبات). سجّل بيانات أولًا ثم شغّل التحليل.</div>
        </div>
      `;
    }

    return `
      <div class="ai-card">
        <div class="ai-card-header">
          <div class="ai-badge">${Icons.get('brain', 14)} تحليل محلي من بياناتك</div>
        </div>
        <div class="ai-metrics">
          <div class="ai-metric">
            <span class="ai-metric-value">${perf.score != null ? perf.score + '%' : '—'}</span>
            <span class="ai-metric-label">الأداء العام</span>
          </div>
          <div class="ai-metric">
            <span class="ai-metric-value ${trend.cls}">${trend.change}</span>
            <span class="ai-metric-label">${trend.text}</span>
          </div>
          <div class="ai-metric">
            <span class="ai-metric-value">${data.attStats.total ? data.attStats.rate + '%' : '—'}</span>
            <span class="ai-metric-label">الحضور</span>
          </div>
        </div>
        <p style="line-height:1.8; color:var(--text-secondary); font-size:var(--font-size-sm);">${Utils.escapeHTML(analysis.summary)}</p>
      </div>

      ${analysis.strengths.length ? `
        <div class="card" style="margin-top: var(--space-3);">
          <h3 class="card-title" style="margin-bottom: var(--space-2); color: var(--color-success);">نقاط القوة</h3>
          <ul class="ai-list">
            ${analysis.strengths.map(s => `<li>${Utils.escapeHTML(s)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      ${analysis.weaknesses.length ? `
        <div class="card" style="margin-top: var(--space-3);">
          <h3 class="card-title" style="margin-bottom: var(--space-2); color: var(--color-warning);">نقاط تحتاج عملًا</h3>
          <ul class="ai-list">
            ${analysis.weaknesses.map(s => `<li>${Utils.escapeHTML(s)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      ${analysis.recommendations.length ? `
        <div class="card" style="margin-top: var(--space-3);">
          <h3 class="card-title" style="margin-bottom: var(--space-2);">توصيات للمدرس</h3>
          <ol class="ai-list numbered">
            ${analysis.recommendations.map(s => `<li>${Utils.escapeHTML(s)}</li>`).join('')}
          </ol>
        </div>
      ` : ''}

      ${analysis.notes.length ? `
        <div class="alert alert-info" style="margin-top: var(--space-3);">
          <div class="alert-icon">${Icons.get('info', 18)}</div>
          <div class="alert-body" style="font-size:var(--font-size-xs);">
            ${analysis.notes.map(n => `<div>${Utils.escapeHTML(n)}</div>`).join('')}
          </div>
        </div>
      ` : ''}
    `;
  },

  // ===== 10) تبويب خطة التحسين =====
  renderPlanTab(studentId) {
    const goals = Storage.list(Storage.KEYS.goals, gl => gl.studentId === studentId);
    return `
      <div class="action-row" style="margin-bottom: var(--space-3);">
        <button class="btn btn-primary btn-sm" id="gen-plan-btn" style="flex:1;">${Icons.get('target', 16)} توليد خطة ذكية</button>
        <button class="btn btn-outline btn-sm" id="add-goal-btn" style="flex:1;">${Icons.get('plus', 16)} هدف يدوي</button>
      </div>
      <div id="plan-content">${this.renderPlanBody(this._lastPlan && this._lastPlan.studentId === studentId ? this._lastPlan : null)}</div>

      <div class="card" style="margin-top: var(--space-4);">
        <h3 class="card-title" style="margin-bottom: var(--space-3);">أهداف الطالب</h3>
        ${goals.length === 0 ? `<p style="color:var(--text-tertiary); font-size:var(--font-size-sm); text-align:center; padding: var(--space-3);">لا توجد أهداف بعد</p>` : `
          <div class="list">
            ${goals.map(gl => `
              <div class="list-item">
                <div class="list-item-body">
                  <div class="list-item-title" style="${gl.status === 'متحقق' ? 'text-decoration:line-through; opacity:0.6;' : ''}">${Utils.escapeHTML(gl.title)}</div>
                  <div class="list-item-subtitle">${gl.target ? 'الهدف: ' + Utils.escapeHTML(gl.target) : ''} ${gl.dueDate ? '• حتى ' + UI.formatDate(gl.dueDate) : ''}</div>
                </div>
                <button class="chip ${gl.status === 'متحقق' ? 'active' : ''}" data-toggle-goal="${gl.id}">${gl.status === 'متحقق' ? 'متحقق' : 'قيد التنفيذ'}</button>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  },

  renderPlanBody(plan) {
    if (!plan) {
      return `
        <div class="alert alert-info">
          <div class="alert-icon">${Icons.get('brain', 20)}</div>
          <div class="alert-body">
            اضغط "توليد خطة ذكية" ليقوم المحرك المحلي ببناء خطة مبنية على بيانات الطالب الفعلية (أضعف المكونات أولًا). يمكنك تعديل أي بند بعد التوليد.
          </div>
        </div>
      `;
    }
    return `
      <div class="ai-card">
        <div class="ai-card-header">
          <div class="ai-badge">${Icons.get('target', 14)} خطة تحسين مقترحة</div>
          ${plan.perfScore != null ? `<span class="badge badge-info">الأداء الحالي: ${plan.perfScore}%</span>` : ''}
        </div>
        ${plan.items.map((item, idx) => `
          <div style="border: 1px solid var(--color-surface-3); border-radius: var(--radius-md); padding: var(--space-3); margin-bottom: var(--space-3);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap: var(--space-2);">
              <strong style="font-size:var(--font-size-sm);">${idx + 1}. ${Utils.escapeHTML(item.title)}</strong>
            </div>
            <p style="font-size:var(--font-size-xs); color:var(--text-tertiary); margin: 6px 0;">السبب: ${Utils.escapeHTML(item.why)}</p>
            <ul style="margin: 8px 0; padding-inline-start: 18px; font-size: var(--font-size-sm); color: var(--text-secondary);">
              ${item.steps.map(st => `<li style="margin-bottom:4px;">${Utils.escapeHTML(st)}</li>`).join('')}
            </ul>
            <p style="font-size:var(--font-size-xs); color: var(--color-success);">${Icons.get('target', 12)} مؤشر النجاح: ${Utils.escapeHTML(item.metric)}</p>
          </div>
        `).join('')}
        <p style="font-size:var(--font-size-xs); color:var(--text-tertiary); margin-top: var(--space-2);">${Utils.escapeHTML(plan.disclaimer)}</p>
      </div>
    `;
  },

  bindPlanActions(s) {
    document.querySelectorAll('[data-toggle-goal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const gl = Storage.find(Storage.KEYS.goals, btn.dataset.toggleGoal);
        if (!gl) return;
        Storage.update(Storage.KEYS.goals, gl.id, { status: gl.status === 'متحقق' ? 'قيد التنفيذ' : 'متحقق' });
        this.renderProfile(s);
      });
    });
  },

  openAddGoal(studentId) {
    UI.modal({
      title: 'إضافة هدف للطالب',
      body: `
        <form id="add-goal-form">
          <div class="field">
            <label>عنوان الهدف <span class="required">*</span></label>
            <input type="text" name="title" required placeholder="مثال: إتقان مسائل الوحدة الثالثة">
          </div>
          <div class="field">
            <label>وصف الهدف</label>
            <input type="text" name="target" placeholder="مثال: درجة كاملة في الاختبار القادم">
          </div>
          <div class="field">
            <label>الموعد المستهدف</label>
            <input type="date" name="dueDate" value="${Utils.today()}">
          </div>
          <div class="action-row">
            <button type="button" class="btn btn-secondary" onclick="UI.closeModal()" style="flex:1">إلغاء</button>
            <button type="submit" class="btn btn-primary" style="flex:1">حفظ الهدف</button>
          </div>
        </form>
      `
    });
    document.getElementById('add-goal-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.target).entries());
      if (!d.title.trim()) { UI.toast('اكتب عنوان الهدف', 'error'); return; }
      Storage.insert(Storage.KEYS.goals, {
        studentId, title: d.title.trim(), target: d.target || '', dueDate: d.dueDate || null, status: 'قيد التنفيذ'
      });
      UI.toast('تم حفظ الهدف', 'success');
      UI.closeModal();
      const cur = Storage.find(Storage.KEYS.students, studentId);
      if (App.currentPage === 'profile') this.renderProfile(cur);
    });
  },

  openEditForm(id) {
    const s = Storage.find(Storage.KEYS.students, id);
    if (!s) return;
    const stages = Storage.get(Storage.KEYS.stages, []);
    const subjects = Storage.get(Storage.KEYS.subjects, []);
    const groups = Storage.list(Storage.KEYS.groups);

    UI.modal({
      title: 'تعديل بيانات الطالب',
      body: `
        <form id="edit-student-form">
          <input type="hidden" name="id" value="${s.id}">
          <div class="field">
            <label>الاسم الرباعي <span class="required">*</span></label>
            <input type="text" name="name" required value="${Utils.escapeHTML(s.name || '')}">
          </div>
          <div class="field-row">
            <div class="field">
              <label>المرحلة</label>
              <select name="stageId">
                ${stages.map(st => `<option value="${st.id}" ${s.stageId === st.id ? 'selected' : ''}>${Utils.escapeHTML(st.name)}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label>الصف</label>
              <input type="text" name="className" value="${Utils.escapeHTML(s.className || '')}">
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label>الشعبة</label>
              <input type="text" name="section" value="${Utils.escapeHTML(s.section || '')}">
            </div>
            <div class="field">
              <label>المادة</label>
              <select name="subject">
                ${subjects.map(sub => `<option value="${Utils.escapeHTML(sub.name)}" ${s.subject === sub.name ? 'selected' : ''}>${Utils.escapeHTML(sub.name)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="field">
            <label>المجموعة</label>
            <select name="groupId">
              ${groups.map(g => `<option value="${g.id}" ${s.groupId === g.id ? 'selected' : ''}>${Utils.escapeHTML(g.name)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>المدرسة</label>
            <input type="text" name="school" value="${Utils.escapeHTML(s.school || '')}">
          </div>
          <div class="field-row">
            <div class="field">
              <label>اسم ولي الأمر</label>
              <input type="text" name="parentName" value="${Utils.escapeHTML(s.parentName || '')}">
            </div>
            <div class="field">
              <label>رقم ولي الأمر</label>
              <input type="tel" name="parentPhone" value="${Utils.escapeHTML(s.parentPhone || '')}">
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label>قيمة الاشتراك</label>
              <input type="number" name="subscriptionAmount" value="${s.subscriptionAmount || 0}">
            </div>
            <div class="field">
              <label>الحالة</label>
              <select name="status">
                <option value="نشط" ${s.status === 'نشط' ? 'selected' : ''}>نشط</option>
                <option value="متوقف" ${s.status === 'متوقف' ? 'selected' : ''}>متوقف</option>
                <option value="منسحب" ${s.status === 'منسحب' ? 'selected' : ''}>منسحب</option>
              </select>
            </div>
          </div>
          <div class="field">
            <label>ملاحظات</label>
            <textarea name="notes">${Utils.escapeHTML(s.notes || '')}</textarea>
          </div>
          <div class="action-row" style="margin-top: var(--space-4);">
            <button type="button" class="btn btn-secondary" onclick="UI.closeModal()" style="flex:1">إلغاء</button>
            <button type="submit" class="btn btn-primary" style="flex:1">حفظ</button>
          </div>
        </form>
      `
    });

    document.getElementById('edit-student-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target).entries());
      Storage.update(Storage.KEYS.students, s.id, data);
      UI.toast('تم تحديث بيانات الطالب', 'success');
      UI.closeModal();
      this.renderProfile(Storage.find(Storage.KEYS.students, s.id));
    });
  },

  confirmDelete(id) {
    const s = Storage.find(Storage.KEYS.students, id);
    if (!s) return;
    UI.confirm(
      `هل أنت متأكد من حذف الطالب "${Utils.escapeHTML(s.name)}"؟ سيتم حذف جميع بياناته (الحضور، الدرجات، المدفوعات). لا يمكن التراجع.`,
      () => {
        // Cascade delete
        ['attendance', 'grades', 'submissions', 'payments', 'notes', 'goals'].forEach(col => {
          const items = Storage.list(Storage.KEYS[col], x => x.studentId === id);
          items.forEach(it => Storage.removeById(Storage.KEYS[col], it.id));
        });
        Storage.list(Storage.KEYS.reports, r => r.studentId === id)
          .forEach(r => Storage.removeById(Storage.KEYS.reports, r.id));
        Storage.removeById(Storage.KEYS.students, id);
        Storage.audit('حذف طالب', s.name);
        UI.toast('تم حذف الطالب', 'success');
        App.navigate('students');
      },
      { title: 'حذف طالب', confirmText: 'حذف نهائي' }
    );
  }
};

window.Students = Students;

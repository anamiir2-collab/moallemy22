/* ============================================
   مُعلّمي | students.js
   إدارة الطلاب - بحث، فلاتر، ملف الطالب
   ============================================ */

const Students = {
  filters: { search: '', stage: '', subject: '', status: '' },
  currentStudent: null,

  render() {
    const students = Storage.list(Storage.KEYS.students);
    const stages = Storage.get(Storage.KEYS.stages, []);
    const subjects = Storage.get(Storage.KEYS.subjects, []);

    return `
      <div class="page-header">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <h1 class="page-title">الطلاب</h1>
            <p class="page-subtitle">${students.length} طالب مسجل</p>
          </div>
          <button class="btn btn-primary" onclick="Students.openAddForm()">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            إضافة
          </button>
        </div>
      </div>

      <div class="search-bar">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        <input type="search" id="student-search" placeholder="ابحث بالاسم أو رقم الهاتف..." value="${this.filters.search}">
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
      search.addEventListener('input', (e) => {
        this.filters.search = e.target.value;
        this.renderList();
      });
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
        '👥',
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
        <div class="list-item-avatar">${UI.initials(s.name)}</div>
        <div class="list-item-body">
          <div class="list-item-title">${s.name}</div>
          <div class="list-item-subtitle">${s.className}${group ? ' • ' + group.name : ''}</div>
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
                ${stages.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
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
                ${subjects.map(s => `<option value="${s.name}">${s.name}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="field">
            <label>المجموعة <span class="required">*</span></label>
            <select name="groupId" required>
              ${groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('')}
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
              ${Seeds.governorates.map(g => `<option value="${g}">${g}</option>`).join('')}
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
              <input type="date" name="subscriptionDate" value="${new Date().toISOString().slice(0, 10)}">
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
      classSel.innerHTML = '<option value="">اختر</option>' + stage.levels.map(l => `<option>${l}</option>`).join('');
      classSel.disabled = false;
    }
  },

  saveStudent(formData) {
    const data = Object.fromEntries(formData.entries());
    if (!data.name || data.name.length < 3) { UI.toast('أدخل اسمًا صحيحًا', 'error'); return; }
    if (!/^01[0-2,5]\d{8}$/.test(data.parentPhone)) { UI.toast('رقم ولي الأمر غير صحيح', 'error'); return; }

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

    Storage.insert(Storage.KEYS.students, data);

    // Generate this month's payment record
    const month = new Date().toISOString().slice(0, 7);
    Storage.insert(Storage.KEYS.payments, {
      studentId: data.id || Storage.uid('st_'),
      groupId: data.groupId,
      month,
      required: parseFloat(data.subscriptionAmount) || 0,
      paid: 0,
      method: '',
      date: null,
      notes: ''
    });

    UI.toast('تم حفظ الطالب بنجاح ✓', 'success');
    UI.closeModal();
    this.renderList();
    Notifications.add('student', 'طالب جديد', `تمت إضافة ${data.name}`, data.id);
  },

  openProfile(id) {
    const student = Storage.find(Storage.KEYS.students, id);
    if (!student) return;
    this.currentStudent = student;
    App.navigate('students'); // Stay on students page
    setTimeout(() => this.renderProfile(student), 50);
  },

  renderProfile(s) {
    const group = Storage.find(Storage.KEYS.groups, s.groupId);
    const att = Storage.list(Storage.KEYS.attendance, a => a.studentId === s.id);
    const grades = Storage.list(Storage.KEYS.grades, g => g.studentId === s.id);
    const submissions = Storage.list(Storage.KEYS.submissions, sub => sub.studentId === s.id);
    const payments = Storage.list(Storage.KEYS.payments, p => p.studentId === s.id);

    const present = att.filter(a => a.status === 'حاضر').length;
    const late = att.filter(a => a.status === 'متأخر').length;
    const absent = att.filter(a => a.status === 'غائب').length;
    const excused = att.filter(a => a.status === 'غياب بعذر').length;
    const attRate = att.length ? Math.round((present / att.length) * 100) : 100;

    const avgGrade = grades.length ? Math.round(grades.reduce((sum, g) => sum + (g.score / g.maxGrade) * 100, 0) / grades.length) : 0;

    const submittedSubs = submissions.filter(sub => sub.status === 'submitted' || sub.status === 'reviewed').length;
    const subRate = submissions.length ? Math.round((submittedSubs / submissions.length) * 100) : 100;

    const totalReq = payments.reduce((sum, p) => sum + (p.required || 0), 0);
    const totalPaid = payments.reduce((sum, p) => sum + (p.paid || 0), 0);
    const remaining = totalReq - totalPaid;

    const container = document.getElementById('page-container');
    container.innerHTML = `
      <div class="page">
        <div class="toolbar" style="margin-bottom: var(--space-3);">
          <button class="icon-btn" onclick="App.navigate('students')">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
          </button>
          <span style="font-weight: 700; flex: 1;">ملف الطالب</span>
          <button class="icon-btn" onclick="Students.openEditForm('${s.id}')" aria-label="تعديل">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="icon-btn" onclick="Students.confirmDelete('${s.id}')" aria-label="حذف">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>

        <div class="detail-header">
          <div class="detail-avatar">${UI.initials(s.name)}</div>
          <h2 class="detail-title">${s.name}</h2>
          <p class="detail-subtitle">${s.className}${s.section ? ' • ' + s.section : ''}${s.subject ? ' • ' + s.subject : ''}</p>
          <div class="detail-meta">
            ${UI.studentStatus(s.status)}
            ${group ? `<span class="detail-meta-item">👥 ${group.name}</span>` : ''}
            ${s.parentPhone ? `<span class="detail-meta-item">📞 ${s.parentPhone}</span>` : ''}
          </div>
        </div>

        <div class="stats-grid stagger">
          <div class="stat-card ${attRate >= 70 ? 'success' : 'danger'}">
            <div class="stat-icon">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <div class="stat-value">${attRate}%</div>
            <div class="stat-label">نسبة الحضور</div>
          </div>
          <div class="stat-card danger">
            <div class="stat-icon">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/></svg>
            </div>
            <div class="stat-value">${absent}</div>
            <div class="stat-label">عدد الغياب</div>
          </div>
          <div class="stat-card warning">
            <div class="stat-icon">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div class="stat-value">${late}</div>
            <div class="stat-label">عدد التأخير</div>
          </div>
          <div class="stat-card ${avgGrade >= 70 ? 'success' : (avgGrade >= 60 ? 'warning' : 'danger')}">
            <div class="stat-icon">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
            </div>
            <div class="stat-value">${avgGrade}%</div>
            <div class="stat-label">متوسط الدرجات</div>
          </div>
          <div class="stat-card info">
            <div class="stat-icon">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            </div>
            <div class="stat-value">${subRate}%</div>
            <div class="stat-label">نسبة التسليم</div>
          </div>
          <div class="stat-card ${remaining > 0 ? 'warning' : 'success'}">
            <div class="stat-icon">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <div class="stat-value">${UI.money(remaining).replace(' ج.م', '')}</div>
            <div class="stat-label">المتبقي (ج.م)</div>
          </div>
        </div>

        <div class="action-row" style="margin-bottom: var(--space-5);">
          <button class="btn btn-outline" onclick="Payments.openPaymentForm('${s.id}')">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            تسجيل دفعة
          </button>
          <button class="btn btn-outline" onclick="Reports.openStudentReport('${s.id}')">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            تقرير
          </button>
          <button class="btn btn-outline" onclick="AIGenerator.openStudentAnalysis('${s.id}')">
            🧠 تحليل ذكي
          </button>
          <button class="btn btn-whatsapp" onclick="Reports.contactParent('${s.id}')">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M17.6 6.32A7.85 7.85 0 0 0 12.05 4 7.94 7.94 0 0 0 5.1 15.94L4 20l4.16-1.09a7.93 7.93 0 0 0 3.79.97h.01a7.94 7.94 0 0 0 5.64-13.55zm-5.55 12.21h-.01a6.6 6.6 0 0 1-3.36-.92l-.24-.14-2.47.65.66-2.41-.16-.25a6.59 6.59 0 1 1 5.58 3.07zm3.62-4.94c-.2-.1-1.18-.58-1.36-.65s-.32-.1-.45.1-.52.65-.64.79-.24.15-.44.05a6.6 6.6 0 0 1-1.95-1.2 7.3 7.3 0 0 1-1.35-1.68c-.14-.24 0-.37.1-.49s.2-.24.3-.36.13-.2.2-.33a.37.37 0 0 0 0-.35c0-.1-.45-1.09-.62-1.48s-.33-.34-.45-.34h-.39a.74.74 0 0 0-.54.25 2.25 2.25 0 0 0-.7 1.68 3.94 3.94 0 0 0 .83 2.07 9 9 0 0 0 3.46 3.06 11.6 11.6 0 0 0 1.15.43 2.77 2.77 0 0 0 1.27.08 2.08 2.08 0 0 0 1.36-.96 1.7 1.7 0 0 0 .12-.96c-.05-.07-.18-.12-.38-.22z"/></svg>
            ولي الأمر
          </button>
        </div>

        <div class="tabs" id="profile-tabs">
          <button class="tab active" data-tab="overview">نظرة عامة</button>
          <button class="tab" data-tab="attendance">الحضور</button>
          <button class="tab" data-tab="exams">الاختبارات</button>
          <button class="tab" data-tab="assignments">الواجبات</button>
          <button class="tab" data-tab="payments">المدفوعات</button>
        </div>

        <div id="profile-tab-content">
          ${this.renderOverviewTab(s, group, att, grades, submissions, payments, attRate, avgGrade, remaining)}
        </div>
      </div>
    `;

    // Bind tabs
    container.querySelectorAll('#profile-tabs .tab').forEach(tab => {
      tab.addEventListener('click', () => {
        container.querySelectorAll('#profile-tabs .tab').forEach(t => t.classList.toggle('active', t === tab));
        const t = tab.dataset.tab;
        let html = '';
        if (t === 'overview') html = this.renderOverviewTab(s, group, att, grades, submissions, payments, attRate, avgGrade, remaining);
        else if (t === 'attendance') html = this.renderAttendanceTab(att);
        else if (t === 'exams') html = this.renderExamsTab(grades);
        else if (t === 'assignments') html = this.renderAssignmentsTab(submissions);
        else if (t === 'payments') html = this.renderPaymentsTab(payments);
        document.getElementById('profile-tab-content').innerHTML = html;
      });
    });
  },

  renderOverviewTab(s, group, att, grades, submissions, payments, attRate, avgGrade, remaining) {
    return `
      <div class="card" style="margin-bottom: var(--space-4);">
        <h3 class="card-title" style="margin-bottom: var(--space-3);">البيانات الأساسية</h3>
        <div style="display: grid; gap: var(--space-2); font-size: var(--font-size-sm);">
          <div style="display:flex; justify-content:space-between; padding: var(--space-2) 0; border-bottom: 1px solid var(--color-surface-3);">
            <span style="color: var(--text-tertiary);">المدرسة</span>
            <span style="font-weight: 600;">${s.school || '—'}</span>
          </div>
          <div style="display:flex; justify-content:space-between; padding: var(--space-2) 0; border-bottom: 1px solid var(--color-surface-3);">
            <span style="color: var(--text-tertiary);">المحافظة</span>
            <span style="font-weight: 600;">${s.governorate || '—'}</span>
          </div>
          <div style="display:flex; justify-content:space-between; padding: var(--space-2) 0; border-bottom: 1px solid var(--color-surface-3);">
            <span style="color: var(--text-tertiary);">ولي الأمر</span>
            <span style="font-weight: 600;">${s.parentName || '—'}</span>
          </div>
          <div style="display:flex; justify-content:space-between; padding: var(--space-2) 0; border-bottom: 1px solid var(--color-surface-3);">
            <span style="color: var(--text-tertiary);">رقم ولي الأمر</span>
            <span style="font-weight: 600; direction: ltr;">${s.parentPhone || '—'}</span>
          </div>
          <div style="display:flex; justify-content:space-between; padding: var(--space-2) 0; border-bottom: 1px solid var(--color-surface-3);">
            <span style="color: var(--text-tertiary);">تاريخ الاشتراك</span>
            <span style="font-weight: 600;">${UI.formatDate(s.subscriptionDate)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; padding: var(--space-2) 0;">
            <span style="color: var(--text-tertiary);">قيمة الاشتراك</span>
            <span style="font-weight: 600;">${UI.money(s.subscriptionAmount)}</span>
          </div>
        </div>
      </div>

      ${s.notes ? `
        <div class="card">
          <h3 class="card-title" style="margin-bottom: var(--space-2);">ملاحظات</h3>
          <p style="color: var(--text-secondary); font-size: var(--font-size-sm); line-height: 1.6;">${s.notes}</p>
        </div>
      ` : ''}
    `;
  },

  renderAttendanceTab(att) {
    if (!att.length) return UI.emptyState('✓', 'لا يوجد سجل حضور', 'لم يتم تسجيل حضور بعد لهذا الطالب.');
    const sorted = [...att].sort((a, b) => b.date.localeCompare(a.date));
    return `<div class="list stagger">${sorted.map(a => {
      const lesson = Storage.find(Storage.KEYS.lessons, a.lessonId);
      const group = lesson ? Storage.find(Storage.KEYS.groups, lesson.groupId) : null;
      return `
        <div class="list-item">
          <div class="list-item-body">
            <div class="list-item-title">${UI.formatDate(a.date, { weekday: true })}</div>
            <div class="list-item-subtitle">${group ? group.name : ''}${lesson ? ' • ' + UI.formatTime(lesson.startTime) : ''}</div>
          </div>
          ${UI.attendanceBadge(a.status)}
        </div>
      `;
    }).join('')}</div>`;
  },

  renderExamsTab(grades) {
    if (!grades.length) return UI.emptyState('📝', 'لا توجد درجات', 'لم يتم تسجيل درجات بعد.');
    return `<div class="list stagger">${grades.map(g => {
      const exam = Storage.find(Storage.KEYS.exams, g.examId);
      const pct = UI.gradePercentage(g.score, g.maxGrade);
      const letter = UI.gradeLetter(pct);
      return `
        <div class="list-item">
          <div class="list-item-body">
            <div class="list-item-title">${exam ? exam.name : 'اختبار'}</div>
            <div class="list-item-subtitle">${UI.formatDate(exam ? exam.date : '')} • ${g.score} / ${g.maxGrade}</div>
          </div>
          <div style="text-align:center;">
            <div style="font-weight: 800; color: var(--color-${letter.cls === 'success' ? 'success' : (letter.cls === 'warning' ? 'warning' : 'danger')});">${Math.round(pct)}%</div>
            <span class="badge badge-${letter.cls}">${letter.label}</span>
          </div>
        </div>
      `;
    }).join('')}</div>`;
  },

  renderAssignmentsTab(subs) {
    if (!subs.length) return UI.emptyState('📋', 'لا توجد واجبات', 'لم يتم تكليف هذا الطالب بأي واجبات بعد.');
    const statusMap = {
      'submitted': ['success', 'تم التسليم'],
      'not_submitted': ['danger', 'لم يسلم'],
      'late': ['warning', 'متأخر'],
      'reviewed': ['info', 'تمت المراجعة']
    };
    return `<div class="list stagger">${subs.map(sub => {
      const a = Storage.find(Storage.KEYS.assignments, sub.assignmentId);
      const [cls, label] = statusMap[sub.status] || ['info', sub.status];
      return `
        <div class="list-item">
          <div class="list-item-body">
            <div class="list-item-title">${a ? a.name : 'واجب'}</div>
            <div class="list-item-subtitle">${a ? UI.formatDate(a.dueDate) : ''}${sub.score != null ? ' • ' + sub.score + '/' + a.maxGrade : ''}</div>
          </div>
          <span class="badge badge-${cls}">${label}</span>
        </div>
      `;
    }).join('')}</div>`;
  },

  renderPaymentsTab(payments) {
    if (!payments.length) return UI.emptyState('💰', 'لا توجد مدفوعات', 'لم تسجل أي مدفوعات لهذا الطالب.');
    const sorted = [...payments].sort((a, b) => (b.month || '').localeCompare(a.month || ''));
    return `<div class="list stagger">${sorted.map(p => {
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
            <input type="text" name="name" required value="${s.name || ''}">
          </div>
          <div class="field-row">
            <div class="field">
              <label>المرحلة</label>
              <select name="stageId">
                ${stages.map(st => `<option value="${st.id}" ${s.stageId === st.id ? 'selected' : ''}>${st.name}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label>الصف</label>
              <input type="text" name="className" value="${s.className || ''}">
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label>الشعبة</label>
              <input type="text" name="section" value="${s.section || ''}">
            </div>
            <div class="field">
              <label>المادة</label>
              <select name="subject">
                ${subjects.map(sub => `<option value="${sub.name}" ${s.subject === sub.name ? 'selected' : ''}>${sub.name}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="field">
            <label>المجموعة</label>
            <select name="groupId">
              ${groups.map(g => `<option value="${g.id}" ${s.groupId === g.id ? 'selected' : ''}>${g.name}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>المدرسة</label>
            <input type="text" name="school" value="${s.school || ''}">
          </div>
          <div class="field-row">
            <div class="field">
              <label>اسم ولي الأمر</label>
              <input type="text" name="parentName" value="${s.parentName || ''}">
            </div>
            <div class="field">
              <label>رقم ولي الأمر</label>
              <input type="tel" name="parentPhone" value="${s.parentPhone || ''}">
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
            <textarea name="notes">${s.notes || ''}</textarea>
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
      `هل أنت متأكد من حذف الطالب "${s.name}"؟ سيتم حذف جميع بياناته (الحضور، الدرجات، المدفوعات). لا يمكن التراجع.`,
      () => {
        // Cascade delete
        ['attendance', 'grades', 'submissions', 'payments'].forEach(col => {
          const items = Storage.list(Storage.KEYS[col], x => x.studentId === id);
          items.forEach(it => Storage.removeById(Storage.KEYS[col], it.id));
        });
        Storage.removeById(Storage.KEYS.students, id);
        UI.toast('تم حذف الطالب', 'success');
        App.navigate('students');
      },
      { title: 'حذف طالب', confirmText: 'حذف نهائي' }
    );
  }
};

window.Students = Students;

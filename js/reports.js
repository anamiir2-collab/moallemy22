/* ============================================
   مُعلّمي | reports.js
   التقارير + مشاركة عبر WhatsApp
   ============================================ */

const Reports = {
  render() {
    const students = Storage.list(Storage.KEYS.students);
    const groups = Storage.list(Storage.KEYS.groups);
    const payments = Storage.list(Storage.KEYS.payments);

    return `
      <div class="page-header">
        <h1 class="page-title">التقارير</h1>
        <p class="page-subtitle">تقارير شاملة للطلاب والمجموعات</p>
      </div>

      <div class="section">
        <h2 class="section-title" style="margin-bottom: var(--space-3);">📊 تقارير سريعة</h2>
        <div class="list stagger">
          <div class="list-item clickable" data-report="student">
            <div class="quick-action-icon">👤</div>
            <div class="list-item-body">
              <div class="list-item-title">تقرير طالب</div>
              <div class="list-item-subtitle">تقرير شامل لطالب معين</div>
            </div>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-tertiary); transform: scaleX(-1);"><path d="m9 18 6-6-6-6"/></svg>
          </div>
          <div class="list-item clickable" data-report="group">
            <div class="quick-action-icon">👥</div>
            <div class="list-item-body">
              <div class="list-item-title">تقرير مجموعة</div>
              <div class="list-item-subtitle">إحصائيات وأداء مجموعة كاملة</div>
            </div>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-tertiary); transform: scaleX(-1);"><path d="m9 18 6-6-6-6"/></svg>
          </div>
          <div class="list-item clickable" data-report="financial">
            <div class="quick-action-icon gold">💰</div>
            <div class="list-item-body">
              <div class="list-item-title">التقرير المالي</div>
              <div class="list-item-subtitle">دخل ومستحقات وإيرادات</div>
            </div>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-tertiary); transform: scaleX(-1);"><path d="m9 18 6-6-6-6"/></svg>
          </div>
          <div class="list-item clickable" data-report="analytics">
            <div class="quick-action-icon info">📈</div>
            <div class="list-item-body">
              <div class="list-item-title">تحليلات الطلاب</div>
              <div class="list-item-subtitle">رؤى مستخرجة من البيانات</div>
            </div>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-tertiary); transform: scaleX(-1);"><path d="m9 18 6-6-6-6"/></svg>
          </div>
        </div>
      </div>

      <div class="section">
        <h2 class="section-title" style="margin-bottom: var(--space-3);">🔗 ربط مع أولياء الأمور</h2>
        <div class="card">
          <p style="color: var(--text-secondary); font-size: var(--font-size-sm); line-height: 1.6; margin-bottom: var(--space-3);">يمكنك إرسال تقارير فردية لأولياء الأمور عبر WhatsApp مباشرةً. اختر الطالب لبدء الإجراء.</p>
          <button class="btn btn-whatsapp btn-block" onclick="Reports.openParentShare()">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M17.6 6.32A7.85 7.85 0 0 0 12.05 4 7.94 7.94 0 0 0 5.1 15.94L4 20l4.16-1.09a7.93 7.93 0 0 0 3.79.97h.01a7.94 7.94 0 0 0 5.64-13.55z"/></svg>
            إرسال تقرير لولي الأمر
          </button>
        </div>
      </div>
    `;
  },

  bind() {
    document.querySelectorAll('[data-report]').forEach(el => {
      el.addEventListener('click', () => {
        const type = el.dataset.report;
        if (type === 'student') this.openStudentReport();
        else if (type === 'group') this.openGroupReport();
        else if (type === 'financial') this.openFinancialReport();
        else if (type === 'analytics') this.openAnalytics();
      });
    });
  },

  openGenerator() {
    this.openStudentReport();
  },

  // ===== Student Report =====
  openStudentReport(studentId = null) {
    if (studentId) {
      this.showStudentReport(studentId);
      return;
    }
    const students = Storage.list(Storage.KEYS.students);
    if (students.length === 0) {
      UI.toast('لا يوجد طلاب', 'warning');
      return;
    }
    UI.modal({
      title: 'اختر الطالب',
      body: `
        <div class="search-bar">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="search" id="report-student-search" placeholder="ابحث...">
        </div>
        <div id="report-students-list" style="max-height: 60vh; overflow-y: auto;">
          ${students.map(s => `
            <div class="list-item clickable" data-student="${s.id}">
              <div class="avatar avatar-sm">${UI.initials(s.name)}</div>
              <div class="list-item-body">
                <div class="list-item-title">${s.name}</div>
                <div class="list-item-subtitle">${s.className} • ${s.subject}</div>
              </div>
            </div>
          `).join('')}
        </div>
      `
    });
    document.getElementById('report-student-search').addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('[data-student]').forEach(el => {
        const name = el.querySelector('.list-item-title').textContent.toLowerCase();
        el.style.display = name.includes(q) ? '' : 'none';
      });
    });
    document.querySelectorAll('[data-student]').forEach(el => {
      el.addEventListener('click', () => {
        UI.closeModal();
        setTimeout(() => this.showStudentReport(el.dataset.student), 300);
      });
    });
  },

  showStudentReport(studentId) {
    const s = Storage.find(Storage.KEYS.students, studentId);
    if (!s) return;
    const group = Storage.find(Storage.KEYS.groups, s.groupId);
    const att = Storage.list(Storage.KEYS.attendance, a => a.studentId === studentId);
    const grades = Storage.list(Storage.KEYS.grades, g => g.studentId === studentId);
    const subs = Storage.list(Storage.KEYS.submissions, sub => sub.studentId === studentId);
    const payments = Storage.list(Storage.KEYS.payments, p => p.studentId === studentId);
    const teacher = Auth.getTeacher();

    const present = att.filter(a => a.status === 'حاضر').length;
    const absent = att.filter(a => a.status === 'غائب').length;
    const late = att.filter(a => a.status === 'متأخر').length;
    const attRate = att.length ? Math.round(present / att.length * 100) : 100;
    const avgGrade = grades.length ? Math.round(grades.reduce((sum, g) => sum + g.score / g.maxGrade * 100, 0) / grades.length) : 0;
    const submitted = subs.filter(sub => sub.status === 'submitted' || sub.status === 'reviewed').length;
    const totalReq = payments.reduce((sum, p) => sum + (p.required || 0), 0);
    const totalPaid = payments.reduce((sum, p) => sum + (p.paid || 0), 0);

    const reportText = `*تقرير متابعة الطالب*\n` +
      `═════════════════\n\n` +
      `👤 الاسم: ${s.name}\n` +
      `📚 الصف: ${s.className}${s.section ? ' - ' + s.section : ''}\n` +
      `📖 المادة: ${s.subject}\n` +
      `👥 المجموعة: ${group ? group.name : '—'}\n\n` +
      `📅 *الحضور:*\n` +
      `• نسبة الحضور: ${attRate}%\n` +
      `• أيام الحضور: ${present}\n` +
      `• أيام الغياب: ${absent}\n` +
      `• مرات التأخير: ${late}\n\n` +
      `📝 *الاختبارات:*\n` +
      (grades.length ? grades.map(g => {
        const e = Storage.find(Storage.KEYS.exams, g.examId);
        return `• ${e ? e.name : ''}: ${g.score}/${g.maxGrade} (${Math.round(g.score / g.maxGrade * 100)}%)\n`;
      }).join('') : '• لا يوجد اختبارات\n') +
      `المتوسط: ${avgGrade}%\n\n` +
      `📋 *الواجبات:*\n` +
      `• المسلم: ${submitted} من ${subs.length}\n\n` +
      `💰 *المدفوعات:*\n` +
      `• المطلوب: ${UI.money(totalReq)}\n` +
      `• المدفوع: ${UI.money(totalPaid)}\n` +
      `• المتبقي: ${UI.money(totalReq - totalPaid)}\n\n` +
      `التاريخ: ${UI.formatDate(new Date().toISOString())}\n` +
      `═════════════════\n` +
      `أ/ ${teacher ? teacher.name : ''}\n` +
      `مُعلّمي - نظام إدارة الدروس`;

    UI.modal({
      title: 'تقرير الطالب',
      body: `
        <div class="detail-header" style="margin-bottom: var(--space-4); padding: var(--space-4);">
          <div class="detail-avatar" style="width: 56px; height: 56px; font-size: var(--font-size-lg);">${UI.initials(s.name)}</div>
          <h3 style="color:#fff;font-size:var(--font-size-md);margin-bottom:4px;">${s.name}</h3>
          <p style="color:rgba(255,255,255,0.85);font-size:var(--font-size-sm);">${s.className} • ${s.subject}</p>
        </div>

        <div class="stats-grid" style="margin-bottom: var(--space-4);">
          <div class="stat-card ${attRate >= 70 ? 'success' : 'danger'}">
            <div class="stat-value">${attRate}%</div>
            <div class="stat-label">الحضور</div>
          </div>
          <div class="stat-card ${avgGrade >= 70 ? 'success' : (avgGrade >= 60 ? 'warning' : 'danger')}">
            <div class="stat-value">${avgGrade}%</div>
            <div class="stat-label">المتوسط</div>
          </div>
          <div class="stat-card info">
            <div class="stat-value">${submitted}/${subs.length}</div>
            <div class="stat-label">الواجبات</div>
          </div>
          <div class="stat-card warning">
            <div class="stat-value">${UI.money(totalReq - totalPaid).replace(' ج.م', '')}</div>
            <div class="stat-label">متبقي</div>
          </div>
        </div>

        <div class="card" style="margin-bottom: var(--space-4); background: var(--color-surface-2); white-space: pre-wrap; font-family: monospace; font-size: 12px; line-height: 1.6; max-height: 50vh; overflow-y: auto;">${reportText}</div>

        <div class="action-row">
          <button class="btn btn-secondary" onclick="window.print()" style="flex:1">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            طباعة
          </button>
          <button class="btn btn-whatsapp" onclick="Reports.shareViaWhatsapp('${studentId}', 'student')" style="flex:1">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M17.6 6.32A7.85 7.85 0 0 0 12.05 4 7.94 7.94 0 0 0 5.1 15.94L4 20l4.16-1.09a7.93 7.93 0 0 0 3.79.97h.01a7.94 7.94 0 0 0 5.64-13.55z"/></svg>
            مشاركة
          </button>
        </div>
      `
    });
  },

  // ===== Group Report =====
  openGroupReport(groupId = null) {
    if (groupId) {
      this.showGroupReport(groupId);
      return;
    }
    const groups = Storage.list(Storage.KEYS.groups);
    if (groups.length === 0) {
      UI.toast('لا يوجد مجموعات', 'warning');
      return;
    }
    UI.modal({
      title: 'اختر المجموعة',
      body: `
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
        UI.closeModal();
        setTimeout(() => this.showGroupReport(el.dataset.group), 300);
      });
    });
  },

  showGroupReport(groupId) {
    const g = Storage.find(Storage.KEYS.groups, groupId);
    if (!g) return;
    const students = Storage.list(Storage.KEYS.students, s => s.groupId === groupId);
    const att = Storage.list(Storage.KEYS.attendance, a => a.groupId === groupId);
    const grades = Storage.list(Storage.KEYS.grades, gr => gr.groupId === groupId);
    const payments = Storage.list(Storage.KEYS.payments, p => p.groupId === groupId);

    const attRate = att.length ? Math.round(att.filter(a => a.status === 'حاضر').length / att.length * 100) : 0;
    const avgGrade = grades.length ? Math.round(grades.reduce((s, gr) => s + gr.score / gr.maxGrade * 100, 0) / grades.length) : 0;
    const totalReq = payments.reduce((s, p) => s + (p.required || 0), 0);
    const totalPaid = payments.reduce((s, p) => s + (p.paid || 0), 0);

    // Students needing follow-up
    const followUp = students.filter(s => {
      const sAtt = Storage.list(Storage.KEYS.attendance, a => a.studentId === s.id);
      const sAttRate = sAtt.length ? sAtt.filter(a => a.status === 'حاضر').length / sAtt.length : 1;
      return sAttRate < 0.7 || s.status !== 'نشط';
    });

    UI.modal({
      title: 'تقرير المجموعة',
      body: `
        <div class="detail-header" style="margin-bottom: var(--space-4); padding: var(--space-4);">
          <h3 style="color:#fff;font-size:var(--font-size-md);margin-bottom:4px;">${g.name}</h3>
          <p style="color:rgba(255,255,255,0.85);font-size:var(--font-size-sm);">${g.subject} • ${g.className}</p>
        </div>

        <div class="stats-grid" style="margin-bottom: var(--space-4);">
          <div class="stat-card"><div class="stat-value">${students.length}</div><div class="stat-label">طالب</div></div>
          <div class="stat-card ${attRate >= 70 ? 'success' : 'warning'}"><div class="stat-value">${attRate}%</div><div class="stat-label">الحضور</div></div>
          <div class="stat-card info"><div class="stat-value">${avgGrade}%</div><div class="stat-label">المتوسط</div></div>
          <div class="stat-card warning"><div class="stat-value">${UI.money(totalReq - totalPaid).replace(' ج.م', '')}</div><div class="stat-label">مستحقات</div></div>
        </div>

        ${followUp.length > 0 ? `
          <h3 style="font-weight:700; margin-bottom: var(--space-3);">⚠️ طلاب يحتاجون متابعة (${followUp.length})</h3>
          <div class="list" style="margin-bottom: var(--space-4);">
            ${followUp.map(s => {
              const sAtt = Storage.list(Storage.KEYS.attendance, a => a.studentId === s.id);
              const sAttRate = sAtt.length ? Math.round(sAtt.filter(a => a.status === 'حاضر').length / sAtt.length * 100) : 100;
              const reason = sAttRate < 70 ? 'كثير الغياب' : (s.status !== 'نشط' ? s.status : '');
              return `
                <div class="list-item clickable" onclick="UI.closeModal(); Students.openProfile('${s.id}')">
                  <div class="avatar avatar-sm">${UI.initials(s.name)}</div>
                  <div class="list-item-body">
                    <div class="list-item-title">${s.name}</div>
                    <div class="list-item-subtitle">${reason} • حضور ${sAttRate}%</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}

        <h3 style="font-weight:700; margin-bottom: var(--space-3);">قائمة الطلاب</h3>
        <div class="list">
          ${students.map(s => {
            const sAtt = Storage.list(Storage.KEYS.attendance, a => a.studentId === s.id);
            const sAttRate = sAtt.length ? Math.round(sAtt.filter(a => a.status === 'حاضر').length / sAtt.length * 100) : 100;
            const sGrades = Storage.list(Storage.KEYS.grades, gr => gr.studentId === s.id);
            const sAvg = sGrades.length ? Math.round(sGrades.reduce((sum, gr) => sum + gr.score / gr.maxGrade * 100, 0) / sGrades.length) : 0;
            return `
              <div class="list-item">
                <div class="avatar avatar-sm">${UI.initials(s.name)}</div>
                <div class="list-item-body">
                  <div class="list-item-title">${s.name}</div>
                  <div class="list-item-subtitle">حضور ${sAttRate}% • متوسط ${sAvg}%</div>
                </div>
                ${UI.studentStatus(s.status)}
              </div>
            `;
          }).join('')}
        </div>

        <div class="action-row" style="margin-top: var(--space-4);">
          <button class="btn btn-secondary" onclick="window.print()" style="flex:1">طباعة</button>
          <button class="btn btn-whatsapp" onclick="Reports.shareGroupViaWhatsapp('${groupId}')" style="flex:1">مشاركة</button>
        </div>
      `
    });
  },

  // ===== Financial Report =====
  openFinancialReport() {
    const payments = Storage.list(Storage.KEYS.payments);
    const today = new Date().toISOString().slice(0, 10);
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const startOfYear = new Date();
    startOfYear.setMonth(0, 1);

    const todayRev = payments.filter(p => p.date === today).reduce((s, p) => s + (p.paid || 0), 0);
    const weekRev = payments.filter(p => p.date && p.date >= startOfWeek.toISOString().slice(0, 10)).reduce((s, p) => s + (p.paid || 0), 0);
    const monthRev = payments.filter(p => p.date && p.date >= startOfMonth.toISOString().slice(0, 10)).reduce((s, p) => s + (p.paid || 0), 0);
    const yearRev = payments.filter(p => p.date && p.date >= startOfYear.toISOString().slice(0, 10)).reduce((s, p) => s + (p.paid || 0), 0);
    const totalOutstanding = payments.reduce((s, p) => s + Math.max(0, (p.required || 0) - (p.paid || 0)), 0);

    // Group by month for chart
    const monthMap = {};
    payments.forEach(p => {
      if (p.month) monthMap[p.month] = (monthMap[p.month] || 0) + (p.paid || 0);
    });
    const months = Object.keys(monthMap).sort().slice(-6);

    UI.modal({
      title: 'التقرير المالي',
      body: `
        <div class="stats-grid" style="margin-bottom: var(--space-4);">
          <div class="stat-card success">
            <div class="stat-value">${UI.money(todayRev).replace(' ج.م', '')}</div>
            <div class="stat-label">اليوم</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${UI.money(weekRev).replace(' ج.م', '')}</div>
            <div class="stat-label">الأسبوع</div>
          </div>
          <div class="stat-card gold">
            <div class="stat-value">${UI.money(monthRev).replace(' ج.م', '')}</div>
            <div class="stat-label">الشهر</div>
          </div>
          <div class="stat-card info">
            <div class="stat-value">${UI.money(yearRev).replace(' ج.م', '')}</div>
            <div class="stat-label">السنة</div>
          </div>
          <div class="stat-card warning" style="grid-column: span 2;">
            <div class="stat-value">${UI.money(totalOutstanding).replace(' ج.م', '')}</div>
            <div class="stat-label">إجمالي المستحقات</div>
          </div>
        </div>

        ${months.length > 1 ? `
          <h3 style="font-weight:700; margin-bottom: var(--space-3);">📊 الدخل الشهري</h3>
          <div class="card" style="margin-bottom: var(--space-4);">
            <canvas id="financial-chart" height="180"></canvas>
          </div>
        ` : ''}

        <h3 style="font-weight:700; margin-bottom: var(--space-3);">آخر المدفوعات</h3>
        <div class="list">
          ${payments.filter(p => p.paid > 0).sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 8).map(p => {
            const s = Storage.find(Storage.KEYS.students, p.studentId);
            return `
              <div class="list-item">
                <div class="avatar avatar-sm">${UI.initials(s ? s.name : '؟')}</div>
                <div class="list-item-body">
                  <div class="list-item-title">${s ? s.name : '—'}</div>
                  <div class="list-item-subtitle">${p.month} • ${p.method || ''}</div>
                </div>
                <span class="badge badge-success">${UI.money(p.paid).replace(' ج.م', '')}</span>
              </div>
            `;
          }).join('')}
        </div>
      `
    });

    // Render chart
    if (months.length > 1 && window.Chart) {
      const ctx = document.getElementById('financial-chart');
      if (ctx) {
        new Chart(ctx, {
          type: 'bar',
          data: {
            labels: months.map(m => {
              const [y, mo] = m.split('-');
              const months = ['ينا','فبر','مار','أبر','ماي','يون','يول','أغس','سبت','أكت','نوف','ديس'];
              return months[parseInt(mo) - 1] + ' ' + y.slice(2);
            }),
            datasets: [{
              label: 'الدخل (ج.م)',
              data: months.map(m => monthMap[m]),
              backgroundColor: '#C89B3C',
              borderRadius: 8
            }]
          },
          options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { font: { family: 'Cairo' } } }, x: { ticks: { font: { family: 'Cairo' } } } }
          }
        });
      }
    }
  },

  // ===== Analytics =====
  openAnalytics() {
    const students = Storage.list(Storage.KEYS.students);
    const att = Storage.list(Storage.KEYS.attendance);
    const grades = Storage.list(Storage.KEYS.grades);
    const subs = Storage.list(Storage.KEYS.submissions);
    const payments = Storage.list(Storage.KEYS.payments);

    const insights = [];

    // High absence
    const settings = Storage.get(Storage.KEYS.settings, {});
    const threshold = settings.absenceAlertThreshold || 3;
    const highAbsence = students.filter(s => {
      const sAtt = att.filter(a => a.studentId === s.id && a.status === 'غائب');
      return sAtt.length >= threshold;
    });
    if (highAbsence.length) {
      insights.push({
        type: 'danger',
        icon: '⚠️',
        title: `${highAbsence.length} طالب كثير الغياب`,
        list: highAbsence.map(s => s.name).slice(0, 5),
        action: 'attendance'
      });
    }

    // Outstanding payments
    const outstandingStudents = students.filter(s => {
      const sp = payments.filter(p => p.studentId === s.id);
      const req = sp.reduce((sum, p) => sum + (p.required || 0), 0);
      const paid = sp.reduce((sum, p) => sum + (p.paid || 0), 0);
      return req - paid > 0;
    });
    if (outstandingStudents.length) {
      insights.push({
        type: 'warning',
        icon: '💰',
        title: `${outstandingStudents.length} طالب متأخر في الدفع`,
        list: outstandingStudents.map(s => s.name).slice(0, 5),
        action: 'payments'
      });
    }

    // Late submissions
    const lateSubs = subs.filter(s => s.status === 'late' || s.status === 'not_submitted');
    const lateStudents = students.filter(s => lateSubs.some(sub => sub.studentId === s.id));
    if (lateStudents.length) {
      insights.push({
        type: 'info',
        icon: '📋',
        title: `${lateStudents.length} طالب متأخر في الواجبات`,
        list: lateStudents.map(s => s.name).slice(0, 5),
        action: 'assignments'
      });
    }

    // Top performers
    const studentAvgs = students.map(s => {
      const sg = grades.filter(g => g.studentId === s.id);
      if (!sg.length) return null;
      return { student: s, avg: sg.reduce((sum, g) => sum + g.score / g.maxGrade * 100, 0) / sg.length };
    }).filter(Boolean).sort((a, b) => b.avg - a.avg);
    if (studentAvgs.length >= 3) {
      insights.push({
        type: 'success',
        icon: '🏆',
        title: 'أعلى الطلاب أداءً',
        list: studentAvgs.slice(0, 5).map(s => `${s.student.name} (${Math.round(s.avg)}%)`),
        action: 'students'
      });
    }

    // Need improvement
    if (studentAvgs.length >= 3) {
      const low = studentAvgs.slice(-3).filter(s => s.avg < 60);
      if (low.length) {
        insights.push({
          type: 'warning',
          icon: '📉',
          title: 'طلاب يحتاجون متابعة دراسية',
          list: low.map(s => `${s.student.name} (${Math.round(s.avg)}%)`),
          action: 'students'
        });
      }
    }

    UI.modal({
      title: 'تحليلات الطلاب',
      body: `
        ${insights.length === 0 ? UI.emptyState('📊', 'لا توجد بيانات كافية', 'أضف طلابًا ودرجات وحضور لتظهر التحليلات.') : ''}
        <div class="stagger">
          ${insights.map(i => `
            <div class="alert alert-${i.type}" style="margin-bottom: var(--space-3);">
              <div class="alert-icon" style="font-size: 22px;">${i.icon}</div>
              <div class="alert-body">
                <strong>${i.title}</strong>
                <ul style="margin-top: 6px; padding-inline-start: 16px; font-size: var(--font-size-sm);">
                  ${i.list.map(n => `<li style="margin-bottom: 2px;">${n}</li>`).join('')}
                </ul>
                ${i.action ? `<button class="btn btn-text btn-sm" style="padding: 4px 0;" onclick="UI.closeModal(); App.navigate('${i.action}')">عرض التفاصيل →</button>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      `
    });
  },

  // ===== WhatsApp Share =====
  openParentShare() {
    const students = Storage.list(Storage.KEYS.students, s => s.parentPhone);
    if (students.length === 0) {
      UI.toast('لا يوجد طلاب بأرقام أولياء أمور', 'warning');
      return;
    }
    UI.modal({
      title: 'إرسال تقرير لولي الأمر',
      body: `
        <p style="color: var(--text-secondary); margin-bottom: var(--space-3); font-size: var(--font-size-sm);">اختر الطالب لإرسال تقريره عبر WhatsApp لولي الأمر:</p>
        <div class="search-bar">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="search" id="parent-share-search" placeholder="ابحث بالاسم...">
        </div>
        <div id="parent-share-list" style="max-height: 60vh; overflow-y: auto;">
          ${students.map(s => `
            <div class="list-item clickable" data-student="${s.id}">
              <div class="avatar avatar-sm">${UI.initials(s.name)}</div>
              <div class="list-item-body">
                <div class="list-item-title">${s.name}</div>
                <div class="list-item-subtitle">ولي الأمر: ${s.parentName || '—'} • ${s.parentPhone}</div>
              </div>
            </div>
          `).join('')}
        </div>
      `
    });

    document.getElementById('parent-share-search').addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('[data-student]').forEach(el => {
        el.style.display = el.querySelector('.list-item-title').textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });

    document.querySelectorAll('[data-student]').forEach(el => {
      el.addEventListener('click', () => {
        UI.closeModal();
        setTimeout(() => this.contactParent(el.dataset.student), 300);
      });
    });
  },

  contactParent(studentId) {
    const s = Storage.find(Storage.KEYS.students, studentId);
    if (!s) return;
    if (!s.parentPhone) {
      UI.toast('لا يوجد رقم لولي الأمر', 'warning');
      return;
    }
    const group = Storage.find(Storage.KEYS.groups, s.groupId);
    const att = Storage.list(Storage.KEYS.attendance, a => a.studentId === studentId);
    const grades = Storage.list(Storage.KEYS.grades, g => g.studentId === studentId);
    const subs = Storage.list(Storage.KEYS.submissions, sub => sub.studentId === studentId);

    const present = att.filter(a => a.status === 'حاضر').length;
    const absent = att.filter(a => a.status === 'غائب').length;
    const attRate = att.length ? Math.round(present / att.length * 100) : 100;
    const avgGrade = grades.length ? Math.round(grades.reduce((sum, g) => sum + g.score / g.maxGrade * 100, 0) / grades.length) : 0;
    const submitted = subs.filter(sub => sub.status === 'submitted' || sub.status === 'reviewed').length;

    const msg = `السلام عليكم ورحمة الله وبركاته،\n\n` +
      `نرسل لحضراتكم تقرير متابعة الطالب *${s.name}* عن الفترة الحالية.\n\n` +
      `التقرير يتضمن:\n` +
      `• نسبة الحضور: ${attRate}% (${present} حضور، ${absent} غياب)\n` +
      `• متوسط الدرجات: ${avgGrade}%\n` +
      `• الواجبات المسلمة: ${submitted} من ${subs.length}\n` +
      (group ? `• المجموعة: ${group.name}\n` : '') +
      `• المادة: ${s.subject}\n\n` +
      `لمزيد من التفاصيل، يرجى التواصل.\n\n` +
      `مع خالص التحية،\n` +
      `أ/ ${Auth.getTeacher() ? Auth.getTeacher().name : ''}`;

    const phone = s.parentPhone.replace(/^0/, '20');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  },

  shareViaWhatsapp(studentId, type = 'student') {
    const s = Storage.find(Storage.KEYS.students, studentId);
    if (!s || !s.parentPhone) {
      UI.toast('لا يوجد رقم لولي الأمر', 'warning');
      return;
    }
    this.contactParent(studentId);
  },

  shareGroupViaWhatsapp(groupId) {
    const g = Storage.find(Storage.KEYS.groups, groupId);
    if (!g) return;
    const teacher = Auth.getTeacher();
    const students = Storage.list(Storage.KEYS.students, s => s.groupId === groupId);
    const att = Storage.list(Storage.KEYS.attendance, a => a.groupId === groupId);
    const attRate = att.length ? Math.round(att.filter(a => a.status === 'حاضر').length / att.length * 100) : 0;
    const grades = Storage.list(Storage.KEYS.grades, gr => gr.groupId === groupId);
    const avgGrade = grades.length ? Math.round(grades.reduce((s, gr) => s + gr.score / gr.maxGrade * 100, 0) / grades.length) : 0;

    const msg = `*تقرير مجموعة - مُعلّمي*\n\n` +
      `المجموعة: ${g.name}\n` +
      `المادة: ${g.subject}\n` +
      `عدد الطلاب: ${students.length}\n` +
      `نسبة الحضور: ${attRate}%\n` +
      `متوسط الدرجات: ${avgGrade}%\n\n` +
      `أ/ ${teacher ? teacher.name : ''}`;

    // Share as text - copy to clipboard
    navigator.clipboard?.writeText(msg).then(() => {
      UI.toast('تم نسخ التقرير. شاركه عبر WhatsApp', 'success');
    }).catch(() => {
      UI.toast('تعذر النسخ. حاول مرة أخرى', 'error');
    });
  }
};

window.Reports = Reports;

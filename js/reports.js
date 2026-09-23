/* ============================================
   مُعلّمي | reports.js
   التقارير: طالب/مجموعة/مالي/تحليلات + سجل التقارير المحفوظة
   ============================================ */

const Reports = {
  render() {
    const savedReports = Storage.list(Storage.KEYS.reports).sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);

    return `
      <div class="page-header">
        <h1 class="page-title">التقارير</h1>
        <p class="page-subtitle">تقارير شاملة للطلاب والمجموعات</p>
      </div>

      <div class="section">
        <h2 class="section-title" style="margin-bottom: var(--space-3);">تقارير سريعة</h2>
        <div class="list stagger">
          <div class="list-item clickable" data-report="student">
            <div class="quick-action-icon">${Icons.get('user', 20)}</div>
            <div class="list-item-body">
              <div class="list-item-title">تقرير طالب</div>
              <div class="list-item-subtitle">تقرير شامل لطالب معين</div>
            </div>
            ${Icons.get('forward', 20)}
          </div>
          <div class="list-item clickable" data-report="group">
            <div class="quick-action-icon gold">${Icons.get('groups', 20)}</div>
            <div class="list-item-body">
              <div class="list-item-title">تقرير مجموعة</div>
              <div class="list-item-subtitle">إحصائيات وأداء مجموعة كاملة</div>
            </div>
            ${Icons.get('forward', 20)}
          </div>
          <div class="list-item clickable" data-report="financial">
            <div class="quick-action-icon gold">${Icons.get('payment', 20)}</div>
            <div class="list-item-body">
              <div class="list-item-title">التقرير المالي</div>
              <div class="list-item-subtitle">دخل ومستحقات وإيرادات</div>
            </div>
            ${Icons.get('forward', 20)}
          </div>
          <div class="list-item clickable" data-report="analytics">
            <div class="quick-action-icon info">${Icons.get('chart', 20)}</div>
            <div class="list-item-body">
              <div class="list-item-title">تحليلات الطلاب</div>
              <div class="list-item-subtitle">رؤى مستخرجة من البيانات</div>
            </div>
            ${Icons.get('forward', 20)}
          </div>
          <div class="list-item clickable" data-report="needs">
            <div class="quick-action-icon danger">${Icons.get('warn', 20)}</div>
            <div class="list-item-body">
              <div class="list-item-title">طلاب يحتاجون متابعة</div>
              <div class="list-item-subtitle">مؤشرات سلبية مع الإجراء المقترح</div>
            </div>
            ${Icons.get('forward', 20)}
          </div>
        </div>
      </div>

      ${savedReports.length ? `
        <div class="section">
          <div class="section-header">
            <h2 class="section-title">أحدث التقارير المحفوظة</h2>
            <span class="badge">${Storage.list(Storage.KEYS.reports).length}</span>
          </div>
          <div class="list stagger">
            ${savedReports.map(r => {
              const s = r.studentId ? Storage.find(Storage.KEYS.students, r.studentId) : null;
              return `
                <div class="list-item clickable" data-open-saved="${r.id}">
                  <div class="list-item-avatar">${Icons.get('file', 18)}</div>
                  <div class="list-item-body">
                    <div class="list-item-title">${Utils.escapeHTML(r.title || r.type)}</div>
                    <div class="list-item-subtitle">${Utils.escapeHTML(r.type || '')} • ${UI.relativeTime(r.createdAt)}${s ? ' • ' + Utils.escapeHTML(s.name) : ''}</div>
                  </div>
                  ${Icons.get('forward', 18)}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}

      <div class="section">
        <h2 class="section-title" style="margin-bottom: var(--space-3);">ربط مع أولياء الأمور</h2>
        <div class="card">
          <p style="color: var(--text-secondary); font-size: var(--font-size-sm); line-height: 1.6; margin-bottom: var(--space-3);">تقارير احترافية لولي الأمر مع معاينة كاملة قبل الإرسال: قوالب جاهزة، نص قابل للتعديل، نسخ، وطباعة A4. لا يتم أي إرسال بدون تأكيدك.</p>
          <button class="btn btn-whatsapp btn-block" onclick="Reports.openParentShare()">
            ${Icons.get('whatsapp', 18)}
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
        else if (type === 'needs') App.navigate('needs');
      });
    });

    document.querySelectorAll('[data-open-saved]').forEach(el => {
      el.addEventListener('click', () => this.viewSaved(el.dataset.openSaved));
    });
  },

  openGenerator() {
    this.openStudentReport();
  },

  /* ===== سجل التقارير: عرض تقرير محفوظ ===== */
  viewSaved(reportId) {
    const r = Storage.find(Storage.KEYS.reports, reportId);
    if (!r) { UI.toast('التقرير غير موجود', 'error'); return; }
    const s = r.studentId ? Storage.find(Storage.KEYS.students, r.studentId) : null;

    UI.modal({
      title: r.title || 'تقرير محفوظ',
      size: 'large',
      body: `
        ${s ? `<p style="font-size:var(--font-size-sm); color:var(--text-tertiary); margin-bottom: var(--space-2);">الطالب: ${Utils.escapeHTML(s.name)} • ${Utils.escapeHTML(r.type || '')} • ${UI.formatDate(new Date(r.createdAt).toISOString())}</p>` : ''}
        <div class="field">
          <textarea id="saved-report-text" rows="14" style="min-height:240px; line-height:1.8; font-size:var(--font-size-sm);">${Utils.escapeHTML(r.content || '')}</textarea>
        </div>
        <div class="action-row" style="margin-top: var(--space-3); flex-wrap: wrap;">
          <button class="btn btn-primary btn-sm" id="sr-update" style="flex:1;">${Icons.get('check', 16)} حفظ التعديل</button>
          <button class="btn btn-outline btn-sm" id="sr-copy" style="flex:1;">${Icons.get('copy', 16)} نسخ</button>
          ${s ? `<button class="btn btn-outline btn-sm" id="sr-print" style="flex:1;">${Icons.get('print', 16)} طباعة</button>
          <button class="btn btn-whatsapp btn-sm" id="sr-wa" style="flex:1;">${Icons.get('whatsapp', 16)} واتساب</button>` : ''}
        </div>
      `
    });

    document.getElementById('sr-update').addEventListener('click', () => {
      Storage.update(Storage.KEYS.reports, r.id, { content: document.getElementById('saved-report-text').value, version: (r.version || 1) + 1 });
      UI.toast('تم حفظ التعديل - إصدار ' + ((r.version || 1) + 1), 'success');
    });

    document.getElementById('sr-copy').addEventListener('click', async () => {
      const ok = await Utils.copyText(document.getElementById('saved-report-text').value);
      UI.toast(ok ? 'تم النسخ' : 'تعذر النسخ', ok ? 'success' : 'error');
    });

    if (s) {
      document.getElementById('sr-print').addEventListener('click', () => {
        ParentReport.print(s.id, document.getElementById('saved-report-text').value);
      });
      document.getElementById('sr-wa').addEventListener('click', () => {
        ParentReport.previewWhatsapp(s.id, document.getElementById('saved-report-text').value);
      });
    }
  },

  /* ===== تقرير طالب سريع (منظرة قديمة محفوظة للتوافق) ===== */
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
          ${Icons.get('search', 18)}
          <input type="search" id="report-student-search" placeholder="ابحث...">
        </div>
        <div id="report-students-list" style="max-height: 60vh; overflow-y: auto;">
          ${students.map(s => `
            <div class="list-item clickable" data-student="${s.id}">
              <div class="avatar avatar-sm">${Utils.escapeHTML(UI.initials(s.name))}</div>
              <div class="list-item-body">
                <div class="list-item-title">${Utils.escapeHTML(s.name)}</div>
                <div class="list-item-subtitle">${Utils.escapeHTML(s.className || '')} • ${Utils.escapeHTML(s.subject || '')}</div>
              </div>
            </div>
          `).join('')}
        </div>
      `
    });
    document.getElementById('report-student-search').addEventListener('input', Utils.debounce((e) => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('#modal-content [data-student]').forEach(el => {
        const name = el.querySelector('.list-item-title').textContent.toLowerCase();
        el.style.display = name.includes(q) ? '' : 'none';
      });
    }, 200));
    document.querySelectorAll('#modal-content [data-student]').forEach(el => {
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
    const data = AIAnalysis.prepare(studentId);
    if (!data) return;
    const perf = AIAnalysis.performance(data);
    const trend = AI.trendLabel(data.gradeTrend);
    const teacher = Auth.getTeacher();

    UI.modal({
      title: 'تقرير الطالب',
      size: 'large',
      body: `
        <div class="detail-header" style="margin-bottom: var(--space-4); padding: var(--space-4);">
          <div class="detail-avatar" style="width: 56px; height: 56px; font-size: var(--font-size-lg);">${Utils.escapeHTML(UI.initials(s.name))}</div>
          <h3 style="color:#fff;font-size:var(--font-size-md);margin-bottom:4px;">${Utils.escapeHTML(s.name)}</h3>
          <p style="color:rgba(255,255,255,0.85);font-size:var(--font-size-sm);">${Utils.escapeHTML(s.className || '')} • ${Utils.escapeHTML(s.subject || '')}</p>
        </div>

        <div class="stats-grid" style="margin-bottom: var(--space-4);">
          <div class="stat-card ${perf.score != null ? (perf.score >= 70 ? 'success' : (perf.score >= 60 ? 'warning' : 'danger')) : ''}">
            <div class="stat-value">${perf.score != null ? perf.score + '%' : '—'}</div>
            <div class="stat-label">الأداء العام</div>
          </div>
          <div class="stat-card ${data.attStats.total ? (data.attStats.rate >= 70 ? 'success' : 'danger') : ''}">
            <div class="stat-value">${data.attStats.total ? data.attStats.rate + '%' : '—'}</div>
            <div class="stat-label">الحضور</div>
          </div>
          <div class="stat-card ${trend.cls || 'info'}">
            <div class="stat-value">${trend.change}</div>
            <div class="stat-label">${trend.text}</div>
          </div>
          <div class="stat-card info">
            <div class="stat-value">${data.assignmentStats.total ? data.assignmentStats.submitted + '/' + data.assignmentStats.total : '—'}</div>
            <div class="stat-label">الواجبات</div>
          </div>
        </div>

        ${group ? `<p style="font-size:var(--font-size-xs); color:var(--text-tertiary); margin-bottom: var(--space-3);">المجموعة: ${Utils.escapeHTML(group.name)}</p>` : ''}

        <div class="action-row" style="flex-wrap: wrap;">
          <button class="btn btn-primary btn-sm" onclick="UI.closeModal(); ParentReport.open('${studentId}')" style="flex:1;">
            ${Icons.get('file', 16)} تقرير ولي الأمر الكامل
          </button>
          <button class="btn btn-whatsapp btn-sm" onclick="UI.closeModal(); ParentReport.open('${studentId}')" style="flex:1;">
            ${Icons.get('whatsapp', 16)} تجهيز وإرسال
          </button>
        </div>
        <p style="font-size:var(--font-size-xs); color:var(--text-tertiary); margin-top: var(--space-3); text-align:center;">
          تقرير ولي الأمر يتضمن: الفترة، القالب، النص القابل للتعديل، المعاينة، النسخ، والطباعة A4.
        </p>
      `
    });
  },

  /* ===== تقرير مجموعة ===== */
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
      size: 'large',
      body: `
        <div class="detail-header" style="margin-bottom: var(--space-4); padding: var(--space-4);">
          <h3 style="color:#fff;font-size:var(--font-size-md);margin-bottom:4px;">${Utils.escapeHTML(g.name)}</h3>
          <p style="color:rgba(255,255,255,0.85);font-size:var(--font-size-sm);">${Utils.escapeHTML(g.subject)} • ${Utils.escapeHTML(g.className)}</p>
        </div>

        <div class="stats-grid" style="margin-bottom: var(--space-4);">
          <div class="stat-card"><div class="stat-value">${students.length}</div><div class="stat-label">طالب</div></div>
          <div class="stat-card ${attRate >= 70 ? 'success' : 'warning'}"><div class="stat-value">${attRate}%</div><div class="stat-label">الحضور</div></div>
          <div class="stat-card info"><div class="stat-value">${avgGrade}%</div><div class="stat-label">المتوسط</div></div>
          <div class="stat-card warning"><div class="stat-value">${UI.money(totalReq - totalPaid).replace(' ج.م', '')}</div><div class="stat-label">مستحقات</div></div>
        </div>

        ${followUp.length > 0 ? `
          <h3 style="font-weight:700; margin-bottom: var(--space-3);">طلاب يحتاجون متابعة (${followUp.length})</h3>
          <div class="list" style="margin-bottom: var(--space-4);">
            ${followUp.map(s => {
              const sAtt = Storage.list(Storage.KEYS.attendance, a => a.studentId === s.id);
              const sAttRate = sAtt.length ? Math.round(sAtt.filter(a => a.status === 'حاضر').length / sAtt.length * 100) : 100;
              const reason = sAttRate < 70 ? 'كثير الغياب' : (s.status !== 'نشط' ? s.status : '');
              return `
                <div class="list-item clickable" onclick="UI.closeModal(); Students.openProfile('${s.id}')">
                  <div class="avatar avatar-sm">${Utils.escapeHTML(UI.initials(s.name))}</div>
                  <div class="list-item-body">
                    <div class="list-item-title">${Utils.escapeHTML(s.name)}</div>
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
                <div class="avatar avatar-sm">${Utils.escapeHTML(UI.initials(s.name))}</div>
                <div class="list-item-body">
                  <div class="list-item-title">${Utils.escapeHTML(s.name)}</div>
                  <div class="list-item-subtitle">حضور ${sAttRate}% • متوسط ${sAvg}%</div>
                </div>
                ${UI.studentStatus(s.status)}
              </div>
            `;
          }).join('')}
        </div>
      `
    });
  },

  /* ===== التقرير المالي ===== */
  openFinancialReport() {
    const payments = Storage.list(Storage.KEYS.payments);
    const today = Utils.today();
    const startOfWeek = Utils.startOfWeek();
    const startOfMonth = Utils.startOfMonth();
    const startOfYear = new Date();
    startOfYear.setMonth(0, 1);
    const startOfYearStr = startOfYear.toISOString().slice(0, 10);

    const todayRev = payments.filter(p => p.date === today).reduce((s, p) => s + (p.paid || 0), 0);
    const weekRev = payments.filter(p => p.date && p.date >= startOfWeek).reduce((s, p) => s + (p.paid || 0), 0);
    const monthRev = payments.filter(p => p.date && p.date >= startOfMonth).reduce((s, p) => s + (p.paid || 0), 0);
    const yearRev = payments.filter(p => p.date && p.date >= startOfYearStr).reduce((s, p) => s + (p.paid || 0), 0);
    const totalOutstanding = payments.reduce((s, p) => s + Math.max(0, (p.required || 0) - (p.paid || 0)), 0);

    // Group by month for chart
    const monthMap = {};
    payments.forEach(p => {
      if (p.month) monthMap[p.month] = (monthMap[p.month] || 0) + (p.paid || 0);
    });
    const months = Object.keys(monthMap).sort().slice(-6);

    UI.modal({
      title: 'التقرير المالي',
      size: 'large',
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
          <h3 style="font-weight:700; margin-bottom: var(--space-3);">الدخل الشهري</h3>
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
                <div class="avatar avatar-sm">${Utils.escapeHTML(UI.initials(s ? s.name : '؟'))}</div>
                <div class="list-item-body">
                  <div class="list-item-title">${s ? Utils.escapeHTML(s.name) : '—'}</div>
                  <div class="list-item-subtitle">${p.month} • ${Utils.escapeHTML(p.method || '')}</div>
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
              const monthsNames = ['ينا','فبر','مار','أبر','ماي','يون','يول','أغس','سبت','أكت','نوف','ديس'];
              return monthsNames[parseInt(mo) - 1] + ' ' + y.slice(2);
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

  /* ===== تحليلات عامة ===== */
  openAnalytics() {
    const students = Storage.list(Storage.KEYS.students);
    const att = Storage.list(Storage.KEYS.attendance);
    const grades = Storage.list(Storage.KEYS.grades);
    const subs = Storage.list(Storage.KEYS.submissions);
    const payments = Storage.list(Storage.KEYS.payments);

    const insights = [];
    const settings = Storage.get(Storage.KEYS.settings, {});
    const threshold = settings.absenceAlertThreshold || 3;

    const highAbsence = students.filter(s => {
      const sAtt = att.filter(a => a.studentId === s.id && a.status === 'غائب');
      return sAtt.length >= threshold;
    });
    if (highAbsence.length) {
      insights.push({
        type: 'danger',
        icon: 'warn',
        title: `${highAbsence.length} طالب كثير الغياب`,
        list: highAbsence.map(s => s.name).slice(0, 5),
        action: 'attendance'
      });
    }

    const outstandingStudents = students.filter(s => {
      const sp = payments.filter(p => p.studentId === s.id);
      const req = sp.reduce((sum, p) => sum + (p.required || 0), 0);
      const paid = sp.reduce((sum, p) => sum + (p.paid || 0), 0);
      return req - paid > 0;
    });
    if (outstandingStudents.length) {
      insights.push({
        type: 'warning',
        icon: 'payment',
        title: `${outstandingStudents.length} طالب متأخر في الدفع`,
        list: outstandingStudents.map(s => s.name).slice(0, 5),
        action: 'payments'
      });
    }

    const lateSubs = subs.filter(s => s.status === 'late' || s.status === 'not_submitted');
    const lateStudents = students.filter(s => lateSubs.some(sub => sub.studentId === s.id));
    if (lateStudents.length) {
      insights.push({
        type: 'info',
        icon: 'assignment',
        title: `${lateStudents.length} طالب متأخر في الواجبات`,
        list: lateStudents.map(s => s.name).slice(0, 5),
        action: 'assignments'
      });
    }

    // Trend distribution
    const improving = [], declining = [];
    students.forEach(s => {
      const sg = grades.filter(g => g.studentId === s.id);
      if (sg.length < 2) return;
      const trend = AI.trendFromGrades(sg);
      if (trend.direction === 'improving') improving.push(s.name);
      else if (trend.direction === 'declining') declining.push(s.name);
    });
    if (improving.length >= 2) {
      insights.push({
        type: 'success',
        icon: 'trendUp',
        title: `${improving.length} طالب في اتجاه تحسن`,
        list: improving.slice(0, 5),
        action: 'students'
      });
    }
    if (declining.length >= 2) {
      insights.push({
        type: 'warning',
        icon: 'trendDown',
        title: `${declining.length} طالب في اتجاه تراجع - يحتاجون متابعة`,
        list: declining.slice(0, 5),
        action: 'needs'
      });
    }

    // Top performers (عرض داخلي للمدرس فقط)
    const studentAvgs = students.map(s => {
      const sg = grades.filter(g => g.studentId === s.id);
      if (!sg.length) return null;
      return { student: s, avg: sg.reduce((sum, g) => sum + g.score / g.maxGrade * 100, 0) / sg.length };
    }).filter(Boolean).sort((a, b) => b.avg - a.avg);
    if (studentAvgs.length >= 3) {
      insights.push({
        type: 'success',
        icon: 'award',
        title: 'أعلى الطلاب أداءً (للاطلاع الداخلي)',
        list: studentAvgs.slice(0, 5).map(s => `${s.student.name} (${Math.round(s.avg)}%)`),
        action: 'students'
      });
    }
    if (studentAvgs.length >= 3) {
      const low = studentAvgs.slice(-3).filter(s => s.avg < 60);
      if (low.length) {
        insights.push({
          type: 'warning',
          icon: 'trendDown',
          title: 'طلاب يحتاجون متابعة دراسية',
          list: low.map(s => `${s.student.name} (${Math.round(s.avg)}%)`),
          action: 'needs'
        });
      }
    }

    UI.modal({
      title: 'تحليلات الطلاب',
      size: 'large',
      body: `
        ${insights.length === 0 ? UI.emptyState(Icons.get('chart', 36), 'لا توجد بيانات كافية', 'أضف طلابًا ودرجات وحضور لتظهر التحليلات.') : ''}
        <div class="stagger">
          ${insights.map(i => `
            <div class="alert alert-${i.type}" style="margin-bottom: var(--space-3);">
              <div class="alert-icon">${Icons.get(i.icon, 20)}</div>
              <div class="alert-body">
                <strong>${i.title}</strong>
                <ul style="margin-top: 6px; padding-inline-start: 16px; font-size: var(--font-size-sm);">
                  ${i.list.map(n => `<li style="margin-bottom: 2px;">${Utils.escapeHTML(n)}</li>`).join('')}
                </ul>
                ${i.action ? `<button class="btn btn-text btn-sm" style="padding: 4px 0;" onclick="UI.closeModal(); App.navigate('${i.action}')">عرض التفاصيل</button>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      `
    });
  },

  /* ===== اختيار طالب لتقرير ولي الأمر ===== */
  openParentShare() {
    const students = Storage.list(Storage.KEYS.students, s => s.parentPhone);
    if (students.length === 0) {
      UI.toast('لا يوجد طلاب بأرقام أولياء أمور', 'warning');
      return;
    }
    UI.modal({
      title: 'إرسال تقرير لولي الأمر',
      body: `
        <p style="color: var(--text-secondary); margin-bottom: var(--space-3); font-size: var(--font-size-sm);">اختر الطالب لفتح نافذة تجهيز التقرير (معاينة ← تعديل ← تأكيد الإرسال):</p>
        <div class="search-bar">
          ${Icons.get('search', 18)}
          <input type="search" id="parent-share-search" placeholder="ابحث بالاسم...">
        </div>
        <div id="parent-share-list" style="max-height: 60vh; overflow-y: auto;">
          ${students.map(s => `
            <div class="list-item clickable" data-student="${s.id}">
              <div class="avatar avatar-sm">${Utils.escapeHTML(UI.initials(s.name))}</div>
              <div class="list-item-body">
                <div class="list-item-title">${Utils.escapeHTML(s.name)}</div>
                <div class="list-item-subtitle">ولي الأمر: ${Utils.escapeHTML(s.parentName || '—')} • <span dir="ltr">${Utils.escapeHTML(s.parentPhone)}</span></div>
              </div>
            </div>
          `).join('')}
        </div>
      `
    });

    document.getElementById('parent-share-search').addEventListener('input', Utils.debounce((e) => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('#modal-content [data-student]').forEach(el => {
        el.style.display = el.querySelector('.list-item-title').textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    }, 200));

    document.querySelectorAll('#modal-content [data-student]').forEach(el => {
      el.addEventListener('click', () => {
        UI.closeModal();
        setTimeout(() => ParentReport.open(el.dataset.student), 300);
      });
    });
  },

  /* ===== التوافق مع الاستدعاءات القديمة ===== */
  // كل مسارات واتساب تمر الآن عبر معاينة وتأكيد المدرس
  contactParent(studentId) {
    ParentReport.open(studentId);
  },

  shareViaWhatsapp(studentId, type = 'student') {
    const s = Storage.find(Storage.KEYS.students, studentId);
    if (!s || !s.parentPhone) {
      UI.toast('لا يوجد رقم لولي الأمر', 'warning');
      return;
    }
    ParentReport.open(studentId);
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

    const msg = `تقرير مجموعة - مُعلّمي\n\n` +
      `المجموعة: ${g.name}\n` +
      `المادة: ${g.subject}\n` +
      `عدد الطلاب: ${students.length}\n` +
      `نسبة الحضور: ${attRate}%\n` +
      `متوسط الدرجات: ${avgGrade}%\n\n` +
      `أ/ ${teacher ? teacher.name : ''}`;

    UI.modal({
      title: 'مشاركة تقرير المجموعة',
      body: `
        <div class="whatsapp-preview">${Utils.escapeHTML(msg).replace(/\n/g, '<br>')}</div>
        <div class="action-row" style="margin-top: var(--space-3);">
          <button class="btn btn-outline" id="grp-copy" style="flex:1;">${Icons.get('copy', 16)} نسخ النص</button>
        </div>
        <p style="font-size:var(--font-size-xs); color:var(--text-tertiary); margin-top: var(--space-2);">تقرير المجموعة عام - يفضل مشاركته في قناة المجموعة وليس مع ولي أمر بعينه.</p>
      `
    });
    document.getElementById('grp-copy').addEventListener('click', async () => {
      const ok = await Utils.copyText(msg);
      UI.toast(ok ? 'تم نسخ التقرير - شاركه عبر واتساب' : 'تعذر النسخ', ok ? 'success' : 'error');
    });
  }
};

window.Reports = Reports;

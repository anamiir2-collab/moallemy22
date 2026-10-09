/* ============================================
   مُعلّمي | daily-report.js
   التقرير اليومي الشامل للطلاب
   ============================================

   يجمع بيانات:
   - الحضور (Attendance)
   - الواجبات (Assignments + Submissions)
   - الاختبارات (Exams + Grades)
   - المدفوعات (Payments)
   - تنبيهات (Alerts)

   قواعد:
   - يميّز بين البيانات المُقاسة (وقائع) والاقتراحات الذكية.
   - لا يخترع بيانات — يعرض "لا توجد بيانات كافية" عند غياب السجلات.
   ============================================ */

const DailyReport = (function () {

  // ===== Compute daily overview for a given date =====
  function computeDailyOverview(dateStr) {
    const lessons = Storage.list(Storage.KEYS.lessons, l => l.date === dateStr);
    const expectedStudentIds = new Set();
    lessons.forEach(l => {
      Storage.list(Storage.KEYS.students, s => s.groupId === l.groupId && s.status === 'نشط')
        .forEach(s => expectedStudentIds.add(s.id));
    });

    const att = Storage.list(Storage.KEYS.attendance, a => a.date === dateStr);
    const present = att.filter(a => a.status === 'حاضر');
    const absent = att.filter(a => a.status === 'غائب');
    const late = att.filter(a => a.status === 'متأخر');
    const excused = att.filter(a => a.status === 'غياب بعذر');

    // Homework completion for lessons on that date (due today or assigned today)
    const assignments = Storage.list(Storage.KEYS.assignments, a => a.dueDate === dateStr || a.assignedDate === dateStr);
    const submissions = Storage.list(Storage.KEYS.submissions);
    let homeworkAssigned = 0, homeworkSubmitted = 0, homeworkLate = 0, homeworkMissing = 0;
    assignments.forEach(a => {
      const subs = submissions.filter(s => s.assignmentId === a.id);
      const expected = Storage.list(Storage.KEYS.students, s => s.groupId === a.groupId && s.status === 'نشط');
      homeworkAssigned += expected.length;
      expected.forEach(stu => {
        const sub = subs.find(s => s.studentId === stu.id);
        if (!sub) homeworkMissing++;
        else if (sub.status === 'submitted' || sub.status === 'reviewed') homeworkSubmitted++;
        else if (sub.status === 'late') homeworkLate++;
        else homeworkMissing++;
      });
    });

    // Recent exam grades recorded today
    const todayGrades = Storage.list(Storage.KEYS.grades, g => {
      // grades don't have a date field reliably; fall back to createdAt proximity (last 24h)
      const created = new Date(g.createdAt || 0);
      const target = new Date(dateStr);
      return created.toISOString().slice(0, 10) === dateStr;
    });

    // Today's payments
    const todayPayments = Storage.list(Storage.KEYS.payments, p => p.date === dateStr);
    const todayRevenue = todayPayments.reduce((s, p) => s + (p.paid || 0), 0);

    // Students requiring attention (multiple absences this week)
    const studentsNeedingAttention = [];
    const allStudents = Storage.list(Storage.KEYS.students, s => s.status === 'نشط');
    allStudents.forEach(s => {
      const recentAtt = Storage.list(Storage.KEYS.attendance, a => a.studentId === s.id).slice(-5);
      const absences = recentAtt.filter(a => a.status === 'غائب').length;
      if (absences >= 3) studentsNeedingAttention.push({ student: s, absences, recent: recentAtt });
    });

    return {
      date: dateStr,
      lessons,
      expectedCount: expectedStudentIds.size,
      attendance: { present, absent, late, excused, all: att },
      homework: { assigned: assignments.length, studentsAssigned: homeworkAssigned, submitted: homeworkSubmitted, late: homeworkLate, missing: homeworkMissing },
      newGradesToday: todayGrades,
      todayPayments,
      todayRevenue,
      studentsNeedingAttention
    };
  }

  // ===== Compute individual student report =====
  function computeStudentReport(studentId) {
    const student = Storage.find(Storage.KEYS.students, studentId);
    if (!student) return null;

    const att = Storage.list(Storage.KEYS.attendance, a => a.studentId === studentId).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const grades = Storage.list(Storage.KEYS.grades, g => g.studentId === studentId);
    const subs = Storage.list(Storage.KEYS.submissions, sub => sub.studentId === studentId);
    const payments = Storage.list(Storage.KEYS.payments, p => p.studentId === studentId);

    const present = att.filter(a => a.status === 'حاضر').length;
    const absent = att.filter(a => a.status === 'غائب').length;
    const late = att.filter(a => a.status === 'متأخر').length;
    const excused = att.filter(a => a.status === 'غياب بعذر').length;
    const attRate = att.length ? Math.round((present / att.length) * 100) : null;

    const avgGrade = grades.length ? Math.round(grades.reduce((s, g) => s + (g.score / g.maxGrade) * 100, 0) / grades.length) : null;
    const latestGrades = grades.slice(-5);

    const submittedSubs = subs.filter(s => s.status === 'submitted' || s.status === 'reviewed').length;
    const missingSubs = subs.filter(s => s.status === 'not_submitted').length;
    const lateSubs = subs.filter(s => s.status === 'late').length;
    const subRate = subs.length ? Math.round((submittedSubs / subs.length) * 100) : null;

    const totalReq = payments.reduce((s, p) => s + (p.required || 0), 0);
    const totalPaid = payments.reduce((s, p) => s + (p.paid || 0), 0);
    const remaining = totalReq - totalPaid;

    // Compute trend (last 5 grades direction)
    let trend = 'stable';
    if (latestGrades.length >= 2) {
      const recentAvg = latestGrades.slice(-2).reduce((s, g) => s + (g.score / g.maxGrade) * 100, 0) / 2;
      const olderAvg = latestGrades.slice(0, 2).reduce((s, g) => s + (g.score / g.maxGrade) * 100, 0) / 2;
      if (recentAvg - olderAvg > 5) trend = 'improving';
      else if (olderAvg - recentAvg > 5) trend = 'declining';
    }

    // Strengths & weaknesses (rule-based, NOT fabricated)
    const strengths = [];
    const weaknesses = [];
    if (attRate !== null) {
      if (attRate >= 85) strengths.push('معدل حضور مرتفع (' + attRate + '%)');
      else if (attRate < 60) weaknesses.push('معدل حضور منخفض (' + attRate + '%)');
    }
    if (avgGrade !== null) {
      if (avgGrade >= 80) strengths.push('متوسط درجات مرتفع (' + avgGrade + '%)');
      else if (avgGrade < 60) weaknesses.push('متوسط درجات منخفض (' + avgGrade + '%)');
    }
    if (subRate !== null) {
      if (subRate >= 80) strengths.push('ينجز الواجبات بانتظام');
      else if (subRate < 50) weaknesses.push('متأخر في تسليم الواجبات');
    }
    if (absent >= 3) weaknesses.push(`غاب ${absent} مرة من ${att.length} حصة مسجلة`);

    return {
      student,
      attendance: { present, absent, late, excused, total: att.length, rate: attRate, recent: att.slice(-5) },
      grades: { avg: avgGrade, count: grades.length, recent: latestGrades, trend },
      homework: { total: subs.length, submitted: submittedSubs, missing: missingSubs, late: lateSubs, rate: subRate },
      payments: { required: totalReq, paid: totalPaid, remaining },
      strengths,
      weaknesses,
      hasData: att.length > 0 || grades.length > 0 || subs.length > 0
    };
  }

  // ===== Open daily report view =====
  function openDaily(dateStr) {
    if (!dateStr) dateStr = new Date().toISOString().slice(0, 10);
    const overview = computeDailyOverview(dateStr);
    const attRate = overview.attendance.all.length > 0
      ? Math.round((overview.attendance.present.length / overview.attendance.all.length) * 100)
      : null;
    const hwRate = overview.homework.studentsAssigned > 0
      ? Math.round((overview.homework.submitted / overview.homework.studentsAssigned) * 100)
      : null;

    UI.modal({
      title: 'التقرير اليومي',
      size: 'large',
      body: `
        <div class="field" style="margin-bottom: var(--space-3);">
          <label>تاريخ التقرير</label>
          <input type="date" id="report-date-input" value="${dateStr}" max="${new Date().toISOString().slice(0, 10)}">
        </div>

        <div class="stats-grid" style="margin-bottom: var(--space-4);">
          <div class="stat-card info"><div class="stat-value">${overview.expectedCount}</div><div class="stat-label">طلاب متوقع</div></div>
          <div class="stat-card success"><div class="stat-value">${overview.attendance.present.length}</div><div class="stat-label">حاضر</div></div>
          <div class="stat-card danger"><div class="stat-value">${overview.attendance.absent.length}</div><div class="stat-label">غائب</div></div>
          <div class="stat-card warning"><div class="stat-value">${overview.attendance.late.length}</div><div class="stat-label">متأخر</div></div>
          <div class="stat-card ${attRate === null ? '' : (attRate >= 70 ? 'success' : 'danger')}"><div class="stat-value">${attRate === null ? '—' : attRate + '%'}</div><div class="stat-label">نسبة الحضور</div></div>
          <div class="stat-card ${hwRate === null ? '' : (hwRate >= 70 ? 'success' : 'warning')}"><div class="stat-value">${hwRate === null ? '—' : hwRate + '%'}</div><div class="stat-label">إنجاز الواجبات</div></div>
          <div class="stat-card gold"><div class="stat-value">${overview.todayRevenue}</div><div class="stat-label">دخل اليوم (ج.م)</div></div>
          <div class="stat-card"><div class="stat-value">${overview.newGradesToday.length}</div><div class="stat-label">درجات جديدة</div></div>
        </div>

        ${overview.attendance.all.length === 0 ? `
          <div class="alert alert-info" style="margin-bottom: var(--space-3);">
            <div class="alert-icon">ℹ️</div>
            <div class="alert-body" style="font-size: var(--font-size-sm);">
              <strong>لا توجد بيانات كافية</strong> — لا يوجد سجل حضور مسجّل في هذا التاريخ.
            </div>
          </div>
        ` : ''}

        ${overview.studentsNeedingAttention.length > 0 ? `
          <div class="section">
            <div class="section-header">
              <h3 class="section-title">⚠️ طلاب يحتاجون اهتمامًا</h3>
              <span class="badge badge-danger">${overview.studentsNeedingAttention.length}</span>
            </div>
            <div class="list stagger">
              ${overview.studentsNeedingAttention.map(item => `
                <div class="list-item clickable" data-student-id="${item.student.id}">
                  <div class="avatar avatar-sm">${UI.initials(item.student.name)}</div>
                  <div class="list-item-body">
                    <div class="list-item-title">${item.student.name}</div>
                    <div class="list-item-subtitle">غاب ${item.absences} مرات في آخر 5 حصص</div>
                  </div>
                  <span class="badge badge-danger">⚠️</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${overview.attendance.absent.length > 0 ? `
          <div class="section">
            <div class="section-header">
              <h3 class="section-title">الغائبون اليوم</h3>
              <span class="badge badge-danger">${overview.attendance.absent.length}</span>
            </div>
            <div class="list stagger">
              ${overview.attendance.absent.map(a => {
                const s = Storage.find(Storage.KEYS.students, a.studentId);
                return `
                  <div class="list-item clickable" data-student-id="${s?.id || ''}">
                    <div class="avatar avatar-sm">${UI.initials(s ? s.name : '؟')}</div>
                    <div class="list-item-body">
                      <div class="list-item-title">${s ? s.name : '—'}</div>
                      <div class="list-item-subtitle">${UI.formatDate(a.date)}</div>
                    </div>
                    ${UI.attendanceBadge(a.status)}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

        <div class="action-row" style="margin-top: var(--space-4);">
          <button class="btn btn-secondary" onclick="UI.closeModal()" style="flex:1">إغلاق</button>
          <button class="btn btn-outline" onclick="window.print()" style="flex:1">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            طباعة
          </button>
        </div>
      `
    });

    document.getElementById('report-date-input').addEventListener('change', (e) => {
      openDaily(e.target.value);
    });
    document.querySelectorAll('[data-student-id]').forEach(el => {
      el.addEventListener('click', () => {
        const sid = el.dataset.studentId;
        if (sid) {
          UI.closeModal();
          setTimeout(() => openStudentReport(sid), 200);
        }
      });
    });
  }

  // ===== Open individual student report =====
  function openStudentReport(studentId) {
    const report = computeStudentReport(studentId);
    if (!report) return;
    const s = report.student;
    const group = Storage.find(Storage.KEYS.groups, s.groupId);

    UI.modal({
      title: `تقرير: ${s.name}`,
      size: 'large',
      body: `
        <div class="detail-header" style="margin-bottom: var(--space-4);">
          <div class="detail-avatar">${UI.initials(s.name)}</div>
          <h2 class="detail-title">${s.name}</h2>
          <p class="detail-subtitle">${group ? group.name : '—'} • ${s.className || ''}</p>
        </div>

        ${report.hasData ? '' : `
          <div class="alert alert-info" style="margin-bottom: var(--space-3);">
            <div class="alert-icon">ℹ️</div>
            <div class="alert-body" style="font-size: var(--font-size-sm);">
              <strong>لا توجد بيانات كافية</strong> لهذا الطالب. سجّل الحضور والدرجات والواجبات لعرض تقرير شامل.
            </div>
          </div>
        `}

        <div class="stats-grid stagger" style="margin-bottom: var(--space-4);">
          <div class="stat-card ${report.attendance.rate === null ? '' : (report.attendance.rate >= 70 ? 'success' : 'danger')}">
            <div class="stat-value">${report.attendance.rate === null ? '—' : report.attendance.rate + '%'}</div>
            <div class="stat-label">معدل الحضور</div>
          </div>
          <div class="stat-card ${report.grades.avg === null ? '' : (report.grades.avg >= 70 ? 'success' : 'warning')}">
            <div class="stat-value">${report.grades.avg === null ? '—' : report.grades.avg + '%'}</div>
            <div class="stat-label">متوسط الاختبارات</div>
          </div>
          <div class="stat-card ${report.homework.rate === null ? '' : (report.homework.rate >= 70 ? 'success' : 'warning')}">
            <div class="stat-value">${report.homework.rate === null ? '—' : report.homework.rate + '%'}</div>
            <div class="stat-label">إنجاز الواجبات</div>
          </div>
          <div class="stat-card ${report.payments.remaining > 0 ? 'warning' : 'success'}">
            <div class="stat-value">${report.payments.remaining}</div>
            <div class="stat-label">متبقي (ج.م)</div>
          </div>
        </div>

        ${report.grades.recent.length > 0 ? `
          <div class="section">
            <div class="section-header">
              <h3 class="section-title">آخر الدرجات المسجّلة</h3>
              ${report.grades.trend === 'improving' ? '<span class="badge badge-success">↗ تحسّن</span>' : ''}
              ${report.grades.trend === 'declining' ? '<span class="badge badge-danger">↘ تراجع</span>' : ''}
              ${report.grades.trend === 'stable' ? '<span class="badge">— ثابت</span>' : ''}
            </div>
            <div class="list">
              ${report.grades.recent.map(g => {
                const e = Storage.find(Storage.KEYS.exams, g.examId);
                const pct = UI.gradePercentage(g.score, g.maxGrade);
                const letter = UI.gradeLetter(pct);
                return `
                  <div class="list-item">
                    <div class="list-item-body">
                      <div class="list-item-title">${e ? e.name : '—'}</div>
                      <div class="list-item-subtitle">${g.score} / ${g.maxGrade} • ${UI.formatDate(e ? e.date : null)}</div>
                    </div>
                    <div style="text-align:center;">
                      <div style="font-weight:700; color: var(--color-${letter.cls === 'success' ? 'success' : (letter.cls === 'warning' ? 'warning' : 'danger')});">${Math.round(pct)}%</div>
                      <span class="badge badge-${letter.cls}">${letter.label}</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

        ${report.attendance.recent.length > 0 ? `
          <div class="section">
            <div class="section-header">
              <h3 class="section-title">آخر سجلات الحضور</h3>
            </div>
            <div class="list">
              ${report.attendance.recent.map(a => {
                const l = Storage.find(Storage.KEYS.lessons, a.lessonId);
                return `
                  <div class="list-item">
                    <div class="list-item-body">
                      <div class="list-item-title">${UI.formatDate(a.date, { weekday: true })}</div>
                      <div class="list-item-subtitle">${l ? UI.formatTime(l.startTime) : ''}</div>
                    </div>
                    ${UI.attendanceBadge(a.status)}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

        ${report.strengths.length > 0 || report.weaknesses.length > 0 ? `
          <div class="section">
            <div class="section-header">
              <h3 class="section-title">تحليل الأداء</h3>
              <span class="badge badge-info">مبني على السجلات</span>
            </div>
            ${report.strengths.length > 0 ? `
              <div class="alert alert-success" style="margin-bottom: var(--space-2);">
                <div class="alert-icon">✓</div>
                <div class="alert-body">
                  <strong>نقاط القوة</strong>
                  <ul style="margin: 6px 0 0; padding-inline-start: 18px;">
                    ${report.strengths.map(st => `<li>${st}</li>`).join('')}
                  </ul>
                </div>
              </div>
            ` : ''}
            ${report.weaknesses.length > 0 ? `
              <div class="alert alert-warning">
                <div class="alert-icon">⚠️</div>
                <div class="alert-body">
                  <strong>نقاط تحتاج تحسين</strong>
                  <ul style="margin: 6px 0 0; padding-inline-start: 18px;">
                    ${report.weaknesses.map(w => `<li>${w}</li>`).join('')}
                  </ul>
                </div>
              </div>
            ` : ''}
          </div>
        ` : ''}

        ${report.homework.total > 0 ? `
          <div class="section">
            <div class="section-header">
              <h3 class="section-title">الواجبات</h3>
            </div>
            <div class="stats-grid">
              <div class="stat-card success"><div class="stat-value">${report.homework.submitted}</div><div class="stat-label">مُنجَز</div></div>
              <div class="stat-card warning"><div class="stat-value">${report.homework.late}</div><div class="stat-label">متأخر</div></div>
              <div class="stat-card danger"><div class="stat-value">${report.homework.missing}</div><div class="stat-label">لم يُنجَز</div></div>
            </div>
          </div>
        ` : ''}

        <div class="alert alert-info" style="margin-top: var(--space-3);">
          <div class="alert-icon">ℹ️</div>
          <div class="alert-body" style="font-size: var(--font-size-xs);">
            التحليلات المذكورة مبنية على السجلات الفعلية. لا يتم استخدام الذكاء الاصطناعي لتقديم اقتراحات إلا في وحدة "خطة التحسين" المنفصلة.
          </div>
        </div>

        <div class="action-row" style="margin-top: var(--space-4);">
          <button class="btn btn-secondary" onclick="UI.closeModal()" style="flex:1">إغلاق</button>
          <button class="btn btn-outline" onclick="window.print()" style="flex:1">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            طباعة
          </button>
          <button class="btn btn-whatsapp" id="share-report-btn" style="flex:1">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M17.6 6.32A7.85 7.85 0 0 0 12.05 4 7.94 7.94 0 0 0 5.1 15.94L4 20l4.16-1.09a7.93 7.93 0 0 0 3.79.97h.01a7.94 7.94 0 0 0 5.64-13.55z"/></svg>
            مشاركة
          </button>
        </div>
      `
    });

    document.getElementById('share-report-btn')?.addEventListener('click', () => {
      const phoneValid = WhatsAppTemplates.validatePhone(s.parentPhone);
      if (!phoneValid) {
        UI.toast('رقم هاتف ولي الأمر غير صالح', 'error');
        return;
      }
      const teacher = Auth.getTeacher();
      const settings = Storage.get(Storage.KEYS.settings, {});
      const tpl = settings.reportTemplate || WhatsAppTemplates.defaultReport;
      const msg = WhatsAppTemplates.fillReport(tpl, {
        studentName: s.name,
        attendance: report.attendance.rate === null ? 'لا يوجد' : report.attendance.rate,
        examAvg: report.grades.avg === null ? 'لا يوجد' : report.grades.avg,
        homeworkDone: `${report.homework.submitted}/${report.homework.total}`,
        teacherName: teacher ? teacher.name : 'مُعلّمي'
      });
      WhatsAppTemplates.openWhatsApp(phoneValid.international, msg);
    });
  }

  return {
    computeDailyOverview,
    computeStudentReport,
    openDaily,
    openStudentReport
  };
})();

window.DailyReport = DailyReport;

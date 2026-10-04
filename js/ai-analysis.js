/* ============================================
   مُعلّمي | ai-analysis.js
   تجهيز بيانات الطالب للتحليل - مصدر الحقيقة الوحيد للبيانات
   مبدأ صارم: لا يُخترع أي رقم. ما لا توجد بياناته يُعلَّم "غير متوفر"
   ============================================ */

const AIAnalysis = {

  /**
   * يجمع كل بيانات الطالب في كائن موحد جاهز للتحليل
   * { studentProfile, grades, gradeTrend, attendance, assignments, exams, teacherNotes, goals }
   */
  prepare(studentId, periodDays = 0) {
    const s = Storage.find(Storage.KEYS.students, studentId);
    if (!s) return null;

    const periodStart = periodDays > 0 ? Utils.daysAgo(periodDays) : null;

    // ===== الدرجات =====
    let grades = Storage.list(Storage.KEYS.grades, g => g.studentId === studentId);
    grades = grades.map(g => ({
      ...g,
      pct: g.maxGrade ? Utils.round((g.score / g.maxGrade) * 100, 1) : 0
    })).sort((a, b) => String(a.date || a.createdAt).localeCompare(String(b.date || b.createdAt)));

    // ===== الحضور =====
    const attendance = Storage.list(Storage.KEYS.attendance, a => a.studentId === studentId)
      .filter(a => !periodStart || a.date >= periodStart)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));

    const attStats = {
      total: attendance.length,
      present: attendance.filter(a => a.status === 'حاضر').length,
      absent: attendance.filter(a => a.status === 'غائب').length,
      late: attendance.filter(a => a.status === 'متأخر').length,
      excused: attendance.filter(a => a.status === 'غياب بعذر').length,
      rate: attendance.length ? Math.round((attendance.filter(a => a.status === 'حاضر').length / attendance.length) * 100) : null
    };

    // ===== الواجبات =====
    const submissions = Storage.list(Storage.KEYS.submissions, sub => sub.studentId === studentId);
    const assignmentStats = {
      total: submissions.length,
      submitted: submissions.filter(sub => sub.status === 'submitted' || sub.status === 'reviewed').length,
      late: submissions.filter(sub => sub.status === 'late').length,
      notSubmitted: submissions.filter(sub => sub.status === 'not_submitted').length,
      reviewed: submissions.filter(sub => sub.status === 'reviewed').length,
      rate: submissions.length ? Math.round((submissions.filter(sub => sub.status === 'submitted' || sub.status === 'reviewed' || sub.status === 'late').length / submissions.length) * 100) : null
    };

    // ===== الاختبارات =====
    const exams = [];
    grades.forEach(g => {
      if (!g.examId) return;
      if (!exams.some(e => e.id === g.examId)) {
        const exam = Storage.find(Storage.KEYS.exams, g.examId);
        if (exam) exams.push(exam);
      }
    });

    // ===== ملاحظات المدرس =====
    const teacherNotes = Storage.list(Storage.KEYS.notes, n => n.studentId === studentId)
      .sort((a, b) => b.createdAt - a.createdAt);

    // ===== الأهداف =====
    const goals = Storage.list(Storage.KEYS.goals, gl => gl.studentId === studentId);

    // ===== الاتجاه الزمني =====
    const gradeTrend = AI.trendFromGrades(grades);

    // ===== بيانات التجميع =====
    const group = s.groupId ? Storage.find(Storage.KEYS.groups, s.groupId) : null;

    return {
      studentProfile: {
        id: s.id,
        name: s.name,
        className: s.className || '',
        section: s.section || '',
        subject: s.subject || (group ? group.subject : ''),
        groupId: s.groupId || null,
        groupName: group ? group.name : '',
        status: s.status || 'نشط',
        subscriptionDate: s.subscriptionDate || null,
        school: s.school || '',
        parentName: s.parentName || '',
        parentPhone: s.parentPhone || ''
      },
      grades: grades.filter(g => !periodStart || (g.date || '') >= periodStart),
      allGrades: grades,
      gradeTrend,
      attendance: attendance,
      attStats,
      assignments: submissions,
      assignmentStats,
      exams,
      teacherNotes,
      goals,
      generatedAt: new Date().toISOString()
    };
  },

  /**
   * مكونات الأداء بأوزان قابلة للتعديل من الإعدادات
   * يعيد: { score, components: {exams, assignments, attendance, continuous}, coverage }
   * coverage = نسبة المكونات المتوفرة فعليًا من الأوزان
   */
  performance(data) {
    const settings = Storage.get(Storage.KEYS.settings, {});
    const weights = settings.weights || { exams: 50, assignments: 20, attendance: 10, continuous: 20 };

    const comps = {};
    let usedWeight = 0;

    // الاختبارات (درجات نوع اختبار + كل الدرجات المرتبطة باختبارات)
    const examGrades = data.allGrades.filter(g => g.type === 'اختبار' || g.examId);
    if (examGrades.length && weights.exams > 0) {
      comps.exams = Math.round(examGrades.reduce((s, g) => s + g.pct, 0) / examGrades.length);
      usedWeight += weights.exams;
    }

    // الواجبات (متوسط درجات المسلَّم + معدل التسليم)
    if (data.assignmentStats.total > 0 && weights.assignments > 0) {
      const subScores = data.assignments
        .filter(a => a.score != null)
        .map(a => {
          const asm = Storage.find(Storage.KEYS.assignments, a.assignmentId);
          return asm && asm.maxGrade ? (a.score / asm.maxGrade) * 100 : null;
        })
        .filter(v => v !== null);
      const scoreAvg = subScores.length ? subScores.reduce((s, v) => s + v, 0) / subScores.length : null;
      const rate = data.assignmentStats.rate != null ? data.assignmentStats.rate : null;
      if (scoreAvg != null && rate != null) comps.assignments = Math.round(scoreAvg * 0.7 + rate * 0.3);
      else comps.assignments = Math.round(scoreAvg != null ? scoreAvg : rate);
      if (comps.assignments != null) usedWeight += weights.assignments;
    }

    // الحضور
    if (data.attStats.rate != null && data.attStats.total > 0 && weights.attendance > 0) {
      comps.attendance = data.attStats.rate;
      usedWeight += weights.attendance;
    }

    // التقييم المستمر (درجات نوع تقييم مستمر/مشاركة)
    const contGrades = data.allGrades.filter(g => g.type === 'تقييم مستمر' || g.type === 'مشاركة');
    if (contGrades.length && weights.continuous > 0) {
      comps.continuous = Math.round(contGrades.reduce((s, g) => s + g.pct, 0) / contGrades.length);
      usedWeight += weights.continuous;
    }

    // حساب النتيجة بأوزان معاد توزيعها على المكونات المتوفرة فقط
    let score = null;
    if (usedWeight > 0) {
      score = 0;
      Object.entries(comps).forEach(([k, v]) => {
        if (v == null) return;
        const w = { exams: weights.exams, assignments: weights.assignments, attendance: weights.attendance, continuous: weights.continuous }[k];
        score += v * (w / usedWeight);
      });
      score = Math.round(score);
    }

    return { score, components: comps, coverage: usedWeight };
  },

  /**
   * طلاب "يحتاج متابعة" - المؤشرات السلبية مع السبب والإجراء المقترح
   */
  needsAttention() {
    const settings = Storage.get(Storage.KEYS.settings, {});
    const threshold = settings.absenceAlertThreshold || 3;
    const students = Storage.list(Storage.KEYS.students, s => s.status !== 'منسحب');
    const results = [];

    students.forEach(s => {
      const data = AIAnalysis.prepare(s.id);
      const reasons = [];

      // 1) غياب متكرر
      if (data.attStats.total >= threshold && data.attStats.rate != null && data.attStats.rate < 70) {
        reasons.push({
          key: 'attendance',
          label: `نسبة حضور منخفضة (${data.attStats.rate}%)`,
          severity: 'danger',
          action: 'contact'
        });
      }

      // 2) اتجاه هابط وواثق
      if (data.gradeTrend && data.gradeTrend.direction === 'declining' && data.gradeTrend.confidence !== 'منخفضة') {
        reasons.push({
          key: 'trend',
          label: `تراجع في الدرجات (${Math.abs(data.gradeTrend.change)}%)`,
          severity: 'danger',
          action: 'plan'
        });
      }

      // 3) متوسط درجات ضعيف
      const examGrades = data.allGrades.filter(g => g.type === 'اختبار' || g.examId);
      if (examGrades.length >= 2) {
        const avg = Math.round(examGrades.reduce((sum, g) => sum + g.pct, 0) / examGrades.length);
        if (avg < 60) {
          reasons.push({
            key: 'grades',
            label: `متوسط درجات ${avg}%`,
            severity: 'warning',
            action: 'plan'
          });
        }
      }

      // 4) واجبات لم تُسلَّم
      if (data.assignmentStats.notSubmitted >= 2) {
        reasons.push({
          key: 'assignments',
          label: `${data.assignmentStats.notSubmitted} واجبات لم تُسلَّم`,
          severity: 'warning',
          action: 'assignment'
        });
      }

      // 5) متوقف مؤقتًا
      if (s.status === 'متوقف') {
        reasons.push({
          key: 'status',
          label: 'حالة الطالب: متوقف',
          severity: 'info',
          action: 'profile'
        });
      }

      if (reasons.length) {
        const perf = AIAnalysis.performance(data);
        results.push({
          student: s,
          reasons,
          perfScore: perf.score,
          attRate: data.attStats.rate
        });
      }
    });

    // الترتيب حسب الأشد خطورة (عدد الأسباب + خطورتها)
    results.sort((a, b) => {
      const sev = { danger: 3, warning: 2, info: 1 };
      const aMax = Math.max(...a.reasons.map(r => sev[r.severity]));
      const bMax = Math.max(...b.reasons.map(r => sev[r.severity]));
      if (aMax !== bMax) return bMax - aMax;
      return b.reasons.length - a.reasons.length;
    });

    return results;
  },

  /**
   * Timeline موحد لآخر أحداث الطالب (درجات/حضور/ملاحظات/مدفوعات/تقارير)
   */
  timeline(studentId, limit = 30) {
    const events = [];

    Storage.list(Storage.KEYS.grades, g => g.studentId === studentId).forEach(g => {
      events.push({ type: 'grade', date: g.date || '', ts: g.createdAt, icon: 'exam', text: `${g.title || 'درجة'}: ${g.score}/${g.maxGrade}`, cls: g.pct >= 70 ? 'success' : (g.pct >= 60 ? 'warning' : 'danger') });
    });

    Storage.list(Storage.KEYS.attendance, a => a.studentId === studentId).forEach(a => {
      const cls = a.status === 'حاضر' ? 'success' : (a.status === 'غائب' ? 'danger' : 'warning');
      events.push({ type: 'attendance', date: a.date || '', ts: a.createdAt, icon: 'attendance', text: `الحضور: ${a.status}`, cls });
    });

    Storage.list(Storage.KEYS.notes, n => n.studentId === studentId).forEach(n => {
      events.push({ type: 'note', date: '', ts: n.createdAt, icon: 'note', text: `${n.type || 'ملاحظة'}: ${n.text}`, cls: 'info' });
    });

    Storage.list(Storage.KEYS.reports, r => r.studentId === studentId).forEach(r => {
      events.push({ type: 'report', date: '', ts: r.createdAt, icon: 'file', text: `تقرير: ${r.title || r.type}`, cls: '' });
    });

    return events
      .sort((a, b) => (b.date || b.ts || 0).toString().localeCompare((a.date || a.ts || 0).toString()) || (b.ts || 0) - (a.ts || 0))
      .slice(0, limit);
  }
};

window.AIAnalysis = AIAnalysis;

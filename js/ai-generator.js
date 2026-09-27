/* ============================================
   مُعلّمي | ai-generator.js
   التحليل الذكي للطلاب (Gemini)
   --------------------------------------------
   - تم إزالة مولّد الامتحانات بالكامل بناءً على طلب المستخدم
   - هذا الملف الآن يحتوي فقط على تحليل الطالب
   - التحليل الذكي يعتمد على Edge Function "gemini-ai" (gemini-ai) كما هو
   - لا يحتوي هذا الملف على أي مفتاح API نهائيًا
   ============================================ */

const AIGenerator = {
  /* Edge Function — تُستخدم لمهمة student-analysis */
  EDGE_FUNCTION: 'gemini-ai',

  /* ============================================
     فحوصات ما قبل الاستخدام
     تحليل الطالب يتطلب Supabase + جلسة (لم يتغير)
     ============================================ */
  precheck() {
    if (!window.SupabaseConfig || !SupabaseConfig.isReady()) {
      return { ok: false, msg: 'تعذر الاتصال بالخدمة — تحقق من اتصالك بالإنترنت ثم أعد المحاولة' };
    }
    if (Storage.isDemoMode()) {
      return { ok: false, msg: 'الوضع التجريبي لا يدعم الذكاء الاصطناعي — سجّل الدخول بحسابك الحقيقي أولًا' };
    }
    return { ok: true };
  },

  /* ============================================
     1) التحليل الذكي — اختيار الطالب
     ============================================ */
  openStudentPicker() {
    const students = Storage.list(Storage.KEYS.students, s => s.status !== 'منسحب')
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ar'));

    UI.modal({
      title: 'التحليل الذكي — اختر الطالب',
      size: 'large',
      body: `
        <div class="search-bar">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="search" id="ai-student-search" placeholder="ابحث باسم الطالب...">
        </div>
        <div id="ai-students-list" style="max-height: 50vh; overflow-y: auto;">
          ${this.renderStudentOptions(students)}
        </div>
        <p class="ai-note">${Icons.get('shield', 13)} يُحلل الطالب بناءً على بياناته المسجلة فقط (الدرجات، التقييمات، الحضور، الواجبات، الملاحظات) — بدون هواتف أو بيانات مالية، وممنوع اختراع أي أرقام.</p>
      `
    });

    const input = document.getElementById('ai-student-search');
    input?.addEventListener('input', Utils.debounce(() => {
      const q = (input.value || '').trim().toLowerCase();
      const filtered = students.filter(s => String(s.name).toLowerCase().includes(q));
      const list = document.getElementById('ai-students-list');
      if (list) list.innerHTML = this.renderStudentOptions(filtered);
      this.bindStudentOptions();
    }, 200));

    this.bindStudentOptions();
  },

  renderStudentOptions(students) {
    if (!students.length) {
      return UI.emptyState('🧠', 'لا يوجد طلاب', 'أضف طلابًا وسجّل بياناتهم أولًا ليعمل التحليل الذكي.');
    }
    return `<div class="list">${students.map(s => {
      const group = Storage.find(Storage.KEYS.groups, s.groupId);
      return `
        <div class="list-item clickable" data-ai-student="${s.id}">
          <div class="avatar avatar-sm">${UI.initials(s.name)}</div>
          <div class="list-item-body">
            <div class="list-item-title">${esc(s.name)}</div>
            <div class="list-item-subtitle">${esc(s.className || '')}${group ? ' • ' + esc(group.name) : ''}</div>
          </div>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-tertiary); transform: scaleX(-1);"><path d="m9 18 6-6-6-6"/></svg>
        </div>
      `;
    }).join('')}</div>`;
  },

  bindStudentOptions() {
    document.querySelectorAll('[data-ai-student]').forEach(el => {
      el.addEventListener('click', () => this.runStudentAnalysis(el.dataset.aiStudent));
    });
  },

  // نقطة الدخول من ملف الطالب مباشرة
  openStudentAnalysis(studentId) {
    this.runStudentAnalysis(studentId);
  },

  /* ============================================
     2) تنفيذ التحليل الذكي
     ============================================ */
  async runStudentAnalysis(studentId) {
    const student = Storage.find(Storage.KEYS.students, studentId);
    if (!student) { UI.toast('لم يتم العثور على الطالب', 'warning'); return; }

    const pre = this.precheck();

    UI.modal({
      title: `التحليل الذكي — ${esc(student.name)}`,
      size: 'large',
      body: pre.ok ? `
        <div class="ai-loading">
          <div class="ai-spinner"></div>
          <h3>جاري تحليل بيانات الطالب...</h3>
          <p class="ai-loading-hint">يتم إرسال البيانات المسجلة فقط إلى الخادم الآمن — قد يستغرق التحليل حتى دقيقة</p>
        </div>
      ` : '<div id="ai-analysis-body"></div>'
    });

    if (!pre.ok) {
      this.renderAnalysisError(pre.msg, studentId);
      return;
    }

    try {
      const res = await AI.requestStudentAnalysis(studentId);
      this.renderAnalysis(studentId, res.data, 'gemini');
    } catch (err) {
      const safe = (err && err.message && err.message.trim())
        ? err.message.trim()
        : 'تعذر إتمام التحليل — حاول مرة أخرى';
      this.renderAnalysisError(safe, studentId);
    }
  },

  renderAnalysisError(msg, studentId) {
    const body = document.getElementById('ai-analysis-body') || document.querySelector('#modal-content .modal-body');
    if (!body) { UI.toast(msg, 'error'); return; }
    body.innerHTML = `
      <div class="ai-error">
        <div class="ai-error-icon">${Icons.get('warn', 30)}</div>
        <h3>تعذر إتمام التحليل الذكي</h3>
        <p>${esc(msg)}</p>
        <div class="action-row" style="margin-top: var(--space-5);">
          <button class="btn btn-secondary" onclick="UI.closeModal()" style="flex:1">إغلاق</button>
          <button class="btn btn-outline" id="ai-analysis-local" style="flex:1.3">تحليل محلي (بدون إنترنت)</button>
        </div>
      </div>
    `;
    document.getElementById('ai-analysis-local')?.addEventListener('click', () => this.renderLocalAnalysis(studentId));
  },

  // البديل المحلي: نفس محرك التحليل المحلي الموجود (يعمل أوفلاين)
  renderLocalAnalysis(studentId) {
    const result = AI.generateStudentAnalysis(studentId);
    if (!result) { UI.toast('لا توجد بيانات كافية للتحليل', 'warning'); return; }
    const a = result.analysis;
    this.renderAnalysis(studentId, {
      summary: a.summary,
      strengths: a.strengths,
      areasToImprove: a.weaknesses,
      possibleCauses: [],
      teacherRecommendations: a.recommendations,
      improvementPlan: (AI.generateImprovementPlan(studentId)?.items || []).map(it => ({
        title: it.title,
        steps: it.steps,
        metric: it.metric
      })),
      parentReport: ''
    }, 'local');
  },

  /* ============================================
     3) عرض نتيجة التحليل
     - يضم زر مشاركة واتساب لتقرير ولي الأمر
     ============================================ */
  renderAnalysis(studentId, data, source) {
    const body = document.getElementById('ai-analysis-body') || document.querySelector('#modal-content .modal-body');
    if (!body) return;

    // مؤشرات فعلية محسوبة محليًا (لا تعتمد على Gemini)
    let chipsHtml = '';
    try {
      const localData = AIAnalysis.prepare(studentId);
      const perf = AIAnalysis.performance(localData);
      const chip = (label, value, cls) => `
        <div class="stat-card ${cls || ''}">
          <div class="stat-value">${value}</div>
          <div class="stat-label">${label}</div>
        </div>`;
      chipsHtml = `
        <div class="ai-real-stats">
          <p class="ai-real-stats-title">${Icons.get('database', 13)} مؤشرات فعلية محسوبة من بياناتك المسجلة:</p>
          <div class="stats-grid">
            ${perf.score != null ? chip('مؤشر الأداء', perf.score + '%', perf.score >= 70 ? 'success' : (perf.score >= 60 ? 'warning' : 'danger')) : ''}
            ${localData.attStats.rate != null ? chip('نسبة الحضور', localData.attStats.rate + '%', localData.attStats.rate >= 85 ? 'success' : 'danger') : ''}
            ${localData.assignmentStats.rate != null ? chip('تسليم الواجبات', localData.assignmentStats.rate + '%', '') : ''}
            ${chip('عدد الدرجات المسجلة', localData.allGrades.length, 'info')}
          </div>
        </div>
      `;
    } catch (e) { /* المؤشرات اختيارية */ }

    const section = (icon, title, items, note) => {
      if (!items || !items.length) return '';
      return `
        <div class="card ai-analysis-section">
          <h3 class="ai-section-title">${icon} ${title}</h3>
          <ul class="ai-list">
            ${items.map(it => `<li>${esc(it)}</li>`).join('')}
          </ul>
          ${note ? `<p class="ai-note">${note}</p>` : ''}
        </div>
      `;
    };

    const planHtml = (data.improvementPlan || []).length ? `
      <div class="card ai-analysis-section">
        <h3 class="ai-section-title">🎯 خطة تحسين للطالب</h3>
        ${data.improvementPlan.map((p, i) => `
          <div class="ai-plan-item">
            <div class="ai-plan-title">${i + 1}. ${esc(p.title || '')}</div>
            ${(p.steps || []).length ? `<ul class="ai-list">${p.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
            ${p.metric ? `<div class="ai-plan-metric">${Icons.get('target', 12)} مؤشر النجاح: ${esc(p.metric)}</div>` : ''}
          </div>
        `).join('')}
      </div>
    ` : '';

    const parentHtml = data.parentReport ? `
      <div class="card ai-analysis-section">
        <h3 class="ai-section-title">💌 تقرير ولي الأمر</h3>
        <div class="ai-parent-report">${esc(data.parentReport).replace(/\n/g, '<br>')}</div>
        <div class="action-row ai-parent-actions">
          <button class="btn btn-whatsapp" style="flex:1.4" id="ai-whatsapp-parent">${Icons.get('whatsapp', 16)} مشاركة عبر واتساب</button>
          <button class="btn btn-outline" style="flex:1" id="ai-copy-parent">${Icons.get('copy', 15)} نسخ التقرير</button>
        </div>
      </div>
    ` : '';

    body.innerHTML = `
      ${source === 'local' ? `<div class="ai-note">${Icons.get('info', 13)} هذا تحليل محلي مولّد من بياناتك المسجلة بدون ذكاء اصطناعي سحابي.</div>` : ''}
      ${chipsHtml}
      <div class="card ai-analysis-section">
        <h3 class="ai-section-title">📋 ملخص أداء الطالب</h3>
        <p class="ai-summary">${esc(data.summary || '')}</p>
      </div>
      ${section('⭐', 'نقاط القوة', data.strengths)}
      ${section('📌', 'نقاط تحتاج متابعة', data.areasToImprove)}
      ${section('❓', 'أسباب محتملة (مبنية على البيانات فقط)', data.possibleCauses, 'هذه أسباب احتمالية مستنتجة من البيانات المسجلة — وليست جزمًا.')}
      ${section('💡', 'توصيات عملية للمدرس', data.teacherRecommendations)}
      ${planHtml}
      ${parentHtml}
      <div class="action-row ai-actions">
        <button class="btn btn-outline" style="flex:1" id="ai-print-analysis">${Icons.get('print', 16)} طباعة التحليل</button>
        <button class="btn btn-secondary" onclick="UI.closeModal()" style="flex:1">إغلاق</button>
      </div>
      <p class="ai-note">${Icons.get('shield', 13)} التحليل مبني فقط على البيانات المسجلة في التطبيق، وهو مؤشر استرشادي — القرار النهائي للمدرس.</p>
    `;

    // زر مشاركة واتساب — يفتح wa.me مع نص التقرير جاهزًا
    document.getElementById('ai-whatsapp-parent')?.addEventListener('click', () => {
      const text = (data.parentReport || '').trim();
      if (!text) {
        UI.toast('لا يوجد نص تقرير للمشاركة', 'warning');
        return;
      }
      const url = 'https://wa.me/?text=' + encodeURIComponent(text);
      const win = window.open(url, '_blank');
      if (!win) {
        UI.toast('تعذر فتح واتساب — اسمح بالنوافذ المنبثقة للمتصفح', 'warning');
        return;
      }
      UI.toast('تم فتح واتساب — اختر جهة الاتصال وأرسل', 'success');
    });

    // زر نسخ التقرير (يبقى كما هو)
    document.getElementById('ai-copy-parent')?.addEventListener('click', async () => {
      const ok = await Utils.copyText(data.parentReport || '');
      UI.toast(ok ? 'تم نسخ تقرير ولي الأمر ✓' : 'تعذر النسخ', ok ? 'success' : 'error');
    });

    document.getElementById('ai-print-analysis')?.addEventListener('click', () => {
      this.printAnalysis(studentId, data, source);
    });

    body.scrollTop = 0;
  },

  printAnalysis(studentId, data, source) {
    const student = Storage.find(Storage.KEYS.students, studentId);
    if (!student) return;
    const teacher = (typeof Auth !== 'undefined' && Auth.getTeacher()) || {};
    const settings = Storage.get(Storage.KEYS.settings, {});

    const li = (arr) => (arr || []).map(x => `<li>${esc(x)}</li>`).join('');
    const planHtml = (data.improvementPlan || []).map((p, i) => `
      <div class="pa-plan"><b>${i + 1}. ${esc(p.title)}</b>
        <ul>${li(p.steps)}</ul>
        ${p.metric ? `<div class="pa-metric">مؤشر النجاح: ${esc(p.metric)}</div>` : ''}
      </div>
    `).join('');

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>تحليل ذكي — ${esc(student.name)}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 14mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Cairo', sans-serif; color: #1a1a1a; font-size: 12.5px; line-height: 1.8; }
  .pa-header { text-align: center; border-bottom: 3px double #8B5E34; padding-bottom: 8px; margin-bottom: 14px; }
  .pa-header h1 { font-size: 19px; color: #6B4527; }
  .pa-sub { color: #5A5048; font-size: 12px; }
  h2 { font-size: 15px; color: #8B5E34; margin: 14px 0 6px; border-inline-start: 4px solid #C89B3C; padding-inline-start: 8px; break-after: avoid; }
  ul { margin: 4px 22px 8px 0; }
  .pa-summary { background: #faf6ef; border: 1px solid #e5dccb; border-radius: 8px; padding: 10px 12px; }
  .pa-report { background: #faf6ef; border: 1px solid #e5dccb; border-radius: 8px; padding: 10px 12px; white-space: pre-wrap; }
  .pa-plan { margin-bottom: 8px; }
  .pa-metric { color: #2D8659; font-size: 12px; }
  .pa-footer { margin-top: 18px; text-align: center; color: #8A7F73; font-size: 11.5px; border-top: 1px solid #e0d8ca; padding-top: 8px; }
</style>
</head>
<body>
  <div class="pa-header">
    <h1>التحليل الذكي — ${esc(student.name)}</h1>
    <div class="pa-sub">${esc(student.className || '')}${student.subject ? ' • ' + esc(student.subject) : ''} • ${new Date().toLocaleDateString('ar-EG')}</div>
  </div>
  <h2>ملخص الأداء</h2>
  <div class="pa-summary">${esc(data.summary || '')}</div>
  ${data.strengths && data.strengths.length ? `<h2>نقاط القوة</h2><ul>${li(data.strengths)}</ul>` : ''}
  ${data.areasToImprove && data.areasToImprove.length ? `<h2>نقاط تحتاج متابعة</h2><ul>${li(data.areasToImprove)}</ul>` : ''}
  ${data.possibleCauses && data.possibleCauses.length ? `<h2>أسباب محتملة (احتمالية)</h2><ul>${li(data.possibleCauses)}</ul>` : ''}
  ${data.teacherRecommendations && data.teacherRecommendations.length ? `<h2>توصيات للمدرس</h2><ul>${li(data.teacherRecommendations)}</ul>` : ''}
  ${planHtml ? `<h2>خطة التحسين</h2>${planHtml}` : ''}
  ${data.parentReport ? `<h2>تقرير ولي الأمر</h2><div class="pa-report">${esc(data.parentReport)}</div>` : ''}
  <div class="pa-footer">
    تحليل مبني على البيانات المسجلة في تطبيق مُعلّمي${source === 'local' ? ' (محرك محلي)' : ' (Gemini AI)'} — مؤشر استرشادي والقرار النهائي للمدرس.
    <br>${esc(settings.reportCenter || teacher.name || '')}
  </div>
  <script>window.onload = function() { setTimeout(function() { window.print(); }, 500); };<\/script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=920,height=680');
    if (!win) {
      UI.toast('تعذر فتح نافذة الطباعة — اسمح بالنوافذ المنبثقة للمتصفح', 'warning');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
  }
};

window.AIGenerator = AIGenerator;

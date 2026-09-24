/* ============================================
   مُعلّمي | ai-generator.js
   مولّد الامتحانات + التحليل الذكي (Gemini)
   --------------------------------------------
   - الاستدعاء عبر Supabase Edge Function بجلسة المستخدم
   - لا يحتوي هذا الملف على أي مفتاح API نهائيًا
   - الامتحانات المولدة تُحفظ محليًا في ai_exams
     ولا تلمس الاختبارات العادية إطلاقًا
   - التحليل الذكي يعتمد على البيانات المسجلة فقط
   ============================================ */

const AIGenerator = {
  EDGE_FUNCTION: 'gemini-ai',

  // ===== حالة مؤقتة للجلسة الحالية =====
  lastExam: null,          // آخر امتحان مولد/معروض
  lastOptions: null,       // خيارات آخر توليد (لإعادة التوليد)
  lastExamSavedId: null,   // id الحفظ (منع التكرار)

  QUESTION_TYPES: [
    { key: 'mcq', label: 'اختيار من متعدد' },
    { key: 'truefalse', label: 'صح أو خطأ' },
    { key: 'fill', label: 'أكمل' },
    { key: 'essay', label: 'مقالي' },
    { key: 'problem', label: 'مسائل' }
  ],

  TYPE_LABELS: {
    mcq: 'اختيار من متعدد',
    truefalse: 'صح أو خطأ',
    fill: 'أكمل',
    essay: 'مقالي',
    problem: 'مسألة'
  },

  DIFFICULTIES: ['سهل', 'متوسط', 'صعب', 'متدرج'],

  /* ============================================
     فحوصات ما قبل الاستخدام
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

  // استدعاء موحد للـ Edge Function (يرسل Access Token تلقائيًا)
  callAI(task, payload) {
    return AIProviders.cloud.invoke(task, payload);
  },

  /* ============================================
     1) مولّد الامتحانات — النموذج
     ============================================ */
  openGenerator() {
    const pre = this.precheck();
    if (!pre.ok) { UI.toast(pre.msg, 'warning'); return; }

    const subjects = Storage.get(Storage.KEYS.subjects, []);
    const teacher = (typeof Auth !== 'undefined' && Auth.getTeacher()) || {};
    const groups = Storage.list(Storage.KEYS.groups);
    const defaultSubject = teacher.subject || '';

    UI.modal({
      title: 'توليد امتحان بالذكاء الاصطناعي',
      size: 'large',
      body: `
        <form id="ai-exam-form">
          <div class="field-row">
            <div class="field">
              <label>المادة <span class="required">*</span></label>
              <select name="subject" required>
                ${subjects.map(s => `<option value="${esc(s.name)}" ${s.name === defaultSubject ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label>الصف الدراسي <span class="required">*</span></label>
              <select name="grade" required>
                ${this.gradeOptions()}
              </select>
            </div>
          </div>

          <div class="field">
            <label>الدرس / الوحدة <span class="required">*</span></label>
            <input type="text" name="topic" required placeholder="مثال: الوحدة الثانية — التفاضل وتطبيقاته">
          </div>

          <div class="field-row">
            <div class="field">
              <label>عدد الأسئلة (5 - 50) <span class="required">*</span></label>
              <input type="number" name="questionCount" min="5" max="50" step="1" value="10" required inputmode="numeric">
            </div>
            <div class="field">
              <label>الدرجة النهائية <span class="required">*</span></label>
              <input type="number" name="totalMarks" min="1" step="0.5" value="20" required inputmode="decimal">
            </div>
            <div class="field">
              <label>الزمن (دقيقة) <span class="required">*</span></label>
              <input type="number" name="durationMinutes" min="5" step="5" value="45" required inputmode="numeric">
            </div>
          </div>

          <div class="field">
            <label>مستوى الصعوبة</label>
            <div class="ai-chip-group" id="ai-difficulty-group">
              ${this.DIFFICULTIES.map(d => `<button type="button" class="ai-chip ${d === 'متوسط' ? 'active' : ''}" data-diff="${d}">${d}</button>`).join('')}
            </div>
          </div>

          <div class="field">
            <label>أنواع الأسئلة (نوع واحد على الأقل)</label>
            <div class="ai-type-grid">
              ${this.QUESTION_TYPES.map((t, i) => `
                <label class="ai-type-item">
                  <input type="checkbox" name="qtype" value="${t.key}" ${i === 0 ? 'checked' : ''}>
                  <span>${t.label}</span>
                </label>
              `).join('')}
            </div>
          </div>

          <div class="field">
            <label>المجموعة المرتبطة بالامتحان (اختياري)</label>
            <select name="groupId">
              <option value="">بدون مجموعة</option>
              ${groups.map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join('')}
            </select>
          </div>

          <div class="field">
            <label>تعليمات إضافية للذكاء الاصطناعي (اختياري)</label>
            <textarea name="extraInstructions" rows="2" placeholder="مثال: ركّز على المسائل التطبيقية، واجعل السؤال الأخير تفكيرًا عالي المستوى"></textarea>
          </div>

          <p class="ai-note">${Icons.get('shield', 13)} يُرسل الطلب عبر خادم التطبيق الآمن باستخدام جلستك — لا توجد أي مفاتيح ذكاء اصطناعي داخل التطبيق.</p>

          <div class="action-row" style="margin-top: var(--space-4);">
            <button type="button" class="btn btn-secondary" onclick="UI.closeModal()" style="flex:1">إلغاء</button>
            <button type="submit" class="btn btn-gold" style="flex:2">✨ توليد الامتحان</button>
          </div>
        </form>
      `
    });

    // شرائح الصعوبة
    const diffGroup = document.getElementById('ai-difficulty-group');
    diffGroup.querySelectorAll('.ai-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        diffGroup.querySelectorAll('.ai-chip').forEach(c => c.classList.toggle('active', c === chip));
      });
    });

    // إرسال النموذج
    document.getElementById('ai-exam-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const types = fd.getAll('qtype');
      if (!types.length) { UI.toast('اختر نوع سؤال واحد على الأقل', 'warning'); return; }

      const options = {
        subject: String(fd.get('subject') || '').trim(),
        grade: String(fd.get('grade') || '').trim(),
        topic: String(fd.get('topic') || '').trim(),
        questionCount: parseInt(fd.get('questionCount'), 10),
        totalMarks: parseFloat(fd.get('totalMarks')),
        durationMinutes: parseInt(fd.get('durationMinutes'), 10),
        difficulty: diffGroup.querySelector('.ai-chip.active')?.dataset.diff || 'متوسط',
        types,
        extraInstructions: String(fd.get('extraInstructions') || '').trim(),
        groupId: String(fd.get('groupId') || '') || null
      };

      if (!options.grade) { UI.toast('اختر الصف الدراسي', 'warning'); return; }
      if (!(options.questionCount >= 5 && options.questionCount <= 50)) { UI.toast('عدد الأسئلة يجب أن يكون بين 5 و 50', 'warning'); return; }
      if (!(options.totalMarks > 0)) { UI.toast('أدخل درجة نهائية صحيحة', 'warning'); return; }
      if (!(options.durationMinutes > 0)) { UI.toast('أدخل زمنًا صحيحًا للامتحان', 'warning'); return; }

      this.generateExam(options);
    });
  },

  // خيارات الصف: صفوف الطلاب الفعلية أولًا ثم مستويات المراحل
  gradeOptions() {
    const stages = Storage.get(Storage.KEYS.stages, []);
    const existing = [];
    Storage.list(Storage.KEYS.students).forEach(s => {
      if (s.className && !existing.includes(s.className)) existing.push(s.className);
    });

    let html = '<option value="">اختر الصف</option>';
    existing.forEach(cn => { html += `<option value="${esc(cn)}">${esc(cn)}</option>`; });
    stages.forEach(st => {
      (st.levels || []).forEach(lv => {
        if (existing.includes(lv)) return;
        html += `<option value="${esc(lv)}">${esc(lv)} — ${esc(st.name)}</option>`;
      });
    });
    return html;
  },

  /* ============================================
     2) توليد الامتحان
     ============================================ */
  async generateExam(options) {
    this.lastExam = null;
    this.lastExamSavedId = null;
    this.lastOptions = options;

    // شاشة تحميل واضحة
    const body = document.querySelector('#modal-content .modal-body');
    if (body) {
      body.innerHTML = `
        <div class="ai-loading">
          <div class="ai-spinner"></div>
          <h3>جاري إعداد الامتحان...</h3>
          <p class="ai-loading-sub">${esc(options.subject)} • ${esc(options.topic)}</p>
          <p class="ai-loading-hint">${options.questionCount} سؤال • ${options.totalMarks} درجة • ${esc(options.difficulty)}</p>
          <p class="ai-loading-hint">قد يستغرق التوليد حتى دقيقة للامتحانات الطويلة — لا تغلق النافذة</p>
        </div>
      `;
    }

    try {
      const raw = await this.callAI('generate-exam', options);
      const exam = this.normalizeExam(raw, options);
      if (!exam.questions.length) {
        throw new Error('جاءت استجابة غير صالحة — اضغط "إعادة التوليد"');
      }
      this.lastExam = exam;
      this.renderExamResult(exam, { saved: false });
    } catch (err) {
      this.renderExamError(err.message || 'حدث خطأ غير متوقع', options);
    }
  },

  // توحيد شكل الامتحان + فرض قواعد الجودة
  normalizeExam(exam, options) {
    let questions = Array.isArray(exam.questions) ? exam.questions : [];
    if (questions.length > options.questionCount) {
      questions = questions.slice(0, options.questionCount);
    }

    questions = questions.map((q) => {
      let type = this.TYPE_LABELS[q.type] ? q.type : null;
      if (!type) type = (Array.isArray(q.options) && q.options.length === 4) ? 'mcq' : 'fill';

      const nq = {
        type,
        text: String(q.text || '').trim(),
        answer: q.answer != null ? String(q.answer).trim() : '',
        modelAnswer: q.modelAnswer != null ? String(q.modelAnswer).trim() : '',
        marks: Math.max(0.5, Number(q.marks) || 1)
      };

      if (type === 'mcq') {
        nq.options = (Array.isArray(q.options) ? q.options : [])
          .map(o => String(o || '').trim()).filter(Boolean).slice(0, 4);
        // مطابقة الإجابة الصحيحة مع أحد الاختيارات (تسامح المسافات)
        if (nq.answer && nq.options.length) {
          const exact = nq.options.find(o => o === nq.answer);
          const loose = nq.options.find(o => o.replace(/\s+/g, '') === nq.answer.replace(/\s+/g, ''));
          if (!exact && loose) nq.answer = loose;
        }
      } else if (type === 'truefalse') {
        nq.options = ['صح', 'خطأ'];
        nq.answer = /خطأ|خطا|false/i.test(nq.answer) ? 'خطأ' : 'صح';
      } else if (type === 'essay' || type === 'problem') {
        if (!nq.modelAnswer) nq.modelAnswer = nq.answer;
      }
      return nq;
    })
    // يُقبل السؤال إذا كان له نص وإجابة (الإجابة النموذجية تُحتسب للمقالي والمسائل)
    .filter(q => q.text && (q.answer || ((q.type === 'essay' || q.type === 'problem') && q.modelAnswer)));

    // فرض: مجموع الدرجات = الدرجة النهائية بالضبط
    this.fixMarks(questions, options.totalMarks);

    return {
      title: String(exam.title || '').trim() || ('امتحان ' + options.subject),
      subject: String(exam.subject || options.subject).trim(),
      grade: String(exam.grade || options.grade).trim(),
      topic: String(exam.topic || options.topic).trim(),
      durationMinutes: parseInt(exam.durationMinutes, 10) || options.durationMinutes,
      totalMarks: options.totalMarks,
      instructions: String(exam.instructions || '').trim(),
      questions,
      countMatch: questions.length === options.questionCount
    };
  },

  // إصلاح مجموع الدرجات ليطابق الدرجة النهائية بالضبط (خطوة 0.5)
  fixMarks(questions, total) {
    if (!questions.length) return;
    const R = v => Math.round(v * 2) / 2;
    const sum = () => questions.reduce((s, q) => s + q.marks, 0);

    questions.forEach(q => { q.marks = Math.max(0.5, R(Number(q.marks) || 1)); });

    let diff = R(total - sum());
    if (diff !== 0) {
      // توزيع نسبي أولي
      const s = sum();
      if (s > 0) {
        questions.forEach(q => {
          q.marks = Math.max(0.5, R(q.marks + diff * (q.marks / s)));
        });
      }
      // تصفية المتبقي (0.5) على الأسئلة الأعلى درجة
      let residual = R(total - sum());
      const byMarks = [...questions].sort((a, b) => b.marks - a.marks);
      let guard = 0;
      while (Math.abs(residual) >= 0.5 && guard < 600) {
        const q = byMarks[guard % byMarks.length];
        const next = R(q.marks + (residual > 0 ? 0.5 : -0.5));
        if (next >= 0.5) {
          q.marks = next;
          residual = R(residual + (residual > 0 ? -0.5 : 0.5));
        }
        guard++;
      }
    }
  },

  /* ============================================
     3) عرض نتيجة الامتحان
     ============================================ */
  renderExamResult(exam, { saved }) {
    const body = document.querySelector('#modal-content .modal-body');
    if (!body) return;

    const isSavedView = saved === true;
    const sum = exam.questions.reduce((s, q) => s + q.marks, 0);

    body.innerHTML = `
      ${this.renderExamHeader(exam)}
      ${this.renderQuestions(exam, true)}
      ${!exam.countMatch && this.lastOptions ? `
        <div class="ai-note ai-note-warn">${Icons.get('warn', 13)} عدد الأسئلة المولد (${exam.questions.length}) يختلف عن المطلوب (${this.lastOptions.questionCount}) — يمكنك الضغط على "إعادة التوليد".</div>
      ` : ''}
      ${Math.abs(sum - exam.totalMarks) > 0.01 ? `
        <div class="ai-note ai-note-warn">${Icons.get('warn', 13)} مجموع درجات الأسئلة (${sum}) لا يطابق الدرجة النهائية (${exam.totalMarks}).</div>
      ` : ''}
      <div class="action-row ai-actions">
        ${!isSavedView ? `<button class="btn btn-primary" style="flex:1.4" id="ai-save-exam">حفظ الامتحان</button>` : ''}
        ${!isSavedView ? `<button class="btn btn-secondary" style="flex:1" id="ai-regen-exam">إعادة التوليد</button>` : ''}
        <button class="btn btn-outline" style="flex:1" id="ai-print-exam">${Icons.get('print', 16)} ورقة الأسئلة</button>
        <button class="btn btn-outline" style="flex:1" id="ai-print-answers">${Icons.get('file', 16)} نموذج الإجابة</button>
        ${isSavedView ? `<button class="btn btn-danger" style="flex:0.8" id="ai-delete-exam">حذف</button>` : ''}
      </div>
    `;

    // ربط الأزرار
    const saveBtn = document.getElementById('ai-save-exam');
    if (saveBtn) saveBtn.addEventListener('click', () => this.saveExam());

    const regenBtn = document.getElementById('ai-regen-exam');
    if (regenBtn) regenBtn.addEventListener('click', () => {
      if (this.lastOptions) this.generateExam(this.lastOptions);
    });

    document.getElementById('ai-print-exam')?.addEventListener('click', () => this.printExam(this.lastExam, false));
    document.getElementById('ai-print-answers')?.addEventListener('click', () => this.printExam(this.lastExam, true));

    const delBtn = document.getElementById('ai-delete-exam');
    if (delBtn && isSavedView && this.lastExamSavedId) {
      delBtn.addEventListener('click', () => this.deleteSaved(this.lastExamSavedId));
    }

    body.scrollTop = 0;
  },

  renderExamError(msg, options) {
    const body = document.querySelector('#modal-content .modal-body');
    if (!body) { UI.toast(msg, 'error'); return; }
    body.innerHTML = `
      <div class="ai-error">
        <div class="ai-error-icon">${Icons.get('warn', 30)}</div>
        <h3>تعذر توليد الامتحان</h3>
        <p>${esc(msg)}</p>
        <div class="action-row" style="margin-top: var(--space-5);">
          <button class="btn btn-secondary" onclick="UI.closeModal()" style="flex:1">إغلاق</button>
          <button class="btn btn-gold" id="ai-retry-exam" style="flex:1">إعادة المحاولة</button>
        </div>
      </div>
    `;
    document.getElementById('ai-retry-exam')?.addEventListener('click', () => this.generateExam(options));
  },

  renderExamHeader(exam) {
    return `
      <div class="card ai-exam-header">
        <h3 class="ai-exam-title">${Icons.get('exam', 20)} ${esc(exam.title)}</h3>
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top: var(--space-2);">
          <span class="badge badge-info">${esc(exam.subject)}</span>
          <span class="badge">${esc(exam.grade)}</span>
          ${exam.topic ? `<span class="badge">${esc(exam.topic)}</span>` : ''}
          <span class="badge badge-warning">${exam.totalMarks} درجة</span>
          <span class="badge badge-gold">${exam.durationMinutes} دقيقة</span>
          <span class="badge badge-success">${exam.questions.length} سؤال</span>
        </div>
        ${exam.instructions ? `
          <div class="ai-instructions">
            <b>تعليمات:</b> ${esc(exam.instructions)}
          </div>
        ` : ''}
      </div>
    `;
  },

  // عرض الأسئلة — showAnswers لإظهار الإجابات الصحيحة والنموذجية
  renderQuestions(exam, showAnswers) {
    const letters = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];
    return exam.questions.map((q, i) => {
      let optionsHtml = '';
      if (q.type === 'mcq' && Array.isArray(q.options) && q.options.length) {
        optionsHtml = `<div class="ai-options">${q.options.map((o, j) => {
          const correct = showAnswers && o === q.answer;
          return `<div class="ai-option ${correct ? 'correct' : ''}">
            <span class="ai-option-key">${letters[j] || (j + 1)}</span>
            <span class="ai-option-text">${esc(o)}</span>
            ${correct ? `<span class="ai-option-check">${Icons.get('check', 13)}</span>` : ''}
          </div>`;
        }).join('')}</div>`;
      } else if (q.type === 'truefalse') {
        optionsHtml = `<div class="ai-options">
          <div class="ai-option ${showAnswers && q.answer === 'صح' ? 'correct' : ''}"><span class="ai-option-key">✓</span><span class="ai-option-text">صح</span></div>
          <div class="ai-option ${showAnswers && q.answer === 'خطأ' ? 'correct' : ''}"><span class="ai-option-key">✕</span><span class="ai-option-text">خطأ</span></div>
        </div>`;
      }

      let answerHtml = '';
      if (showAnswers) {
        if (q.type === 'essay' || q.type === 'problem') {
          answerHtml = `
            <div class="ai-answer-block">
              <div class="ai-answer-label">${Icons.get('award', 13)} الإجابة النموذجية</div>
              <div class="ai-answer-text">${esc(q.modelAnswer || q.answer || '—')}</div>
            </div>
          `;
        } else {
          answerHtml = `<div class="ai-answer-inline">الإجابة الصحيحة: <b>${esc(q.answer || '—')}</b></div>`;
        }
      }

      return `
        <div class="card ai-q-card">
          <div class="ai-q-head">
            <span class="ai-q-num">${i + 1}</span>
            <span class="badge badge-info ai-q-type">${this.TYPE_LABELS[q.type] || q.type}</span>
            <span style="flex:1"></span>
            <span class="badge badge-warning ai-q-marks">${q.marks} درجة</span>
          </div>
          <div class="ai-q-text">${esc(q.text)}</div>
          ${optionsHtml}
          ${answerHtml}
        </div>
      `;
    }).join('');
  },

  /* ============================================
     4) حفظ الامتحان المولد (محليًا — ai_exams)
     ============================================ */
  saveExam() {
    if (!this.lastExam) return;
    if (this.lastExamSavedId) { UI.toast('الامتحان محفوظ بالفعل', 'info'); return; }

    const o = this.lastOptions || {};
    const saved = Storage.insert(Storage.KEYS.aiExams, {
      title: this.lastExam.title,
      subject: this.lastExam.subject,
      grade: this.lastExam.grade,
      topic: this.lastExam.topic,
      durationMinutes: this.lastExam.durationMinutes,
      totalMarks: this.lastExam.totalMarks,
      instructions: this.lastExam.instructions,
      questions: this.lastExam.questions,
      groupId: o.groupId || null,
      difficulty: o.difficulty || '',
      types: o.types || [],
      isAiGenerated: true
    });
    this.lastExamSavedId = saved.id;

    try {
      Notifications.add('exam', 'امتحان بالذكاء الاصطناعي', `${saved.title} — ${saved.questions.length} سؤال`, saved.id);
    } catch (e) { /* الإشعارات اختيارية */ }

    UI.toast('تم حفظ الامتحان في تبويب "الذكاء الاصطناعي" ✓', 'success');
    const btn = document.getElementById('ai-save-exam');
    if (btn) { btn.textContent = 'تم الحفظ ✓'; btn.disabled = true; btn.style.opacity = '0.7'; }
  },

  deleteSaved(id) {
    const exam = Storage.find(Storage.KEYS.aiExams, id);
    if (!exam) return;
    UI.confirm(
      `هل تريد حذف الامتحان "${esc(exam.title)}" نهائيًا؟ لن تتأثر الاختبارات العادية أو درجات الطلاب.`,
      () => {
        Storage.removeById(Storage.KEYS.aiExams, id);
        UI.closeModal();
        UI.toast('تم حذف الامتحان المولد', 'success');
        if (App.currentPage === 'exams') App.navigate('exams');
      },
      { title: 'حذف امتحان مولد', confirmText: 'حذف' }
    );
  },

  /* ============================================
     5) الامتحانات المولدة المحفوظة (تبويب صفحة الاختبارات)
     ============================================ */
  renderSavedTab() {
    const exams = Storage.list(Storage.KEYS.aiExams)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    if (!exams.length) {
      return UI.emptyState('✨', 'لا توجد امتحانات مولدة بعد', 'أنشئ امتحانًا جاهزًا في دقيقة واحدة بالذكاء الاصطناعي.', 'توليد امتحان', 'ai-generate');
    }

    return `<div class="list stagger">${exams.map(e => `
      <div class="list-item clickable" data-ai-exam="${e.id}">
        <div class="quick-action-icon gold">✨</div>
        <div class="list-item-body">
          <div class="list-item-title">${esc(e.title)}</div>
          <div class="list-item-subtitle">${esc(e.subject)} • ${esc(e.grade)}${e.topic ? ' • ' + esc(e.topic) : ''}</div>
          <div style="display:flex; gap:6px; margin-top:6px; flex-wrap:wrap;">
            <span class="badge badge-info">${e.questions.length} سؤال</span>
            <span class="badge badge-warning">${e.totalMarks} درجة</span>
            <span class="badge badge-gold">${e.durationMinutes} دقيقة</span>
          </div>
        </div>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-tertiary); transform: scaleX(-1);"><path d="m9 18 6-6-6-6"/></svg>
      </div>
    `).join('')}</div>`;
  },

  bindSavedTab() {
    document.querySelectorAll('[data-ai-exam]').forEach(el => {
      el.addEventListener('click', () => this.openSavedDetail(el.dataset.aiExam));
    });
    document.querySelectorAll('[data-action="ai-generate"]').forEach(el => {
      el.addEventListener('click', () => this.openGenerator());
    });
  },

  openSavedDetail(id) {
    const exam = Storage.find(Storage.KEYS.aiExams, id);
    if (!exam) { UI.toast('لم يتم العثور على الامتحان المولد', 'warning'); return; }

    this.lastExam = exam;
    this.lastExamSavedId = id;
    this.lastOptions = { questionCount: exam.questions.length, groupId: exam.groupId, difficulty: exam.difficulty };

    UI.modal({
      title: esc(exam.title || 'امتحان مولد بالذكاء الاصطناعي'),
      size: 'large',
      body: '<div id="ai-exam-detail-body"></div>'
    });

    setTimeout(() => this.renderExamResult(exam, { saved: true }), 30);
  },

  /* ============================================
     6) طباعة الامتحان / نموذج الإجابة (A4)
     ============================================ */
  printExam(exam, withAnswers) {
    if (!exam || !exam.questions) { UI.toast('لا يوجد امتحان للطباعة', 'warning'); return; }

    const teacher = (typeof Auth !== 'undefined' && Auth.getTeacher()) || {};
    const settings = Storage.get(Storage.KEYS.settings, {});
    const centerName = settings.reportCenter || teacher.name || 'مُعلّمي';
    const letters = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];

    const questionsHtml = exam.questions.map((q, i) => {
      let body = '';
      if (q.type === 'mcq' && Array.isArray(q.options)) {
        body = `<div class="p-options">${q.options.map((o, j) => `
          <div class="p-option"><span class="p-key">${letters[j] || (j + 1)})</span> ${esc(o)}</div>
        `).join('')}</div>`;
      } else if (q.type === 'truefalse') {
        body = `<div class="p-options"><div class="p-option">( ) صح</div><div class="p-option">( ) خطأ</div></div>`;
      } else if (q.type === 'fill') {
        body = `<div class="p-dots"></div>`;
      }

      let answerHtml = '';
      if (withAnswers) {
        if (q.type === 'essay' || q.type === 'problem') {
          answerHtml = `<div class="p-answer"><b>الإجابة النموذجية:</b> ${esc(q.modelAnswer || q.answer || '—')}</div>`;
        } else {
          answerHtml = `<div class="p-answer"><b>الإجابة:</b> ${esc(q.answer || '—')}</div>`;
        }
      }

      return `
        <div class="p-question">
          <div class="p-q-head">
            <span class="p-q-num">${i + 1}</span>
            <span class="p-q-text">${esc(q.text)}</span>
            <span class="p-q-marks">(${q.marks} درجة)</span>
          </div>
          ${body}
          ${answerHtml}
        </div>
      `;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>${esc(exam.title)}${withAnswers ? ' — نموذج الإجابة' : ''}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 14mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Cairo', sans-serif; color: #1a1a1a; font-size: 13px; line-height: 1.7; }
  .p-header { text-align: center; border-bottom: 3px double #8B5E34; padding-bottom: 8px; margin-bottom: 12px; }
  .p-header h1 { font-size: 20px; color: #6B4527; }
  .p-header .p-center { font-size: 14px; font-weight: 700; color: #8B5E34; }
  .p-meta { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin: 10px 0; }
  .p-meta span { border: 1px solid #d9cfc0; border-radius: 20px; padding: 2px 12px; font-size: 11.5px; background: #faf6ef; }
  .p-student { display: flex; gap: 30px; margin: 12px 0; font-size: 13px; }
  .p-student span { flex: 1; border-bottom: 1.5px dotted #999; padding-bottom: 2px; }
  .p-instructions { background: #faf6ef; border: 1px solid #e5dccb; border-radius: 8px; padding: 8px 12px; margin-bottom: 14px; font-size: 12px; }
  .p-question { margin-bottom: 14px; break-inside: avoid; }
  .p-q-head { display: flex; gap: 8px; align-items: baseline; }
  .p-q-num { background: #8B5E34; color: #fff; min-width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }
  .p-q-text { flex: 1; font-weight: 600; }
  .p-q-marks { color: #8B5E34; font-size: 11.5px; white-space: nowrap; }
  .p-options { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 18px; margin: 6px 28px 0 0; font-size: 12.5px; }
  .p-key { font-weight: 700; color: #8B5E34; }
  .p-dots { border-bottom: 1.5px dotted #999; height: 22px; margin: 6px 28px 0 0; }
  .p-answer { background: #f2f7f4; border-inline-start: 3px solid #2D8659; border-radius: 6px; padding: 6px 10px; margin: 6px 28px 0 0; font-size: 12.5px; }
  .p-type { display: inline-block; font-size: 10.5px; color: #8A7F73; border: 1px solid #e0d8ca; border-radius: 10px; padding: 0 8px; margin-inline-start: 6px; }
  .p-footer { text-align: center; margin-top: 20px; color: #8A7F73; font-size: 12px; border-top: 1px solid #e0d8ca; padding-top: 8px; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
  <div class="p-header">
    <div class="p-center">${esc(centerName)}</div>
    <h1>${esc(exam.title)}${withAnswers ? ' — نموذج الإجابة' : ''}</h1>
  </div>
  <div class="p-meta">
    <span>المادة: ${esc(exam.subject)}</span>
    <span>الصف: ${esc(exam.grade)}</span>
    ${exam.topic ? `<span>الدرس: ${esc(exam.topic)}</span>` : ''}
    <span>الزمن: ${exam.durationMinutes} دقيقة</span>
    <span>الدرجة: ${exam.totalMarks}</span>
  </div>
  ${withAnswers ? '' : `
    <div class="p-student">
      <span>اسم الطالب: ..............................</span>
      <span>الفصل: ..............</span>
      <span>التاريخ: ..............................</span>
    </div>
  `}
  ${exam.instructions ? `<div class="p-instructions"><b>تعليمات:</b> ${esc(exam.instructions)}</div>` : ''}
  ${questionsHtml}
  <div class="p-footer">مع تمنياتنا بالتوفيق — ${esc(teacher.name || '')}</div>
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
  },

  /* ============================================
     7) التحليل الذكي — اختيار الطالب
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
     8) تنفيذ التحليل الذكي
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
      this.renderAnalysisError(err.message || 'تعذر إتمام التحليل', studentId);
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
     9) عرض نتيجة التحليل
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
        <div class="action-row" style="margin-top: var(--space-3);">
          <button class="btn btn-whatsapp" style="flex:1" id="ai-copy-parent">${Icons.get('copy', 15)} نسخ التقرير</button>
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


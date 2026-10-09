/* ============================================
   مُعلّمي | ai-exam.js
   مولّد الاختبارات بالذكاء الاصطناعي + محرر يدوي
   ============================================

   يعتمد على:
   - مزوّد ذكاء اصطناعي اختياري يُحدّده المدرس في الإعدادات (OpenAI / ZAI / غيره)
   - في غياب المزوّد أو المفتاح: يُقدّم محرّر أسئلة يدوي كامل
   - لا يتم إرسال أي بيانات لمزوّد خارجي ما لم يُفعّل المدرس ذلك صراحةً
   - لا يتم ادّعاء نجاح التوليد إذا فشل الاتصال
   ============================================ */

const AIExam = (function () {

  const QUESTION_TYPES = [
    { id: 'mcq', label: 'اختيار من متعدد', icon: '🔘' },
    { id: 'true_false', label: 'صح أو خطأ', icon: '✓✕' },
    { id: 'complete', label: 'أكمل الفراغ', icon: '✏️' },
    { id: 'short', label: 'سؤال قصير', icon: '📝' },
    { id: 'essay', label: 'سؤال مقالي', icon: '📄' },
    { id: 'matching', label: 'توصيل', icon: '🔗' }
  ];

  const DIFFICULTY_LEVELS = [
    { id: 'easy', label: 'سهل', color: 'success' },
    { id: 'medium', label: 'متوسط', color: 'warning' },
    { id: 'hard', label: 'صعب', color: 'danger' }
  ];

  // ===== Build prompt for AI provider =====
  function buildPrompt(opts) {
    const typeLabels = opts.questionTypes.map(t => QUESTION_TYPES.find(q => q.id === t)?.label).filter(Boolean);
    return `أنت معلم خبير في مادة "${opts.subject}" للمرحلة "${opts.stage || 'غير محددة'}".
أَنشئ اختبارًا تعليميًا باللغة العربية حول الموضوع التالي:

${opts.lessonContent || 'الموضوع: ' + (opts.topic || 'غير محدد')}

متطلبات الاختبار:
- عدد الأسئلة: ${opts.questionCount}
- مستوى الصعوبة: ${DIFFICULTY_LEVELS.find(d => d.id === opts.difficulty)?.label || 'متوسط'}
- أنواع الأسئلة المطلوبة: ${typeLabels.join('، ') || 'متنوعة'}
- الدرجة الكلية: ${opts.maxGrade} درجة

قواعد الإخراج (إلزامية):
1. أَعد JSON صالح فقط بدون أي نص إضافي قبل أو بعد.
2. الصيغة:
{
  "title": "عنوان الاختبار",
  "instructions": "تعليمات للطلاب",
  "questions": [
    {
      "type": "mcq|true_false|complete|short|essay|matching",
      "text": "نص السؤال",
      "options": ["خيار 1", "خيار 2", "خيار 3", "خيار 4"],
      "correctAnswer": "الخيار الصحيح",
      "mark": 1,
      "explanation": "شرح موجز للحل"
    }
  ]
}
3. لأسئلة "صح أو خطأ" استخدم options = ["صح", "خطأ"].
4. لأسئلة "أكمل الفراغ" ضع الفراغ "_____" داخل نص السؤال وضع الإجابة الصحيحة في correctAnswer.
5. لأسئلة "مقالي" اترك correctAnswer فارغًا وضع معايير التصحيح في explanation.
6. تأكد أن مجموع الدرجات يساوي ${opts.maxGrade}.
7. اجعل الأسئلة واضحة ومناسبة للمرحلة العمرية.
8. لا تستخدم رموزًا رياضية معقدة بصيغة لا يمكن قراءتها — استخدم صيغة نصية بسيطة (مثل: س^2 بدل س²).`;
  }

  // ===== Try AI generation via configured provider =====
  async function generate(opts) {
    const settings = Storage.get(Storage.KEYS.settings, {});
    const provider = settings.aiProvider || 'none';
    const apiKey = settings.aiApiKey || '';
    const endpoint = settings.aiEndpoint || '';

    if (provider === 'none' || !apiKey || !endpoint) {
      return { ok: false, reason: 'no-config', fallback: 'manual' };
    }

    const prompt = buildPrompt(opts);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(provider === 'openai' ? { 'Authorization': `Bearer ${apiKey}` } : {}),
          ...(provider === 'zai' ? { 'Authorization': `Bearer ${apiKey}` } : {})
        },
        body: JSON.stringify({
          model: settings.aiModel || (provider === 'openai' ? 'gpt-4o-mini' : 'glm-4-flash'),
          messages: [
            { role: 'system', content: 'أنت مساعد تعليمي متخصص في إنشاء اختبارات عربية للطلاب.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 4000
        })
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        return { ok: false, reason: 'http-error', status: res.status, message: errText };
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content || '';
      if (!content) {
        return { ok: false, reason: 'empty-response' };
      }

      // Extract JSON from the response (some providers wrap in code fences)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { ok: false, reason: 'invalid-json', raw: content };
      }

      let parsed;
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (e) {
        return { ok: false, reason: 'parse-error', raw: content };
      }

      if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
        return { ok: false, reason: 'no-questions', raw: content };
      }

      // Normalize each question
      parsed.questions = parsed.questions.map((q, i) => ({
        id: 'q_' + Date.now() + '_' + i,
        type: q.type || 'short',
        text: q.text || '',
        options: Array.isArray(q.options) ? q.options : [],
        correctAnswer: q.correctAnswer !== undefined ? String(q.correctAnswer) : '',
        mark: parseFloat(q.mark) || 1,
        explanation: q.explanation || ''
      }));

      return { ok: true, exam: parsed };
    } catch (e) {
      return { ok: false, reason: 'network-error', message: e.message };
    }
  }

  // ===== Save generated exam to the existing exams collection =====
  function saveExamToCollection(exam, opts) {
    // Build a question set record
    const questionSet = {
      id: Storage.uid('qs_'),
      examId: null, // will be linked when exam is created
      title: exam.title || opts.topic || 'اختبار',
      instructions: exam.instructions || '',
      questions: exam.questions,
      difficulty: opts.difficulty,
      createdAt: Date.now()
    };

    // Save question sets in their own collection for re-use
    const all = Storage.get('moallemy_exam_questions', []);
    all.push(questionSet);
    Storage.set('moallemy_exam_questions', all);

    return questionSet;
  }

  // ===== Get all saved question sets =====
  function listQuestionSets() {
    return Storage.get('moallemy_exam_questions', []);
  }

  function findQuestionSet(id) {
    return listQuestionSets().find(qs => qs.id === id) || null;
  }

  function deleteQuestionSet(id) {
    const all = listQuestionSets();
    Storage.set('moallemy_exam_questions', all.filter(qs => qs.id !== id));
  }

  // ===== Open the AI exam generator UI =====
  function openGenerator(prefillGroupId = '') {
    const groups = Storage.list(Storage.KEYS.groups);
    if (groups.length === 0) {
      UI.toast('أنشئ مجموعة أولًا', 'warning');
      return;
    }

    const stages = Storage.get(Storage.KEYS.stages, []);
    const subjects = Storage.get(Storage.KEYS.subjects, []);
    const settings = Storage.get(Storage.KEYS.settings, {});
    const provider = settings.aiProvider || 'none';

    UI.modal({
      title: 'مولّد الاختبارات',
      size: 'large',
      body: `
        ${provider === 'none' || !settings.aiApiKey ? `
          <div class="alert alert-info" style="margin-bottom: var(--space-3);">
            <div class="alert-icon">ℹ️</div>
            <div class="alert-body" style="font-size: var(--font-size-sm);">
              <strong>وضع يدوي</strong> — لم يتم إعداد مزوّد ذكاء اصطناعي.
              يمكنك إنشاء أسئلة يدويًا بنفس الكفاءة، أو إعداد مزوّد من <strong>الإعدادات ← الذكاء الاصطناعي</strong>.
            </div>
          </div>
        ` : `
          <div class="alert alert-success" style="margin-bottom: var(--space-3);">
            <div class="alert-icon">✓</div>
            <div class="alert-body" style="font-size: var(--font-size-sm);">
              مزوّد الذكاء الاصطناعي مُفعّل: <strong>${provider}</strong>. سيتم توليد الأسئلة تلقائيًا ثم مراجعتها قبل الحفظ.
            </div>
          </div>
        `}

        <form id="ai-exam-form">
          <div class="field-row">
            <div class="field">
              <label>المادة <span class="required">*</span></label>
              <select name="subject" required>
                ${subjects.map(s => `<option value="${s.name}">${s.name}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label>المرحلة</label>
              <select name="stage">
                <option value="">— عام —</option>
                ${stages.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="field">
            <label>المجموعة <span class="required">*</span></label>
            <select name="groupId" required>
              ${groups.map(g => `<option value="${g.id}" ${g.id === prefillGroupId ? 'selected' : ''}>${g.name}</option>`).join('')}
            </select>
          </div>

          <div class="field">
            <label>عنوان الدرس / الأهداف التعليمية</label>
            <input type="text" name="topic" placeholder="مثال: الفصل الأول - الجبر الخطي">
          </div>

          <div class="field">
            <label>محتوى الدرس</label>
            <textarea name="lessonContent" rows="4" placeholder="الصق نص الدرس هنا لمساعدة الذكاء الاصطناعي على إنشاء أسئلة دقيقة..."></textarea>
            <p style="font-size: var(--font-size-xs); color: var(--text-tertiary); margin-top: 4px;">أو اتركه فارغًا ليعتمد الذكاء الاصطناعي على عنوان الدرس فقط.</p>
          </div>

          <div class="field-row">
            <div class="field">
              <label>مستوى الصعوبة</label>
              <select name="difficulty">
                ${DIFFICULTY_LEVELS.map(d => `<option value="${d.id}">${d.label}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label>عدد الأسئلة</label>
              <input type="number" name="questionCount" min="1" max="30" value="5">
            </div>
          </div>

          <div class="field-row">
            <div class="field">
              <label>الدرجة النهائية</label>
              <input type="number" name="maxGrade" min="1" value="20">
            </div>
            <div class="field">
              <label>مدة الاختبار (دقيقة)</label>
              <input type="number" name="duration" min="5" value="30">
            </div>
          </div>

          <div class="field">
            <label>أنواع الأسئلة</label>
            <div style="display:grid; grid-template-columns: repeat(2,1fr); gap:6px;">
              ${QUESTION_TYPES.map(t => `
                <label style="display:flex; align-items:center; gap:6px; padding: var(--space-2); background: var(--color-surface-2); border: 1.5px solid var(--color-surface-3); border-radius: var(--radius-sm); font-size: var(--font-size-sm); cursor: pointer;">
                  <input type="checkbox" name="questionTypes" value="${t.id}" checked style="width:auto;"> ${t.icon} ${t.label}
                </label>
              `).join('')}
            </div>
          </div>

          <div class="action-row" style="margin-top: var(--space-4);">
            <button type="button" class="btn btn-secondary" onclick="UI.closeModal()" style="flex:1">إلغاء</button>
            <button type="button" class="btn btn-primary" id="ai-generate-btn" style="flex:1;">
              ${provider !== 'none' && settings.aiApiKey ? '✨ توليد بالذكاء الاصطناعي' : '✏️ إنشاء يدوي'}
            </button>
          </div>
        </form>
      `
    });

    // Bind generate button
    document.getElementById('ai-generate-btn').addEventListener('click', () => {
      const form = document.getElementById('ai-exam-form');
      const fd = new FormData(form);
      const data = Object.fromEntries(fd.entries());
      data.questionTypes = fd.getAll('questionTypes');
      data.questionCount = parseInt(data.questionCount) || 5;
      data.maxGrade = parseFloat(data.maxGrade) || 20;
      data.duration = parseInt(data.duration) || 30;
      data.difficulty = data.difficulty || 'medium';

      if (!data.subject || !data.groupId) {
        UI.toast('أكمل البيانات المطلوبة', 'error');
        return;
      }
      if (data.questionTypes.length === 0) {
        UI.toast('اختر نوع سؤال واحدًا على الأقل', 'error');
        return;
      }

      this.handleGenerate(data);
    });
  }

  // ===== Handle generation: try AI, fallback to manual editor =====
  async function handleGenerate(opts) {
    const btn = document.getElementById('ai-generate-btn');
    const settings = Storage.get(Storage.KEYS.settings, {});

    if (settings.aiProvider && settings.aiProvider !== 'none' && settings.aiApiKey) {
      // Show loading state
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-sm"></span> جارٍ التوليد...';

      const result = await generate(opts);

      btn.disabled = false;
      btn.innerHTML = '✨ توليد بالذكاء الاصطناعي';

      if (result.ok) {
        UI.closeModal();
        setTimeout(() => openEditor({
          exam: result.exam,
          opts,
          isAIGenerated: true
        }), 200);
        return;
      }

      // Show clear error — don't claim success
      let errMessage = 'تعذّر توليد الأسئلة. ';
      if (result.reason === 'no-config') errMessage += 'لم يتم إعداد المزوّد.';
      else if (result.reason === 'http-error') errMessage += `خطأ من المزوّد (${result.status}).`;
      else if (result.reason === 'network-error') errMessage += 'مشكلة في الشبكة: ' + (result.message || '');
      else if (result.reason === 'invalid-json' || result.reason === 'parse-error') errMessage += 'استجابة غير صالحة من المزوّد.';
      else if (result.reason === 'no-questions') errMessage += 'لم يُرجع المزوّد أي أسئلة.';
      else if (result.reason === 'empty-response') errMessage += 'استجابة فارغة من المزوّد.';
      UI.toast(errMessage + ' يمكنك إنشاء الأسئلة يدويًا.', 'error', 4500);

      // Offer manual editor as fallback
      setTimeout(() => {
        UI.confirm(
          'تعذّر توليد الأسئلة بالذكاء الاصطناعي. هل تريد فتح المحرر اليدوي لإنشاء الأسئلة بنفسك؟',
          () => openEditor({ exam: null, opts, isAIGenerated: false }),
          { title: 'الانتقال للمحرر اليدوي', confirmText: 'نعم، افتح المحرر', danger: false }
        );
      }, 500);
      return;
    }

    // No AI provider — open manual editor directly
    UI.closeModal();
    setTimeout(() => openEditor({ exam: null, opts, isAIGenerated: false }), 200);
  }

  // ===== Open the exam editor (manual + AI review) =====
  function openEditor({ exam, opts, isAIGenerated }) {
    const title = exam?.title || opts.topic || 'اختبار جديد';
    const instructions = exam?.instructions || '';
    const questions = exam?.questions || [{
      id: 'q_' + Date.now(),
      type: 'mcq',
      text: '',
      options: ['', '', '', ''],
      correctAnswer: '',
      mark: 1,
      explanation: ''
    }];

    UI.modal({
      title: isAIGenerated ? 'مراجعة أسئلة الذكاء الاصطناعي' : 'محرّر الأسئلة اليدوي',
      size: 'large',
      body: `
        <div class="alert alert-${isAIGenerated ? 'success' : 'info'}" style="margin-bottom: var(--space-3);">
          <div class="alert-icon">${isAIGenerated ? '✓' : 'ℹ️'}</div>
          <div class="alert-body" style="font-size: var(--font-size-sm);">
            ${isAIGenerated
              ? 'تم توليد الأسئلة بواسطة الذكاء الاصطناعي. راجع كل سؤال بعناية قبل الحفظ. يمكنك تعديل أي سؤال أو حذفه أو إعادة ترتيبه.'
              : 'أنشئ أسئلتك يدويًا. أضف سؤالاً جديدًا في كل مرة، ثم احفظ لإنشاء الاختبار.'}
          </div>
        </div>

        <div class="field">
          <label>عنوان الاختبار</label>
          <input type="text" id="exam-title" value="${(title || '').replace(/"/g, '&quot;')}">
        </div>
        <div class="field">
          <label>تعليمات للطلاب</label>
          <textarea id="exam-instructions" rows="2" placeholder="تعليمات...">${instructions}</textarea>
        </div>

        <div id="questions-container" style="display:flex; flex-direction:column; gap: var(--space-3); margin-top: var(--space-4);"></div>

        <button class="btn btn-outline btn-block" id="add-question-btn" style="margin-top: var(--space-3);">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          إضافة سؤال
        </button>

        <div id="exam-stats" style="margin-top: var(--space-4); padding: var(--space-3); background: var(--color-surface-2); border-radius: var(--radius-md); text-align:center;">
          <span id="exam-stats-text">0 سؤال • 0 درجة</span>
        </div>

        <div class="action-row" style="margin-top: var(--space-4);">
          <button type="button" class="btn btn-secondary" onclick="UI.closeModal()" style="flex:1">إلغاء</button>
          <button type="button" class="btn btn-primary" id="preview-exam-btn" style="flex:1">معاينة وحفظ</button>
        </div>
      `
    });

    const container = document.getElementById('questions-container');

    function renderQuestion(q, idx) {
      const typeDef = QUESTION_TYPES.find(t => t.id === q.type) || QUESTION_TYPES[0];
      let optionsHtml = '';
      if (q.type === 'mcq' || q.type === 'true_false' || q.type === 'matching') {
        const options = q.type === 'true_false' ? ['صح', 'خطأ'] : (q.options && q.options.length ? q.options : ['', '', '', '']);
        optionsHtml = `
          <label style="font-size: var(--font-size-xs); color: var(--text-tertiary); margin-top: 8px;">الخيارات (الخيار الصحيح في الحقل "الإجابة الصحيحة")</label>
          <div style="display:flex; flex-direction:column; gap:4px; margin-top: 4px;">
            ${options.map((opt, i) => `
              <input type="text" data-q="${q.id}" data-field="option" data-index="${i}" value="${(opt || '').replace(/"/g, '&quot;')}" placeholder="خيار ${i + 1}" style="padding: var(--space-2); background: var(--color-surface-2); border: 1.5px solid var(--color-surface-3); border-radius: var(--radius-sm); font-size: var(--font-size-sm);">
            `).join('')}
            ${q.type === 'mcq' ? `<button type="button" class="btn btn-text btn-sm" data-q="${q.id}" data-action="add-option" style="padding:4px 0;">+ خيار إضافي</button>` : ''}
          </div>
        `;
      }

      return `
        <div class="card" style="padding: var(--space-3); border: 1.5px solid var(--color-surface-3);" data-question-card="${q.id}">
          <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom: var(--space-2);">
            <div style="font-weight:700; color: var(--text-secondary);">سؤال ${idx + 1}</div>
            <div style="display:flex; gap: 4px;">
              <button type="button" class="icon-btn" data-q="${q.id}" data-action="up" aria-label="أعلى" style="padding: 4px;">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="m18 15-6-6-6 6"/></svg>
              </button>
              <button type="button" class="icon-btn" data-q="${q.id}" data-action="down" aria-label="أسفل" style="padding: 4px;">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
              </button>
              <button type="button" class="icon-btn" data-q="${q.id}" data-action="remove" aria-label="حذف" style="padding: 4px; color: var(--color-danger);">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>

          <div class="field-row" style="margin-bottom: var(--space-2);">
            <div class="field" style="margin: 0;">
              <label style="font-size: var(--font-size-xs);">النوع</label>
              <select data-q="${q.id}" data-field="type" style="font-size: var(--font-size-sm);">
                ${QUESTION_TYPES.map(t => `<option value="${t.id}" ${t.id === q.type ? 'selected' : ''}>${t.icon} ${t.label}</option>`).join('')}
              </select>
            </div>
            <div class="field" style="margin: 0;">
              <label style="font-size: var(--font-size-xs);">الدرجة</label>
              <input type="number" min="0.5" step="0.5" data-q="${q.id}" data-field="mark" value="${q.mark}" style="font-size: var(--font-size-sm);">
            </div>
          </div>

          <div class="field" style="margin: 0;">
            <label style="font-size: var(--font-size-xs);">نص السؤال</label>
            <textarea data-q="${q.id}" data-field="text" rows="2" placeholder="اكتب السؤال هنا..." style="font-size: var(--font-size-sm;">${(q.text || '').replace(/</g, '&lt;')}</textarea>
          </div>

          ${optionsHtml}

          <div class="field" style="margin: 8px 0 0;">
            <label style="font-size: var(--font-size-xs);">الإجابة الصحيحة</label>
            <input type="text" data-q="${q.id}" data-field="correctAnswer" value="${(q.correctAnswer || '').replace(/"/g, '&quot;')}" placeholder="اكتب الإجابة الصحيحة" style="font-size: var(--font-size-sm);">
          </div>

          <div class="field" style="margin: 8px 0 0;">
            <label style="font-size: var(--font-size-xs);">شرح / معايير التصحيح</label>
            <textarea data-q="${q.id}" data-field="explanation" rows="2" placeholder="شرح موجز للإجابة أو معايير التصحيح..." style="font-size: var(--font-size-sm);">${(q.explanation || '').replace(/</g, '&lt;')}</textarea>
          </div>
        </div>
      `;
    }

    let localQuestions = questions.map(q => ({ ...q }));

    function rerender() {
      container.innerHTML = localQuestions.map((q, i) => renderQuestion(q, i)).join('');
      bindCardEvents();
      updateStats();
    }

    function bindCardEvents() {
      container.querySelectorAll('[data-question-card]').forEach(card => {
        const qid = card.dataset.questionCard;

        // Field changes
        card.querySelectorAll('[data-field]').forEach(el => {
          el.addEventListener('input', () => {
            const idx = localQuestions.findIndex(q => q.id === qid);
            if (idx === -1) return;
            const field = el.dataset.field;
            if (field === 'option') {
              const oi = parseInt(el.dataset.index);
              if (!localQuestions[idx].options) localQuestions[idx].options = [];
              localQuestions[idx].options[oi] = el.value;
            } else if (field === 'mark') {
              localQuestions[idx][field] = parseFloat(el.value) || 0;
            } else {
              localQuestions[idx][field] = el.value;
            }
            updateStats();
          });
          // Type change should rerender
          if (el.dataset.field === 'type') {
            el.addEventListener('change', () => {
              const idx = localQuestions.findIndex(q => q.id === qid);
              if (idx === -1) return;
              localQuestions[idx].type = el.value;
              if (el.value === 'true_false') {
                localQuestions[idx].options = ['صح', 'خطأ'];
              } else if (el.value === 'mcq' && (!localQuestions[idx].options || localQuestions[idx].options.length < 2)) {
                localQuestions[idx].options = ['', '', '', ''];
              }
              rerender();
            });
          }
        });

        // Action buttons
        card.querySelectorAll('[data-action]').forEach(btn => {
          btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            const idx = localQuestions.findIndex(q => q.id === qid);
            if (idx === -1) return;
            if (action === 'up' && idx > 0) {
              [localQuestions[idx - 1], localQuestions[idx]] = [localQuestions[idx], localQuestions[idx - 1]];
            } else if (action === 'down' && idx < localQuestions.length - 1) {
              [localQuestions[idx + 1], localQuestions[idx]] = [localQuestions[idx], localQuestions[idx + 1]];
            } else if (action === 'remove') {
              if (localQuestions.length === 1) {
                UI.toast('يجب وجود سؤال واحد على الأقل', 'warning');
                return;
              }
              localQuestions.splice(idx, 1);
            } else if (action === 'add-option') {
              if (!localQuestions[idx].options) localQuestions[idx].options = [];
              localQuestions[idx].options.push('');
            }
            rerender();
          });
        });
      });
    }

    function updateStats() {
      const total = localQuestions.reduce((s, q) => s + (parseFloat(q.mark) || 0), 0);
      const el = document.getElementById('exam-stats-text');
      if (el) el.textContent = `${localQuestions.length} سؤال • ${total} درجة`;
    }

    rerender();

    document.getElementById('add-question-btn').addEventListener('click', () => {
      localQuestions.push({
        id: 'q_' + Date.now(),
        type: 'mcq',
        text: '',
        options: ['', '', '', ''],
        correctAnswer: '',
        mark: 1,
        explanation: ''
      });
      rerender();
      container.lastElementChild?.scrollIntoView({ behavior: 'smooth' });
    });

    document.getElementById('preview-exam-btn').addEventListener('click', () => {
      // Validate
      const title = document.getElementById('exam-title').value.trim();
      if (!title) { UI.toast('أدخل عنوان الاختبار', 'error'); return; }
      const validQuestions = localQuestions.filter(q => q.text && q.text.trim());
      if (validQuestions.length === 0) {
        UI.toast('أضف سؤالًا واحدًا على الأقل بنص', 'error');
        return;
      }
      // Save the question set
      const questionSet = saveExamToCollection({
        title,
        instructions: document.getElementById('exam-instructions').value.trim(),
        questions: validQuestions
      }, opts);

      UI.closeModal();
      setTimeout(() => openPreview(questionSet, opts), 200);
    });
  }

  // ===== Open exam preview (print/save/share) =====
  function openPreview(questionSet, opts) {
    const group = Storage.find(Storage.KEYS.groups, opts.groupId);
    const teacher = Auth.getTeacher();
    const totalMarks = questionSet.questions.reduce((s, q) => s + (parseFloat(q.mark) || 0), 0);

    UI.modal({
      title: 'معاينة الاختبار',
      size: 'large',
      body: `
        <div class="exam-paper" id="exam-print-area" style="background: #fff; padding: var(--space-4); border-radius: var(--radius-md); direction: rtl;">
          <div style="text-align: center; margin-bottom: var(--space-4);">
            <h2 style="font-weight: 800; margin-bottom: 4px;">${questionSet.title}</h2>
            <p style="color: var(--text-tertiary); font-size: var(--font-size-sm);">المادة: ${opts.subject} • المجموعة: ${group ? group.name : '—'} • الدرجة الكلية: ${totalMarks}</p>
            <p style="color: var(--text-tertiary); font-size: var(--font-size-xs); margin-top: 4px;">أ/ ${teacher ? teacher.name : 'مُعلّمي'}</p>
          </div>

          <div style="display:flex; gap: var(--space-4); margin-bottom: var(--space-4); font-size: var(--font-size-sm);">
            <div style="flex:1;">
              <div style="border: 1px solid #999; padding: 6px 10px; border-radius: 4px;">اسم الطالب: ......................................</div>
            </div>
            <div style="flex:1;">
              <div style="border: 1px solid #999; padding: 6px 10px; border-radius: 4px;">الصف: ${group ? group.className : '..............'}</div>
            </div>
          </div>

          ${questionSet.instructions ? `
            <div style="background: var(--color-surface-2); padding: var(--space-3); border-radius: var(--radius-sm); margin-bottom: var(--space-4); font-size: var(--font-size-sm);">
              <strong>تعليمات:</strong> ${questionSet.instructions}
            </div>
          ` : ''}

          <div style="display:flex; flex-direction:column; gap: var(--space-4);">
            ${questionSet.questions.map((q, i) => renderQuestionForPrint(q, i)).join('')}
          </div>

          <div style="text-align: center; margin-top: var(--space-5); padding-top: var(--space-3); border-top: 1px dashed #ccc; color: var(--text-tertiary); font-size: var(--font-size-xs);">
            ${teacher ? teacher.name : 'مُعلّمي'} — ${UI.formatDate(new Date().toISOString())}
          </div>
        </div>

        <div class="action-row" style="margin-top: var(--space-4);">
          <button class="btn btn-outline" id="edit-back-btn" style="flex:1;">تعديل الأسئلة</button>
          <button class="btn btn-secondary" onclick="window.print()" style="flex:1;">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            طباعة
          </button>
          <button class="btn btn-primary" id="save-exam-btn" style="flex:1;">حفظ كاختبار</button>
        </div>
      `
    });

    document.getElementById('edit-back-btn').addEventListener('click', () => {
      UI.closeModal();
      setTimeout(() => openEditor({ exam: questionSet, opts, isAIGenerated: false }), 200);
    });
    document.getElementById('save-exam-btn').addEventListener('click', () => {
      // Save as exam record (compatible with existing Exams module)
      const examRecord = Storage.insert(Storage.KEYS.exams, {
        name: questionSet.title,
        groupId: opts.groupId,
        subject: opts.subject,
        date: new Date().toISOString().slice(0, 10),
        topic: opts.topic || '',
        maxGrade: totalMarks,
        duration: opts.duration || 30,
        difficulty: opts.difficulty,
        questionSetId: questionSet.id,
        instructions: questionSet.instructions
      });

      // Link the questionSet back to the exam
      questionSet.examId = examRecord.id;
      const all = Storage.get('moallemy_exam_questions', []);
      const idx = all.findIndex(qs => qs.id === questionSet.id);
      if (idx !== -1) {
        all[idx] = questionSet;
        Storage.set('moallemy_exam_questions', all);
      }

      UI.toast('تم حفظ الاختبار بنجاح ✓', 'success');
      UI.closeModal();
      Notifications.add('exam', 'اختبار جديد', `${questionSet.title} - ${group ? group.name : ''}`, examRecord.id);
      setTimeout(() => Exams.openDetail(examRecord.id), 250);
    });
  }

  function renderQuestionForPrint(q, idx) {
    const num = idx + 1;
    const typeLabel = QUESTION_TYPES.find(t => t.id === q.type)?.label || '';
    let body = '';

    if (q.type === 'mcq') {
      const opts = (q.options || []).filter(o => o !== undefined && o !== null);
      body = `
        <div style="display:flex; flex-direction:column; gap: 6px; margin-top: 8px; padding-inline-start: 16px;">
          ${(opts.length ? opts : ['','','','']).map((opt, i) => {
            const letter = ['أ','ب','ج','د','هـ','و'][i] || (i+1);
            return `<div style="display:flex; gap: 6px; align-items:center;"><span style="font-weight:700;">${letter})</span> <span>${opt || '................'}</span></div>`;
          }).join('')}
        </div>
      `;
    } else if (q.type === 'true_false') {
      body = `
        <div style="display:flex; gap: var(--space-4); margin-top: 8px;">
          <span style="display:inline-flex; align-items:center; gap:6px;"><span style="border: 1.5px solid #999; width: 18px; height: 18px; border-radius: 50%; display:inline-block;"></span> صح</span>
          <span style="display:inline-flex; align-items:center; gap:6px;"><span style="border: 1.5px solid #999; width: 18px; height: 18px; border-radius: 50%; display:inline-block;"></span> خطأ</span>
        </div>
      `;
    } else if (q.type === 'complete') {
      body = `<div style="margin-top:8px; border-bottom: 1px solid #ccc; min-height: 28px;"></div>`;
    } else if (q.type === 'short') {
      body = `<div style="margin-top:8px; border-bottom: 1px solid #ccc; min-height: 28px;"></div>`;
    } else if (q.type === 'essay') {
      body = `
        <div style="margin-top:8px;">
          <div style="border-bottom: 1px solid #ccc; min-height: 28px;"></div>
          <div style="border-bottom: 1px solid #ccc; min-height: 28px; margin-top: 6px;"></div>
          <div style="border-bottom: 1px solid #ccc; min-height: 28px; margin-top: 6px;"></div>
        </div>
      `;
    } else if (q.type === 'matching') {
      body = `<div style="margin-top:8px; font-size: var(--font-size-xs); color: var(--text-tertiary);">[سؤال توصيل — اكتب العناصر والأزواج في نص السؤال]</div>`;
    }

    return `
      <div style="border-bottom: 1px dashed #ddd; padding-bottom: var(--space-3);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap: 8px;">
          <div style="flex:1; font-weight:600;">
            <span style="display:inline-block; background: var(--color-primary-soft); color: var(--color-primary); width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-size: var(--font-size-sm); margin-inline-end: 6px;">${num}</span>
            ${q.text}
          </div>
          <div style="font-size: var(--font-size-xs); color: var(--text-tertiary); white-space: nowrap;">
            <span class="badge badge-info">${q.mark || 1} درجة</span>
          </div>
        </div>
        ${body}
      </div>
    `;
  }

  return {
    QUESTION_TYPES,
    DIFFICULTY_LEVELS,
    generate,
    openGenerator,
    openEditor,
    openPreview,
    saveExamToCollection,
    listQuestionSets,
    findQuestionSet,
    deleteQuestionSet
  };
})();

window.AIExam = AIExam;

/* ============================================
   مُعلّمي | js/curriculum-ai.js
   نظام المناهج — تكامل الذكاء الاصطناعي
   --------------------------------------------
   1) يوسّع Prompt مولّد الامتحانات ليستخدم المنهج الرسمي كمصدر
      (المادة/الصف/الترم/الوحدة/الدروس/اسم الكتاب الرسمي)
      دون أي تعديل على سلوك التوليد العام الحالي.
   2) يفرض JSON Schema صارمًا للأسئلة الناتجة من المنهج:
      {
        "question": "نص السؤال",
        "type": "mcq | true_false | short_answer | essay",
        "options": [...],
        "correctAnswer": "...",
        "explanation": "...",
        "grade": "...", "subject": "...", "term": "...",
        "unit": "...", "lesson": "...",
        "source": "وزارة التربية والتعليم"
      }
   3) يحوّل الناتج إلى الصيغة الداخلية للتطبيق (mcq/truefalse/fill/essay)
      مع الاحتفاظ بالبيانات الأصلية والمصدر في كل سؤال.
   لا يسمح بإرجاع JSON غير صالح — يرفض برسالة واضحة.
   ============================================ */

const CurriculumAI = (function () {
  'use strict';

  const SOURCE = 'وزارة التربية والتعليم';

  const ALLOWED_TYPES = ['mcq', 'true_false', 'short_answer', 'essay'];

  // تحويل النوع من سكيما المنهج إلى النوع الداخلي للتطبيق
  const TYPE_MAP = {
    'mcq': 'mcq',
    'true_false': 'truefalse',
    'short_answer': 'fill',
    'essay': 'essay'
  };
  const TYPE_AR = {
    'mcq': 'اختيار من متعدد',
    'true_false': 'صح أو خطأ',
    'short_answer': 'إجابة قصيرة (أكمل)',
    'essay': 'مقالي'
  };

  // ============ بناء القسم المنهجي في الـPrompt ============
  function buildCurriculumPromptSection(ctx) {
    const b = ctx.book ? CurriculumData.book(ctx.bookId) : null;
    const unit = ctx.unitId ? CurriculumData.unit(ctx.unitId) : null;
    const lessons = (ctx.lessonIds || [])
      .map(id => CurriculumData.lesson(id))
      .filter(Boolean);

    const lines = [];
    lines.push('- مصدر الأسئلة: المنهج الرسمي لوزارة التربية والتعليم المصرية (بوابة الكتب الدراسية studentbooks.moe.gov.eg)');
    if (b) {
      lines.push(`- الكتاب الرسمي: "${b.subject}" — ${b.grade} — ${b.term}${b.academicYear ? ' — العام الدراسي ' + b.academicYear : ''}`);
    }
    if (ctx.subject) lines.push(`- المادة: ${ctx.subject}`);
    if (ctx.grade) lines.push(`- الصف الدراسي: ${ctx.grade}`);
    if (ctx.term) lines.push(`- الفصل الدراسي: ${ctx.term}`);
    if (unit) lines.push(`- الوحدة: ${unit.title}`);
    if (lessons.length) {
      lines.push(`- الدروس المحددة (التزم بها حصرًا): ${lessons.map(l => l.title).join('، ')}`);
      if (lessons.some(l => l.description)) {
        lines.push('- نقاط الدروس كما وردت من المدرس: ' + lessons.filter(l => l.description).map(l => `${l.title}: ${l.description}`).join(' | '));
      }
    }
    lines.push('');
    lines.push('قواعد الالتزام بالمنهج الرسمي (إلزامية):');
    lines.push('1. مصدر كل سؤال هو محتوى الكتاب الرسمي المحدد أعلاه فقط — ممنوع منعًا باتًا اختراع منهج أو دروس غير موجودة فيه.');
    lines.push('2. اجعل الأسئلة مطابقة لمصطلحات الكتاب وصياغة المفاهيم الرسمية في المنهج المصري.');
    lines.push('3. إذا كان نطاق الدروس المحددة ضيقًا، تنوّع في مستويات التفكير داخل النطاق نفسه (تذكر، فهم، تطبيق، تحليل) ولا تخرج عنه.');
    return lines.join('\n');
  }

  // ============ تعليمات السكيما الصارمة للأسئلة المنهجية ============
  function buildSchemaInstructions() {
    return `
صيغة JSON المطلوبة لكل سؤال (التزم بهذه الحقول حرفيًا):
{
  "questions": [
    {
      "question": "نص السؤال",
      "type": "mcq" | "true_false" | "short_answer" | "essay",
      "options": ["الخيار الأول", "الخيار الثاني", "الخيار الثالث", "الخيار الرابع"],
      "correctAnswer": "الخيار الصحيح",
      "explanation": "شرح مختصر للإجابة",
      "grade": "${'{{grade}}'}",
      "subject": "${'{{subject}}'}",
      "term": "${'{{term}}'}",
      "unit": "{{unit}}",
      "lesson": "{{lesson}}",
      "source": "${SOURCE}"
    }
  ]
}

قواعد السكيما (رفض أي إخراج يخالفها):
- type قيمته واحدة فقط من: mcq، true_false، short_answer، essay.
- سؤال mcq: options فيه 4 اختيارات، وcorrectAnswer نص مطابق حرفيًا لأحد الاختيارات.
- سؤال true_false: correctAnswer إما "صح" أو "خطأ"، وoptions مصفوفة فارغة [].
- سؤال short_answer: إجابة قصيرة محددة في correctAnswer، وoptions مصفوفة فارغة [].
- سؤال essay: correctAnswer ملخص الإجابة، واكتب الإجابة النموذجية الكاملة في explanation.
- املأ grade وsubject وterm وunit وlesson من بيانات المنهج المحددة أعلاه في كل سؤال.
- source قيمته ثابتة: "${SOURCE}".
- أعِد JSON صالحًا فقط بدون Markdown أو أي شرح إضافي.`
      .replace('{{grade}}', '{{grade}}')
      .replace('{{subject}}', '{{subject}}')
      .replace('{{term}}', '{{term}}');
  }

  // ============ التحقق الصارم من ناتج AI ============
  function validateAndNormalize(raw, ctx) {
    if (!raw || typeof raw !== 'object') {
      throw new Error('استجابة الذكاء الاصطناعي ليست JSON صالحًا — أعد المحاولة');
    }
    let questions = raw.questions;
    if (!Array.isArray(questions) || !questions.length) {
      throw new Error('لم يرجع الذكاء الاصطناعي أي أسئلة — أعد المحاولة');
    }

    const book = ctx.bookId ? CurriculumData.book(ctx.bookId) : null;
    const unit = ctx.unitId ? CurriculumData.unit(ctx.unitId) : null;
    const gradeTitle = ctx.grade || (book ? book.grade : '');
    const subjectTitle = ctx.subject || (book ? book.subject : '');
    const termTitle = ctx.term || (book ? book.term : '');
    const unitTitle = unit ? unit.title : '';

    const valid = [];
    const errors = [];

    questions.forEach((q, i) => {
      const errs = [];
      const text = String(q.question || q.text || '').trim();
      let type = String(q.type || '').trim();
      const options = Array.isArray(q.options) ? q.options.map(o => String(o || '').trim()).filter(Boolean) : [];
      const correct = String(q.correctAnswer || q.answer || '').trim();
      const explanation = String(q.explanation || q.modelAnswer || '').trim();

      if (!text) errs.push(`س${i + 1}: نص السؤال فارغ`);
      if (!ALLOWED_TYPES.includes(type)) errs.push(`س${i + 1}: نوع غير مسموح (${type})`);
      if (!correct && type !== 'essay') errs.push(`س${i + 1}: لا توجد إجابة صحيحة`);
      if (type === 'mcq' && options.length < 2) errs.push(`س${i + 1}: الاختيارات ناقصة`);
      if (type === 'mcq' && correct && options.length && !options.some(o => o.replace(/\s+/g, '') === correct.replace(/\s+/g, ''))) {
        errs.push(`س${i + 1}: الإجابة الصحيحة ليست ضمن الاختيارات`);
      }
      if (type === 'true_false' && !/^(صح|خطأ)$/.test(correct)) errs.push(`س${i + 1}: إجابة صح/خطأ غير صالحة`);

      if (errs.length) { errors.push(...errs); return; }

      // البيانات المرجعية لكل سؤال (الشكل المطلوب في المواصفات)
      const curriculumRef = {
        curriculumId: ctx.lessonIds && ctx.lessonIds.length ? ctx.lessonIds[0] : (ctx.unitId || ctx.bookId || ''),
        grade: gradeTitle,
        subject: subjectTitle,
        term: termTitle,
        bookId: ctx.bookId || '',
        unitId: ctx.unitId || '',
        lessonId: ctx.lessonIds && ctx.lessonIds.length ? ctx.lessonIds[0] : '',
        source: SOURCE
      };

      // السكيما الأصلية المطلوبة تُحفظ كما هي (للتوثيق والتصدير)
      const schema = {
        question: text,
        type,
        options: type === 'mcq' ? options : [],
        correctAnswer: correct,
        explanation: explanation,
        grade: gradeTitle,
        subject: subjectTitle,
        term: termTitle,
        unit: unitTitle,
        lesson: (curriculumRef.lessonId && CurriculumData.lesson(curriculumRef.lessonId) || {}).title || unitTitle || '',
        source: SOURCE
      };

      // الصيغة الداخلية للتطبيق (تعرض وتُطبع وتُصحح كما في النظام الحالي)
      const internal = {
        type: TYPE_MAP[type],
        text,
        answer: correct,
        modelAnswer: explanation || correct,
        marks: 1
      };
      if (internal.type === 'mcq') internal.options = options;
      if (internal.type === 'truefalse') internal.options = ['صح', 'خطأ'];

      valid.push(Object.assign(internal, { curriculum: curriculumRef, schema }));
    });

    if (!valid.length) {
      throw new Error('فشل التحقق من الأسئلة المولدة:\n' + errors.slice(0, 5).join('\n'));
    }

    return {
      questions: valid,
      errors,
      title: String(raw.title || '').trim() || ('امتحان ' + subjectTitle + (unitTitle ? ' — ' + unitTitle : '')),
      instructions: String(raw.instructions || '').trim()
    };
  }

  // ============ تركيب الامتحان المنهجي في الصيغة الداخلية ============
  function toInternalExam(normalized, ctx, options) {
    const book = ctx.bookId ? CurriculumData.book(ctx.bookId) : null;
    const unit = ctx.unitId ? CurriculumData.unit(ctx.unitId) : null;
    const b = options || {};
    return {
      title: normalized.title,
      subject: ctx.subject || (book ? book.subject : ''),
      grade: ctx.grade || (book ? book.grade : ''),
      topic: [unit ? unit.title : '', (normalized.title || '')].filter(Boolean).join(' — ') || (b.topic || ''),
      durationMinutes: b.durationMinutes || 45,
      totalMarks: b.totalMarks || normalized.questions.length,
      instructions: normalized.instructions || (book ? `أسئلة من منهج وزارة التربية والتعليم — ${book.subject} (${book.grade})` : ''),
      questions: normalized.questions,
      curriculum: {
        bookId: ctx.bookId || '',
        unitId: ctx.unitId || '',
        lessonIds: ctx.lessonIds || [],
        term: ctx.term || (book ? book.term : ''),
        source: SOURCE
      },
      countMatch: !b.questionCount || normalized.questions.length === b.questionCount
    };
  }

  // ============ تثبيت التكامل مع AIGenerator (بدون تعديل ملف ai.js) ============
  let installed = false;
  function install() {
    if (installed || !window.AIGenerator || !window.AI) return;
    installed = true;

    // 1) توسيع بناء الـPrompt: عند وجود options.curriculum نضيف قسم المنهج + السكيما الصارمة
    const origBuildExamPrompt = AI.buildExamPrompt.bind(AI);
    AI.buildExamPrompt = function (p) {
      const base = origBuildExamPrompt(p);
      const ctx = p && p.curriculum;
      if (!ctx || !ctx.bookId || !window.CurriculumData) return base;

      const book = CurriculumData.book(ctx.bookId);
      const section = buildCurriculumPromptSection(Object.assign({}, ctx, { book }));
      const gradeVal = ctx.grade || (book ? book.grade : '');
      const subjectVal = ctx.subject || (book ? book.subject : '');
      const termVal = ctx.term || (book ? book.term : '');
      const unitObj = ctx.unitId ? CurriculumData.unit(ctx.unitId) : null;

      const schemaBlock = buildSchemaInstructions()
        .replace('{{grade}}', gradeVal)
        .replace('{{subject}}', subjectVal)
        .replace('{{term}}', termVal)
        .replace('{{unit}}', unitObj ? unitObj.title : '')
        .replace('{{lesson}}', (ctx.lessonIds && ctx.lessonIds[0] ? (CurriculumData.lesson(ctx.lessonIds[0]) || {}).title : '') || (unitObj ? unitObj.title : ''));

      return `${base}\n\n====================\nالتوليد من المنهج الرسمي\n====================\n${section}\n${schemaBlock}`;
    };

    // 2) توسيع التسوية: امتحانات المنهج تمر عبر سكيما المنهج الصارمة أولاً
    const origNormalizeExam = AIGenerator.normalizeExam.bind(AIGenerator);
    AIGenerator.normalizeExam = function (exam, options) {
      const ctx = options && options.curriculum;
      if (!ctx || !ctx.bookId) return origNormalizeExam(exam, options);

      let normalized;
      try {
        normalized = validateAndNormalize(exam, ctx);
      } catch (e) {
        // ناتج غير مطابق للسكيما — نرفض برسالة واضحة (ممنوع JSON غير صالح)
        throw new Error('نتيجة التوليد لم تلتزم بصيغة الأسئلة المطلوبة — أعد المحاولة. ' + (e.message || ''));
      }

      // توزيع الدرجات على الصيغة الداخلية بنفس قواعد التطبيق
      AIGenerator.fixMarks(normalized.questions, options.totalMarks);
      return toInternalExam(normalized, ctx, options);
    };
  }

  // تثبيت بعد جاهزية الصفحة (ai-generator.js يُحمّل قبل هذا الملف)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }

  return {
    install, validateAndNormalize, buildCurriculumPromptSection, buildSchemaInstructions, SOURCE, TYPE_MAP, ALLOWED_TYPES
  };
})();

window.CurriculumAI = CurriculumAI;

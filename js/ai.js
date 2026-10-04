/* ============================================
   مُعلّمي | ai.js
   محرك التحليل المحلي + مزود CodeCraft AI السحابي
   - يعمل بالكامل على بيانات الطالب الفعلية من التخزين
   - المزود السحابي يستدعي CodeCraft API مباشرة من المتصفح
     (OpenAI-compatible: https://www.codecraftapi.com/v1/chat/completions)
   - المزود المحلي يعمل Offline دون أي اتصال بالشبكة
   ============================================ */

/* ============================================
   0) إعدادات CodeCraft API (OpenAI-compatible)
   ملاحظة: المفتاح موضوع داخل هذا الملف بناءً على طلب مالك المشروع.
   تحذير: هذا يكشف المفتاح لأي مستخدم يفتح أدوات المتصفح — راجع README.md.
   ============================================ */
const CODECRAFT_API_KEY = 'cc_TUG5geOvMmIyHr7HBEpyfa0DNTqRkf4oGSgor7xeENeNVmuP';
const CODECRAFT_ENDPOINT = 'https://www.codecraftapi.com/v1/chat/completions';
const CODECRAFT_MODEL = 'claude-opus-4.8';
const CODECRAFT_MAX_TOKENS_EXAM = 32768;
const CODECRAFT_MAX_TOKENS_ANALYSIS = 16384;

// تحويل أخطاء HTTP من CodeCraft إلى رسائل عربية واضحة
function mapCodeCraftHttpError(status, rawText) {
  if (status === 401) return 'مفتاح خدمة الذكاء الاصطناعي غير صالح أو منتهي';
  if (status === 402) return 'رصيد خدمة الذكاء الاصطناعي غير كافٍ';
  if (status === 429) return 'تم تجاوز حد الاستخدام، حاول مرة أخرى لاحقًا';
  if (status === 500 || status === 502 || status === 503) {
    return 'تعذر الاتصال بخدمة الذكاء الاصطناعي حاليًا — حاول مرة أخرى بعد قليل';
  }
  if (status >= 500) return 'خطأ في الخادم — جرّب مرة أخرى بعد قليل';
  return (rawText || 'تعذر تنفيذ طلب الذكاء الاصطناعي — حاول مرة أخرى').slice(0, 200);
}

// استخراج JSON من نص الاستجابة (مع تحمل أي غلاف بسيط)
function parseJsonSafe(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch (_) {
        return null;
      }
    }
    return null;
  }
}

/* ============================================
   1) واجهات المزودين (Provider Interfaces)
   الافتراضي: محلّي. السحابي: هيكل جاهز يتصل بـ Backend لاحقًا
   ============================================ */
const AIProviders = {
  // واجهة موحدة: analyze(payload) -> Promise<{ text, meta }>
  local: {
    name: 'محلي',
    isReady() { return true; },
    analyze(payload) {
      return Promise.resolve({ text: AI.generateStudentAnalysisText(payload), meta: { engine: 'local' } });
    }
  },
  cloud: {
    name: 'سحابي (CodeCraft AI)',
    isReady() {
      // لا نحتاج Supabase لاستدعاء الذكاء الاصطناعي — الاستدعاء مباشر إلى CodeCraft
      if (!navigator.onLine) return false;
      if (window.Storage && typeof Storage.isDemoMode === 'function' && Storage.isDemoMode()) return false;
      return true;
    },
    /**
     * استدعاء مباشر إلى CodeCraft API (OpenAI-compatible)
     * يقوم ببناء الـ Prompt محليًا ثم يرسل POST إلى /v1/chat/completions
     * يعيد Promise بالـ data المُ解析ة (JSON) أو يرفض برسالة عربية
     */
    invoke(task, payload) {
      if (!this.isReady()) {
        return Promise.reject(new Error(AI.cloudUnavailableReason()));
      }

      let prompt = '';
      let maxTokens = CODECRAFT_MAX_TOKENS_EXAM;

      if (task === 'generate-exam') {
        try {
          prompt = AI.buildExamPrompt(payload);
        } catch (e) {
          return Promise.reject(new Error('بيانات الامتحان غير صالحة: ' + e.message));
        }
      } else if (task === 'student-analysis') {
        prompt = AI.buildAnalysisPrompt(payload);
        maxTokens = CODECRAFT_MAX_TOKENS_ANALYSIS;
      } else {
        return Promise.reject(new Error('مهمة غير معروفة: ' + task));
      }

      return fetch(CODECRAFT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + CODECRAFT_API_KEY,
        },
        body: JSON.stringify({
          model: CODECRAFT_MODEL,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.75,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' },
        }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const errText = await res.text().catch(() => '');
            throw new Error(mapCodeCraftHttpError(res.status, errText));
          }
          return res.json();
        })
        .then((data) => {
          const text = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
          if (!text || typeof text !== 'string' || !text.trim()) {
            throw new Error('استجابة فارغة من خدمة الذكاء الاصطناعي — جرّب مرة أخرى');
          }
          const parsed = parseJsonSafe(text.trim());
          if (!parsed) {
            throw new Error('تعذر قراءة استجابة الذكاء الاصطناعي كـ JSON صالح — جرّب إعادة المحاولة');
          }
          return parsed;
        })
        .catch((err) => {
          // أعد رمي أخطاء رسائلنا العربية كما هي، ولفّ أي خطأ شبكة آخر
          if (err && err.message && err.message.length < 250) {
            throw err;
          }
          throw new Error('تعذر الاتصال بخدمة الذكاء الاصطناعي — تحقق من الإنترنت ثم أعد المحاولة');
        });
    },
    analyze(payload) {
      return this.invoke('student-analysis', payload).then((data) => ({
        text: data.parentReport || data.summary || '',
        meta: { engine: 'codecraft', data }
      }));
    }
  }
};

/* ============================================
   2) المحرك الرئيسي
   ============================================ */
const AI = {
  activeProvider: 'local',

  provider() { return AIProviders[this.activeProvider] || AIProviders.local; },

  /* ============================================
     CodeCraft API — أدوات مساعدة
     ============================================ */

  // سبب عربي واضح لعدم جاهزية المزود السحابي
  cloudUnavailableReason() {
    if (!navigator.onLine) {
      return 'تعذر الاتصال بالإنترنت — تحقق من اتصالك ثم أعد المحاولة';
    }
    if (window.Storage && typeof Storage.isDemoMode === 'function' && Storage.isDemoMode()) {
      return 'الوضع التجريبي لا يدعم الذكاء الاصطناعي — سجّل الدخول بحسابك الحقيقي أولًا';
    }
    return 'خدمة الذكاء الاصطناعي غير متاحة حاليًا — حاول لاحقًا';
  },

  /* ============================================
     بناء Prompt توليد الامتحان
     (نفس منطق الـ Edge Function السابق — الحقول والقواعد كما هي)
     ============================================ */
  buildExamPrompt(p) {
    const types = {
      mcq: 'اختيار من متعدد (4 اختيارات: أ، ب، ج، د — إجابة صحيحة واحدة فقط)',
      truefalse: 'صح أو خطأ (الإجابة كلمة "صح" أو "خطأ" فقط)',
      fill: 'أكمل (فراغ بإجابة قصيرة واضحة)',
      essay: 'مقالي (مع إجابة نموذجية قابلة للتصحيح في modelAnswer)',
      problem: 'مسألة (مع خطوات الحل كاملة في modelAnswer)',
    };
    const typeLabels = (p.types && p.types.length ? p.types : ['mcq'])
      .map((t) => types[t] || t)
      .join('، ');
    const difficultyNote = {
      'سهل': 'أسئلة مباشرة من جوهر الدرس تناسب جميع الطلاب.',
      'متوسط': 'مزيج متوازن: أغلب الأسئلة متوسطة مع بعض الأسئلة السهلة.',
      'صعب': 'أسئلة تفكير وتطبيق لكنها داخل حدود الدرس المحدد.',
      'متدرج': 'ترتيب تصاعدي: ابدأ بالأسئلة السهلة وانتهِ بالأصعب تدريجيًا.',
    };

    return `أنت مختص خبير في إعداد الامتحانات المدرسية في مصر وفق المنهج الرسمي.

أنشئ امتحانًا وفق المواصفات التالية بالضبط:

- المادة: ${p.subject}
- الصف الدراسي: ${p.grade}
- الدرس / الوحدة: ${p.topic}
- عدد الأسئلة: ${p.questionCount} سؤال بالضبط (لا تزيد ولا تنقص)
- الدرجة النهائية: ${p.totalMarks} درجة (مجموع درجات الأسئلة يجب أن يساوي هذا الرقم بالضبط)
- زمن الامتحان: ${p.durationMinutes} دقيقة
- مستوى الصعوبة: ${p.difficulty} — ${difficultyNote[p.difficulty] || ''}
- أنواع الأسئلة المطلوبة فقط: ${typeLabels}
${p.extraInstructions ? `- تعليمات إضافية من المدرس (التزم بها): ${p.extraInstructions}` : ''}

قواعد إلزامية لا تخالفها:
1. التزم حصرًا بالمادة والصف والدرس/الوحدة المحددين — ممنوع اختراع محتوى من دروس أخرى أو منهج غير محدد.
2. لا تكرر أي سؤال ولا تكرر فكرة سؤال بصياغتين متشابهتين.
3. مجموع حقل marks لجميع الأسئلة = ${p.totalMarks} بالضبط. وزّع الدرجات بمنطق (الاختيار من متعدد وصح-خطأ درجات صغيرة، المقالي والمسائل درجات أكبر).
4. سؤال "اختيار من متعدد": options تحتوي 4 اختيارات بالضبط، وإجابة صحيحة واحدة فقط في answer (اكتب نص الإجابة الصحيحة كما هو في أحد الاختيارات حرفيًا).
5. سؤال "صح أو خطأ": answer إما "صح" أو "خطأ"، ولا تضع options.
6. سؤال "أكمل": أجب بإجابة قصيرة محددة في answer ولا تضع options.
7. سؤال "مقالي" أو "مسألة": اكتب الإجابة النموذجية الكاملة القابلة للتصحيح في modelAnswer (وللمسألة: خطوات الحل والنتيجة النهائية).
8. عبارات الأسئلة بالعربية الفصحى السليمة الواضحة، مناسبة لمرحلة ${p.grade}.
9. لا ترقّم الأسئلة داخل نص السؤال — الترقيم يُولَّد تلقائيًا من التطبيق.
10. أعِد JSON فقط دون أي شرح إضافي.

صيغة JSON المطلوبة (نفس أسماء الحقول حرفيًا):
{
  "title": string,
  "subject": string,
  "grade": string,
  "topic": string,
  "durationMinutes": number,
  "totalMarks": number,
  "instructions": string,
  "questions": [
    {
      "type": "mcq" | "truefalse" | "fill" | "essay" | "problem",
      "text": string,
      "options": string[],
      "answer": string,
      "modelAnswer": string,
      "marks": number
    }
  ]
}

أعد JSON صالحًا فقط بدون Markdown أو شرح إضافي.`;
  },

  /* ============================================
     بناء Prompt تحليل الطالب
     (نفس منطق الـ Edge Function السابق — قواعد الخصوصية كما هي)
     ============================================ */
  buildAnalysisPrompt(p) {
    return `أنت مستشار تربوي خبير في تحليل أداء الطلاب داخل نظام إدارة مدرسي مصري.

ستستلم أدناه بيانات فعلية مسجلة لطالب (درجات، حضور، واجبات، ملاحظات مدرس، أهداف).

⚠️ قاعدة صارمة لا تخالفها: اعتمد فقط على الأرقام والبيانات الموجودة في حقل "البيانات الفعلية" أدناه. ممنوع منعًا باتًا اختراع أي رقم أو درجة أو نسبة أو حدث غير موجود في البيانات. إذا كان أحد الجوانب بلا بيانات كافية، اذكر ذلك بلطف ووضوح في الموضع المناسب بدلًا من التخمين.

البيانات الفعلية (JSON):
${JSON.stringify(p)}

المطلوب إخراج التحليل التالي بالعربية الفصحى المهنية المهذبة:
1. summary: ملخص أداء الطالب (3-5 جمل يذكر الأرقام الفعلية الموجودة فقط، ويُنبّه للحكم المبدئي إذا كانت البيانات قليلة).
2. strengths: نقاط القوة المبنية على أرقام فعلية (إن وُجدت).
3. areasToImprove: نقاط تحتاج متابعة (مبنية على الأرقام الفعلية).
4. possibleCauses: أسباب محتملة مستمدة من البيانات فقط — صِفها كاحتمالات ("قد يكون")، وممنوع الجزم بأي سبب غير مدعوم ببيانات.
5. teacherRecommendations: توصيات عملية قابلة للتنفيذ للمدرس.
6. improvementPlan: خطة تحسين للطالب (2-4 محاور، كل محور: title + steps قابلة للتنفيذ + metric مؤشر قياس واقعي).
7. parentReport: تقرير احترافي ومهذب لولي الأمر بصيغة رسالة كاملة جاهزة للإرسال، مبنية على بيانات هذا الطالب فقط، بدون ذكر أي طالب آخر أو مقارنات أو بيانات مالية، وتنتهي بتشجيع مهذب وملاحظة أن التقرير مؤشر مبني على البيانات المسجلة.

قواعد الخصوصية الإلزامية:
- الاعتماد على بيانات الطالب الفعلية فقط.
- عدم اختراع درجات أو نسب أو أحداث.
- عدم إدخال بيانات مالية أو أرقام هواتف أو بيانات طلاب آخرين.
- الأسباب المحتملة يجب أن تكون احتمالية وليست جزمًا.

صيغة JSON المطلوبة (نفس أسماء الحقول حرفيًا):
{
  "summary": string,
  "strengths": string[],
  "areasToImprove": string[],
  "possibleCauses": string[],
  "teacherRecommendations": string[],
  "improvementPlan": [
    { "title": string, "steps": string[], "metric": string }
  ],
  "parentReport": string
}

أعد JSON صالحًا فقط بدون Markdown أو شرح إضافي.`;
  },

  /**
   * بناء حزمة بيانات الطالب الفعلية لإرسالها إلى CodeCraft
   * مبدأ صارم: بيانات مسجلة فقط — بدون هواتف أو بيانات مالية أو طلاب آخرين
   * ما لا يوجد له بيانات يُرسل فارغًا/صفرًا ليصرّح CodeCraft بغياب البيانات
   */
  buildStudentAnalysisPayload(studentId, periodDays = 0) {
    const data = AIAnalysis.prepare(studentId, periodDays);
    if (!data) return null;

    return {
      student: {
        name: data.studentProfile.name,
        className: data.studentProfile.className || '',
        section: data.studentProfile.section || '',
        subject: data.studentProfile.subject || '',
        groupName: data.studentProfile.groupName || '',
        status: data.studentProfile.status || 'نشط'
      },
      grades: data.allGrades.map(g => ({
        title: g.title || (g.examId ? 'درجة اختبار' : 'درجة'),
        type: g.type || '',
        score: g.score,
        maxGrade: g.maxGrade,
        percentage: g.pct,
        date: g.date || null
      })),
      gradeTrend: {
        direction: data.gradeTrend.direction,
        change: data.gradeTrend.change,
        confidence: data.gradeTrend.confidence,
        sampleSize: data.gradeTrend.sample,
        note: data.gradeTrend.message || null
      },
      attendance: data.attStats,
      assignments: data.assignmentStats,
      teacherNotes: data.teacherNotes.slice(0, 30).map(n => ({
        type: n.type || 'ملاحظة',
        text: n.text || '',
        date: n.date || null
      })),
      goals: data.goals.slice(0, 20).map(g => ({
        title: g.title || g.text || '',
        status: g.status || ''
      })),
      generatedAt: data.generatedAt
    };
  },

  /**
   * طلب تحليل طالب من CodeCraft (مباشر من المتصفح)
   * يعيد Promise: { ok: true, data, source: 'codecraft' } أو يرفض بخطأ عربي
   */
  requestStudentAnalysis(studentId, periodDays = 0) {
    const payload = AI.buildStudentAnalysisPayload(studentId, periodDays);
    if (!payload) {
      return Promise.reject(new Error('لم يتم العثور على بيانات هذا الطالب'));
    }
    return AIProviders.cloud.invoke('student-analysis', payload)
      .then(data => ({ ok: true, data, source: 'codecraft', payload }));
  },

  /* ============================================
     محرك الاتجاه (Trend Engine)
     يعيد { direction, change, confidence } ولا يخمّن من نتيجة واحدة
     ============================================ */
  trendFromGrades(grades) {
    const series = (grades || [])
      .filter(g => g.maxGrade > 0 && g.date)
      .map(g => ({ date: g.date, pct: (g.score / g.maxGrade) * 100 }))
      .sort((a, b) => a.date.localeCompare(b.date));

    if (series.length < 2) {
      return { direction: 'insufficient', change: null, confidence: 'غير كافية', sample: series.length, message: 'لا توجد بيانات درجات كافية لتحديد الاتجاه (يلزم درجتان على الأقل بتواريخ مختلفة)' };
    }

    // تقسيم السلسلة إلى نصفين ومقارنة متوسطيهما
    const mid = Math.floor(series.length / 2);
    const older = series.slice(0, mid);
    const recent = series.slice(mid);
    const oldAvg = older.reduce((s, g) => s + g.pct, 0) / older.length;
    const newAvg = recent.reduce((s, g) => s + g.pct, 0) / recent.length;
    const change = Utils.round(newAvg - oldAvg, 1);

    let direction = 'stable';
    if (change >= 5) direction = 'improving';
    else if (change <= -5) direction = 'declining';

    // الثقة تعتمد على حجم العينة لا على نتيجة واحدة
    let confidence = 'منخفضة';
    if (series.length >= 6) confidence = 'عالية';
    else if (series.length >= 4) confidence = 'متوسطة';

    return { direction, change, confidence, sample: series.length };
  },

  trendLabel(trend) {
    if (!trend) return 'غير متوفر';
    switch (trend.direction) {
      case 'improving': return { text: 'متجه للتحسن', icon: 'trendUp', cls: 'success', change: `+${trend.change}` };
      case 'declining': return { text: 'متجه للتراجع', icon: 'trendDown', cls: 'danger', change: `${trend.change}` };
      case 'stable': return { text: 'مستقر', icon: 'trendFlat', cls: 'info', change: `${trend.change >= 0 ? '+' : ''}${trend.change}` };
      default: return { text: 'غير كافٍ', icon: 'info', cls: '', change: '—' };
    }
  },

  /* ============================================
     تجهيز وتحليل الطالب (نقطة الدخول الرئيسية)
     ============================================ */
  generateStudentAnalysis(studentId) {
    const data = AIAnalysis.prepare(studentId);
    if (!data) return null;
    const perf = AIAnalysis.performance(data);
    const analysis = AI.buildAnalysis(data, perf);
    return { data, perf, analysis };
  },

  /* ============================================
     بناء التحليل المحلي - من البيانات الفعلية فقط
     ============================================ */
  buildAnalysis(data, perf) {
    const p = data.studentProfile;
    const sections = { summary: '', strengths: [], weaknesses: [], recommendations: [], notes: [] };

    // ---- المدخل (Summary) ----
    const trend = data.gradeTrend;
    const trendLbl = AI.trendLabel(trend);
    const parts = [];

    if (perf.score != null && perf.coverage >= 40) {
      parts.push(`مستوى الأداء العام للطالب ${p.name} يقدَّر بـ ${perf.score}%`);
      if (trend.direction !== 'insufficient') {
        parts.push(`والاتجاه الزمني ${trendLbl.text} (فرق ${trendLbl.change} نقطة، ثقة ${trend.confidence})`);
      }
    } else {
      parts.push(`البيانات المتاحة عن الطالب ${p.name} محدودة، لذلك يُفضل اعتبار هذا التحليل مؤشرًا أوليًا وليس حكمًا نهائيًا`);
    }
    if (data.attStats.total > 0 && data.attStats.rate != null) {
      parts.push(`نسبة الحضور ${data.attStats.rate}% من ${data.attStats.total} حصة مسجلة`);
    } else {
      parts.push('لا توجد بيانات حضور كافية خلال الفترة المتاحة');
    }
    if (data.assignmentStats.total > 0 && data.assignmentStats.rate != null) {
      parts.push(`ونسبة تسليم الواجبات ${data.assignmentStats.rate}%`);
    }
    sections.summary = parts.join('، ') + '.';

    // ---- نقاط القوة (مبنية على أرقام فعلية) ----
    if (perf.components.exams != null && perf.components.exams >= 75) {
      sections.strengths.push(`أداء جيد في الاختبارات بمتوسط ${perf.components.exams}%`);
    }
    if (perf.components.continuous != null && perf.components.continuous >= 75) {
      sections.strengths.push(`تقييم مستمر مرتفع (${perf.components.continuous}%) يعكس تفاعلًا يوميًا جيدًا`);
    }
    if (data.attStats.rate != null && data.attStats.rate >= 90 && data.attStats.total >= 3) {
      sections.strengths.push(`التزام ممتاز بالحضور (${data.attStats.rate}%)`);
    }
    if (data.assignmentStats.total > 0 && data.assignmentStats.rate >= 90) {
      sections.strengths.push(`التزام كامل تقريبًا بتسليم الواجبات (${data.assignmentStats.submitted}/${data.assignmentStats.total})`);
    }
    if (trend.direction === 'improving') {
      sections.strengths.push(`تحسن ملموس في الدرجات خلال الفترة الأخيرة (+${trend.change} نقطة)`);
    }
    if (data.teacherNotes.some(n => n.type === 'إنجاز')) {
      sections.strengths.push('ملاحظات إنجاز مسجلة من المدرس خلال الفترة');
    }

    // ---- نقاط الضعف ----
    const examGrades = data.allGrades.filter(g => g.type === 'اختبار' || g.examId);
    if (examGrades.length >= 2) {
      const avg = Math.round(examGrades.reduce((s, g) => s + g.pct, 0) / examGrades.length);
      if (avg < 60) sections.weaknesses.push(`متوسط الاختبارات ${avg}% وهو دون المستوى المطلوب`);
    }
    if (perf.components.exams != null && perf.components.exams < 60) {
      sections.weaknesses.push(`الحاجة لتعزيز الأساسيات قبل الانتقال لموضوعات جديدة (متوسط الاختبارات ${perf.components.exams}%)`);
    }
    if (data.attStats.rate != null && data.attStats.total >= 3 && data.attStats.rate < 75) {
      sections.weaknesses.push(`نسبة حضور ${data.attStats.rate}% تؤثر مباشرة على استمرارية الفهم`);
    }
    if (data.assignmentStats.notSubmitted > 0) {
      sections.weaknesses.push(`${data.assignmentStats.notSubmitted} واجبات لم تُسلَّم من إجمالي ${data.assignmentStats.total}`);
    }
    if (data.assignmentStats.late > 0 && data.assignmentStats.late >= data.assignmentStats.total / 2 && data.assignmentStats.total > 1) {
      sections.weaknesses.push('نصف الواجبات تقريبًا تُسلَّم متأخرة');
    }
    if (trend.direction === 'declining' && trend.confidence !== 'منخفضة') {
      sections.weaknesses.push(`اتجاه هابط في الدرجات (-${Math.abs(trend.change)} نقطة، ثقة ${trend.confidence})`);
    }

    // ---- التوصيات (generateTeacherRecommendations) ----
    sections.recommendations = AI.generateTeacherRecommendations(data, perf);

    // ---- ملاحظات شفافية ----
    if (data.allGrades.length < 3) sections.notes.push('عدد الدرجات المسجلة قليل، والنتائج مؤشرات أولية.');
    if (data.attStats.total === 0) sections.notes.push('لم يُسجل حضور للطالب بعد.');
    if (perf.coverage < 70) sections.notes.push(`الأوزان المطبقة تغطي ${perf.coverage}% فقط من مكونات الأداء لأن بعض المكونات لا توجد بياناتها.`);
    sections.notes.push('هذا التحليل مولّد محليًا من بياناتك المسجلة، ويمكنك تعديله قبل اعتماده أو مشاركته.');

    return sections;
  },

  /* ============================================
     توليد توصيات المدرس
     ============================================ */
  generateTeacherRecommendations(data, perf) {
    const recs = [];

    if (data.attStats.rate != null && data.attStats.total >= 3 && data.attStats.rate < 75) {
      recs.push('التواصل مع ولي الأمر لمناقشة أسباب الغياب ووضع خطة متابعة للحضور.');
    }
    if (data.assignmentStats.notSubmitted > 0) {
      recs.push(`متابعة تسليم الواجبات المتأخرة (${data.assignmentStats.notSubmitted} واجب) وتحديد موعد نهائي واضح.`);
    }
    if (perf.components.exams != null && perf.components.exams < 60) {
      recs.push('تخصيص جلسة مراجعة للأساسيات مع تمارين متدرجة الصعوبة قبل تقديم محتوى جديد.');
    }
    if (data.gradeTrend.direction === 'declining' && data.gradeTrend.confidence !== 'منخفضة') {
      recs.push('عقد جلسة فردية قصيرة لفهم أسباب التراجع (ضغط دراسي، غياب، أو صعوبة في موضوع معين).');
    }
    if (perf.components.continuous == null && perf.components.exams != null) {
      recs.push('إضافة درجات تقييم مستمر أسبوعية لتغطية أوسع لمستوى الطالب الفعلي.');
    }
    if (data.assignmentStats.total === 0) {
      recs.push('تكليف الطالب بواجب قصير لقياس مستوى الالتزام والفهم.');
    }
    if (recs.length === 0) {
      recs.push('الأداء العام منتظم - الاستمرار في المتابعة الدورية وتحفيز الطالب للحفاظ على المستوى.');
    }
    return recs;
  },

  /* ============================================
     خطة التحسين - بنود عملية مبنية على أضعف المكونات
     ============================================ */
  generateImprovementPlan(studentId) {
    const data = AIAnalysis.prepare(studentId);
    if (!data) return null;
    const perf = AIAnalysis.performance(data);
    const items = [];

    if (perf.components.exams != null && perf.components.exams < 70) {
      items.push({
        title: 'تعزيز الجوانب الدراسية الضعيفة',
        why: `متوسط الاختبارات الحالي ${perf.components.exams}%`,
        steps: [
          'تحديد الموضوعات الأقل درجة ومراجعتها حصة بحصة',
          'حل تمارين متدرجة أسبوعيًا مع تصحيح فوري',
          'اختبار قصير كل أسبوعين لقياس التحسن'
        ],
        metric: 'ارتفاع متوسط الاختبارات إلى 75%+'
      });
    }
    if (data.attStats.rate != null && data.attStats.total >= 3 && data.attStats.rate < 85) {
      items.push({
        title: 'تحسين الانتظام في الحضور',
        why: `نسبة الحضور ${data.attStats.rate}%`,
        steps: [
          'التنسيق مع ولي الأمر لتثبيت مواعيد الحضور',
          'تسجيل أسباب الغياب في ملف الطالب',
          'متابعة أسبوعية لنسبة الحضور'
        ],
        metric: 'نسبة حضور 90%+ في الشهر القادم'
      });
    }
    if (data.assignmentStats.total > 0 && (data.assignmentStats.notSubmitted > 0 || data.assignmentStats.late > 0)) {
      items.push({
        title: 'الالتزام بتسليم الواجبات في موعدها',
        why: `${data.assignmentStats.notSubmitted} واجبات لم تُسلَّم و${data.assignmentStats.late} متأخرة`,
        steps: [
          'إرسال تذكير عبر WhatsApp قبل موعد التسليم بيوم',
          'ربط تسليم الواجب بتقييم مستمر أسبوعي',
          'مراجعة الواجب مع الطالب عند بداية الحصة'
        ],
        metric: 'نسبة التسليم 95%+'
      });
    }
    if (data.allGrades.length < 4) {
      items.push({
        title: 'توسيع قياس الأداء',
        why: 'عدد الدرجات المسجلة قليل ولا يعطي صورة كافية',
        steps: [
          'إضافة تقييم مستمر أسبوعي (5-10 درجات)',
          'تسجيل درجات المشاركة داخل الحصة'
        ],
        metric: '4+ درجات مسجلة خلال شهر'
      });
    }
    if (items.length === 0) {
      items.push({
        title: 'الحفاظ على المستوى والانتقال لمهارات أعلى',
        why: 'المؤشرات العامة منتظمة',
        steps: [
          'إضافة تحديات أسبوعية أعلى قليلًا من المستوى الحالي',
          'تشجيع الطالب على مساعدته زملاءه في الحصة (تعزيز للفهم)'
        ],
        metric: 'ثبات المتوسط 80%+'
      });
    }

    return {
      studentId,
      createdAt: Date.now(),
      perfScore: perf.score,
      coverage: perf.coverage,
      items,
      disclaimer: 'خطة أولية مبنية على البيانات المتاحة - قابلة للتعديل من المدرس، والمدرس صاحب القرار النهائي.'
    };
  },

  /* ============================================
     تقرير ولي الأمر (نص) - خصوصية صارمة
     ممنوع: بيانات طلاب آخرين، ترتيب، ملاحظات داخلية، بيانات مالية
     ============================================ */
  generateParentReport(studentId, options = {}) {
    const { periodDays = 30, style = 'متوسط', include = { attendance: true, grades: true, assignments: true, recommendations: true } } = options;
    const data = AIAnalysis.prepare(studentId, periodDays);
    if (!data) return null;

    const settings = Storage.get(Storage.KEYS.settings, {});
    const teacher = Auth.getTeacher() || {};
    const p = data.studentProfile;
    const trend = data.gradeTrend;
    const perf = AIAnalysis.performance(data);
    const lines = [];

    lines.push('السلام عليكم ورحمة الله وبركاته،');
    lines.push('');
    lines.push(`والد/والدة الطالب ${p.name} المحترم/ة،`);
    lines.push('');

    if (style === 'مختصر') {
      lines.push(`نطلعكم على متابعة مختصرة للطالب خلال الفترة الأخيرة:`);
      if (include.attendance && data.attStats.total > 0) {
        lines.push(`- الحضور: ${data.attStats.rate}% (${data.attStats.present} حاضر، ${data.attStats.absent} غياب)`);
      }
      if (include.grades && perf.components.exams != null) {
        lines.push(`- متوسط الاختبارات: ${perf.components.exams}%`);
      }
      if (include.assignments && data.assignmentStats.total > 0) {
        lines.push(`- تسليم الواجبات: ${data.assignmentStats.submitted} من ${data.assignmentStats.total}`);
      }
    } else {
      lines.push(`يسرّنا أن نطلعكم على تقرير متابعة للطالب خلال الفترة الأخيرة، وسعدنا بملاحظة تطوره خلال هذه المرحلة.`);
      lines.push('');

      if (include.attendance) {
        lines.push('أولًا - الحضور والمشاركة:');
        if (data.attStats.total > 0 && data.attStats.rate != null) {
          lines.push(`- نسبة الحضور: ${data.attStats.rate}% (${data.attStats.present} حضور، ${data.attStats.absent} غياب، ${data.attStats.late} تأخير من إجمالي ${data.attStats.total} حصة)`);
          if (data.attStats.rate >= 90) lines.push('نقدّر التزام الطالب المنتظم ببدء الحصص في موعدها.');
          else if (data.attStats.rate < 75) lines.push('نأمل التعاون معنا لتقليل الغياب لأنه يؤثر مباشرة على استمرارية الفهم.');
        } else {
          lines.push('لا توجد بيانات حضور كافية خلال الفترة المحددة.');
        }
        lines.push('');
      }

      if (include.grades) {
        lines.push('ثانيًا - المستوى الدراسي:');
        if (data.allGrades.length > 0) {
          const recent = data.allGrades.slice(-4).reverse();
          recent.forEach(g => {
            lines.push(`- ${g.title || 'درجة'}: ${g.score} من ${g.maxGrade} (${Math.round(g.pct)}%)`);
          });
          if (trend.direction !== 'insufficient' && trend.confidence !== 'منخفضة') {
            const word = trend.direction === 'improving' ? 'نلاحظ تحسنًا تدريجيًا' : (trend.direction === 'declining' ? 'لاحظنا تراجعًا بسيطًا' : 'المستوى مستقر نسبيًا');
            lines.push(`${word} مقارنة بالفترة السابقة، وسنعمل معًا على تعزيز ${trend.direction === 'declining' ? 'الانتظام' : 'هذا التقدم'}.`);
          }
        } else {
          lines.push('لم تُسجل درجات خلال هذه الفترة بعد، وسنوافيكم بأي مستجدات فور توفرها.');
        }
        lines.push('');
      }

      if (include.assignments) {
        lines.push('ثالثًا - الواجبات:');
        if (data.assignmentStats.total > 0) {
          lines.push(`- سلَّم ${data.assignmentStats.submitted} واجبات من ${data.assignmentStats.total}${data.assignmentStats.late ? `، منها ${data.assignmentStats.late} متأخرة` : ''}.`);
          if (data.assignmentStats.rate >= 90) lines.push('نقدّر التزام الطالب الواضح بواجباته.');
          else lines.push('نأمل متابعته لتسليم الواجبات في مواعيدها، فهي جزء أساسي من الترسيخ.');
        } else {
          lines.push('لم تُكلَّف بأي واجبات خلال هذه الفترة.');
        }
        lines.push('');
      }

      if (include.recommendations) {
        const recs = AI.generateTeacherRecommendations(data, perf).slice(0, 3);
        if (recs.length) {
          lines.push('توصيات لتعزيز مستوى الطالب من جهتنا:');
          recs.forEach((r, i) => lines.push(`${i + 1}. ${r}`));
          lines.push('');
        }
      }

      if (perf.score != null && perf.coverage >= 40) {
        lines.push(`مؤشر الأداء العام لهذه الفترة: ${perf.score}%.`);
        lines.push('');
      }
    }

    lines.push('يظل هذا التقرير مؤشرًا مبدئيًا مأخوذًا من البيانات المسجلة، ونرحب بأي استفسار.');
    lines.push('');
    lines.push(settings.reportSignature || 'مع خالص التحية والتقدير،');
    lines.push(`أ/ ${teacher.name || ''}`);
    if (settings.reportCenter) lines.push(settings.reportCenter);
    if (settings.reportPhone) lines.push(`للتواصل: ${settings.reportPhone}`);

    return {
      text: lines.join('\n'),
      periodDays,
      style,
      dataUsed: { grades: data.allGrades.length, attendance: data.attStats.total, assignments: data.assignmentStats.total },
      createdAt: Date.now()
    };
  },

  /* ============================================
     رسالة واتساب قصيرة
     ============================================ */
  generateWhatsAppMessage(studentId) {
    const full = AI.generateParentReport(studentId, { periodDays: 30, style: 'مختصر' });
    return full ? full.text : '';
  },

  /* ============================================
     النص الكامل لتحليل الطالب (يستخدم في التبويب وواجهة المزود)
     ============================================ */
  generateStudentAnalysisText(payload) {
    const d = payload.data, a = payload.analysis, perf = payload.perf;
    const out = [];
    out.push(`تحليل أداء الطالب: ${d.studentProfile.name}`);
    out.push('='.repeat(34));
    out.push('');
    out.push(a.summary);
    out.push('');
    if (a.strengths.length) {
      out.push('نقاط القوة:');
      a.strengths.forEach(s => out.push(`- ${s}`));
      out.push('');
    }
    if (a.weaknesses.length) {
      out.push('نقاط تحتاج عملًا:');
      a.weaknesses.forEach(s => out.push(`- ${s}`));
      out.push('');
    } else {
      out.push('لا توجد مؤشرات سلبية واضحة في البيانات الحالية.');
      out.push('');
    }
    if (a.recommendations.length) {
      out.push('توصيات:');
      a.recommendations.forEach((s, i) => out.push(`${i + 1}. ${s}`));
      out.push('');
    }
    if (a.notes.length) {
      out.push('ملاحظات على التحليل:');
      a.notes.forEach(s => out.push(`- ${s}`));
    }
    return out.join('\n');
  }
};

window.AI = AI;
window.AIProviders = AIProviders;

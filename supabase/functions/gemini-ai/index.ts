// ============================================
//   مُعلّمي | gemini-ai Edge Function
//   بوابة ذكاء اصطناعي آمنة للتطبيق
// --------------------------------------------
//   ملاحظة: اسم الدالة "gemini-ai" محفوظ لأسباب التوافق
//   مع استدعاءات التطبيق الحالية، لكن المحرك السحابي
//   الفعلي هو CodeCraft API (OpenAI-compatible).
//
//   الأمان:
//   - المفتاح CODECRAFT_API_KEY يُقرأ حصريًا من Supabase Secrets
//     (supabase secrets set CODECRAFT_API_KEY=...)
//   - ممنوع منعًا باتًا وضع المفتاح في أي ملف Frontend
//   - الطلب مرفوض إلا بجلسة Supabase صالحة (Access Token)
//
//   المهام:
//   - task = "generate-exam"      : توليد امتحان كامل (JSON منظم)
//   - task = "student-analysis"   : تحليل أداء طالب من بياناته الفعلية فقط
//
//   النشر:
//   supabase functions deploy gemini-ai
//   supabase secrets set CODECRAFT_API_KEY=your_codecraft_key_here
//   supabase secrets set CODECRAFT_MODEL=claude-opus-4.8   (اختياري)
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ===== CORS =====
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function fail(error: string, status = 400, extra: Record<string, unknown> = {}) {
  return json({ ok: false, error, ...extra }, status);
}

// ===== حد استخدام بسيط لكل مستخدم (حماية من الإساءة) =====
// نافذة 5 دقائق: 30 طلبًا كحد أقصى لكل مستخدم لكل نسخة من الدالة
const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_MAX = 30;
const rateMap = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const arr = (rateMap.get(userId) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) {
    rateMap.set(userId, arr);
    return true;
  }
  arr.push(now);
  rateMap.set(userId, arr);
  return false;
}

// ===== إعدادات CodeCraft (OpenAI-compatible) =====
// الموديل قابل للتغيير عبر Supabase Secret/Environment Variable.
// القيمة الافتراضية: claude-opus-4.8
const CODECRAFT_MODEL =
  Deno.env.get('CODECRAFT_MODEL') || 'claude-opus-4.8';

const CODECRAFT_ENDPOINT =
  'https://www.codecraftapi.com/v1/chat/completions';

const MAX_OUTPUT_TOKENS = 32768;

// استدعاء CodeCraft (OpenAI-compatible chat completions)
async function callCodeCraft(
  apiKey: string,
  prompt: string,
  maxTokens = MAX_OUTPUT_TOKENS,
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(CODECRAFT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: CODECRAFT_MODEL,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.75,
        max_tokens: maxTokens,
        response_format: {
          type: 'json_object',
        },
      }),
    });
  } catch (err) {
    // خطأ في الشبكة أو تعذر الاتصال بالخدمة
    throw new Error(
      'CODECRAFT_CALL_FAILED: ' +
        (err instanceof Error ? err.message : String(err)),
    );
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    // رمي خطأ يحمل كود الـ HTTP ليتعامل معه المعالج الرئيسي برسالة عربية واضحة
    throw new Error(`CODECRAFT_HTTP_${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json().catch(() => null);
  // OpenAI-compatible response: choices[0].message.content
  const text: string =
    data?.choices?.[0]?.message?.content ||
    data?.choices?.[0]?.text ||
    '';

  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new Error('CODECRAFT_CALL_FAILED: استجابة فارغة من CodeCraft');
  }
  return text.trim();
}

// استخراج JSON من نص الاستجابة (مع تحمل أي غلاف بسيط)
function parseJsonSafe(text: string): any | null {
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

// ===== Schema: توليد امتحان =====
// ملاحظة: CodeCraft (OpenAI-compatible) يعتمد على response_format من نوع json_object
// مع تعليمات صريحة داخل الـ Prompt لضبط أسماء الحقول، بدلًا من responseSchema الصارم.
const examSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    subject: { type: 'string' },
    grade: { type: 'string' },
    topic: { type: 'string' },
    durationMinutes: { type: 'integer' },
    totalMarks: { type: 'number' },
    instructions: { type: 'string' },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['mcq', 'truefalse', 'fill', 'essay', 'problem'],
          },
          text: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          answer: { type: 'string' },
          modelAnswer: { type: 'string' },
          marks: { type: 'number' },
        },
        required: ['type', 'text', 'answer', 'marks'],
      },
    },
  },
  required: [
    'title', 'subject', 'grade', 'topic',
    'durationMinutes', 'totalMarks', 'instructions', 'questions',
  ],
};

// ===== Schema: تحليل الطالب =====
const analysisSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    strengths: { type: 'array', items: { type: 'string' } },
    areasToImprove: { type: 'array', items: { type: 'string' } },
    possibleCauses: { type: 'array', items: { type: 'string' } },
    teacherRecommendations: { type: 'array', items: { type: 'string' } },
    improvementPlan: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          steps: { type: 'array', items: { type: 'string' } },
          metric: { type: 'string' },
        },
        required: ['title', 'steps'],
      },
    },
    parentReport: { type: 'string' },
  },
  required: [
    'summary', 'strengths', 'areasToImprove', 'possibleCauses',
    'teacherRecommendations', 'improvementPlan', 'parentReport',
  ],
};

// ===== بناء Prompt: توليد امتحان =====
function buildExamPrompt(p: any): string {
  const types: Record<string, string> = {
    mcq: 'اختيار من متعدد (4 اختيارات: أ، ب، ج، د — إجابة صحيحة واحدة فقط)',
    truefalse: 'صح أو خطأ (الإجابة كلمة "صح" أو "خطأ" فقط)',
    fill: 'أكمل (فراغ بإجابة قصيرة واضحة)',
    essay: 'مقالي (مع إجابة نموذجية قابلة للتصحيح في modelAnswer)',
    problem: 'مسألة (مع خطوات الحل كاملة في modelAnswer)',
  };

  const typeLabels = (p.types && p.types.length ? p.types : ['mcq'])
    .map((t: string) => types[t] || t)
    .join('، ');

  const difficultyNote: Record<string, string> = {
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
      "options": string[] (لمسائل الصحيح/خطأ والأكمل والمقالي يمكن حذفها أو تركها فارغة),
      "answer": string,
      "modelAnswer": string (للمقالي والمسائل فقط),
      "marks": number
    }
  ]
}

أعد JSON صالحًا فقط بدون Markdown أو شرح إضافي.`;
}

// ===== بناء Prompt: تحليل الطالب =====
function buildAnalysisPrompt(p: any): string {
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
}

// ===== الدخول =====
Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return fail('الطريقة غير مدعومة', 405);
  }

  try {
    // 1) التحقق من جلسة المستخدم عبر Supabase Auth
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return fail('جلسة غير صالحة — سجّل الدخول أولًا', 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return fail('جلسة غير صالحة أو منتهية — سجّل الدخول من جديد', 401);
    }
    const user = userData.user;

    // 2) حد الاستخدام
    if (rateLimited(user.id)) {
      return fail('محاولات كثيرة — انتظر قليلًا ثم حاول مرة أخرى', 429);
    }

    // 3) قراءة المفتاح من Secrets فقط (لا يوجد مفتاح في الفرونت أبدًا)
    const apiKey = Deno.env.get('CODECRAFT_API_KEY');
    if (!apiKey) {
      return fail(
        'مفتاح الذكاء الاصطناعي غير مهيأ على الخادم',
        500,
      );
    }

    // 4) قراءة الطلب
    const body = await req.json().catch(() => null);
    if (!body || typeof body.task !== 'string') {
      return fail('طلب غير صالح — الحقل task مطلوب');
    }
    const payload = body.payload || {};

    // 5) تنفيذ المهمة
    if (body.task === 'generate-exam') {
      const required = ['subject', 'grade', 'topic', 'questionCount', 'totalMarks'];
      for (const k of required) {
        if (payload[k] === undefined || payload[k] === null || payload[k] === '') {
          return fail(`بيانات ناقصة: ${k}`);
        }
      }
      const qCount = Math.min(50, Math.max(5, parseInt(payload.questionCount, 10) || 10));
      const prompt = buildExamPrompt({ ...payload, questionCount: qCount });
      const text = await callCodeCraft(apiKey, prompt);
      const exam = parseJsonSafe(text);
      if (!exam || !Array.isArray(exam.questions) || exam.questions.length === 0) {
        return fail('تعذر توليد امتحان صالح — جرّب إعادة التوليد', 502);
      }
      return json({ ok: true, data: exam });
    }

    if (body.task === 'student-analysis') {
      if (!payload.student || typeof payload.student !== 'object') {
        return fail('بيانات ناقصة: student');
      }
      const prompt = buildAnalysisPrompt(payload);
      const text = await callCodeCraft(apiKey, prompt, 16384);
      const analysis = parseJsonSafe(text);
      if (!analysis || typeof analysis.summary !== 'string') {
        return fail('تعذر توليد تحليل صالح — جرّب مرة أخرى', 502);
      }
      return json({ ok: true, data: analysis });
    }

    return fail('مهمة غير معروفة: ' + body.task);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[gemini-ai] error:', msg);

    // معالجة أخطاء CodeCraft إلى رسائل عربية واضحة للمستخدم
    if (msg.startsWith('CODECRAFT_HTTP_401') || msg.includes(' 401 ')) {
      return fail('مفتاح خدمة الذكاء الاصطناعي غير صالح أو منتهي', 401);
    }
    if (msg.startsWith('CODECRAFT_HTTP_429') || msg.includes(' 429 ')) {
      return fail('تم تجاوز حد الاستخدام، حاول مرة أخرى لاحقًا', 429);
    }
    if (msg.startsWith('CODECRAFT_HTTP_402') || msg.includes(' 402 ')) {
      return fail('رصيد خدمة الذكاء الاصطناعي غير كافٍ', 402);
    }
    if (
      msg.startsWith('CODECRAFT_HTTP_500') ||
      msg.startsWith('CODECRAFT_HTTP_502') ||
      msg.startsWith('CODECRAFT_HTTP_503') ||
      /\b(500|502|503)\b/.test(msg)
    ) {
      return fail(
        'تعذر الاتصال بخدمة الذكاء الاصطناعي حاليًا — حاول مرة أخرى بعد قليل',
        503,
      );
    }
    if (msg.startsWith('CODECRAFT_CALL_FAILED')) {
      return fail(
        'تعذر الاتصال بخدمة الذكاء الاصطناعي حاليًا — حاول مرة أخرى بعد قليل',
        502,
      );
    }

    return fail('حدث خطأ غير متوقع في الخادم', 500);
  }
});

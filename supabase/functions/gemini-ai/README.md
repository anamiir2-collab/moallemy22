# gemini-ai Edge Function

بوابة الذكاء الاصطناعي لتطبيق **مُعلّمي** — توليد الامتحانات وتحليل أداء الطلاب عبر **CodeCraft API** (OpenAI-compatible).

> ملاحظة: اسم الدالة `gemini-ai` محفوظ لأسباب التوافق مع استدعاءات التطبيق الحالية (Frontend يستدعي `functions.invoke('gemini-ai', ...)`). المحرك السحابي الفعلي هو **CodeCraft API** وليس Google Gemini. لا تستخدم `GEMINI_API_KEY` بعد الآن.

## الأمان

- المفتاح `CODECRAFT_API_KEY` يُخزَّن **حصريًا** في Supabase Secrets — ممنوع تمامًا وضعه في أي ملف Frontend أو رفعه إلى GitHub.
- كل استدعاء يتطلب جلسة Supabase صالحة (Access Token يُرسل تلقائيًا من `supabase-js` عبر `functions.invoke`).
- حد استخدام: 30 طلبًا / 5 دقائق لكل مستخدم.
- الموديل قابل للتغيير عبر `CODECRAFT_MODEL` (القيمة الافتراضية: `claude-opus-4.8`).

## نقطة النهاية (Endpoint)

- Base URL: `https://www.codecraftapi.com/v1`
- Chat endpoint: `https://www.codecraftapi.com/v1/chat/completions`
- التوثيق: `Authorization: Bearer CODECRAFT_API_KEY`

شكل الطلب المُرسل إلى CodeCraft:

```json
{
  "model": "claude-opus-4.8",
  "messages": [
    { "role": "user", "content": "<prompt>" }
  ],
  "temperature": 0.75,
  "max_tokens": 32768,
  "response_format": { "type": "json_object" }
}
```

يتم قراءة الاستجابة من `data.choices[0].message.content` ثم تمريرها إلى `parseJsonSafe`.

## خطوات النشر

```bash
# 1) تسجيل الدخول وربط المشروع
supabase login
supabase link --project-ref secejwjzxfjgjozpteld

# 2) ضبط المفتاح السري (مفتاح CodeCraft API)
supabase secrets set CODECRAFT_API_KEY=cc_...your_codecraft_key_here

# 3) (اختياري) ضبط الموديل — القيمة الافتراضية: claude-opus-4.8
supabase secrets set CODECRAFT_MODEL=claude-opus-4.8

# 4) نشر الدالة
supabase functions deploy gemini-ai
```

> مهم: لا تضع المفتاح في أي ملف في GitHub. المفتاح موجود في Supabase Secrets فقط.

## الاختبار السريع

```bash
supabase functions invoke gemini-ai \
  --body '{"task":"generate-exam","payload":{"subject":"الرياضيات","grade":"الثالث الثانوي","topic":"التفاضل","questionCount":5,"totalMarks":10,"durationMinutes":30,"difficulty":"متوسط","types":["mcq","essay"]}}'
```

> ملاحظة: الاستدعاء من خارج تطبيق مسجَّل الدخول سيرجع `401` — هذا مقصود (الحماية تعتمد على جلسة المستخدم).

## رسائل الأخطاء

| HTTP | الرسالة للمستخدم |
|------|-----------------|
| 401 | "مفتاح خدمة الذكاء الاصطناعي غير صالح أو منتهي" |
| 429 | "تم تجاوز حد الاستخدام، حاول مرة أخرى لاحقًا" |
| 402 | "رصيد خدمة الذكاء الاصطناعي غير كافٍ" |
| 500 / 502 / 503 | "تعذر الاتصال بخدمة الذكاء الاصطناعي حاليًا — حاول مرة أخرى بعد قليل" |

## الطلبات المدعومة

| task | الوصف | payload |
|------|-------|---------|
| `generate-exam` | توليد امتحان كامل | `{ subject, grade, topic, questionCount, totalMarks, durationMinutes, difficulty, types[], extraInstructions?, groupId? }` |
| `student-analysis` | تحليل أداء طالب من بياناته الفعلية | `{ student, grades[], gradeTrend, attendance, assignments, teacherNotes[], goals[] }` |

## المسار الآمن

```
Frontend → Supabase Auth → Supabase Edge Function (gemini-ai) → CodeCraft API → AI Model → Edge Function → Frontend
```

بهذا الشكل يبقى مفتاح `CODECRAFT_API_KEY` مخفيًا تمامًا عن المتصفح.

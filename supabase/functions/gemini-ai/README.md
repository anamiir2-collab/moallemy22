# gemini-ai Edge Function

بوابة الذكاء الاصطناعي لتطبيق **مُعلّمي** — توليد الامتحانات وتحليل أداء الطلاب عبر Google Gemini.

## الأمان

- المفتاح `GEMINI_API_KEY` يُخزَّن **حصريًا** في Supabase Secrets — ممنوع تمامًا وضعه في أي ملف Frontend أو رفعه إلى GitHub.
- كل استدعاء يتطلب جلسة Supabase صالحة (Access Token يُرسل تلقائيًا من `supabase-js` عبر `functions.invoke`).
- حد استخدام: 30 طلبًا / 5 دقائق لكل مستخدم.

## خطوات النشر

```bash
# 1) تسجيل الدخول وربط المشروع
supabase login
supabase link --project-ref secejwjzxfjgjozpteld

# 2) ضبط المفتاح السري (مفتاح Google AI Studio)
supabase secrets set GEMINI_API_KEY=AIza...your_key_here

# 3) نشر الدالة
supabase functions deploy gemini-ai
```

## الاختبار السريع

```bash
supabase functions invoke gemini-ai \
  --body '{"task":"generate-exam","payload":{"subject":"الرياضيات","grade":"الثالث الثانوي","topic":"التفاضل","questionCount":5,"totalMarks":10,"durationMinutes":30,"difficulty":"متوسط","types":["mcq","essay"]}}'
```

> ملاحظة: الاستدعاء من خارج تطبيق مسجَّل الدخول سيرجع `401` — هذا مقصود (الحماية تعتمد على جلسة المستخدم).

## الطلبات المدعومة

| task | الوصف | payload |
|------|-------|---------|
| `generate-exam` | توليد امتحان كامل | `{ subject, grade, topic, questionCount, totalMarks, durationMinutes, difficulty, types[], extraInstructions?, groupId? }` |
| `student-analysis` | تحليل أداء طالب من بياناته الفعلية | `{ student, grades[], gradeTrend, attendance, assignments, teacherNotes[], goals[] }` |

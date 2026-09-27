/* ============================================
   مُعلّمي | ai-key.js
   إدارة مفتاح Gemini من المتصفح مباشرة
   --------------------------------------------
   - المفتاح يُدخله المستخدم ويُحفظ في localStorage على جهازه فقط
   - لا يُرسل المفتاح إلى Supabase أو أي سيرفر خاص بالتطبيق
   - لا يُسجَّل في console ولا يُطبع في رسائل الخطأ
   - لا توجد أي مفاتيح ثابتة داخل هذا الملف إطلاقًا
   - استدعاء Gemini يتم بمفتاح x-goog-api-key من المتصفح
   - يُستخدم فقط لمولّد الامتحانات (generate-exam)
     أما student-analysis فما زال يمر عبر Edge Function كما هو
   ============================================ */

const GeminiKey = {
  /* مفتاح التخزين المحلي — قيمته هي نص المفتاح فقط */
  STORAGE_KEY: 'moallemy_gemini_key',

  /* نقطة نهاية Gemini الرسمية — رابط عام ثابت، ليس سرًا */
  ENDPOINT:
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',

  /* نموذج Gemini الرسمي (مطلوب المستخدم تحديده) */
  MODEL: 'gemini-2.5-flash',

  /* الحد الأقصى لطول الاستجابة (يوازي إعداد Edge Function) */
  MAX_OUTPUT_TOKENS: 32768,

  /* ============================================
     قراءة/كتابة المفتاح محليًا — لا تُسجِّل القيمة أبدًا
     ============================================ */
  hasKey() {
    try {
      return !!localStorage.getItem(this.STORAGE_KEY);
    } catch (_) {
      return false;
    }
  },

  getKey() {
    try {
      return localStorage.getItem(this.STORAGE_KEY) || '';
    } catch (_) {
      return '';
    }
  },

  saveKey(key) {
    const k = String(key || '').trim();
    if (!k) {
      const err = new Error('المفتاح فارغ — الصق مفتاح Gemini صحيح');
      err.code = 'EMPTY_KEY';
      throw err;
    }
    try {
      localStorage.setItem(this.STORAGE_KEY, k);
    } catch (_) {
      const err = new Error('تعذر حفظ المفتاح على هذا الجهاز — تحقق من إعدادات التخزين في المتصفح');
      err.code = 'STORAGE_FAIL';
      throw err;
    }
  },

  clearKey() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (_) {
      /* تجاهل */
    }
  },

  /* عرض مقنّع للمفتاح بعد الحفظ — لا يُعرض المفتاح كاملًا أبدًا */
  maskedKey() {
    const k = this.getKey();
    if (!k) return '';
    if (k.length <= 4) return '••••';
    if (k.length <= 8) return '••••••••';
    return '••••••••' + k.slice(-4);
  },

  /* ============================================
     استدعاء Gemini مباشرة من المتصفح
     - يُرجِع نص الاستجابة (text) فقط
     - يرفض بـ Error عربي واضح عند أي مشكلة
     - لا يُسجِّل المفتاح ولا الاستجابة في console
     ============================================ */
  async callGemini(prompt, responseSchema, options = {}) {
    const apiKey = this.getKey();
    if (!apiKey) {
      const err = new Error(
        'لم يُعثر على مفتاح Gemini — أضف المفتاح من قسم "إعداد الذكاء الاصطناعي" بالأعلى'
      );
      err.code = 'NO_KEY';
      throw err;
    }

    const maxTokens = options.maxTokens || this.MAX_OUTPUT_TOKENS;

    const generationConfig = {
      temperature: 0.75,
      topP: 0.95,
      maxOutputTokens: maxTokens,
      responseMimeType: 'application/json',
      responseSchema: responseSchema || undefined,
      // تعطيل "التفكير" في موديل 2.5 لتسريع الاستجابة وتوفير التوكنز
      thinkingConfig: { thinkingBudget: 0 }
    };

    let res;
    try {
      res = await fetch(this.ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig
        })
      });
    } catch (netErr) {
      const err = new Error(
        'تعذر الاتصال بالإنترنت — تحقق من اتصالك ثم أعد المحاولة'
      );
      err.code = 'NETWORK';
      throw err;
    }

    if (!res.ok) {
      let raw = '';
      try {
        raw = await res.text();
      } catch (_) {
        raw = '';
      }
      const msg = this.mapHttpError(res.status, raw);
      const err = new Error(msg);
      err.code = 'HTTP_' + res.status;
      throw err;
    }

    let data;
    try {
      data = await res.json();
    } catch (_) {
      const err = new Error('استجابة غير صالحة من Gemini — جرّب إعادة التوليد');
      err.code = 'BAD_JSON';
      throw err;
    }

    const candidate = data && data.candidates && data.candidates[0];
    if (!candidate) {
      const blockReason =
        (data && data.promptFeedback && data.promptFeedback.blockReason) || '';
      const err = new Error(
        blockReason
          ? 'حُجب الطلب من Gemini: ' + String(blockReason) + ' — جرّب تعديل المحتوى'
          : 'استجابة فارغة من Gemini — جرّب إعادة التوليد'
      );
      err.code = 'EMPTY';
      throw err;
    }

    const finishReason = candidate.finishReason || '';
    if (finishReason === 'SAFETY') {
      const err = new Error('حُجب الطلب بسبب قيود الأمان — عدّل تعليماتك وأعد المحاولة');
      err.code = 'SAFETY';
      throw err;
    }
    if (finishReason === 'MAX_TOKENS') {
      // ليس خطأ قاتلًا — نُكمل بالقدر المتاح
    }

    const parts = (candidate.content && candidate.content.parts) || [];
    const text = parts
      .map((p) => p && p.text ? p.text : '')
      .join('')
      .trim();

    if (!text) {
      const err = new Error('استجابة فارغة من Gemini — جرّب تعديل الموضوع أو إعادة التوليد');
      err.code = 'EMPTY_TEXT';
      throw err;
    }

    return text;
  },

  /* ============================================
     اختبار الاتصال — استدعاء صغير للتحقق من صلاحية المفتاح
     ============================================ */
  async testConnection() {
    const apiKey = this.getKey();
    if (!apiKey) {
      return {
        ok: false,
        msg: 'لا يوجد مفتاح محفوظ — أدخل المفتاح أولًا ثم اضغط "حفظ المفتاح"'
      };
    }

    try {
      const res = await fetch(this.ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'OK' }] }],
          generationConfig: { maxOutputTokens: 4, temperature: 0 }
        })
      });

      if (res.ok) {
        return { ok: true, msg: 'تم الاتصال بـ Gemini بنجاح — المفتاح صالح ومُفعّل' };
      }

      let raw = '';
      try {
        raw = await res.text();
      } catch (_) {
        raw = '';
      }
      return { ok: false, msg: this.mapHttpError(res.status, raw) };
    } catch (e) {
      return {
        ok: false,
        msg: 'تعذر الاتصال بالإنترنت — تحقق من اتصالك ثم أعد المحاولة'
      };
    }
  },

  /* ============================================
     تحويل أخطاء HTTP إلى رسائل عربية واضحة
     لا نُظهِر النص الخام من Gemini (قد يكشف معلومات حساسة)
     ============================================ */
  mapHttpError(status, raw) {
    switch (status) {
      case 400:
        return 'طلب غير صالح إلى Gemini — تحقق من إعدادات الأسئلة وحاول مرة أخرى';
      case 401:
        return 'مفتاح Gemini غير صحيح أو منتهي الصلاحية — تحقق من المفتاح وأعد إدخاله';
      case 403:
        return 'المفتاح لا يملك صلاحية الوصول إلى هذا النموذج — راجع صلاحيات المفتاح في Google AI Studio';
      case 404:
        return 'نموذج Gemini المطلوب غير متوفر حاليًا — حاول لاحقًا';
      case 429:
        return 'تم تجاوز الحد المسموح من Gemini — انتظر قليلًا ثم أعد المحاولة';
      case 500:
      case 502:
      case 503:
        return 'خطأ مؤقت في خوادم Gemini — جرّب بعد قليل';
      default:
        return 'تعذر الاتصال بـ Gemini (كود ' + status + ') — حاول مرة أخرى';
    }
  },

  /* ============================================
     استخراج JSON من نص الاستجابة بأمان
     ============================================ */
  parseJsonSafe(text) {
    if (!text) return null;
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
};

window.GeminiKey = GeminiKey;

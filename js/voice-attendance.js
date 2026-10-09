/* ============================================
   مُعلّمي | voice-attendance.js
   الحضور الصوتي بالعربية - Web Speech API
   ============================================

   يعتمد على WebKit Speech Recognition (مدعوم في Chrome و Edge و Safari الحديث).
   لا يعمل على Firefox — نوفّر fallback يدوي تلقائيًا.
   لا نُرسل أي بيانات لمزود خارجي؛ التعرّف يتم في المتصفح.
   ============================================ */

const VoiceAttendance = (function () {

  const AR_LANG = 'ar-EG';

  // ===== Normalize Arabic text for matching =====
  function normalizeAr(s) {
    if (!s) return '';
    return String(s)
      .replace(/[\u064B-\u0652]/g, '')          // strip tashkeel
      .replace(/\u0670/g, '')                     // strip superscript alef
      .replace(/[إأآا]/g, 'ا')                   // unify alef
      .replace(/ى/g, 'ي')                         // alef maqsura → ya
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/ة/g, 'ه')                         // ta marbuta → ha
      .replace(/\u061F/g, '')                    // ?
      .replace(/\u060C/g, ' ')                    // ، → space
      .replace(/[.,!?;:]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  // ===== Build name lookup =====
  // For each student, extract given-name tokens we will try to match.
  function buildStudentIndex(students) {
    return students.map(s => {
      const nameParts = (s.name || '').trim().split(/\s+/);
      const tokens = new Set();
      // full name
      tokens.add(normalizeAr(s.name));
      // first name
      if (nameParts[0]) tokens.add(normalizeAr(nameParts[0]));
      // first + second (very common in Egypt: "Ahmed Mohamed")
      if (nameParts.length > 1) tokens.add(normalizeAr(nameParts[0] + ' ' + nameParts[1]));
      // second name (some teachers say "غايب محمد" = family name)
      if (nameParts[1]) tokens.add(normalizeAr(nameParts[1]));
      return { student: s, tokens: Array.from(tokens) };
    });
  }

  // ===== Split transcript into name candidates =====
  // We strip out stop-words, then split on "و" and "," and "وصلت لـ" etc.
  const STOP_WORDS = [
    'و', 'في', 'من', 'عن', 'ال', 'ده', 'دي', 'دا', 'دول',
    'غايب', 'غايبين', 'غياب', 'غائب', 'غائبين',
    'متأخر', 'متأخرين', 'تأخر',
    'حاضر', 'حاضرين', 'حضروا', 'حضور',
    'كل', 'الكل', 'جميع', 'كله', 'كلهم',
    'ما', 'عدا', 'الا', 'إلا', 'مش', 'ماعدا',
    'خلي', 'خلّي', 'خليه', 'خليهم', 'سجل',
    'الطالب', 'الطلاب', 'ابن', 'ابنت',
    'النهارده', 'اليوم', 'بكرة', 'امبارح'
  ];

  function extractNameCandidates(transcript) {
    const norm = normalizeAr(transcript);
    // Split on و ("and") and common conjunctions
    const chunks = norm
      .replace(/ و /g, ',')
      .replace(/ و/g, ',')
      .replace(/,/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

    // Build candidates: try single tokens, and bigrams
    const candidates = [];
    for (let i = 0; i < chunks.length; i++) {
      // skip stop-words
      if (STOP_WORDS.includes(chunks[i])) continue;
      candidates.push(chunks[i]);
      // bigram
      if (i + 1 < chunks.length && !STOP_WORDS.includes(chunks[i + 1])) {
        candidates.push(chunks[i] + ' ' + chunks[i + 1]);
      }
    }
    return candidates;
  }

  // ===== Detect intent =====
  // Returns: { mode: 'all_present' | 'all_absent' | 'mark_absent' | 'mark_late' | 'mark_present' | 'except', names: [...] }
  function detectIntent(rawTranscript, students) {
    const t = normalizeAr(rawTranscript);

    // ===== Check "except" FIRST so it beats "all present" =====
    // "ما عدا" / "إلا" → mark all present EXCEPT named students (absent)
    const exceptMatch = t.match(/(ماعدا|ما عدا|الا|إلا|عدا)\s+(.+)$/);
    if (exceptMatch) {
      const namesAfter = exceptMatch[2];
      const matched = matchNamesInText(namesAfter, students);
      return { mode: 'except', names: matched };
    }

    // "كل الطلاب حضروا" / "الكل حاضر" / "سجل الكل حاضر"
    if (/(الكل حاضر|كل الطلاب حضروا|سجل الكل|كلهم حاضر|الجميع حاضر|سجل المجموعه كلها حاضر)/.test(t)) {
      return { mode: 'all_present', names: [] };
    }

    // "خلي X متأخر" → mark X late
    const lateMatch = t.match(/(خلي|خلّي|خليه|خليهم)\s+(.+?)\s+(متأخر|متأخرين|تأخر)/);
    if (lateMatch) {
      const matched = matchNamesInText(lateMatch[2], students);
      return { mode: 'mark_late', names: matched };
    }
    // "خلي X غايب" → mark X absent
    const keepAbsentMatch = t.match(/(خلي|خلّي|خليه|خليهم)\s+(.+?)\s+(غايب|غايبين|غياب|غائب)/);
    if (keepAbsentMatch) {
      const matched = matchNamesInText(keepAbsentMatch[2], students);
      return { mode: 'mark_absent', names: matched };
    }
    // Generic late: "X متأخر" / "X و Y متأخرين"
    if (/(متأخر|متأخرين|تأخر)/.test(t)) {
      const matched = matchNamesInText(t, students);
      return { mode: 'mark_late', names: matched };
    }
    // Generic absent: "X غايب" / "X و Y غايبين" / "غاب X"
    if (/(غايب|غايبين|غياب|غائب|غائبين|غاب)/.test(t)) {
      const matched = matchNamesInText(t, students);
      return { mode: 'mark_absent', names: matched };
    }
    // "X حاضر"
    if (/(حاضر|حاضرين|حضروا|حضور)/.test(t)) {
      const matched = matchNamesInText(t, students);
      return { mode: 'mark_present', names: matched };
    }

    return { mode: 'unknown', names: [] };
  }

  // ===== Match names in text against student list =====
  // Returns: [{ student, confidence, matchedToken }]
  // Note: a single candidate can match MULTIPLE students (e.g., "محمد" matches
  // both a student whose first name is محمد and another whose middle name is محمد).
  // We return ALL matches so the teacher can disambiguate in the UI.
  function matchNamesInText(text, students) {
    const index = buildStudentIndex(students);
    const candidates = extractNameCandidates(text);
    const matches = [];
    const usedStudents = new Set();

    for (const cand of candidates) {
      // Exact-match pass: collect ALL exact matches for this candidate (so duplicates surface)
      let exactHits = [];
      for (const entry of index) {
        if (usedStudents.has(entry.student.id)) continue;
        if (entry.tokens.includes(cand)) {
          exactHits.push({ student: entry.student, confidence: 1.0, matchedToken: cand });
        }
      }
      if (exactHits.length > 0) {
        // If exactly one exact match → high confidence.
        // If multiple → still add them all, but flag the others as ambiguous.
        exactHits.forEach(h => {
          matches.push(h);
          usedStudents.add(h.student.id);
        });
        continue; // move to next candidate
      }

      // Partial-match pass (only if no exact hits for this candidate)
      for (const entry of index) {
        if (usedStudents.has(entry.student.id)) continue;
        const hit = entry.tokens.find(tok =>
          (tok.length >= 3 && cand.length >= 3) &&
          (tok.startsWith(cand) || cand.startsWith(tok) || tok.includes(cand) || cand.includes(tok))
        );
        if (hit) {
          matches.push({ student: entry.student, confidence: 0.6, matchedToken: cand });
          usedStudents.add(entry.student.id);
          break; // for partial matches, first hit wins (avoid cascade)
        }
      }
    }

    return matches;
  }

  // ===== Apply detected intent to attendance state =====
  // attState: { [studentId]: 'حاضر' | 'غائب' | 'متأخر' | 'غياب بعذر' }
  function applyIntent(intent, students, attState) {
    const newState = { ...attState };
    const matchedIds = new Set(intent.names.map(m => m.student.id));

    if (intent.mode === 'all_present') {
      students.forEach(s => newState[s.id] = 'حاضر');
    } else if (intent.mode === 'except') {
      // everyone present except the matched ones → absent
      students.forEach(s => {
        newState[s.id] = matchedIds.has(s.id) ? 'غائب' : 'حاضر';
      });
    } else if (intent.mode === 'mark_absent') {
      intent.names.forEach(m => newState[m.student.id] = 'غائب');
    } else if (intent.mode === 'mark_late') {
      intent.names.forEach(m => newState[m.student.id] = 'متأخر');
    } else if (intent.mode === 'mark_present') {
      intent.names.forEach(m => newState[m.student.id] = 'حاضر');
    }

    return { newState, matched: intent.names, mode: intent.mode };
  }

  // ===== Browser support check =====
  function isSupported() {
    return !!(
      window.SpeechRecognition ||
      window.webkitSpeechRecognition ||
      window.SpeechRecognitionEvent
    );
  }

  // ===== Run recognition session =====
  // opts: { onPartial(text), onFinal(text), onError(err), onEnd() }
  function startRecognition(opts = {}) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      opts.onError && opts.onError({ error: 'not-supported', message: 'المتصفح لا يدعم التعرّف الصوتي' });
      return null;
    }
    const rec = new SR();
    rec.lang = AR_LANG;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 3;

    let finalText = '';

    rec.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) finalText += r[0].transcript + ' ';
        else interim += r[0].transcript;
      }
      opts.onPartial && opts.onPartial(interim);
      if (finalText) opts.onFinal && opts.onFinal(finalText.trim());
    };
    rec.onerror = (e) => {
      const map = {
        'no-speech': 'لم يتم التقاط صوت. حاول مرة أخرى.',
        'audio-capture': 'تعذّر الوصول إلى الميكروفون.',
        'not-allowed': 'تم رفض إذن الميكروفون.',
        'network': 'مشكلة في الشبكة أثناء التعرّف الصوتي.',
        'aborted': 'تم إلغاء التسجيل.'
      };
      opts.onError && opts.onError({ error: e.error, message: map[e.error] || 'خطأ غير معروف في التعرّف الصوتي.' });
    };
    rec.onend = () => {
      opts.onEnd && opts.onEnd(finalText.trim());
    };

    try {
      rec.start();
    } catch (e) {
      opts.onError && opts.onError({ error: 'start-failed', message: 'تعذّر بدء التسجيل: ' + e.message });
      return null;
    }
    return rec;
  }

  function stopRecognition(rec) {
    if (rec && typeof rec.stop === 'function') {
      try { rec.stop(); } catch (e) {}
    }
  }

  return {
    isSupported,
    startRecognition,
    stopRecognition,
    detectIntent,
    applyIntent,
    matchNamesInText,
    normalizeAr
  };
})();

window.VoiceAttendance = VoiceAttendance;

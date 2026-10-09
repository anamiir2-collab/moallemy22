/* ============================================
   مُعلّمي | whatsapp-templates.js
   قوالب الرسائل + التحقق من الأرقام المصرية + فتح واتساب
   ============================================ */

const WhatsAppTemplates = (function () {

  // Default templates use {placeholders} that will be replaced.
  // Lines that become empty after substitution are stripped out.
  const DEFAULT_ABSENT =
`السلام عليكم ورحمة الله وبركاته،
نود إبلاغ حضرتكم بأن الطالب {studentName} لم يحضر حصة اليوم بتاريخ {date}.
المجموعة: {groupName}
الدرس: {lessonTopic}
نرجو الاطمئنان على الطالب، وشكرًا لثقتكم بنا.`;

  const DEFAULT_OVERDUE =
`السلام عليكم،
نود تذكير حضرتكم بأن هناك مبلغًا مستحقًا للطالب {studentName} بقيمة {amount} جنيه، وتاريخ الاستحقاق {dueDate}.
المبلغ المتبقي: {remaining} جنيه.
شكرًا لتعاونكم.`;

  const DEFAULT_REPORT =
`تقرير الطالب: {studentName}
الحضور: {attendance}%
متوسط الاختبارات: {examAvg}%
الواجبات المنجزة: {homeworkDone}
مع تحيات أ/ {teacherName}`;

  // ===== Phone validation =====
  // Accepts Egyptian formats: 01XXXXXXXXX (11 digits), +20..., 20...
  function validatePhone(raw) {
    if (!raw) return null;
    let digits = String(raw).replace(/[^\d+]/g, '');
    if (!digits) return null;
    if (digits.startsWith('+')) digits = digits.slice(1);

    // Egyptian number with country code: 20 + 10 digits = 12 chars total
    if (digits.startsWith('20') && digits.length === 12) {
      const local = digits.slice(2);
      // Valid Egyptian mobile prefixes: 010, 011, 012, 015
      if (!/^1[0125]\d{8}$/.test(local)) return null;
      return {
        international: digits,
        local: '0' + local,
        formatted: '+20 ' + local.slice(0, 3) + ' ' + local.slice(3, 6) + ' ' + local.slice(6)
      };
    }
    // Local Egyptian mobile: 01XXXXXXXXX (11 chars)
    if (digits.length === 11 && /^01[0125]\d{8}$/.test(digits)) {
      const intl = '20' + digits.slice(1);
      return {
        international: intl,
        local: digits,
        formatted: '+' + intl.slice(0, 2) + ' ' + digits.slice(1, 4) + ' ' + digits.slice(4, 7) + ' ' + digits.slice(7)
      };
    }
    return null;
  }

  // ===== Fill template placeholders =====
  // After substitution, drop any line that is now empty (or only whitespace after label like "الدرس: ")
  function fill(template, vars) {
    if (!template) return '';
    const replaced = template.replace(/\{(\w+)\}/g, (m, key) => {
      const v = vars[key];
      return (v === undefined || v === null) ? '' : String(v);
    });
    // Remove lines whose only content is a "Label: " with nothing after it
    const cleaned = replaced
      .split('\n')
      .map(line => {
        const trimmed = line.trim();
        // Pattern: "<arabic label>: " with empty value
        if (/^[\u0600-\u06FF\w\s\u060C]+:\s*$/.test(trimmed)) return null;
        return line;
      })
      .filter(line => line !== null)
      .join('\n')
      // Collapse 3+ newlines to 2
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return cleaned;
  }

  function fillAbsent(template, vars) { return fill(template, vars); }
  function fillOverdue(template, vars) { return fill(template, vars); }
  function fillReport(template, vars) { return fill(template, vars); }

  // ===== Open WhatsApp click-to-chat =====
  // NEVER auto-send; just opens WhatsApp with prefilled text.
  // Does NOT mark the message as "sent" or "delivered" — the teacher must
  // manually press send inside WhatsApp to actually deliver it.
  function openWhatsApp(internationalNumber, message) {
    if (!internationalNumber) return false;
    const url = `https://wa.me/${internationalNumber}?text=${encodeURIComponent(message || '')}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  }

  return {
    defaultAbsent: DEFAULT_ABSENT,
    defaultOverdue: DEFAULT_OVERDUE,
    defaultReport: DEFAULT_REPORT,
    validatePhone,
    fillAbsent,
    fillOverdue,
    fillReport,
    openWhatsApp,
    fill
  };
})();

window.WhatsAppTemplates = WhatsAppTemplates;

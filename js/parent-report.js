/* ============================================
   مُعلّمي | parent-report.js
   تقرير ولي الأمر الاحترافي
   - الخصوصية أولًا: لا بيانات طلاب آخرين، لا ترتيب، لا ملاحظات داخلية، لا بيانات مالية
   - المدرس صاحب القرار: النص قابل للتعديل قبل الحفظ أو الإرسال
   - واتساب: معاينة + نسخ + فتح واتساب فقط بعد تأكيد المدرس
   - طباعة: ورقة A4 مستقلة RTL بدون واجهة التطبيق
   ============================================ */

const ParentReport = {
  lastState: null, // { studentId, text, period, style, include }

  /**
   * نقطة الدخول: نافذة تجهيز تقرير ولي الأمر
   */
  open(studentId, options = {}) {
    const s = Storage.find(Storage.KEYS.students, studentId);
    if (!s) return;
    if (!s.parentPhone) {
      UI.toast('لا يوجد رقم لولي الأمر - يمكن المعاينة والطباعة فقط', 'warning', 3500);
    }

    const settings = Storage.get(Storage.KEYS.settings, {});
    const period = options.period || '30';
    const style = options.style || settings.reportStyle || 'متوسط';
    const include = options.include || { attendance: true, grades: true, assignments: true, recommendations: true };

    // توليد أول نسخة
    const generated = AI.generateParentReport(studentId, { periodDays: parseInt(period), style, include });
    if (!generated) { UI.toast('تعذر تجهيز التقرير', 'error'); return; }

    UI.modal({
      title: 'تقرير ولي الأمر',
      size: 'large',
      body: `
        <div class="report-setup">
          <div class="field-row">
            <div class="field">
              <label>الفترة</label>
              <select id="pr-period">
                <option value="7" ${period === '7' ? 'selected' : ''}>آخر أسبوع</option>
                <option value="30" ${period === '30' ? 'selected' : ''}>آخر 30 يومًا</option>
                <option value="90" ${period === '90' ? 'selected' : ''}>آخر 3 أشهر</option>
                <option value="0" ${period === '0' ? 'selected' : ''}>كل الفترة المتاحة</option>
              </select>
            </div>
            <div class="field">
              <label>القالب</label>
              <select id="pr-style">
                <option value="مختصر" ${style === 'مختصر' ? 'selected' : ''}>مختصر</option>
                <option value="متوسط" ${style === 'متوسط' ? 'selected' : ''}>احترافي (متوسط)</option>
                <option value="مفصل" ${style === 'مفصل' ? 'selected' : ''}>مفصل</option>
              </select>
            </div>
          </div>

          <div style="display:flex; gap: var(--space-3); flex-wrap:wrap; margin-bottom: var(--space-3); font-size: var(--font-size-sm);">
            <label style="display:flex; align-items:center; gap:6px;"><input type="checkbox" id="pr-att" ${include.attendance ? 'checked' : ''}> الحضور</label>
            <label style="display:flex; align-items:center; gap:6px;"><input type="checkbox" id="pr-grades" ${include.grades ? 'checked' : ''}> الدرجات</label>
            <label style="display:flex; align-items:center; gap:6px;"><input type="checkbox" id="pr-assign" ${include.assignments ? 'checked' : ''}> الواجبات</label>
            <label style="display:flex; align-items:center; gap:6px;"><input type="checkbox" id="pr-recs" ${include.recommendations ? 'checked' : ''}> التوصيات</label>
          </div>

          <div class="alert alert-info" style="margin-bottom: var(--space-3); padding: var(--space-3);">
            <div class="alert-icon">${Icons.get('shield', 18)}</div>
            <div class="alert-body" style="font-size: var(--font-size-xs);">
              هذا التقرير خاص بولي أمر الطالب فقط: لا يعرض بيانات طلاب آخرين أو ترتيبًا أو ملاحظات داخلية أو بيانات مالية.
              <strong>النص قابل للتعديل</strong> - المدرس صاحب القرار قبل الحفظ أو الإرسال.
            </div>
          </div>
        </div>

        <div class="field">
          <label>نص التقرير (قابل للتعديل)</label>
          <textarea id="pr-text" rows="14" style="min-height: 240px; font-size: var(--font-size-sm); line-height: 1.8;"></textarea>
          <div id="pr-meta" style="font-size: var(--font-size-xs); color: var(--text-tertiary); margin-top: 6px;"></div>
        </div>

        <div class="action-row" style="margin-top: var(--space-4); flex-wrap: wrap;">
          <button class="btn btn-outline btn-sm" id="pr-regenerate" style="flex:1;">${Icons.get('refresh', 16)} إعادة التوليد</button>
          <button class="btn btn-outline btn-sm" id="pr-copy" style="flex:1;">${Icons.get('copy', 16)} نسخ</button>
          <button class="btn btn-outline btn-sm" id="pr-print" style="flex:1;">${Icons.get('print', 16)} طباعة / PDF</button>
          <button class="btn btn-whatsapp btn-sm" id="pr-whatsapp" style="flex:1;">${Icons.get('whatsapp', 16)} واتساب</button>
          <button class="btn btn-primary btn-sm" id="pr-save" style="flex:1;">${Icons.get('check', 16)} حفظ بالسجل</button>
        </div>
      `
    });

    // تعبئة النص
    const textEl = document.getElementById('pr-text');
    textEl.value = generated.text;
    this.updateMeta(generated);

    // حفظ الحالة
    this.lastState = { studentId, period, style, include, text: generated.text };

    // ربط الأحداث
    document.getElementById('pr-regenerate').addEventListener('click', () => {
      const period2 = document.getElementById('pr-period').value;
      const style2 = document.getElementById('pr-style').value;
      const include2 = {
        attendance: document.getElementById('pr-att').checked,
        grades: document.getElementById('pr-grades').checked,
        assignments: document.getElementById('pr-assign').checked,
        recommendations: document.getElementById('pr-recs').checked
      };
      const gen = AI.generateParentReport(studentId, { periodDays: parseInt(period2), style: style2, include: include2 });
      if (gen) {
        textEl.value = gen.text;
        this.lastState = { studentId, period: period2, style: style2, include: include2, text: gen.text };
        this.updateMeta(gen);
        UI.toast('تم توليد نسخة جديدة', 'success', 1500);
      }
    });

    document.getElementById('pr-copy').addEventListener('click', async () => {
      const ok = await Utils.copyText(textEl.value);
      UI.toast(ok ? 'تم نسخ التقرير' : 'تعذر النسخ', ok ? 'success' : 'error');
    });

    document.getElementById('pr-print').addEventListener('click', () => {
      this.print(studentId, textEl.value);
    });

    document.getElementById('pr-whatsapp').addEventListener('click', () => {
      this.previewWhatsapp(studentId, textEl.value);
    });

    document.getElementById('pr-save').addEventListener('click', () => {
      const saved = Storage.insert(Storage.KEYS.reports, {
        studentId,
        groupId: s.groupId || null,
        type: 'ولي أمر',
        title: `تقرير ولي الأمر - ${s.name}`,
        period: document.getElementById('pr-period').value,
        content: textEl.value,
        aiGenerated: true,
        version: 1
      });
      Storage.audit('حفظ تقرير ولي أمر', s.name);
      UI.toast('تم حفظ التقرير في السجل', 'success');
      Notifications.add('report', 'تقرير محفوظ', `تم حفظ تقرير ولي أمر للطالب ${s.name}`, saved.id);
    });
  },

  updateMeta(generated) {
    const el = document.getElementById('pr-meta');
    if (!el || !generated) return;
    el.textContent = `مبني على: ${generated.dataUsed.grades} درجة، ${generated.dataUsed.attendance} سجل حضور، ${generated.dataUsed.assignments} واجب - تم التوليد ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;
  },

  /**
   * معاينة واتساب: تأكيد صريح قبل فتح wa.me - لا إرسال تلقائي أبدًا
   */
  previewWhatsapp(studentId, text) {
    const s = Storage.find(Storage.KEYS.students, studentId);
    if (!s) return;
    if (!s.parentPhone) {
      UI.toast('لا يوجد رقم لولي الأمر - استخدم النسخ أو الطباعة', 'warning');
      return;
    }

    const phone = String(s.parentPhone).replace(/^0/, '20');

    UI.modal({
      title: 'معاينة الإرسال عبر WhatsApp',
      body: `
        <div style="display:flex; align-items:center; gap: var(--space-3); margin-bottom: var(--space-3);">
          <div class="avatar avatar-lg">${Utils.escapeHTML(UI.initials(s.name))}</div>
          <div>
            <div style="font-weight:700;">${Utils.escapeHTML(s.parentName || 'ولي أمر الطالب')}</div>
            <div style="font-size:var(--font-size-sm); color:var(--text-tertiary); direction:ltr; text-align:right;">+${Utils.escapeHTML(phone)}</div>
          </div>
        </div>

        <div class="whatsapp-preview">${Utils.escapeHTML(text).replace(/\n/g, '<br>')}</div>

        <p style="font-size:var(--font-size-xs); color:var(--text-tertiary); margin: var(--space-3) 0;">
          سيتفتح WhatsApp برسالة جاهزة - راجع النص أعلاه ثم أكد الإرسال. لا يتم الإرسال تلقائيًا أبدًا.
        </p>

        <div class="action-row">
          <button class="btn btn-secondary" id="prw-copy" style="flex:1;">${Icons.get('copy', 16)} نسخ النص فقط</button>
          <button class="btn btn-whatsapp" id="prw-send" style="flex:1;">${Icons.get('whatsapp', 16)} تأكيد وفتح واتساب</button>
        </div>
      `
    });

    document.getElementById('prw-copy').addEventListener('click', async () => {
      const ok = await Utils.copyText(text);
      UI.toast(ok ? 'تم نسخ النص' : 'تعذر النسخ', ok ? 'success' : 'error');
    });

    document.getElementById('prw-send').addEventListener('click', () => {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
      UI.toast('تم فتح واتساب - أكمل الإرسال من هناك', 'success');
    });
  },

  /**
   * طباعة A4 نظيفة: نافذة مستقلة بتنسيق تقرير رسمي
   */
  print(studentId, text) {
    const s = Storage.find(Storage.KEYS.students, studentId);
    if (!s) return;
    const settings = Storage.get(Storage.KEYS.settings, {});
    const teacher = Auth.getTeacher() || {};
    const color = settings.reportColor || '#8B5E34';

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>تقرير - ${Utils.escapeHTML(s.name)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Cairo', 'Tajawal', 'Segoe UI', Tahoma, sans-serif;
    color: #1f1b16;
    background: #fff;
    padding: 40px 48px;
    max-width: 210mm;
    margin: 0 auto;
    line-height: 1.9;
    font-size: 13pt;
  }
  .report-head {
    display: flex; justify-content: space-between; align-items: flex-start;
    border-bottom: 3px solid ${color};
    padding-bottom: 16px; margin-bottom: 24px;
  }
  .report-brand h1 { font-size: 20pt; color: ${color}; margin-bottom: 2px; }
  .report-brand p { font-size: 10pt; color: #777; }
  .report-meta { text-align: left; font-size: 10pt; color: #555; line-height: 1.7; }
  .report-title {
    text-align: center; font-size: 16pt; font-weight: 800;
    margin: 8px 0 20px; color: ${color};
  }
  .student-line {
    background: #faf6f0; border: 1px solid ${color}33; border-radius: 8px;
    padding: 10px 16px; margin-bottom: 20px; font-size: 11pt;
  }
  .report-body { white-space: pre-wrap; text-align: right; }
  .report-footer {
    margin-top: 36px; padding-top: 14px; border-top: 1px solid #ddd;
    display: flex; justify-content: space-between; align-items: flex-end; font-size: 10pt; color: #666;
  }
  .signature { text-align: center; }
  .signature .name { font-weight: 700; color: #1f1b16; font-size: 12pt; }
  .page-num { text-align: center; font-size: 9pt; color: #999; margin-top: 24px; }
  @page { size: A4; margin: 12mm; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="report-head">
    <div class="report-brand">
      <h1>مُعلّمي</h1>
      <p>${settings.reportCenter ? Utils.escapeHTML(settings.reportCenter) : 'تقرير متابعة تعليمي'}</p>
    </div>
    <div class="report-meta">
      <div>التاريخ: ${UI.formatDate(Utils.today())}</div>
      ${settings.reportPhone ? `<div>هاتف: <span dir="ltr">${Utils.escapeHTML(settings.reportPhone)}</span></div>` : ''}
      ${settings.reportEmail ? `<div>${Utils.escapeHTML(settings.reportEmail)}</div>` : ''}
    </div>
  </div>

  <div class="report-title">تقرير متابعة الطالب</div>

  <div class="student-line">
    <strong>الطالب:</strong> ${Utils.escapeHTML(s.name)}
    &nbsp;|&nbsp; <strong>الصف:</strong> ${Utils.escapeHTML(s.className || '—')}
    &nbsp;|&nbsp; <strong>المادة:</strong> ${Utils.escapeHTML(s.subject || '—')}
  </div>

  <div class="report-body">${Utils.escapeHTML(text)}</div>

  <div class="report-footer">
    <div>${settings.reportSignature ? Utils.escapeHTML(settings.reportSignature) : ''}</div>
    <div class="signature">
      <div class="name">أ/ ${Utils.escapeHTML(teacher.name || '')}</div>
      <div>التوقيع</div>
    </div>
  </div>
</body>
</html>`;

    // فتح نافذة الطباعة
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) {
      UI.toast('متصفحك منع فتح نافذة الطباعة - اسمح بالنوافذ المنبثقة', 'error', 4000);
      return;
    }
    w.document.write(html);
    w.document.close();
    w.onload = () => setTimeout(() => w.print(), 400);
  }
};

window.ParentReport = ParentReport;

/* ============================================
   مُعلّمي | settings.js
   الإعدادات: الحساب + المظهر + التعليمية + التقارير + أوزان الأداء
              + النسخ الاحتياطي (عبر Backup) + الأمان + سجل النشاط
   ============================================ */

const Settings = {
  render() {
    const teacher = Auth.getTeacher() || {};
    const settings = Storage.get(Storage.KEYS.settings, {});
    const subjects = Storage.get(Storage.KEYS.subjects, []);
    const stages = Storage.get(Storage.KEYS.stages, []);
    const students = Storage.list(Storage.KEYS.students);
    const groups = Storage.list(Storage.KEYS.groups);
    const isDemo = Storage.isDemoMode();

    return `
      <div class="page-header">
        <h1 class="page-title">الإعدادات</h1>
      </div>

      ${isDemo ? `
        <div class="alert alert-warning" style="margin-bottom: var(--space-4);">
          <div class="alert-icon">${Icons.get('warn', 20)}</div>
          <div class="alert-body">
            <strong>وضع تجريبي مفعّل</strong>
            البيانات الحالية تجريبية. يمكنك مسحها من قسم النسخ الاحتياطي.
          </div>
        </div>
      ` : ''}

      <div class="section">
        <h2 class="section-title" style="margin-bottom: var(--space-3);">الحساب</h2>
        <div class="card" style="margin-bottom: var(--space-3);">
          <div style="display:flex; align-items:center; gap: var(--space-3);">
            <div class="avatar avatar-lg" style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));">${Utils.escapeHTML(UI.initials(teacher.name || 'م'))}</div>
            <div style="flex:1;">
              <h3 style="font-weight: 700;">${Utils.escapeHTML(teacher.name || '—')}</h3>
              <p style="color: var(--text-secondary); font-size: var(--font-size-sm);">${Utils.escapeHTML(teacher.subject || '')}</p>
              <p style="color: var(--text-tertiary); font-size: var(--font-size-xs); direction: ltr; text-align: right;">${Utils.escapeHTML(teacher.phone || '')}</p>
            </div>
          </div>
          <button class="btn btn-outline btn-block" style="margin-top: var(--space-3);" onclick="Settings.openProfileForm()">تعديل بيانات الحساب</button>
        </div>
      </div>

      <div class="section">
        <h2 class="section-title" style="margin-bottom: var(--space-3);">المظهر</h2>
        <div class="settings-row" onclick="Settings.toggleTheme()">
          <div class="settings-icon">${Icons.get('moon', 20)}</div>
          <div class="settings-body">
            <div class="settings-title">الوضع الداكن</div>
            <div class="settings-desc">${settings.theme === 'dark' ? 'مفعّل' : 'غير مفعّل'}</div>
          </div>
          <label class="switch" onclick="event.stopPropagation();">
            <input type="checkbox" id="theme-toggle" ${settings.theme === 'dark' ? 'checked' : ''}>
            <span class="switch-slider"></span>
          </label>
        </div>
      </div>

      <div class="section">
        <h2 class="section-title" style="margin-bottom: var(--space-3);">الإعدادات التعليمية</h2>
        <div class="settings-row" onclick="Settings.openSubjectsManager()">
          <div class="settings-icon">${Icons.get('book', 20)}</div>
          <div class="settings-body">
            <div class="settings-title">المواد الدراسية</div>
            <div class="settings-desc">${subjects.length} مادة</div>
          </div>
          ${Icons.get('forward', 20)}
        </div>
        <div class="settings-row" onclick="Settings.openStagesManager()">
          <div class="settings-icon">${Icons.get('award', 20)}</div>
          <div class="settings-body">
            <div class="settings-title">المراحل والصفوف</div>
            <div class="settings-desc">${stages.length} مراحل</div>
          </div>
          ${Icons.get('forward', 20)}
        </div>
        <div class="settings-row" onclick="Settings.openThresholdForm()">
          <div class="settings-icon">${Icons.get('warn', 20)}</div>
          <div class="settings-body">
            <div class="settings-title">حد تنبيه الغياب</div>
            <div class="settings-desc">${settings.absenceAlertThreshold || 3} حصص متتالية</div>
          </div>
          ${Icons.get('forward', 20)}
        </div>
        <div class="settings-row" onclick="Settings.openWeightsForm()">
          <div class="settings-icon">${Icons.get('chart', 20)}</div>
          <div class="settings-body">
            <div class="settings-title">أوزان حساب الأداء</div>
            <div class="settings-desc">اختبارات ${settings.weights?.exams ?? 50}% • واجبات ${settings.weights?.assignments ?? 20}% • حضور ${settings.weights?.attendance ?? 10}% • مستمر ${settings.weights?.continuous ?? 20}%</div>
          </div>
          ${Icons.get('forward', 20)}
        </div>
      </div>

      <div class="section">
        <h2 class="section-title" style="margin-bottom: var(--space-3);">إعدادات التقارير والتحليل الذكي</h2>
        <div class="settings-row" onclick="Settings.openReportSettings()">
          <div class="settings-icon">${Icons.get('file', 20)}</div>
          <div class="settings-body">
            <div class="settings-title">بيانات التقرير والتوقيع</div>
            <div class="settings-desc">${settings.reportCenter ? Utils.escapeHTML(settings.reportCenter) : 'لم يتم إدخال اسم المركز'} • ${settings.aiEnabled !== false ? 'التحليل الذكي مفعّل' : 'التحليل الذكي معطل'}</div>
          </div>
          ${Icons.get('forward', 20)}
        </div>
      </div>

      <div class="section" id="backup-section">
        <h2 class="section-title" style="margin-bottom: var(--space-3);">النسخ الاحتياطي والبيانات</h2>
        <p style="font-size: var(--font-size-xs); color: var(--text-tertiary); margin: -6px 0 var(--space-3);">${Backup.lastBackupText()}</p>
        <div class="settings-row" onclick="Settings.exportData('json')">
          <div class="settings-icon">${Icons.get('download', 20)}</div>
          <div class="settings-body">
            <div class="settings-title">تصدير البيانات (JSON)</div>
            <div class="settings-desc">نسخة احتياطية كاملة مع التحقق</div>
          </div>
        </div>
        <div class="settings-row" onclick="Settings.exportData('csv')">
          <div class="settings-icon">${Icons.get('file', 20)}</div>
          <div class="settings-body">
            <div class="settings-title">تصدير الطلاب (CSV)</div>
            <div class="settings-desc">جدول بيانات الطلاب</div>
          </div>
        </div>
        <div class="settings-row" onclick="Settings.importData()">
          <div class="settings-icon">${Icons.get('upload', 20)}</div>
          <div class="settings-body">
            <div class="settings-title">استيراد البيانات</div>
            <div class="settings-desc">معاينة المحتوى ثم اختيار دمج أو استبدال</div>
          </div>
        </div>
        <div class="settings-row" onclick="Settings.confirmClearAll()">
          <div class="settings-icon" style="background: var(--color-danger-soft); color: var(--color-danger);">
            ${Icons.get('trash', 20)}
          </div>
          <div class="settings-body">
            <div class="settings-title" style="color: var(--color-danger);">مسح جميع البيانات</div>
            <div class="settings-desc">${students.length} طالب، ${groups.length} مجموعة</div>
          </div>
        </div>
      </div>

      <div class="section">
        <h2 class="section-title" style="margin-bottom: var(--space-3);">الأمان</h2>
        <div class="settings-row" onclick="Settings.changePIN()">
          <div class="settings-icon">${Icons.get('lock', 20)}</div>
          <div class="settings-body">
            <div class="settings-title">تغيير رمز المرور (PIN)</div>
            <div class="settings-desc">رمز الدخول للتطبيق</div>
          </div>
        </div>
        <div class="settings-row" onclick="Settings.showAuditLog()">
          <div class="settings-icon">${Icons.get('eye', 20)}</div>
          <div class="settings-body">
            <div class="settings-title">سجل النشاط</div>
            <div class="settings-desc">آخر العمليات الحساسة (حذف/نسخ/استيراد)</div>
          </div>
          ${Icons.get('forward', 20)}
        </div>
        <div class="settings-row" onclick="Settings.logout()">
          <div class="settings-icon" style="background: var(--color-danger-soft); color: var(--color-danger);">${Icons.get('logout', 20)}</div>
          <div class="settings-body">
            <div class="settings-title" style="color: var(--color-danger);">تسجيل الخروج</div>
            <div class="settings-desc">العودة لشاشة الدخول</div>
          </div>
        </div>
      </div>

      <div class="section" style="text-align: center; padding: var(--space-4) 0; color: var(--text-tertiary); font-size: var(--font-size-xs);">
        <p style="font-weight: 700; color: var(--text-secondary);">مُعلّمي | Moallemy</p>
        <p>الإصدار ${Utils.appVersion()}</p>
        <p style="margin-top: 4px;">صُنع بشغف للمدرسين في مصر</p>
        <p style="margin-top: 10px;">
          <a
            href="https://wa.me/201066227553"
            target="_blank"
            rel="noopener noreferrer"
            style="
              display: inline-flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              padding: 9px 16px;
              border-radius: 12px;
              background: #25D366;
              color: #fff;
              font-weight: 700;
              text-decoration: none;
              box-shadow: 0 4px 12px rgba(37, 211, 102, 0.25);
            "
          >
            تواصل معنا على واتساب
          </a>
        </p>
      </div>
    `;
  },

  bind() {
    document.getElementById('theme-toggle')?.addEventListener('change', (e) => {
      this.applyTheme(e.target.checked ? 'dark' : 'light');
    });
  },

  toggleTheme() {
    const settings = Storage.get(Storage.KEYS.settings, {});
    const newTheme = settings.theme === 'dark' ? 'light' : 'dark';
    this.applyTheme(newTheme);
    App.navigate('settings');
  },

  applyTheme(theme) {
    const settings = Storage.get(Storage.KEYS.settings, {});
    settings.theme = theme;
    Storage.set(Storage.KEYS.settings, settings);
    if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    UI.toast(`تم التبديل للوضع ${theme === 'dark' ? 'الداكن' : 'الفاتح'}`, 'info', 1500);
  },

  openProfileForm() {
    const teacher = Auth.getTeacher() || {};
    const subjects = Storage.get(Storage.KEYS.subjects, []);

    UI.modal({
      title: 'تعديل بيانات الحساب',
      body: `
        <form id="profile-form">
          <div class="field">
            <label>اسم المدرس</label>
            <input type="text" name="name" required value="${Utils.escapeHTML(teacher.name || '')}">
          </div>
          <div class="field">
            <label>المادة</label>
            <select name="subject">
              ${subjects.map(s => `<option value="${Utils.escapeHTML(s.name)}" ${teacher.subject === s.name ? 'selected' : ''}>${Utils.escapeHTML(s.name)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>رقم الهاتف</label>
            <input type="tel" name="phone" value="${Utils.escapeHTML(teacher.phone || '')}">
          </div>
          <div class="field">
            <label>البريد الإلكتروني</label>
            <input type="email" name="email" value="${Utils.escapeHTML(teacher.email || '')}">
          </div>
          <div class="field">
            <label>نبذة تعريفية</label>
            <textarea name="bio" placeholder="معلومات عنك...">${Utils.escapeHTML(teacher.bio || '')}</textarea>
          </div>
          <div class="action-row">
            <button type="button" class="btn btn-secondary" onclick="UI.closeModal()" style="flex:1">إلغاء</button>
            <button type="submit" class="btn btn-primary" style="flex:1">حفظ</button>
          </div>
        </form>
      `
    });

    document.getElementById('profile-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target).entries());
      Auth.updateTeacher(data);
      UI.toast('تم تحديث بياناتك', 'success');
      UI.closeModal();
      App.onAuthSuccess();
      App.navigate('settings');
    });
  },

  /* ===== أوزان حساب الأداء ===== */
  openWeightsForm() {
    const settings = Storage.get(Storage.KEYS.settings, {});
    const w = settings.weights || { exams: 50, assignments: 20, attendance: 10, continuous: 20 };

    UI.modal({
      title: 'أوزان حساب الأداء',
      body: `
        <p style="font-size:var(--font-size-sm); color:var(--text-secondary); margin-bottom: var(--space-3); line-height:1.7;">
          حدد وزن كل مكون في متوسط الأداء العام (نسبة مئوية). يجب أن يكون المجموع 100%.
          المكونات التي لا توجد بياناتها تُستبعد تلقائيًا وتُعاد موازنة الباقي.
        </p>
        <div class="field-row">
          <div class="field">
            <label>الاختبارات (%)</label>
            <input type="number" id="w-exams" min="0" max="100" value="${w.exams}">
          </div>
          <div class="field">
            <label>الواجبات (%)</label>
            <input type="number" id="w-assign" min="0" max="100" value="${w.assignments}">
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>الحضور (%)</label>
            <input type="number" id="w-att" min="0" max="100" value="${w.attendance}">
          </div>
          <div class="field">
            <label>التقييم المستمر (%)</label>
            <input type="number" id="w-cont" min="0" max="100" value="${w.continuous}">
          </div>
        </div>
        <div id="weights-sum" style="text-align:center; margin: var(--space-3) 0; font-weight:700;"></div>
        <button class="btn btn-primary btn-block" onclick="Settings.saveWeights()">حفظ الأوزان</button>
      `
    });

    const updateSum = () => {
      const sum = ['w-exams', 'w-assign', 'w-att', 'w-cont']
        .reduce((s, id) => s + (parseInt(document.getElementById(id).value) || 0), 0);
      const el = document.getElementById('weights-sum');
      el.textContent = `المجموع: ${sum}%`;
      el.style.color = sum === 100 ? 'var(--color-success)' : 'var(--color-danger)';
    };
    ['w-exams', 'w-assign', 'w-att', 'w-cont'].forEach(id => {
      document.getElementById(id).addEventListener('input', updateSum);
    });
    updateSum();
  },

  saveWeights() {
    const weights = {
      exams: parseInt(document.getElementById('w-exams').value) || 0,
      assignments: parseInt(document.getElementById('w-assign').value) || 0,
      attendance: parseInt(document.getElementById('w-att').value) || 0,
      continuous: parseInt(document.getElementById('w-cont').value) || 0
    };
    const sum = Object.values(weights).reduce((s, v) => s + v, 0);
    if (sum !== 100) {
      UI.toast(`المجموع يجب أن يكون 100% (الحالي: ${sum}%)`, 'error');
      return;
    }
    const settings = Storage.get(Storage.KEYS.settings, {});
    settings.weights = weights;
    Storage.set(Storage.KEYS.settings, settings);
    UI.toast('تم حفظ الأوزان - ستطبق على كل حسابات الأداء الجديدة', 'success');
    UI.closeModal();
    App.navigate('settings');
  },

  /* ===== إعدادات التقارير ===== */
  openReportSettings() {
    const settings = Storage.get(Storage.KEYS.settings, {});

    UI.modal({
      title: 'إعدادات التقارير والتحليل الذكي',
      size: 'large',
      body: `
        <form id="report-settings-form">
          <div class="field">
            <label>اسم المركز / السينتر (يظهر في رأس التقرير المطبوع)</label>
            <input type="text" name="reportCenter" value="${Utils.escapeHTML(settings.reportCenter || '')}" placeholder="مثال: سنتر النور التعليمي">
          </div>
          <div class="field-row">
            <div class="field">
              <label>هاتف التواصل في التقارير</label>
              <input type="tel" name="reportPhone" value="${Utils.escapeHTML(settings.reportPhone || '')}" placeholder="01xxxxxxxxx">
            </div>
            <div class="field">
              <label>البريد الإلكتروني</label>
              <input type="email" name="reportEmail" value="${Utils.escapeHTML(settings.reportEmail || '')}">
            </div>
          </div>
          <div class="field">
            <label>عبارة التوقيع في نهاية التقارير</label>
            <input type="text" name="reportSignature" value="${Utils.escapeHTML(settings.reportSignature || '')}" placeholder="مع خالص التحية والتقدير">
          </div>
          <div class="field-row">
            <div class="field">
              <label>لون التقارير المطبوعة</label>
              <input type="color" name="reportColor" value="${settings.reportColor || '#8B5E34'}" style="height:44px; padding:4px;">
            </div>
            <div class="field">
              <label>أسلوب التقارير الافتراضي</label>
              <select name="reportStyle">
                <option value="مختصر" ${settings.reportStyle === 'مختصر' ? 'selected' : ''}>مختصر</option>
                <option value="متوسط" ${(!settings.reportStyle || settings.reportStyle === 'متوسط') ? 'selected' : ''}>احترافي (متوسط)</option>
                <option value="مفصل" ${settings.reportStyle === 'مفصل' ? 'selected' : ''}>مفصل</option>
              </select>
            </div>
          </div>
          <div class="settings-row" style="padding: var(--space-2) 0;" onclick="event.stopPropagation();">
            <div class="settings-body">
              <div class="settings-title">تفعيل التحليل الذكي (محلي)</div>
              <div class="settings-desc">يعمل من بياناتك بدون إنترنت - عند التعطيل يبقى التقرير اليدوي متاحًا</div>
            </div>
            <label class="switch">
              <input type="checkbox" name="aiEnabled" ${settings.aiEnabled !== false ? 'checked' : ''}>
              <span class="switch-slider"></span>
            </label>
          </div>
          <div class="action-row" style="margin-top: var(--space-4);">
            <button type="button" class="btn btn-secondary" onclick="UI.closeModal()" style="flex:1">إلغاء</button>
            <button type="submit" class="btn btn-primary" style="flex:1">حفظ</button>
          </div>
        </form>
      `
    });

    document.getElementById('report-settings-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const settings = Storage.get(Storage.KEYS.settings, {});
      settings.reportCenter = (fd.get('reportCenter') || '').trim();
      settings.reportPhone = (fd.get('reportPhone') || '').trim();
      settings.reportEmail = (fd.get('reportEmail') || '').trim();
      settings.reportSignature = (fd.get('reportSignature') || '').trim();
      settings.reportColor = fd.get('reportColor') || '#8B5E34';
      settings.reportStyle = fd.get('reportStyle') || 'متوسط';
      settings.aiEnabled = fd.get('aiEnabled') === 'on';
      Storage.set(Storage.KEYS.settings, settings);
      UI.toast('تم حفظ إعدادات التقارير', 'success');
      UI.closeModal();
      App.navigate('settings');
    });
  },

  openSubjectsManager() {
    const subjects = Storage.get(Storage.KEYS.subjects, []);
    UI.modal({
      title: 'إدارة المواد',
      body: `
        <div class="list" id="subjects-list">
          ${subjects.map(s => `
            <div class="list-item">
              <div class="list-item-body">
                <div class="list-item-title">${Utils.escapeHTML(s.name)}</div>
                <div class="list-item-subtitle">${s.isDefault ? 'مادة افتراضية' : 'مادة مخصصة'}</div>
              </div>
              <button class="icon-btn" onclick="Settings.deleteSubject('${s.id}')" aria-label="حذف">
                ${Icons.get('trash', 18)}
              </button>
            </div>
          `).join('')}
        </div>
        <form id="add-subject-form" style="margin-top: var(--space-4);">
          <div style="display:flex; gap: var(--space-2);">
            <input type="text" name="name" placeholder="اسم المادة الجديدة" required style="flex:1; padding: var(--space-3); background: var(--color-surface-2); border: 1.5px solid var(--color-surface-3); border-radius: var(--radius-md);">
            <button type="submit" class="btn btn-primary">إضافة</button>
          </div>
        </form>
      `
    });

    document.getElementById('add-subject-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = e.target.name.value.trim();
      if (!name) return;
      const subjects = Storage.get(Storage.KEYS.subjects, []);
      if (subjects.find(s => s.name === name)) {
        UI.toast('المادة موجودة مسبقًا', 'warning');
        return;
      }
      subjects.push({ id: Storage.uid('sub_'), name, isDefault: false });
      Storage.set(Storage.KEYS.subjects, subjects);
      UI.toast('تمت إضافة المادة', 'success');
      UI.closeModal();
      this.openSubjectsManager();
    });
  },

  deleteSubject(id) {
    UI.confirm('هل تريد حذف هذه المادة؟', () => {
      const subjects = Storage.get(Storage.KEYS.subjects, []);
      Storage.set(Storage.KEYS.subjects, subjects.filter(s => s.id !== id));
      UI.toast('تم حذف المادة', 'success');
      UI.closeModal();
      this.openSubjectsManager();
    });
  },

  openStagesManager() {
    const stages = Storage.get(Storage.KEYS.stages, []);
    UI.modal({
      title: 'المراحل والصفوف',
      body: `
        <div class="list">
          ${stages.map(s => `
            <div class="card" style="margin-bottom: var(--space-2);">
              <div style="font-weight: 700; margin-bottom: var(--space-2);">${Utils.escapeHTML(s.name)}</div>
              <div style="display:flex; flex-wrap:wrap; gap:4px;">
                ${s.levels.map(l => `<span class="badge">${Utils.escapeHTML(l)}</span>`).join('')}
              </div>
            </div>
          `).join('')}
        </div>
        <p style="color: var(--text-tertiary); font-size: var(--font-size-sm); margin-top: var(--space-3); text-align:center;">يمكنك إضافة صفوف مخصصة عند إنشاء المجموعات</p>
      `
    });
  },

  openThresholdForm() {
    const settings = Storage.get(Storage.KEYS.settings, {});
    UI.modal({
      title: 'حد تنبيه الغياب',
      body: `
        <p style="color: var(--text-secondary); margin-bottom: var(--space-3); font-size: var(--font-size-sm);">عدد الحصص المتتالية التي يغيب عنها الطالب قبل إظهار التنبيه</p>
        <div class="field">
          <label>الحد</label>
          <input type="number" id="threshold-input" min="1" max="10" value="${settings.absenceAlertThreshold || 3}">
        </div>
        <button class="btn btn-primary btn-block" onclick="Settings.saveThreshold()">حفظ</button>
      `
    });
  },

  saveThreshold() {
    const val = parseInt(document.getElementById('threshold-input').value) || 3;
    const settings = Storage.get(Storage.KEYS.settings, {});
    settings.absenceAlertThreshold = Utils.clamp(val, 1, 10);
    Storage.set(Storage.KEYS.settings, settings);
    UI.toast('تم حفظ الإعداد', 'success');
    UI.closeModal();
    App.navigate('settings');
  },

  changePIN() {
    UI.modal({
      title: 'تغيير رمز المرور',
      body: `
        <form id="pin-form">
          <div class="field">
            <label>الرمز الحالي</label>
            <input type="password" name="current" inputmode="numeric" maxlength="6" required>
          </div>
          <div class="field">
            <label>الرمز الجديد</label>
            <input type="password" name="new" inputmode="numeric" maxlength="6" required min="4">
          </div>
          <div class="field">
            <label>تأكيد الرمز الجديد</label>
            <input type="password" name="confirm" inputmode="numeric" maxlength="6" required>
          </div>
          <button type="submit" class="btn btn-primary btn-block">تغيير الرمز</button>
        </form>
      `
    });
    document.getElementById('pin-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target).entries());
      const teacher = Auth.getTeacher();
      if (data.current !== teacher.pin) {
        UI.toast('الرمز الحالي غير صحيح', 'error');
        return;
      }
      if (data.new.length < 4) {
        UI.toast('الرمز الجديد يجب أن يكون 4 أرقام على الأقل', 'error');
        return;
      }
      if (data.new !== data.confirm) {
        UI.toast('الرمزان غير متطابقين', 'error');
        return;
      }
      Auth.updateTeacher({ pin: data.new });
      Storage.audit('تغيير رمز المرور');
      UI.toast('تم تغيير رمز المرور بنجاح', 'success');
      UI.closeModal();
    });
  },

  showAuditLog() {
    const log = Storage.getAuditLog();
    UI.modal({
      title: 'سجل النشاط',
      body: `
        ${log.length === 0 ? `<p style="text-align:center; color:var(--text-tertiary); padding: var(--space-4);">لا توجد عمليات مسجلة بعد</p>` : `
          <div class="list">
            ${log.map(item => `
              <div class="list-item">
                <div class="list-item-body">
                  <div class="list-item-title">${Utils.escapeHTML(item.action)}</div>
                  <div class="list-item-subtitle">${Utils.escapeHTML(item.details || '')}</div>
                </div>
                <span style="font-size:var(--font-size-xs); color:var(--text-tertiary); white-space:nowrap;">${UI.relativeTime(item.at)}</span>
              </div>
            `).join('')}
          </div>
        `}
      `
    });
  },

  // تُفوض لوحدة Backup الموحدة
  exportData(format = 'json') {
    if (format === 'json') Backup.exportJson();
    else if (format === 'csv') Backup.exportCsv();
  },

  importData() {
    Backup.importDialog();
  },

  confirmClearAll() {
    UI.confirm('سيتم مسح جميع الطلاب والمجموعات والحصص والمدفوعات نهائيًا. لا يمكن التراجع. ننصح بتصدير نسخة احتياطية أولًا.', () => {
      UI.confirm('تأكيد أخير: مسح كل البيانات؟', () => {
        Storage.clearAll();
        Storage.setDemoMode(false);
        Storage.audit('مسح جميع البيانات');
        UI.toast('تم مسح جميع البيانات', 'success');
        setTimeout(() => location.reload(), 1000);
      }, { title: 'تأكيد نهائي', confirmText: 'نعم، امسح الكل' });
    }, { title: 'مسح البيانات', confirmText: 'متابعة' });
  },

  logout() {
    UI.confirm('هل تريد تسجيل الخروج؟', () => {
      Auth.logout();
    }, { title: 'تسجيل الخروج', confirmText: 'خروج', danger: false });
  }
};

window.Settings = Settings;

/* ============================================
   مُعلّمي | settings.js
   الإعدادات + الأمان + النسخ الاحتياطي
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
          <div class="alert-icon">⚠️</div>
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
            <div class="avatar avatar-lg" style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));">${UI.initials(teacher.name || 'م')}</div>
            <div style="flex:1;">
              <h3 style="font-weight: 700;">${teacher.name || '—'}</h3>
              <p style="color: var(--text-secondary); font-size: var(--font-size-sm);">${teacher.subject || ''}</p>
              <p style="color: var(--text-tertiary); font-size: var(--font-size-xs); direction: ltr; text-align: right;">${teacher.phone || ''}</p>
            </div>
          </div>
          <button class="btn btn-outline btn-block" style="margin-top: var(--space-3);" onclick="Settings.openProfileForm()">تعديل بيانات الحساب</button>
        </div>
      </div>

      <div class="section">
        <h2 class="section-title" style="margin-bottom: var(--space-3);">المظهر</h2>
        <div class="settings-row" onclick="Settings.toggleTheme()">
          <div class="settings-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          </div>
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
          <div class="settings-icon">📖</div>
          <div class="settings-body">
            <div class="settings-title">المواد الدراسية</div>
            <div class="settings-desc">${subjects.length} مادة</div>
          </div>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-tertiary); transform: scaleX(-1);"><path d="m9 18 6-6-6-6"/></svg>
        </div>
        <div class="settings-row" onclick="Settings.openStagesManager()">
          <div class="settings-icon">🎓</div>
          <div class="settings-body">
            <div class="settings-title">المراحل والصفوف</div>
            <div class="settings-desc">${stages.length} مراحل</div>
          </div>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-tertiary); transform: scaleX(-1);"><path d="m9 18 6-6-6-6"/></svg>
        </div>
        <div class="settings-row" onclick="Settings.openThresholdForm()">
          <div class="settings-icon">⚠️</div>
          <div class="settings-body">
            <div class="settings-title">حد تنبيه الغياب</div>
            <div class="settings-desc">${settings.absenceAlertThreshold || 3} حصص متتالية</div>
          </div>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-tertiary); transform: scaleX(-1);"><path d="m9 18 6-6-6-6"/></svg>
        </div>
      </div>

      <div class="section">
        <h2 class="section-title" style="margin-bottom: var(--space-3);">المزامنة السحابية</h2>
        <div class="settings-row" onclick="Settings.syncNow()">
          <div class="settings-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-9-9"/><polyline points="21 3 21 9 15 9"/></svg></div>
          <div class="settings-body">
            <div class="settings-title">حالة المزامنة</div>
            <div class="settings-desc" id="cloud-status-desc">${Settings.cloudStatusText()}</div>
          </div>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-tertiary); transform: scaleX(-1);"><path d="m9 18 6-6-6-6"/></svg>
        </div>
      </div>

      <div class="section">
        <h2 class="section-title" style="margin-bottom: var(--space-3);">النسخ الاحتياطي والبيانات</h2>
        <div class="settings-row" onclick="Settings.exportData('json')">
          <div class="settings-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></div>
          <div class="settings-body">
            <div class="settings-title">تصدير البيانات (JSON)</div>
            <div class="settings-desc">نسخة احتياطية كاملة</div>
          </div>
        </div>
        <div class="settings-row" onclick="Settings.exportData('csv')">
          <div class="settings-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
          <div class="settings-body">
            <div class="settings-title">تصدير الطلاب (CSV)</div>
            <div class="settings-desc">جدول بيانات الطلاب</div>
          </div>
        </div>
        <div class="settings-row" onclick="Settings.importData()">
          <div class="settings-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div>
          <div class="settings-body">
            <div class="settings-title">استيراد البيانات</div>
            <div class="settings-desc">من ملف JSON</div>
          </div>
        </div>
        <div class="settings-row" onclick="Settings.confirmClearAll()">
          <div class="settings-icon" style="background: var(--color-danger-soft); color: var(--color-danger);">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
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
          <div class="settings-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
          <div class="settings-body">
            <div class="settings-title">${teacher.authMethod === 'email' ? 'تغيير كلمة المرور' : 'تغيير رمز المرور (PIN)'}</div>
            <div class="settings-desc">${teacher.authMethod === 'email' ? 'كلمة مرور الدخول للبريد' : 'رمز الدخول للتطبيق'}</div>
          </div>
        </div>
        <div class="settings-row" onclick="Settings.logout()">
          <div class="settings-icon" style="background: var(--color-danger-soft); color: var(--color-danger);"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></div>
          <div class="settings-body">
            <div class="settings-title" style="color: var(--color-danger);">تسجيل الخروج</div>
            <div class="settings-desc">العودة لشاشة الدخول</div>
          </div>
        </div>
      </div>

      <div class="section" style="text-align: center; padding: var(--space-4) 0; color: var(--text-tertiary); font-size: var(--font-size-xs);">
        <p style="font-weight: 700; color: var(--text-secondary);">مُعلّمي | Moallemy</p>
        <p>الإصدار 1.0.0</p>
        <p style="margin-top: 4px;">صُنع بشغف للمدرسين في مصر 🌿</p>
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
    💬 تواصل معنا على واتساب
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

  cloudStatusText() {
    if (!(window.Cloud && window.SupabaseConfig)) return 'غير متاحة';
    const s = Cloud.status();
    if (s.demo) return 'الوضع التجريبي لا يُزامن';
    if (!s.ready) return 'غير متاحة — تحقق من الاتصال';
    if (!s.authed) return 'سجّل الدخول للتفعيل';
    if (!s.online) return 'غير متصل — سيُرفع تلقائيًا';
    if (s.pending > 0) return `جارٍ الرفع (${s.pending} تغيير)...`;
    const last = s.lastSync ? ' — آخر مزامنة ' + UI.relativeTime(s.lastSync) : '';
    return 'مُتصل وكل البيانات محفوظة' + last;
  },

  syncNow() {
    if (!(window.Cloud && window.SupabaseConfig) || !SupabaseConfig.isReady()) {
      UI.toast('المزامنة غير متاحة حاليًا', 'warning');
      return;
    }
    const s = Cloud.status();
    if (s.demo || !s.authed) {
      UI.toast('سجّل الدخول بحسابك لتفعيل المزامنة', 'info');
      return;
    }
    UI.toast('جارٍ المزامنة...', 'info', 1500);
    Cloud.pull(true).then(() => Cloud.flush()).then(() => {
      const st = Cloud.status();
      if (st.pending > 0) UI.toast('لم تكتمل المزامنة — ستعيد المحاولة تلقائيًا', 'warning');
      else UI.toast('تمت المزامنة بنجاح', 'success');
      App.navigate('settings');
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
            <input type="text" name="name" required value="${teacher.name || ''}">
          </div>
          <div class="field">
            <label>المادة</label>
            <select name="subject">
              ${subjects.map(s => `<option value="${s.name}" ${teacher.subject === s.name ? 'selected' : ''}>${s.name}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>رقم الهاتف</label>
            <input type="tel" name="phone" value="${teacher.phone || ''}">
          </div>
          <div class="field">
            <label>البريد الإلكتروني</label>
            <input type="email" name="email" value="${teacher.email || ''}">
          </div>
          <div class="field">
            <label>نبذة تعريفية</label>
            <textarea name="bio" placeholder="معلومات عنك...">${teacher.bio || ''}</textarea>
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

  openSubjectsManager() {
    const subjects = Storage.get(Storage.KEYS.subjects, []);
    UI.modal({
      title: 'إدارة المواد',
      body: `
        <div class="list" id="subjects-list">
          ${subjects.map(s => `
            <div class="list-item">
              <div class="list-item-body">
                <div class="list-item-title">${s.name}</div>
                <div class="list-item-subtitle">${s.isDefault ? 'مادة افتراضية' : 'مادة مخصصة'}</div>
              </div>
              <button class="icon-btn" onclick="Settings.deleteSubject('${s.id}')" aria-label="حذف">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
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
              <div style="font-weight: 700; margin-bottom: var(--space-2);">${s.name}</div>
              <div style="display:flex; flex-wrap:wrap; gap:4px;">
                ${s.levels.map(l => `<span class="badge">${l}</span>`).join('')}
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
    settings.absenceAlertThreshold = val;
    Storage.set(Storage.KEYS.settings, settings);
    UI.toast('تم حفظ الإعداد', 'success');
    UI.closeModal();
    App.navigate('settings');
  },

  changePIN() {
    const t = Auth.getTeacher() || {};
    const isEmail = t.authMethod === 'email';
    const title = isEmail ? 'تغيير كلمة المرور' : 'تغيير رمز المرور';
    const curLabel = isEmail ? 'كلمة المرور الحالية' : 'الرمز الحالي';
    const newLabel = isEmail ? 'كلمة المرور الجديدة' : 'الرمز الجديد';
    const confLabel = isEmail ? 'تأكيد كلمة المرور الجديدة' : 'تأكيد الرمز الجديد';
    const minLen = isEmail ? 6 : 4;
    const inputAttrs = isEmail
      ? 'autocomplete="current-password"'
      : 'inputmode="numeric" maxlength="6"';
    const newInputAttrs = isEmail
      ? 'autocomplete="new-password"'
      : 'inputmode="numeric" maxlength="6"';
    UI.modal({
      title,
      body: `
        <form id="pin-form">
          <div class="field">
            <label>${curLabel}</label>
            <input type="password" name="current" ${inputAttrs} required>
          </div>
          <div class="field">
            <label>${newLabel}</label>
            <input type="password" name="new" ${newInputAttrs} required minlength="${minLen}">
          </div>
          <div class="field">
            <label>${confLabel}</label>
            <input type="password" name="confirm" ${newInputAttrs} required>
          </div>
          <button type="submit" class="btn btn-primary btn-block">${isEmail ? 'تغيير كلمة المرور' : 'تغيير الرمز'}</button>
        </form>
      `
    });
    document.getElementById('pin-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target).entries());
      if (data.new.length < minLen) {
        UI.toast(isEmail
          ? 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل'
          : 'الرمز الجديد يجب أن يكون 4 أرقام على الأقل', 'error');
        return;
      }
      if (data.new !== data.confirm) {
        UI.toast(isEmail ? 'كلمتا المرور غير متطابقتين' : 'الرمزان غير متطابقين', 'error');
        return;
      }
      if (!(window.SupabaseConfig && SupabaseConfig.isReady()) || Storage.isDemoMode()) {
        UI.toast('التغيير يتطلب الاتصال بالإنترنت وحسابًا حقيقيًا', 'warning');
        return;
      }
      setLoading(true);
      const res = await Auth.changePIN(data.current, data.new);
      setLoading(false);
      if (!res.ok) {
        UI.toast(res.message || 'تعذر التغيير', 'error');
        return;
      }
      UI.toast(isEmail ? 'تم تغيير كلمة المرور بنجاح' : 'تم تغيير رمز المرور بنجاح', 'success');
      UI.closeModal();
    });

    function setLoading(on) {
      const btn = document.querySelector('#pin-form button[type="submit"]');
      if (!btn) return;
      btn.disabled = on;
      btn.textContent = on ? 'جارٍ التغيير...' : (isEmail ? 'تغيير كلمة المرور' : 'تغيير الرمز');
    }
  },

  exportData(format = 'json') {
    if (format === 'json') {
      const data = Storage.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `moallemy-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      UI.toast('تم تصدير البيانات بنجاح', 'success');
    } else if (format === 'csv') {
      const students = Storage.list(Storage.KEYS.students);
      const headers = ['الاسم', 'الصف', 'الشعبة', 'المادة', 'المجموعة', 'ولي الأمر', 'الهاتف', 'الاشتراك', 'الحالة'];
      const rows = students.map(s => {
        const g = Storage.find(Storage.KEYS.groups, s.groupId);
        return [s.name, s.className, s.section, s.subject, g ? g.name : '', s.parentName, s.parentPhone, s.subscriptionAmount, s.status];
      });
      const csv = [headers, ...rows].map(r => r.map(c => `"${c || ''}"`).join(',')).join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `moallemy-students-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      UI.toast('تم تصدير بيانات الطلاب', 'success');
    }
  },

  importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          UI.confirm('سيتم استبدال جميع البيانات الحالية بالبيانات المستوردة. متابعة؟', () => {
            if (Storage.importAll(data, 'replace')) {
              UI.toast('تم استيراد البيانات بنجاح', 'success');
              setTimeout(() => location.reload(), 1000);
            } else {
              UI.toast('ملف غير صحيح', 'error');
            }
          }, { title: 'استيراد البيانات', confirmText: 'متابعة' });
        } catch (err) {
          UI.toast('تعذر قراءة الملف', 'error');
        }
      };
      reader.readAsText(file);
    });
    input.click();
  },

  confirmClearAll() {
    UI.confirm('سيتم مسح جميع الطلاب والمجموعات والحصص والمدفوعات نهائيًا من جهازك ومن السحابة. لا يمكن التراجع. ننصح بتصدير نسخة احتياطية أولًا.', async () => {
      UI.confirm('تأكيد أخير: مسح كل البيانات؟', async () => {
        // امسح من السحابة أولًا (خصوصًا إذا كان الحساب مُزامنًا)
        if (window.Cloud && Cloud.isAuthed()) {
          const wiped = await Cloud.wipeCloudData();
          if (!wiped) UI.toast('تعذر مسح البيانات السحابية — أعد المحاولة', 'warning');
        }
        Cloud.suspend();
        Storage.clearAll();
        Storage.setDemoMode(false);
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

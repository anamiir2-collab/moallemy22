/* =========================================================
   مُعلّمي — app.js
   Main Application Controller
   ========================================================= */
(function (global) {
  'use strict';

  const pageModules = {
    dashboard: 'Dashboard', students: 'Students', groups: 'Groups',
    calendar: 'Calendar', lessons: 'Lessons', attendance: 'Attendance',
    assignments: 'Assignments', exams: 'Exams', payments: 'Payments',
    reports: 'Reports', notifications: 'Notifications', settings: 'Settings'
  };

  const App = {
    currentPage: 'dashboard',
    pageHistory: [],
    initialized: false,
    deferredInstallPrompt: null,

    async init() {
      try {
        if (global.Storage?.runMigrations) Storage.runMigrations();
        if (global.Seeds?.ensureSeeds) Seeds.ensureSeeds();
        if (global.Auth?.init) await Auth.init();

        document.getElementById('splash-screen')?.classList.add('hidden');
        document.getElementById('app')?.classList.remove('hidden');
        this.bindEvents();

        if (Auth?.isLogged?.()) {
          document.getElementById('auth-screen')?.classList.add('hidden');
          document.getElementById('main-app')?.classList.remove('hidden');
          await this.onAuthSuccess();
          const hash = location.hash.slice(1).trim();
          this.navigate(this.isAllowedPage(hash) ? hash : 'dashboard', false);
        } else {
          document.getElementById('auth-screen')?.classList.remove('hidden');
          document.getElementById('main-app')?.classList.add('hidden');
        }
        this.registerSW();
        this.initialized = true;
      } catch (error) {
        console.error('App initialization error:', error);
        document.getElementById('splash-screen')?.classList.add('hidden');
        document.getElementById('app')?.classList.remove('hidden');
        document.getElementById('auth-screen')?.classList.remove('hidden');
        document.getElementById('main-app')?.classList.add('hidden');
        global.UI?.toast?.('حدث خطأ أثناء تشغيل التطبيق', 'error');
      }
    },

    async onAuthSuccess() {
      const teacher = Auth?.getTeacher?.();
      if (teacher) this.updateTeacherInfo(teacher);
      document.getElementById('auth-screen')?.classList.add('hidden');
      document.getElementById('main-app')?.classList.remove('hidden');
      try { Settings?.applyTheme?.(Storage.get(Storage.KEYS.settings, {}).theme || 'light'); } catch (e) { console.warn('Theme error:', e); }
      try {
        if (Notifications?.refresh) await Notifications.refresh();
        else Notifications?.refreshAutoAlerts?.();
      } catch (e) { console.warn('Notifications error:', e); }
    },

    updateTeacherInfo(teacher) {
      const name = teacher?.name || teacher?.full_name || 'المعلم';
      document.querySelectorAll('[data-teacher-name], .teacher-name').forEach(el => el.textContent = name);
      document.querySelectorAll('[data-teacher-avatar], .teacher-avatar').forEach(el => {
        const avatar = teacher.avatar || teacher.avatar_url || teacher.logo || '';
        if (avatar && 'src' in el) el.src = avatar;
      });
      const greeting = document.getElementById('greeting-text') || document.querySelector('[data-greeting]');
      if (greeting) greeting.textContent = new Date().getHours() < 12 ? 'صباح الخير' : 'مساء الخير';
      const date = document.getElementById('greeting-date') || document.querySelector('[data-current-date]');
      if (date) date.textContent = new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
    },

    bindEvents() {
      document.addEventListener('click', e => {
        const nav = e.target.closest('[data-page]');
        if (nav?.dataset.page) { e.preventDefault(); this.navigate(nav.dataset.page); }
        const back = e.target.closest('[data-action="back"]');
        if (back) { e.preventDefault(); this.goBack(); }
      });
      document.getElementById('header-notif-btn')?.addEventListener('click', () => this.navigate('notifications'));
      document.getElementById('header-search-btn')?.addEventListener('click', () => this.openSearch());
      document.getElementById('install-btn')?.addEventListener('click', () => this.showInstallPrompt());
      document.getElementById('update-btn')?.addEventListener('click', () => location.reload());
      document.getElementById('install-close')?.addEventListener('click', () => document.getElementById('install-banner')?.classList.add('hidden'));
      window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); this.deferredInstallPrompt = e; document.getElementById('install-banner')?.classList.remove('hidden'); });
      window.addEventListener('popstate', e => this.renderPage(e.state?.page || location.hash.slice(1) || 'dashboard'));
    },

    getPageContainer() { return document.getElementById('page-container'); },
    isAllowedPage(page) { return ['dashboard','home','students','profile','needs','groups','calendar','more','lessons','attendance','assignments','exams','payments','reports','notifications','settings'].includes(page); },

    navigate(page = 'dashboard', addHistory = true) {
      if (page === 'home') page = 'dashboard';
      if (!this.isAllowedPage(page)) page = 'dashboard';
      if (addHistory && this.currentPage !== page) {
        this.pageHistory.push(this.currentPage);
        try { history.pushState({ page }, '', `#${page}`); } catch (e) { console.warn('History error:', e); }
      }
      this.currentPage = page;
      this.renderPage(page);
    },

    renderPage(page) {
      if (page === 'home') page = 'dashboard';
      if (!this.isAllowedPage(page)) page = 'dashboard';
      const container = this.getPageContainer();
      if (!container) return console.error('Page container not found');
      this.currentPage = page;
      document.querySelectorAll('[data-page]').forEach(el => el.classList.toggle('active', (el.dataset.page === 'home' ? 'dashboard' : el.dataset.page) === page));
      try {
        if (page === 'more') this.renderMore(container);
        else if (page === 'profile') {
          // Student profiles use the existing Students feature; teacher profile has no separate module.
          if (Students?.currentStudent) Students.renderProfile(Students.currentStudent);
          else this.renderTeacherProfile(container);
        } else if (page === 'needs') {
          container.innerHTML = Dashboard?.renderNeeds?.() || UI.emptyState('يحتاج متابعة', 'لا توجد بيانات');
        } else {
          const moduleName = pageModules[page];
          const module = global[moduleName];
          if (module?.render) container.innerHTML = module.render();
          else container.innerHTML = UI.emptyState('القسم غير متاح حالياً', 'تعذر تحميل الصفحة');
        }
      } catch (error) {
        console.error(`Error rendering page "${page}":`, error);
        container.innerHTML = UI.emptyState('حدث خطأ', 'تعذر تحميل الصفحة');
      }
      this.bindPageEvents(page);
    },

    renderTeacherProfile(container) {
      const teacher = Auth?.getTeacher?.() || {};
      const name = Utils.escapeHTML(teacher.name || 'المعلم');
      container.innerHTML = `<section class="page profile-page"><div class="page-header"><h1 class="page-title">الملف الشخصي</h1><p class="page-subtitle">بيانات حسابك</p></div><div class="detail-header"><div class="detail-avatar">${Utils.escapeHTML(UI.initials(teacher.name || 'م'))}</div><h2 class="detail-title">${name}</h2><p class="detail-subtitle">${Utils.escapeHTML(teacher.subject || '')}</p></div><div class="card" style="margin-top:var(--space-4);"><div class="list"><div class="list-item"><span>البريد الإلكتروني</span><strong>${Utils.escapeHTML(teacher.email || '—')}</strong></div><div class="list-item"><span>رقم الهاتف</span><strong>${Utils.escapeHTML(teacher.phone || '—')}</strong></div><div class="list-item"><span>المحافظة</span><strong>${Utils.escapeHTML(teacher.governorate || '—')}</strong></div><div class="list-item"><span>النبذة</span><strong>${Utils.escapeHTML(teacher.bio || '—')}</strong></div></div><button class="btn btn-primary btn-block" data-action="edit-profile" style="margin-top:var(--space-4)">تعديل البيانات</button></div></section>`;
      container.querySelector('[data-action="edit-profile"]')?.addEventListener('click', () => Settings.openProfileForm());
    },

    bindPageEvents(page) {
      const moduleName = pageModules[page];
      const module = global[moduleName];
      if (module) {
        try { if (typeof module.bindEvents === 'function') module.bindEvents(); else if (typeof module.bind === 'function') module.bind(); } catch (e) { console.error(`Page binding error "${page}":`, e); }
      }
      if (page === 'more') this.bindMore();
    },

    renderMore(container) { container.innerHTML = `<div class="page-header"><h1 class="page-title">المزيد</h1><p class="page-subtitle">إدارة التطبيق والإعدادات</p></div><div class="more-grid"><button class="more-card" data-page="profile"><strong>الملف الشخصي</strong><span>بيانات المعلم</span></button><button class="more-card" data-page="reports"><strong>التقارير</strong><span>تقارير الطلاب والأداء</span></button><button class="more-card" data-page="payments"><strong>المدفوعات</strong><span>متابعة الحسابات</span></button><button class="more-card" data-page="settings"><strong>الإعدادات</strong><span>إعدادات التطبيق</span></button><button class="more-card" data-action="backup"><strong>النسخ الاحتياطي</strong><span>حفظ واستعادة البيانات</span></button></div>`; },
    bindMore() { document.querySelectorAll('.more-card[data-action="backup"]').forEach(el => el.addEventListener('click', () => this.navigate('settings'))); },
    goBack() { this.navigate(this.pageHistory.pop() || 'dashboard', false); },
    openSearch() { global.Search?.open?.(); },
    async showInstallPrompt() { if (!this.deferredInstallPrompt) return UI.toast('التطبيق مثبت بالفعل أو غير متاح للتثبيت حالياً', 'info'); await this.deferredInstallPrompt.prompt(); this.deferredInstallPrompt = null; document.getElementById('install-banner')?.classList.add('hidden'); },
    registerSW() { if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(e => console.warn('Service Worker:', e))); }
  };

  const UI = {
    toast(message, type = 'info') { const c = document.getElementById('toast-container') || document.body; const el = document.createElement('div'); el.className = `toast toast-${type}`; el.textContent = message; c.appendChild(el); requestAnimationFrame(() => el.classList.add('show')); setTimeout(() => el.remove(), 3300); },
    modal(options = {}) { const overlay = document.createElement('div'); overlay.className = 'modal-overlay'; const modal = document.createElement('div'); modal.className = 'modal'; modal.innerHTML = `<div class="modal-header"><h3>${options.title || ''}</h3><button class="modal-close" type="button">×</button></div><div class="modal-body">${options.body ?? options.content ?? ''}</div><div class="modal-footer"></div>`; overlay.appendChild(modal); document.body.appendChild(overlay); const close = () => overlay.remove(); modal.querySelector('.modal-close').onclick = close; (options.buttons || []).forEach(b => { const btn = document.createElement('button'); btn.className = `btn ${b.class || ''}`; btn.type = 'button'; btn.textContent = b.text || 'إغلاق'; btn.onclick = async () => { await b.onClick?.(); if (b.close !== false) close(); }; modal.querySelector('.modal-footer').appendChild(btn); }); return { close }; },
    closeModal() { document.querySelectorAll('.modal-overlay').forEach(el => el.remove()); document.getElementById('modal-container')?.classList.add('hidden'); },
    confirm(message, onConfirm, options = {}) { this.modal({ title: options.title || 'تأكيد', body: `<p>${message}</p>`, buttons: [{ text: 'إلغاء', class: 'btn-secondary' }, { text: options.confirmText || 'تأكيد', class: 'btn-primary', onClick: onConfirm }] }); },
    emptyState(a = '', b = '', c = '', buttonLabel = '', action = '') { const oldStyle = typeof a === 'string' && !/<[a-z]/i.test(a) && !a.includes('svg') && c === ''; const title = oldStyle ? a : b; const message = oldStyle ? b : c; return `<div class="empty-state"><div class="empty-state-icon">${oldStyle ? '' : a || ''}</div><h3>${title || 'لا توجد بيانات'}</h3>${message ? `<p>${message}</p>` : ''}${buttonLabel && action ? `<button class="btn btn-primary" data-action="${action}">${buttonLabel}</button>` : ''}</div>`; },
    initials(name) { return String(name || 'م').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('') || 'م'; },
    money(value) { return `${(Number(value) || 0).toLocaleString('ar-EG')} ج.م`; },
    formatDate(value, options = {}) { if (!value) return '—'; const d = new Date(value); return Number.isNaN(d.getTime()) ? String(value) : new Intl.DateTimeFormat('ar-EG', options.weekday ? { weekday: 'long', day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' }).format(d); },
    formatTime(value) { return value || '—'; },
    relativeTime(value) { return value ? this.formatDate(value) : '—'; },
    attendanceBadge(status) { const map = { 'حاضر':'success', 'غائب':'danger', 'متأخر':'warning', 'غياب بعذر':'info' }; return `<span class="badge badge-${map[status] || 'info'}">${status || '—'}</span>`; },
    lessonStatusBadge(status) { return `<span class="badge">${status || '—'}</span>`; },
    studentStatus(status) { return `<span class="badge">${status || '—'}</span>`; },
    paymentStatus(paid, required) { const p = Number(paid) || 0, r = Number(required) || 0; return p >= r && r > 0 ? { label: 'مدفوع', cls: 'success' } : p > 0 ? { label: 'جزئي', cls: 'warning' } : { label: 'غير مدفوع', cls: 'danger' }; },
    gradePercentage(score, max) { return max ? (Number(score) || 0) / max * 100 : 0; },
    gradeLetter(pct) { return pct >= 85 ? { label: 'ممتاز', cls: 'success' } : pct >= 65 ? { label: 'جيد', cls: 'warning' } : { label: 'يحتاج متابعة', cls: 'danger' }; },
    skeleton(count = 3) { return Array.from({ length: count }, () => '<div class="skeleton skeleton-card"></div>').join(''); }
  };
  global.App = App; global.UI = UI;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => App.init()); else App.init();
})(window);

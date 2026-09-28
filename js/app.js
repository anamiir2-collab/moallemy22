/* ============================================
   مُعلّمي | app.js
   التطبيق الرئيسي - App Shell, Routing, UI helpers
   ============================================ */

const UI = {
  // ===== Toast =====
  toast(message, type = 'success', duration = 2800) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const icons = {
      success: '✓', error: '✕', warning: '!', info: 'i'
    };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<div class="toast-icon">${icons[type] || '✓'}</div><div>${message}</div>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 250);
    }, duration);
  },

  // ===== Modal =====
  modal(options = {}) {
    const { title = '', body = '', onClose, size } = options;
    const container = document.getElementById('modal-container');
    const content = document.getElementById('modal-content');
    if (!container || !content) return;

    content.innerHTML = `
      <div class="modal-handle"></div>
      <div class="modal-header">
        <h3 class="modal-title">${title}</h3>
        <button class="modal-close" aria-label="إغلاق">×</button>
      </div>
      <div class="modal-body">${body}</div>
    `;

    if (size === 'large') content.style.maxWidth = '640px';
    else content.style.maxWidth = '';

    container.classList.remove('hidden');

    const close = () => {
      container.classList.add('hidden');
      if (onClose) onClose();
    };

    content.querySelector('.modal-close').addEventListener('click', close);
    document.getElementById('modal-overlay').onclick = close;
  },

  closeModal() {
    document.getElementById('modal-container').classList.add('hidden');
  },

  // ===== Confirm =====
  confirm(message, onConfirm, options = {}) {
    const { title = 'تأكيد', confirmText = 'تأكيد', cancelText = 'إلغاء', danger = true } = options;
    this.modal({
      title,
      body: `
        <p style="color: var(--text-secondary); margin-bottom: var(--space-5); line-height: 1.6;">${message}</p>
        <div class="action-row">
          <button class="btn btn-secondary" id="confirm-cancel" style="flex:1">${cancelText}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirm-ok" style="flex:1">${confirmText}</button>
        </div>
      `,
      onClose: () => {}
    });
    document.getElementById('confirm-cancel').addEventListener('click', () => this.closeModal());
    document.getElementById('confirm-ok').addEventListener('click', () => {
      this.closeModal();
      if (onConfirm) onConfirm();
    });
  },

  // ===== Empty State =====
  emptyState(icon, title, text, btnLabel, btnAction) {
    // data-action مطلوب — الصفحات تربط أحداثها على [data-action="..."]
    const btn = btnLabel ? `<button class="btn btn-primary" data-action="${btnAction || 'add'}">${btnLabel}</button>` : '';
    return `
      <div class="empty-state">
        <div class="empty-icon">${icon}</div>
        <h3 class="empty-title">${title}</h3>
        <p class="empty-text">${text}</p>
        ${btn}
      </div>
    `;
  },

  // ===== Helpers =====
  formatDate(dateStr, opts = {}) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    const days = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
    if (opts.weekday) return days[d.getDay()] + ' ' + d.getDate() + ' ' + months[d.getMonth()];
    if (opts.short) return d.getDate() + ' ' + months[d.getMonth()].slice(0, 3);
    if (opts.month) return months[d.getMonth()] + ' ' + d.getFullYear();
    return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
  },

  formatTime(t) {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const period = h >= 12 ? 'م' : 'ص';
    const hour12 = h % 12 || 12;
    return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
  },

  relativeTime(ts) {
    const diff = Date.now() - ts;
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return 'الآن';
    const min = Math.floor(sec / 60);
    if (min < 60) return `منذ ${min} دقيقة`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `منذ ${hr} ساعة`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `منذ ${day} يوم`;
    const week = Math.floor(day / 7);
    if (week < 4) return `منذ ${week} أسبوع`;
    return this.formatDate(new Date(ts).toISOString());
  },

  money(n) {
    if (n == null || isNaN(n)) n = 0;
    return Number(n).toLocaleString('ar-EG') + ' ج.م';
  },

  percent(n, total) {
    if (!total) return '0%';
    return Math.round((n / total) * 100) + '%';
  },

  // ===== Avatar initials =====
  initials(name) {
    if (!name) return '؟';
    const parts = name.trim().split(/\s+/);
    return parts[0][0] + (parts[1] ? parts[1][0] : '');
  },

  // ===== Status badges =====
  studentStatus(status) {
    const map = {
      'نشط': 'success',
      'متوقف': 'warning',
      'منسحب': 'danger'
    };
    return `<span class="badge badge-${map[status] || ''}">${status}</span>`;
  },

  lessonStatusBadge(status) {
    const map = {
      'مجدولة': ['info', '⏱'],
      'تمت': ['success', '✓'],
      'ملغاة': ['danger', '✕'],
      'مؤجلة': ['warning', '⏰'],
      'تعويض': ['gold', '↻']
    };
    const [cls, icon] = map[status] || ['info', ''];
    return `<span class="badge badge-${cls}">${icon} ${status}</span>`;
  },

  paymentStatus(paid, required) {
    if (paid >= required) return { label: 'مدفوع', cls: 'success' };
    if (paid > 0) return { label: 'جزئي', cls: 'warning' };
    return { label: 'غير مدفوع', cls: 'danger' };
  },

  attendanceBadge(status) {
    const map = {
      'حاضر': 'success',
      'غائب': 'danger',
      'متأخر': 'warning',
      'غياب بعذر': 'info'
    };
    return `<span class="badge badge-${map[status] || ''}">${status}</span>`;
  },

  gradePercentage(score, max) {
    if (!max) return 0;
    return (score / max) * 100;
  },

  gradeLetter(percentage) {
    if (percentage >= 90) return { letter: 'A', cls: 'success', label: 'ممتاز' };
    if (percentage >= 80) return { letter: 'B', cls: 'success', label: 'جيد جدًا' };
    if (percentage >= 70) return { letter: 'C', cls: 'warning', label: 'جيد' };
    if (percentage >= 60) return { letter: 'D', cls: 'warning', label: 'مقبول' };
    return { letter: 'F', cls: 'danger', label: 'ضعيف' };
  },

  // ===== Skeleton =====
  skeleton(count = 3) {
    let html = '';
    for (let i = 0; i < count; i++) {
      html += `
        <div class="skeleton-card" style="margin-bottom: var(--space-3);">
          <div style="display:flex; gap: var(--space-3); align-items:center;">
            <div class="skeleton skeleton-circle"></div>
            <div style="flex:1;">
              <div class="skeleton skeleton-text lg"></div>
              <div class="skeleton skeleton-text sm"></div>
            </div>
          </div>
        </div>
      `;
    }
    return html;
  }
};
window.UI = UI;

// ===== App =====
const App = {
  currentPage: 'dashboard',
  pageHistory: [],

  init() {
    Seeds.ensureSeeds();
    const authReady = Auth.init();

    // Hide splash
    setTimeout(() => {
      const splash = document.getElementById('splash-screen');
      if (splash) splash.classList.add('hidden');
      const app = document.getElementById('app');
      if (app) app.classList.remove('hidden');

      // انتظار استعادة جلسة Supabase (بمهلة قصوى للأوفلاين)
      Promise.race([
        Promise.resolve(authReady).catch(() => {}),
        new Promise(resolve => setTimeout(resolve, 4500))
      ]).then(() => {
        // Check auth
        if (!Auth.isLogged()) {
          document.getElementById('auth-screen').classList.remove('hidden');
        } else {
          document.getElementById('main-app').classList.remove('hidden');
          this.onAuthSuccess();
        }
      });
    }, 800);

    this.bindEvents();
    this.registerSW();
    this.handleUrlAction();
  },

  onAuthSuccess() {
    const teacher = Auth.getTeacher();
    const avatar = document.getElementById('header-avatar');
    const greeting = document.getElementById('greeting-text');
    const dateEl = document.getElementById('greeting-date');

    if (avatar && teacher) avatar.textContent = UI.initials(teacher.name);
    if (greeting && teacher) greeting.textContent = `أهلاً يا أستاذ ${teacher.name.split(' ')[0]} 👋`;
    if (dateEl) {
      const now = new Date();
      const days = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
      const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
      dateEl.textContent = `${days[now.getDay()]}، ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
    }

    // Apply theme
    const settings = Storage.get(Storage.KEYS.settings, {});
    if (settings.theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');

    // Update notif badge
    Notifications.updateBadge();

    // Navigate to default page
    this.navigate('dashboard');
  },

  bindEvents() {
    // Bottom nav
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const page = item.dataset.page;
        this.navigate(page);
      });
    });

    // Header buttons
    document.getElementById('header-notif-btn')?.addEventListener('click', () => {
      this.navigate('notifications');
    });
    document.getElementById('header-search-btn')?.addEventListener('click', () => {
      this.openGlobalSearch();
    });

    // Install banner
    document.getElementById('install-close')?.addEventListener('click', () => {
      document.getElementById('install-banner').classList.add('hidden');
      Storage.set(Storage.KEYS.installDismissed, { date: Date.now() });
    });

    document.getElementById('install-btn')?.addEventListener('click', () => {
      if (this.deferredPrompt) {
        this.deferredPrompt.prompt();
        this.deferredPrompt.userChoice.then(() => {
          this.deferredPrompt = null;
          document.getElementById('install-banner').classList.add('hidden');
        });
      }
    });

    document.getElementById('update-btn')?.addEventListener('click', () => {
      if (this.swRegistration && this.swRegistration.waiting) {
        this.swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      window.location.reload();
    });

    // PWA install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.maybeShowInstallBanner();
    });

    // Hardware back button (Android)
    window.addEventListener('popstate', (e) => {
      if (this.pageHistory.length > 0) {
        const prev = this.pageHistory.pop();
        this.navigate(prev, true);
      }
    });
  },

  navigate(page, skipHistory = false) {
    if (!skipHistory && this.currentPage && this.currentPage !== page) {
      this.pageHistory.push(this.currentPage);
    }
    this.currentPage = page;

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });

    const container = document.getElementById('page-container');
    if (!container) return;

    // Show skeleton briefly for perceived performance
    container.innerHTML = `<div class="page" style="min-height: 50vh;">${UI.skeleton(4)}</div>`;
    container.scrollTop = 0;

    // Use setTimeout to allow skeleton render
    setTimeout(() => {
      const renderer = this.pages[page];
      if (renderer) {
        container.innerHTML = `<div class="page">${renderer.call(this)}</div>`;
        // Bind events for the new page
        const binder = this.pageBinds[page];
        if (binder) binder.call(this);
      } else {
        container.innerHTML = `<div class="page">${UI.emptyState('🔍', 'الصفحة غير موجودة', 'تأكد من الرابط')}</div>`;
      }
    }, 50);
  },

  pages: {
    dashboard: () => Dashboard.render(),
    students: () => Students.render(),
    groups: () => Groups.render(),
    calendar: () => Calendar.render(),
    more: () => App.renderMore(),
    lessons: () => Lessons.render(),
    attendance: () => Attendance.render(),
    assignments: () => Assignments.render(),
    exams: () => Exams.render(),
    payments: () => Payments.render(),
    reports: () => Reports.render(),
    notifications: () => Notifications.render(),
    settings: () => Settings.render()
  },

  pageBinds: {
    dashboard: () => Dashboard.bind(),
    students: () => Students.bind(),
    groups: () => Groups.bind(),
    calendar: () => Calendar.bind(),
    more: () => App.bindMore(),
    lessons: () => Lessons.bind(),
    attendance: () => Attendance.bind(),
    assignments: () => Assignments.bind(),
    exams: () => Exams.bind(),
    payments: () => Payments.bind(),
    reports: () => Reports.bind(),
    notifications: () => Notifications.bind(),
    settings: () => Settings.bind()
  },

  renderMore() {
    const items = [
      { id: 'lessons', icon: '📚', title: 'الحصص', desc: 'إدارة الجدول والحصص', color: '' },
      { id: 'attendance', icon: '✓', title: 'الحضور', desc: 'تسجيل ومتابعة الحضور', color: 'success' },
      { id: 'exams', icon: '📝', title: 'الاختبارات', desc: 'الاختبارات والدرجات', color: 'warning' },
      { id: 'assignments', icon: '📋', title: 'الواجبات', desc: 'تكليف ومتابعة الواجبات', color: 'info' },
      { id: 'payments', icon: '💰', title: 'المدفوعات', desc: 'الإيصالات والتقارير المالية', color: 'gold' },
      { id: 'reports', icon: '📊', title: 'التقارير', desc: 'تقارير الطلاب والمجموعات', color: '' },
      { id: 'notifications', icon: '🔔', title: 'الإشعارات', desc: 'التنبيهات والإعلانات', color: 'danger' },
      { id: 'settings', icon: '⚙️', title: 'الإعدادات', desc: 'الحساب والأمان والنسخ', color: '' }
    ];

    // قسم الذكاء الاصطناعي — إضافة جديدة لا تلمس الأقسام الحالية
    const aiItems = [
      { id: 'ai-analysis', icon: '🧠', title: 'التحليل الذكي', desc: 'تحليل أداء الطلاب من بياناتهم المسجلة', color: 'info' },
      { id: 'ai-exam-gen', icon: '✨', title: 'مولّد الامتحانات', desc: 'إنشاء امتحانات جاهزة في دقيقة', color: 'gold' }
    ];

    return `
      <div class="page-header">
        <h1 class="page-title">المزيد</h1>
        <p class="page-subtitle">جميع أدوات التطبيق</p>
      </div>

      <div class="section-header" style="margin-bottom: var(--space-3);">
        <h3 class="section-title">الذكاء الاصطناعي</h3>
      </div>
      <div class="list stagger">
        ${aiItems.map(item => `
          <div class="list-item clickable" data-nav="${item.id}">
            <div class="quick-action-icon ${item.color}">${item.icon}</div>
            <div class="list-item-body">
              <div class="list-item-title">${item.title}</div>
              <div class="list-item-subtitle">${item.desc}</div>
            </div>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-tertiary); transform: scaleX(-1);">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </div>
        `).join('')}
      </div>

      <div class="section-header" style="margin: var(--space-5) 0 var(--space-3);">
        <h3 class="section-title">جميع الأدوات</h3>
      </div>
      <div class="list stagger">
        ${items.map(item => `
          <div class="list-item clickable" data-nav="${item.id}">
            <div class="quick-action-icon ${item.color}">${item.icon}</div>
            <div class="list-item-body">
              <div class="list-item-title">${item.title}</div>
              <div class="list-item-subtitle">${item.desc}</div>
            </div>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-tertiary); transform: scaleX(-1);">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </div>
        `).join('')}
      </div>
    `;
  },

  bindMore() {
    document.querySelectorAll('[data-nav]').forEach(el => {
      el.addEventListener('click', () => {
        const nav = el.dataset.nav;
        // أدوات الذكاء الاصطناعي — نوافذ مباشرة بدل التنقل
        if (nav === 'ai-analysis') { AIGenerator.openStudentPicker(); return; }
        if (nav === 'ai-exam-gen') { AIGenerator.openGenerator(); return; }
        this.navigate(nav);
      });
    });
  },

  openGlobalSearch() {
    UI.modal({
      title: 'بحث سريع',
      body: `
        <div class="search-bar">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="search" id="global-search" placeholder="ابحث عن طالب، مجموعة، رقم هاتف..." autofocus>
        </div>
        <div id="search-results" style="max-height: 60vh; overflow-y: auto;"></div>
      `
    });
    const input = document.getElementById('global-search');
    input.addEventListener('input', (e) => this.doSearch(e.target.value));
  },

  doSearch(q) {
    const results = document.getElementById('search-results');
    if (!q || q.length < 2) { results.innerHTML = ''; return; }
    q = q.toLowerCase();
    const students = Storage.list(Storage.KEYS.students, s =>
      s.name.toLowerCase().includes(q) || (s.parentPhone && s.parentPhone.includes(q)) || (s.studentPhone && s.studentPhone.includes(q))
    );
    const groups = Storage.list(Storage.KEYS.groups, g => g.name.toLowerCase().includes(q));

    let html = '';
    if (students.length) {
      html += '<p style="font-size:12px;color:var(--text-tertiary);margin:var(--space-3) 0 var(--space-2);">طلاب</p>';
      html += students.map(s => `
        <div class="list-item clickable" data-student="${s.id}">
          <div class="list-item-avatar">${UI.initials(s.name)}</div>
          <div class="list-item-body">
            <div class="list-item-title">${s.name}</div>
            <div class="list-item-subtitle">${s.className} • ${s.subject}</div>
          </div>
        </div>
      `).join('');
    }
    if (groups.length) {
      html += '<p style="font-size:12px;color:var(--text-tertiary);margin:var(--space-3) 0 var(--space-2);">مجموعات</p>';
      html += groups.map(g => `
        <div class="list-item clickable" data-group="${g.id}">
          <div class="list-item-avatar">${UI.initials(g.name)}</div>
          <div class="list-item-body">
            <div class="list-item-title">${g.name}</div>
            <div class="list-item-subtitle">${g.subject} • ${g.className}</div>
          </div>
        </div>
      `).join('');
    }
    if (!html) html = '<p style="text-align:center;color:var(--text-tertiary);padding:var(--space-6);">لا توجد نتائج</p>';

    results.innerHTML = html;
    results.querySelectorAll('[data-student]').forEach(el => {
      el.addEventListener('click', () => { UI.closeModal(); Students.openProfile(el.dataset.student); });
    });
    results.querySelectorAll('[data-group]').forEach(el => {
      el.addEventListener('click', () => { UI.closeModal(); Groups.openGroup(el.dataset.group); });
    });
  },

  maybeShowInstallBanner() {
    const dismissed = Storage.get(Storage.KEYS.installDismissed);
    // Don't show if dismissed in last 14 days
    if (dismissed && (Date.now() - dismissed.date) < 14 * 86400000) return;
    // Don't show if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    setTimeout(() => {
      document.getElementById('install-banner').classList.remove('hidden');
    }, 3000);
  },

  registerSW() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js').then(reg => {
          this.swRegistration = reg;
          // Check for updates
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                document.getElementById('update-banner').classList.remove('hidden');
              }
            });
          });
        }).catch(err => console.warn('SW registration failed:', err));
      });
    }
  },

  handleUrlAction() {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (action === 'add-student' && Auth.isLogged()) {
      setTimeout(() => Students.openAddForm(), 1500);
    } else if (action === 'quick-attendance' && Auth.isLogged()) {
      setTimeout(() => Attendance.openQuick(), 1500);
    } else if (action === 'quick-payment' && Auth.isLogged()) {
      setTimeout(() => Payments.openQuick(), 1500);
    }
  }
};

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => App.init());

window.App = App;

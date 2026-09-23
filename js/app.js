/* =========================================================
   مُعلّمي — app.js
   Main Application Controller
   ========================================================= */

(function (global) {
  'use strict';

  const App = {
    currentPage: 'dashboard',
    pageHistory: [],
    initialized: false,

    /* =====================================================
       INIT
       ===================================================== */
    async init() {
      try {
        /* ---------- Storage migrations ---------- */
        if (typeof Storage !== 'undefined' && Storage.runMigrations) {
          Storage.runMigrations();
        }

        /* ---------- Seed data ---------- */
        if (typeof Seeds !== 'undefined' && Seeds.ensureSeeds) {
          Seeds.ensureSeeds();
        }

        /* ---------- Auth ---------- */
        if (typeof Auth !== 'undefined' && Auth.init) {
          await Auth.init();
        }

        /* ---------- Elements ---------- */
        const splash = document.getElementById('splash-screen');
        const app = document.getElementById('app');
        const authScreen = document.getElementById('auth-screen');
        const mainApp = document.getElementById('main-app');

        /* ---------- Hide splash ---------- */
        if (splash) {
          splash.classList.add('hidden');
        }

        if (app) {
          app.classList.remove('hidden');
        }

        /* =================================================
           CHECK LOGIN STATE
           ================================================= */
        if (typeof Auth !== 'undefined' && Auth.isLogged && Auth.isLogged()) {
          if (authScreen) {
            authScreen.classList.add('hidden');
          }

          if (mainApp) {
            mainApp.classList.remove('hidden');
          }

          await this.onAuthSuccess();

        } else {
          if (authScreen) {
            authScreen.classList.remove('hidden');
          }

          if (mainApp) {
            mainApp.classList.add('hidden');
          }
        }

        /* ---------- Bind global events ---------- */
        this.bindEvents();

        /* ---------- Service Worker ---------- */
        this.registerSW();

        /* ---------- URL actions ---------- */
        this.handleUrlAction();

        this.initialized = true;

      } catch (error) {
        console.error('App initialization error:', error);

        const splash = document.getElementById('splash-screen');
        const app = document.getElementById('app');
        const authScreen = document.getElementById('auth-screen');
        const mainApp = document.getElementById('main-app');

        if (splash) {
          splash.classList.add('hidden');
        }

        if (app) {
          app.classList.remove('hidden');
        }

        if (authScreen) {
          authScreen.classList.remove('hidden');
        }

        if (mainApp) {
          mainApp.classList.add('hidden');
        }

        if (typeof UI !== 'undefined' && UI.toast) {
          UI.toast('حدث خطأ أثناء تشغيل التطبيق', 'error');
        }
      }
    },

    /* =====================================================
       AUTH SUCCESS
       ===================================================== */
    async onAuthSuccess() {
      try {
        const teacher =
          typeof Auth !== 'undefined' && Auth.getTeacher
            ? Auth.getTeacher()
            : null;

        /* ---------- Screen state ---------- */
        const authScreen = document.getElementById('auth-screen');
        const mainApp = document.getElementById('main-app');

        if (authScreen) {
          authScreen.classList.add('hidden');
        }

        if (mainApp) {
          mainApp.classList.remove('hidden');
        }

        /* ---------- Teacher info ---------- */
        if (teacher) {
          this.updateTeacherInfo(teacher);
        }

        /* ---------- Theme ---------- */
        if (
          typeof Settings !== 'undefined' &&
          Settings.applyTheme
        ) {
          Settings.applyTheme();
        }

        /* ---------- Notifications ---------- */
        if (
          typeof Notifications !== 'undefined' &&
          Notifications.refresh
        ) {
          try {
            await Notifications.refresh();
          } catch (error) {
            console.warn('Notifications refresh failed:', error);
          }
        }

        /* ---------- Navigate dashboard ---------- */
        this.navigate('dashboard', false);

      } catch (error) {
        console.error('onAuthSuccess error:', error);
      }
    },

    /* =====================================================
       UPDATE TEACHER INFO
       ===================================================== */
    updateTeacherInfo(teacher) {
      if (!teacher) return;

      const name =
        teacher.name ||
        teacher.full_name ||
        teacher.fullName ||
        'المعلم';

      const avatar =
        teacher.avatar ||
        teacher.avatar_url ||
        teacher.photo ||
        '';

      /* ---------- Teacher names ---------- */
      document.querySelectorAll('[data-teacher-name]').forEach(el => {
        el.textContent = name;
      });

      document.querySelectorAll('.teacher-name').forEach(el => {
        el.textContent = name;
      });

      /* ---------- Avatar ---------- */
      document.querySelectorAll('[data-teacher-avatar]').forEach(el => {
        if (avatar) {
          el.src = avatar;
          el.classList.remove('hidden');
        }
      });

      document.querySelectorAll('.teacher-avatar').forEach(el => {
        if (avatar) {
          el.src = avatar;
        }
      });

      /* ---------- Greeting ---------- */
      const greeting = document.querySelector('[data-greeting]');

      if (greeting) {
        const hour = new Date().getHours();

        let text = 'أهلاً وسهلاً';

        if (hour >= 5 && hour < 12) {
          text = 'صباح الخير';
        } else if (hour >= 12 && hour < 18) {
          text = 'مساء الخير';
        } else {
          text = 'مساء الخير';
        }

        greeting.textContent = text;
      }

      /* ---------- Date ---------- */
      const dateElement =
        document.querySelector('[data-current-date]');

      if (dateElement) {
        dateElement.textContent =
          new Intl.DateTimeFormat('ar-EG', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          }).format(new Date());
      }
    },

    /* =====================================================
       BIND EVENTS
       ===================================================== */
    bindEvents() {
      /* ---------- Bottom navigation ---------- */
      document.addEventListener('click', event => {
        const navButton =
          event.target.closest('[data-page]');

        if (!navButton) return;

        const page = navButton.dataset.page;

        if (!page) return;

        event.preventDefault();

        this.navigate(page);
      });

      /* ---------- Back buttons ---------- */
      document.addEventListener('click', event => {
        const backButton =
          event.target.closest('[data-action="back"]');

        if (!backButton) return;

        event.preventDefault();

        this.goBack();
      });

      /* ---------- Header buttons ---------- */
      const notificationButton =
        document.querySelector('[data-action="notifications"]');

      if (notificationButton) {
        notificationButton.addEventListener('click', () => {
          this.navigate('notifications');
        });
      }

      const profileButton =
        document.querySelector('[data-action="profile"]');

      if (profileButton) {
        profileButton.addEventListener('click', () => {
          this.navigate('profile');
        });
      }

      /* ---------- Install button ---------- */
      const installButton =
        document.querySelector('[data-action="install"]');

      if (installButton) {
        installButton.addEventListener('click', () => {
          this.showInstallPrompt();
        });
      }

      /* ---------- Update button ---------- */
      const updateButton =
        document.querySelector('[data-action="update"]');

      if (updateButton) {
        updateButton.addEventListener('click', () => {
          window.location.reload();
        });
      }

      /* ---------- PWA install ---------- */
      window.addEventListener(
        'beforeinstallprompt',
        event => {
          event.preventDefault();

          this.deferredInstallPrompt = event;

          const banner =
            document.getElementById('install-banner');

          if (banner) {
            banner.classList.remove('hidden');
          }
        }
      );

      /* ---------- Browser navigation ---------- */
      window.addEventListener('popstate', () => {
        const page =
          history.state?.page || 'dashboard';

        this.renderPage(page, false);
      });
    },

    /* =====================================================
       NAVIGATE
       ===================================================== */
    navigate(page, addHistory = true) {
      if (!page) {
        page = 'dashboard';
      }

      if (addHistory && this.currentPage !== page) {
        this.pageHistory.push(this.currentPage);

        try {
          history.pushState(
            { page },
            '',
            `#${page}`
          );
        } catch (error) {
          console.warn('History error:', error);
        }
      }

      this.currentPage = page;

      this.renderPage(page, addHistory);
    },

    /* =====================================================
       RENDER PAGE
       ===================================================== */
    renderPage(page) {
      const container =
        document.getElementById('page-content') ||
        document.getElementById('main-content') ||
        document.querySelector('.page-content');

      if (!container) {
        console.warn('Page container not found');
        return;
      }

      /* ---------- Update nav ---------- */
      document
        .querySelectorAll('[data-page]')
        .forEach(button => {
          const buttonPage =
            button.dataset.page;

          button.classList.toggle(
            'active',
            buttonPage === page
          );
        });

      /* =================================================
         PAGE MODULES
         ================================================= */

      try {
        switch (page) {

          /* ---------- Dashboard ---------- */
          case 'dashboard':
          case 'home':

            if (
              typeof Dashboard !== 'undefined' &&
              Dashboard.render
            ) {
              Dashboard.render(container);
            }

            break;

          /* ---------- Students ---------- */
          case 'students':

            if (
              typeof Students !== 'undefined' &&
              Students.render
            ) {
              Students.render(container);
            }

            break;

          /* ---------- Profile ---------- */
          case 'profile':

            if (
              typeof Profile !== 'undefined' &&
              Profile.render
            ) {
              Profile.render(container);
            }

            break;

          /* ---------- Needs ---------- */
          case 'needs':

            if (
              typeof Students !== 'undefined' &&
              Students.renderNeeds
            ) {
              Students.renderNeeds(container);
            }

            break;

          /* ---------- Groups ---------- */
          case 'groups':

            if (
              typeof Groups !== 'undefined' &&
              Groups.render
            ) {
              Groups.render(container);
            }

            break;

          /* ---------- Calendar ---------- */
          case 'calendar':

            if (
              typeof Calendar !== 'undefined' &&
              Calendar.render
            ) {
              Calendar.render(container);
            }

            break;

          /* ---------- Lessons ---------- */
          case 'lessons':

            if (
              typeof Lessons !== 'undefined' &&
              Lessons.render
            ) {
              Lessons.render(container);
            }

            break;

          /* ---------- Attendance ---------- */
          case 'attendance':

            if (
              typeof Attendance !== 'undefined' &&
              Attendance.render
            ) {
              Attendance.render(container);
            }

            break;

          /* ---------- Assignments ---------- */
          case 'assignments':

            if (
              typeof Assignments !== 'undefined' &&
              Assignments.render
            ) {
              Assignments.render(container);
            }

            break;

          /* ---------- Exams ---------- */
          case 'exams':

            if (
              typeof Exams !== 'undefined' &&
              Exams.render
            ) {
              Exams.render(container);
            }

            break;

          /* ---------- Payments ---------- */
          case 'payments':

            if (
              typeof Payments !== 'undefined' &&
              Payments.render
            ) {
              Payments.render(container);
            }

            break;

          /* ---------- Reports ---------- */
          case 'reports':

            if (
              typeof Reports !== 'undefined' &&
              Reports.render
            ) {
              Reports.render(container);
            }

            break;

          /* ---------- Notifications ---------- */
          case 'notifications':

            if (
              typeof Notifications !== 'undefined' &&
              Notifications.render
            ) {
              Notifications.render(container);
            }

            break;

          /* ---------- Settings ---------- */
          case 'settings':

            if (
              typeof Settings !== 'undefined' &&
              Settings.render
            ) {
              Settings.render(container);
            }

            break;

          /* ---------- More ---------- */
          case 'more':

            this.renderMore(container);

            break;

          /* ---------- Default ---------- */
          default:

            this.navigate('dashboard', false);

            break;
        }

      } catch (error) {
        console.error(
          `Error rendering page "${page}":`,
          error
        );

        if (typeof UI !== 'undefined' && UI.emptyState) {
          container.innerHTML = UI.emptyState(
            'حدث خطأ',
            'تعذر تحميل الصفحة'
          );
        }
      }

      /* ---------- Page bindings ---------- */
      this.bindPageEvents(page);
    },

    /* =====================================================
       PAGE EVENTS
       ===================================================== */
    bindPageEvents(page) {
      try {
        switch (page) {

          case 'dashboard':

            if (
              typeof Dashboard !== 'undefined' &&
              Dashboard.bindEvents
            ) {
              Dashboard.bindEvents();
            }

            break;

          case 'students':

            if (
              typeof Students !== 'undefined' &&
              Students.bindEvents
            ) {
              Students.bindEvents();
            }

            break;

          case 'profile':

            if (
              typeof Profile !== 'undefined' &&
              Profile.bindEvents
            ) {
              Profile.bindEvents();
            }

            break;

          case 'groups':

            if (
              typeof Groups !== 'undefined' &&
              Groups.bindEvents
            ) {
              Groups.bindEvents();
            }

            break;

          case 'calendar':

            if (
              typeof Calendar !== 'undefined' &&
              Calendar.bindEvents
            ) {
              Calendar.bindEvents();
            }

            break;

          case 'lessons':

            if (
              typeof Lessons !== 'undefined' &&
              Lessons.bindEvents
            ) {
              Lessons.bindEvents();
            }

            break;

          case 'attendance':

            if (
              typeof Attendance !== 'undefined' &&
              Attendance.bindEvents
            ) {
              Attendance.bindEvents();
            }

            break;

          case 'assignments':

            if (
              typeof Assignments !== 'undefined' &&
              Assignments.bindEvents
            ) {
              Assignments.bindEvents();
            }

            break;

          case 'exams':

            if (
              typeof Exams !== 'undefined' &&
              Exams.bindEvents
            ) {
              Exams.bindEvents();
            }

            break;

          case 'payments':

            if (
              typeof Payments !== 'undefined' &&
              Payments.bindEvents
            ) {
              Payments.bindEvents();
            }

            break;

          case 'reports':

            if (
              typeof Reports !== 'undefined' &&
              Reports.bindEvents
            ) {
              Reports.bindEvents();
            }

            break;

          case 'notifications':

            if (
              typeof Notifications !== 'undefined' &&
              Notifications.bindEvents
            ) {
              Notifications.bindEvents();
            }

            break;

          case 'settings':

            if (
              typeof Settings !== 'undefined' &&
              Settings.bindEvents
            ) {
              Settings.bindEvents();
            }

            break;

          case 'more':

            this.bindMore();

            break;
        }

      } catch (error) {
        console.error(
          `Page binding error "${page}":`,
          error
        );
      }
    },

    /* =====================================================
       MORE PAGE
       ===================================================== */
    renderMore(container) {
      container.innerHTML = `
        <div class="page-header">
          <div>
            <h1>المزيد</h1>
            <p>إدارة التطبيق والإعدادات</p>
          </div>
        </div>

        <div class="more-grid">

          <button class="more-card" data-page="profile">
            <div class="more-card-icon">
              <i class="fa-solid fa-user"></i>
            </div>
            <div>
              <strong>الملف الشخصي</strong>
              <span>بيانات المعلم</span>
            </div>
          </button>

          <button class="more-card" data-page="reports">
            <div class="more-card-icon">
              <i class="fa-solid fa-chart-column"></i>
            </div>
            <div>
              <strong>التقارير</strong>
              <span>تقارير الطلاب والأداء</span>
            </div>
          </button>

          <button class="more-card" data-page="payments">
            <div class="more-card-icon">
              <i class="fa-solid fa-wallet"></i>
            </div>
            <div>
              <strong>المدفوعات</strong>
              <span>متابعة الحسابات</span>
            </div>
          </button>

          <button class="more-card" data-page="settings">
            <div class="more-card-icon">
              <i class="fa-solid fa-gear"></i>
            </div>
            <div>
              <strong>الإعدادات</strong>
              <span>إعدادات التطبيق</span>
            </div>
          </button>

          <button class="more-card" data-action="backup">
            <div class="more-card-icon">
              <i class="fa-solid fa-database"></i>
            </div>
            <div>
              <strong>النسخ الاحتياطي</strong>
              <span>حفظ واستعادة البيانات</span>
            </div>
          </button>

        </div>
      `;
    },

    /* =====================================================
       MORE EVENTS
       ===================================================== */
    bindMore() {
      document
        .querySelectorAll('.more-card')
        .forEach(card => {

          card.addEventListener('click', () => {

            const page =
              card.dataset.page;

            const action =
              card.dataset.action;

            if (page) {
              this.navigate(page);
              return;
            }

            if (action === 'backup') {

              if (
                typeof Backup !== 'undefined' &&
                Backup.render
              ) {
                this.navigate('settings');
              }
            }
          });
        });
    },

    /* =====================================================
       BACK
       ===================================================== */
    goBack() {
      if (this.pageHistory.length > 0) {

        const previous =
          this.pageHistory.pop();

        this.navigate(previous, false);

        return;
      }

      this.navigate('dashboard', false);
    },

    /* =====================================================
       GLOBAL SEARCH
       ===================================================== */
    openSearch() {
      if (
        typeof Search !== 'undefined' &&
        Search.open
      ) {
        Search.open();
      }
    },

    /* =====================================================
       INSTALL PWA
       ===================================================== */
    async showInstallPrompt() {
      if (!this.deferredInstallPrompt) {
        if (typeof UI !== 'undefined' && UI.toast) {
          UI.toast(
            'التطبيق مثبت بالفعل أو غير متاح للتثبيت حالياً',
            'info'
          );
        }

        return;
      }

      try {
        await this.deferredInstallPrompt.prompt();

        const result =
          await this.deferredInstallPrompt.userChoice;

        console.log(
          'Install result:',
          result
        );

        this.deferredInstallPrompt = null;

        const banner =
          document.getElementById('install-banner');

        if (banner) {
          banner.classList.add('hidden');
        }

      } catch (error) {
        console.error(
          'Install prompt error:',
          error
        );
      }
    },

    /* =====================================================
       SERVICE WORKER
       ===================================================== */
    registerSW() {
      if (!('serviceWorker' in navigator)) {
        return;
      }

      window.addEventListener(
        'load',
        () => {

          navigator.serviceWorker
            .register('./service-worker.js')
            .then(registration => {

              console.log(
                'Service Worker registered:',
                registration.scope
              );

              registration.addEventListener(
                'updatefound',
                () => {

                  const newWorker =
                    registration.installing;

                  if (!newWorker) return;

                  newWorker.addEventListener(
                    'statechange',
                    () => {

                      if (
                        newWorker.state === 'installed' &&
                        navigator.serviceWorker.controller
                      ) {

                        const updateBanner =
                          document.getElementById(
                            'update-banner'
                          );

                        if (updateBanner) {
                          updateBanner.classList.remove(
                            'hidden'
                          );
                        }
                      }
                    }
                  );
                }
              );

            })
            .catch(error => {
              console.warn(
                'Service Worker registration failed:',
                error
              );
            });
        }
      );
    },

    /* =====================================================
       URL ACTIONS
       ===================================================== */
    handleUrlAction() {
      const hash =
        window.location.hash;

      if (!hash) {
        return;
      }

      const page =
        hash.replace('#', '').trim();

      if (!page) {
        return;
      }

      const allowedPages = [
        'dashboard',
        'home',
        'students',
        'profile',
        'needs',
        'groups',
        'calendar',
        'more',
        'lessons',
        'attendance',
        'assignments',
        'exams',
        'payments',
        'reports',
        'notifications',
        'settings'
      ];

      if (allowedPages.includes(page)) {
        this.currentPage = page;
      }
    }
  };

  /* =========================================================
     UI
     ========================================================= */

  const UI = {

    /* ---------- Toast ---------- */
    toast(message, type = 'info') {

      let container =
        document.getElementById('toast-container');

      if (!container) {

        container =
          document.createElement('div');

        container.id =
          'toast-container';

        document.body.appendChild(container);
      }

      const toast =
        document.createElement('div');

      toast.className =
        `toast toast-${type}`;

      toast.textContent =
        message;

      container.appendChild(toast);

      requestAnimationFrame(() => {
        toast.classList.add('show');
      });

      setTimeout(() => {

        toast.classList.remove('show');

        setTimeout(() => {
          toast.remove();
        }, 300);

      }, 3000);
    },

    /* ---------- Modal ---------- */
    modal(options = {}) {

      const {
        title = '',
        content = '',
        buttons = []
      } = options;

      const overlay =
        document.createElement('div');

      overlay.className =
        'modal-overlay';

      const modal =
        document.createElement('div');

      modal.className =
        'modal';

      modal.innerHTML = `
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="modal-body">
          ${content}
        </div>

        <div class="modal-footer"></div>
      `;

      overlay.appendChild(modal);

      document.body.appendChild(overlay);

      const close =
        () => overlay.remove();

      modal
        .querySelector('.modal-close')
        .addEventListener(
          'click',
          close
        );

      const footer =
        modal.querySelector('.modal-footer');

      buttons.forEach(button => {

        const btn =
          document.createElement('button');

        btn.className =
          `btn ${button.class || ''}`;

        btn.textContent =
          button.text || 'إغلاق';

        btn.addEventListener(
          'click',
          async () => {

            if (button.onClick) {
              await button.onClick();
            }

            if (button.close !== false) {
              close();
            }
          }
        );

        footer.appendChild(btn);
      });

      return {
        close
      };
    },

    /* ---------- Confirm ---------- */
    confirm(
      message,
      onConfirm,
      options = {}
    ) {

      const title =
        options.title || 'تأكيد';

      this.modal({
        title,

        content: `
          <div class="confirm-message">
            ${message}
          </div>
        `,

        buttons: [
          {
            text: 'إلغاء',
            class: 'btn-secondary'
          },

          {
            text: 'تأكيد',
            class: 'btn-primary',

            onClick: async () => {

              if (onConfirm) {
                await onConfirm();
              }

            }
          }
        ]
      });
    },

    /* ---------- Empty state ---------- */
    emptyState(
      title = 'لا توجد بيانات',
      message = ''
    ) {

      return `
        <div class="empty-state">

          <div class="empty-state-icon">
            <i class="fa-regular fa-folder-open"></i>
          </div>

          <h3>${title}</h3>

          ${
            message
              ? `<p>${message}</p>`
              : ''
          }

        </div>
      `;
    },

    /* ---------- Format number ---------- */
    number(value) {

      if (
        value === null ||
        value === undefined ||
        value === ''
      ) {
        return '0';
      }

      return new Intl.NumberFormat(
        'ar-EG'
      ).format(Number(value) || 0);
    },

    /* ---------- Format currency ---------- */
    currency(value) {

      return new Intl.NumberFormat(
        'ar-EG',
        {
          style: 'currency',
          currency: 'EGP',
          maximumFractionDigits: 0
        }
      ).format(
        Number(value) || 0
      );
    },

    /* ---------- Format date ---------- */
    date(value) {

      if (!value) {
        return '-';
      }

      const date =
        new Date(value);

      if (Number.isNaN(date.getTime())) {
        return value;
      }

      return new Intl.DateTimeFormat(
        'ar-EG',
        {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        }
      ).format(date);
    },

    /* ---------- Format time ---------- */
    time(value) {

      if (!value) {
        return '-';
      }

      const date =
        new Date(value);

      if (Number.isNaN(date.getTime())) {
        return value;
      }

      return new Intl.DateTimeFormat(
        'ar-EG',
        {
          hour: 'numeric',
          minute: '2-digit'
        }
      ).format(date);
    },

    /* ---------- Badge ---------- */
    badge(text, type = 'default') {

      return `
        <span class="badge badge-${type}">
          ${text}
        </span>
      `;
    },

    /* ---------- Skeleton ---------- */
    skeleton(count = 3) {

      return Array
        .from(
          { length: count },
          () => `
            <div class="skeleton skeleton-card"></div>
          `
        )
        .join('');
    }
  };

  /* =========================================================
     GLOBAL EXPORT
     ========================================================= */

  global.App = App;
  global.UI = UI;

  /* =========================================================
     DOM READY
     ========================================================= */

  if (
    document.readyState === 'loading'
  ) {

    document.addEventListener(
      'DOMContentLoaded',
      () => {
        App.init();
      }
    );

  } else {

    App.init();

  }

})(window);
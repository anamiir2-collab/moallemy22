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
    deferredInstallPrompt: null,

    /* =====================================================
       INIT
       ===================================================== */
    async init() {
      try {

        /* ---------- Storage migrations ---------- */
        if (
          typeof Storage !== 'undefined' &&
          typeof Storage.runMigrations === 'function'
        ) {
          try {
            Storage.runMigrations();
          } catch (error) {
            console.warn('Storage migration failed:', error);
          }
        }

        /* ---------- Seed data ---------- */
        if (
          typeof Seeds !== 'undefined' &&
          typeof Seeds.ensureSeeds === 'function'
        ) {
          try {
            Seeds.ensureSeeds();
          } catch (error) {
            console.warn('Seed data failed:', error);
          }
        }

        /* ---------- Auth ---------- */
        if (
          typeof Auth !== 'undefined' &&
          typeof Auth.init === 'function'
        ) {
          await Auth.init();
        }

        /* ---------- Elements ---------- */
        const splash =
          document.getElementById('splash-screen');

        const app =
          document.getElementById('app');

        const authScreen =
          document.getElementById('auth-screen');

        const mainApp =
          document.getElementById('main-app');

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
        const isLogged =
          typeof Auth !== 'undefined' &&
          typeof Auth.isLogged === 'function' &&
          Auth.isLogged();

        if (isLogged) {

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
        if (isLogged) {
          this.handleUrlAction();

          /*
           * لو فيه صفحة محددة في الرابط نعرضها
           * ولو مفيش نعرض لوحة التحكم.
           */
          const hash =
            window.location.hash
              .replace('#', '')
              .trim();

          if (hash && this.isAllowedPage(hash)) {
            this.navigate(hash, false);
          } else {
            this.navigate('dashboard', false);
          }
        }

        this.initialized = true;

        console.log('مُعلّمي: App initialized successfully');

      } catch (error) {

        console.error(
          'App initialization error:',
          error
        );

        const splash =
          document.getElementById('splash-screen');

        const app =
          document.getElementById('app');

        const authScreen =
          document.getElementById('auth-screen');

        const mainApp =
          document.getElementById('main-app');

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

        if (
          typeof UI !== 'undefined' &&
          typeof UI.toast === 'function'
        ) {
          UI.toast(
            'حدث خطأ أثناء تشغيل التطبيق',
            'error'
          );
        }
      }
    },

    /* =====================================================
       AUTH SUCCESS
       ===================================================== */
    async onAuthSuccess() {
      try {

        const teacher =
          typeof Auth !== 'undefined' &&
          typeof Auth.getTeacher === 'function'
            ? Auth.getTeacher()
            : null;

        /* ---------- Screen state ---------- */
        const authScreen =
          document.getElementById('auth-screen');

        const mainApp =
          document.getElementById('main-app');

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
          typeof Settings.applyTheme === 'function'
        ) {
          try {
            Settings.applyTheme();
          } catch (error) {
            console.warn(
              'Theme application failed:',
              error
            );
          }
        }

        /* ---------- Notifications ---------- */
        if (
          typeof Notifications !== 'undefined' &&
          typeof Notifications.refresh === 'function'
        ) {
          try {
            await Notifications.refresh();
          } catch (error) {
            console.warn(
              'Notifications refresh failed:',
              error
            );
          }
        }

        /* ---------- Render dashboard ---------- */
        this.currentPage = 'dashboard';

        this.renderPage(
          'dashboard',
          false
        );

      } catch (error) {

        console.error(
          'onAuthSuccess error:',
          error
        );

        /*
         * حتى لو حصل خطأ في الإشعارات أو البيانات
         * لا نسيب المستخدم على شاشة بيضاء.
         */
        const mainApp =
          document.getElementById('main-app');

        if (mainApp) {
          mainApp.classList.remove('hidden');
        }

        this.renderPage(
          'dashboard',
          false
        );
      }
    },

    /* =====================================================
       UPDATE TEACHER INFO
       ===================================================== */
    updateTeacherInfo(teacher) {

      if (!teacher) {
        return;
      }

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
      document
        .querySelectorAll('[data-teacher-name]')
        .forEach(el => {
          el.textContent = name;
        });

      document
        .querySelectorAll('.teacher-name')
        .forEach(el => {
          el.textContent = name;
        });

      /* ---------- Avatar ---------- */
      document
        .querySelectorAll('[data-teacher-avatar]')
        .forEach(el => {

          if (avatar) {
            el.src = avatar;
            el.classList.remove('hidden');
          }
        });

      document
        .querySelectorAll('.teacher-avatar')
        .forEach(el => {

          if (avatar) {
            el.src = avatar;
          }
        });

      /* ---------- Greeting ---------- */
      const greeting =
        document.querySelector(
          '[data-greeting]'
        );

      if (greeting) {

        const hour =
          new Date().getHours();

        let text =
          'أهلاً وسهلاً';

        if (
          hour >= 5 &&
          hour < 12
        ) {
          text = 'صباح الخير';

        } else if (
          hour >= 12 &&
          hour < 18
        ) {
          text = 'مساء الخير';

        } else {
          text = 'مساء الخير';
        }

        greeting.textContent = text;
      }

      /* ---------- Date ---------- */
      const dateElement =
        document.querySelector(
          '[data-current-date]'
        );

      if (dateElement) {

        dateElement.textContent =
          new Intl.DateTimeFormat(
            'ar-EG',
            {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            }
          ).format(
            new Date()
          );
      }
    },

    /* =====================================================
       BIND EVENTS
       ===================================================== */
    bindEvents() {

      /* ---------- Bottom / App navigation ---------- */
      document.addEventListener(
        'click',
        event => {

          const navButton =
            event.target.closest(
              '[data-page]'
            );

          if (!navButton) {
            return;
          }

          const page =
            navButton.dataset.page;

          if (!page) {
            return;
          }

          event.preventDefault();

          this.navigate(page);
        }
      );

      /* ---------- Back buttons ---------- */
      document.addEventListener(
        'click',
        event => {

          const backButton =
            event.target.closest(
              '[data-action="back"]'
            );

          if (!backButton) {
            return;
          }

          event.preventDefault();

          this.goBack();
        }
      );

      /* ---------- Header buttons ---------- */
      const notificationButton =
        document.querySelector(
          '[data-action="notifications"]'
        );

      if (notificationButton) {

        notificationButton.addEventListener(
          'click',
          () => {
            this.navigate('notifications');
          }
        );
      }

      const profileButton =
        document.querySelector(
          '[data-action="profile"]'
        );

      if (profileButton) {

        profileButton.addEventListener(
          'click',
          () => {
            this.navigate('profile');
          }
        );
      }

      /* ---------- Install button ---------- */
      const installButton =
        document.querySelector(
          '[data-action="install"]'
        );

      if (installButton) {

        installButton.addEventListener(
          'click',
          () => {
            this.showInstallPrompt();
          }
        );
      }

      /* ---------- Update button ---------- */
      const updateButton =
        document.querySelector(
          '[data-action="update"]'
        );

      if (updateButton) {

        updateButton.addEventListener(
          'click',
          () => {

            if (
              'serviceWorker' in navigator
            ) {

              navigator.serviceWorker
                .getRegistrations()
                .then(registrations => {

                  registrations.forEach(
                    registration => {
                      registration.update();
                    }
                  );

                  window.location.reload();
                })
                .catch(() => {
                  window.location.reload();
                });

            } else {
              window.location.reload();
            }
          }
        );
      }

      /* ---------- PWA install ---------- */
      window.addEventListener(
        'beforeinstallprompt',
        event => {

          event.preventDefault();

          this.deferredInstallPrompt =
            event;

          const banner =
            document.getElementById(
              'install-banner'
            );

          if (banner) {
            banner.classList.remove(
              'hidden'
            );
          }
        }
      );

      /* ---------- Browser navigation ---------- */
      window.addEventListener(
        'popstate',
        event => {

          const page =
            event.state?.page ||
            window.location.hash
              .replace('#', '')
              .trim() ||
            'dashboard';

          this.currentPage =
            page;

          this.renderPage(
            page,
            false
          );
        }
      );
    },

    /* =====================================================
       NAVIGATE
       ===================================================== */
    navigate(
      page,
      addHistory = true
    ) {

      if (!page) {
        page = 'dashboard';
      }

      if (!this.isAllowedPage(page)) {
        page = 'dashboard';
      }

      /* ---------- Normalize home ---------- */
      if (page === 'home') {
        page = 'dashboard';
      }

      if (
        addHistory &&
        this.currentPage !== page
      ) {

        this.pageHistory.push(
          this.currentPage
        );

        try {

          history.pushState(
            { page },
            '',
            `#${page}`
          );

        } catch (error) {

          console.warn(
            'History error:',
            error
          );
        }
      }

      this.currentPage =
        page;

      this.renderPage(
        page,
        addHistory
      );
    },

    /* =====================================================
       GET PAGE CONTAINER
       ===================================================== */
    getPageContainer() {

      /*
       * مهم جداً:
       * index.html يستخدم #page-container
       * وليس #page-content
       */

      return (
        document.getElementById(
          'page-container'
        ) ||

        document.getElementById(
          'page-content'
        ) ||

        document.getElementById(
          'main-content'
        ) ||

        document.querySelector(
          '.page-content'
        )
      );
    },

    /* =====================================================
       CHECK PAGE
       ===================================================== */
    isAllowedPage(page) {

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

      return allowedPages.includes(
        page
      );
    },

    /* =====================================================
       RENDER PAGE
       ===================================================== */
    renderPage(page) {

      /* ---------- Normalize ---------- */
      if (page === 'home') {
        page = 'dashboard';
      }

      if (!this.isAllowedPage(page)) {
        page = 'dashboard';
      }

      /*
       * أهم إصلاح في الملف:
       * إضافة #page-container
       */
      const container =
        this.getPageContainer();

      if (!container) {

        console.error(
          'مُعلّمي: Page container not found.'
        );

        return;
      }

      /* ---------- Update current page ---------- */
      this.currentPage =
        page;

      /* ---------- Update navigation ---------- */
      document
        .querySelectorAll(
          '[data-page]'
        )
        .forEach(button => {

          const buttonPage =
            button.dataset.page;

          const normalizedButtonPage =
            buttonPage === 'home'
              ? 'dashboard'
              : buttonPage;

          button.classList.toggle(
            'active',
            normalizedButtonPage === page
          );
        });

      /* =================================================
         PAGE MODULES
         ================================================= */

      try {

        switch (page) {

          /* ---------- Dashboard ---------- */
          case 'dashboard':

            if (
              typeof Dashboard !== 'undefined' &&
              typeof Dashboard.render === 'function'
            ) {

              Dashboard.render(
                container
              );

            } else {

              container.innerHTML =
                this.defaultDashboard();
            }

            break;

          /* ---------- Students ---------- */
          case 'students':

            if (
              typeof Students !== 'undefined' &&
              typeof Students.render === 'function'
            ) {
              Students.render(
                container
              );
            } else {
              container.innerHTML =
                UI.emptyState(
                  'الطلاب',
                  'قسم الطلاب غير متاح حالياً'
                );
            }

            break;

          /* ---------- Profile ---------- */
          case 'profile':

            if (
              typeof Profile !== 'undefined' &&
              typeof Profile.render === 'function'
            ) {
              Profile.render(
                container
              );
            } else {
              container.innerHTML =
                UI.emptyState(
                  'الملف الشخصي',
                  'قسم الملف الشخصي غير متاح حالياً'
                );
            }

            break;

          /* ---------- Needs ---------- */
          case 'needs':

            if (
              typeof Students !== 'undefined' &&
              typeof Students.renderNeeds === 'function'
            ) {
              Students.renderNeeds(
                container
              );
            } else {
              container.innerHTML =
                UI.emptyState(
                  'الاحتياجات',
                  'القسم غير متاح حالياً'
                );
            }

            break;

          /* ---------- Groups ---------- */
          case 'groups':

            if (
              typeof Groups !== 'undefined' &&
              typeof Groups.render === 'function'
            ) {
              Groups.render(
                container
              );
            } else {
              container.innerHTML =
                UI.emptyState(
                  'المجموعات',
                  'قسم المجموعات غير متاح حالياً'
                );
            }

            break;

          /* ---------- Calendar ---------- */
          case 'calendar':

            if (
              typeof Calendar !== 'undefined' &&
              typeof Calendar.render === 'function'
            ) {
              Calendar.render(
                container
              );
            } else {
              container.innerHTML =
                UI.emptyState(
                  'التقويم',
                  'قسم التقويم غير متاح حالياً'
                );
            }

            break;

          /* ---------- Lessons ---------- */
          case 'lessons':

            if (
              typeof Lessons !== 'undefined' &&
              typeof Lessons.render === 'function'
            ) {
              Lessons.render(
                container
              );
            } else {
              container.innerHTML =
                UI.emptyState(
                  'الحصص',
                  'قسم الحصص غير متاح حالياً'
                );
            }

            break;

          /* ---------- Attendance ---------- */
          case 'attendance':

            if (
              typeof Attendance !== 'undefined' &&
              typeof Attendance.render === 'function'
            ) {
              Attendance.render(
                container
              );
            } else {
              container.innerHTML =
                UI.emptyState(
                  'الحضور',
                  'قسم الحضور غير متاح حالياً'
                );
            }

            break;

          /* ---------- Assignments ---------- */
          case 'assignments':

            if (
              typeof Assignments !== 'undefined' &&
              typeof Assignments.render === 'function'
            ) {
              Assignments.render(
                container
              );
            } else {
              container.innerHTML =
                UI.emptyState(
                  'الواجبات',
                  'قسم الواجبات غير متاح حالياً'
                );
            }

            break;

          /* ---------- Exams ---------- */
          case 'exams':

            if (
              typeof Exams !== 'undefined' &&
              typeof Exams.render === 'function'
            ) {
              Exams.render(
                container
              );
            } else {
              container.innerHTML =
                UI.emptyState(
                  'الاختبارات',
                  'قسم الاختبارات غير متاح حالياً'
                );
            }

            break;

          /* ---------- Payments ---------- */
          case 'payments':

            if (
              typeof Payments !== 'undefined' &&
              typeof Payments.render === 'function'
            ) {
              Payments.render(
                container
              );
            } else {
              container.innerHTML =
                UI.emptyState(
                  'المدفوعات',
                  'قسم المدفوعات غير متاح حالياً'
                );
            }

            break;

          /* ---------- Reports ---------- */
          case 'reports':

            if (
              typeof Reports !== 'undefined' &&
              typeof Reports.render === 'function'
            ) {
              Reports.render(
                container
              );
            } else {
              container.innerHTML =
                UI.emptyState(
                  'التقارير',
                  'قسم التقارير غير متاح حالياً'
                );
            }

            break;

          /* ---------- Notifications ---------- */
          case 'notifications':

            if (
              typeof Notifications !== 'undefined' &&
              typeof Notifications.render === 'function'
            ) {
              Notifications.render(
                container
              );
            } else {
              container.innerHTML =
                UI.emptyState(
                  'الإشعارات',
                  'لا توجد إشعارات حالياً'
                );
            }

            break;

          /* ---------- Settings ---------- */
          case 'settings':

            if (
              typeof Settings !== 'undefined' &&
              typeof Settings.render === 'function'
            ) {
              Settings.render(
                container
              );
            } else {
              container.innerHTML =
                UI.emptyState(
                  'الإعدادات',
                  'قسم الإعدادات غير متاح حالياً'
                );
            }

            break;

          /* ---------- More ---------- */
          case 'more':

            this.renderMore(
              container
            );

            break;

          /* ---------- Default ---------- */
          default:

            this.navigate(
              'dashboard',
              false
            );

            return;
        }

      } catch (error) {

        console.error(
          `Error rendering page "${page}":`,
          error
        );

        container.innerHTML =
          UI.emptyState(
            'حدث خطأ',
            'تعذر تحميل الصفحة'
          );
      }

      /* ---------- Page bindings ---------- */
      this.bindPageEvents(
        page
      );
    },

    /* =====================================================
       DEFAULT DASHBOARD
       ===================================================== */
    defaultDashboard() {

      const teacher =
        typeof Auth !== 'undefined' &&
        typeof Auth.getTeacher === 'function'
          ? Auth.getTeacher()
          : null;

      const name =
        teacher?.name ||
        teacher?.full_name ||
        'المعلم';

      return `
        <section class="page dashboard-page">

          <div class="page-header">

            <div>
              <h1>مرحباً ${name}</h1>
              <p>أهلاً بك في مُعلّمي</p>
            </div>

          </div>

          <div class="empty-state">

            <div class="empty-state-icon">
              <i class="fa-solid fa-house"></i>
            </div>

            <h3>لوحة التحكم</h3>

            <p>
              تم تسجيل الدخول بنجاح.
            </p>

          </div>

        </section>
      `;
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
              typeof Dashboard.bindEvents === 'function'
            ) {
              Dashboard.bindEvents();
            }

            break;

          case 'students':

            if (
              typeof Students !== 'undefined' &&
              typeof Students.bindEvents === 'function'
            ) {
              Students.bindEvents();
            }

            break;

          case 'profile':

            if (
              typeof Profile !== 'undefined' &&
              typeof Profile.bindEvents === 'function'
            ) {
              Profile.bindEvents();
            }

            break;

          case 'groups':

            if (
              typeof Groups !== 'undefined' &&
              typeof Groups.bindEvents === 'function'
            ) {
              Groups.bindEvents();
            }

            break;

          case 'calendar':

            if (
              typeof Calendar !== 'undefined' &&
              typeof Calendar.bindEvents === 'function'
            ) {
              Calendar.bindEvents();
            }

            break;

          case 'lessons':

            if (
              typeof Lessons !== 'undefined' &&
              typeof Lessons.bindEvents === 'function'
            ) {
              Lessons.bindEvents();
            }

            break;

          case 'attendance':

            if (
              typeof Attendance !== 'undefined' &&
              typeof Attendance.bindEvents === 'function'
            ) {
              Attendance.bindEvents();
            }

            break;

          case 'assignments':

            if (
              typeof Assignments !== 'undefined' &&
              typeof Assignments.bindEvents === 'function'
            ) {
              Assignments.bindEvents();
            }

            break;

          case 'exams':

            if (
              typeof Exams !== 'undefined' &&
              typeof Exams.bindEvents === 'function'
            ) {
              Exams.bindEvents();
            }

            break;

          case 'payments':

            if (
              typeof Payments !== 'undefined' &&
              typeof Payments.bindEvents === 'function'
            ) {
              Payments.bindEvents();
            }

            break;

          case 'reports':

            if (
              typeof Reports !== 'undefined' &&
              typeof Reports.bindEvents === 'function'
            ) {
              Reports.bindEvents();
            }

            break;

          case 'notifications':

            if (
              typeof Notifications !== 'undefined' &&
              typeof Notifications.bindEvents === 'function'
            ) {
              Notifications.bindEvents();
            }

            break;

          case 'settings':

            if (
              typeof Settings !== 'undefined' &&
              typeof Settings.bindEvents === 'function'
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

          <button
            class="more-card"
            data-page="profile"
            type="button"
          >

            <div class="more-card-icon">
              <i class="fa-solid fa-user"></i>
            </div>

            <div>
              <strong>الملف الشخصي</strong>
              <span>بيانات المعلم</span>
            </div>

          </button>

          <button
            class="more-card"
            data-page="reports"
            type="button"
          >

            <div class="more-card-icon">
              <i class="fa-solid fa-chart-column"></i>
            </div>

            <div>
              <strong>التقارير</strong>
              <span>تقارير الطلاب والأداء</span>
            </div>

          </button>

          <button
            class="more-card"
            data-page="payments"
            type="button"
          >

            <div class="more-card-icon">
              <i class="fa-solid fa-wallet"></i>
            </div>

            <div>
              <strong>المدفوعات</strong>
              <span>متابعة الحسابات</span>
            </div>

          </button>

          <button
            class="more-card"
            data-page="settings"
            type="button"
          >

            <div class="more-card-icon">
              <i class="fa-solid fa-gear"></i>
            </div>

            <div>
              <strong>الإعدادات</strong>
              <span>إعدادات التطبيق</span>
            </div>

          </button>

          <button
            class="more-card"
            data-action="backup"
            type="button"
          >

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

          card.addEventListener(
            'click',
            () => {

              const page =
                card.dataset.page;

              const action =
                card.dataset.action;

              if (page) {

                this.navigate(
                  page
                );

                return;
              }

              if (
                action === 'backup'
              ) {

                if (
                  typeof Backup !== 'undefined' &&
                  typeof Backup.render === 'function'
                ) {

                  this.navigate(
                    'settings'
                  );

                } else if (
                  typeof UI !== 'undefined' &&
                  typeof UI.toast === 'function'
                ) {

                  UI.toast(
                    'النسخ الاحتياطي غير متاح حالياً',
                    'info'
                  );
                }
              }
            }
          );
        });
    },

    /* =====================================================
       BACK
       ===================================================== */
    goBack() {

      if (
        this.pageHistory.length > 0
      ) {

        const previous =
          this.pageHistory.pop();

        this.navigate(
          previous,
          false
        );

        return;
      }

      this.navigate(
        'dashboard',
        false
      );
    },

    /* =====================================================
       GLOBAL SEARCH
       ===================================================== */
    openSearch() {

      if (
        typeof Search !== 'undefined' &&
        typeof Search.open === 'function'
      ) {

        Search.open();
      }
    },

    /* =====================================================
       INSTALL PWA
       ===================================================== */
    async showInstallPrompt() {

      if (
        !this.deferredInstallPrompt
      ) {

        if (
          typeof UI !== 'undefined' &&
          typeof UI.toast === 'function'
        ) {

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

        this.deferredInstallPrompt =
          null;

        const banner =
          document.getElementById(
            'install-banner'
          );

        if (banner) {
          banner.classList.add(
            'hidden'
          );
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

      if (
        !('serviceWorker' in navigator)
      ) {
        return;
      }

      window.addEventListener(
        'load',
        () => {

          navigator.serviceWorker
            .register(
              './service-worker.js'
            )
            .then(
              registration => {

                console.log(
                  'Service Worker registered:',
                  registration.scope
                );

                registration.addEventListener(
                  'updatefound',
                  () => {

                    const newWorker =
                      registration.installing;

                    if (!newWorker) {
                      return;
                    }

                    newWorker.addEventListener(
                      'statechange',
                      () => {

                        if (
                          newWorker.state ===
                            'installed' &&
                          navigator
                            .serviceWorker
                            .controller
                        ) {

                          const updateBanner =
                            document.getElementById(
                              'update-banner'
                            );

                          if (
                            updateBanner
                          ) {

                            updateBanner.classList.remove(
                              'hidden'
                            );
                          }
                        }
                      }
                    );
                  }
                );
              }
            )
            .catch(
              error => {

                console.warn(
                  'Service Worker registration failed:',
                  error
                );
              }
            );
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
        hash
          .replace('#', '')
          .trim();

      if (!page) {
        return;
      }

      if (
        this.isAllowedPage(page)
      ) {
        this.currentPage =
          page === 'home'
            ? 'dashboard'
            : page;
      }
    }
  };

  /* =========================================================
     UI
     ========================================================= */

  const UI = {

    /* ---------- Toast ---------- */
    toast(
      message,
      type = 'info'
    ) {

      let container =
        document.getElementById(
          'toast-container'
        );

      if (!container) {

        container =
          document.createElement(
            'div'
          );

        container.id =
          'toast-container';

        document.body.appendChild(
          container
        );
      }

      const toast =
        document.createElement(
          'div'
        );

      toast.className =
        `toast toast-${type}`;

      toast.textContent =
        message;

      container.appendChild(
        toast
      );

      requestAnimationFrame(
        () => {
          toast.classList.add(
            'show'
          );
        }
      );

      setTimeout(
        () => {

          toast.classList.remove(
            'show'
          );

          setTimeout(
            () => {
              toast.remove();
            },
            300
          );

        },
        3000
      );
    },

    /* ---------- Modal ---------- */
    modal(options = {}) {

      const {
        title = '',
        content = '',
        buttons = []
      } = options;

      const overlay =
        document.createElement(
          'div'
        );

      overlay.className =
        'modal-overlay';

      const modal =
        document.createElement(
          'div'
        );

      modal.className =
        'modal';

      modal.innerHTML = `

        <div class="modal-header">

          <h3>${title}</h3>

          <button
            class="modal-close"
            type="button"
            aria-label="إغلاق"
          >
            <i class="fa-solid fa-xmark"></i>
          </button>

        </div>

        <div class="modal-body">
          ${content}
        </div>

        <div class="modal-footer"></div>
      `;

      overlay.appendChild(
        modal
      );

      document.body.appendChild(
        overlay
      );

      const close =
        () => overlay.remove();

      const closeButton =
        modal.querySelector(
          '.modal-close'
        );

      if (closeButton) {

        closeButton.addEventListener(
          'click',
          close
        );
      }

      const footer =
        modal.querySelector(
          '.modal-footer'
        );

      buttons.forEach(
        button => {

          const btn =
            document.createElement(
              'button'
            );

          btn.className =
            `btn ${button.class || ''}`;

          btn.textContent =
            button.text ||
            'إغلاق';

          btn.type =
            'button';

          btn.addEventListener(
            'click',
            async () => {

              try {

                if (
                  typeof button.onClick ===
                  'function'
                ) {
                  await button.onClick();
                }

              } catch (error) {

                console.error(
                  'Modal button error:',
                  error
                );
              }

              if (
                button.close !== false
              ) {
                close();
              }
            }
          );

          footer.appendChild(
            btn
          );
        }
      );

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
        options.title ||
        'تأكيد';

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

              if (
                typeof onConfirm ===
                'function'
              ) {
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
      ).format(
        Number(value) || 0
      );
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

      if (
        Number.isNaN(
          date.getTime()
        )
      ) {
        return value;
      }

      return new Intl.DateTimeFormat(
        'ar-EG',
        {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        }
      ).format(
        date
      );
    },

    /* ---------- Format time ---------- */
    time(value) {

      if (!value) {
        return '-';
      }

      const date =
        new Date(value);

      if (
        Number.isNaN(
          date.getTime()
        )
      ) {
        return value;
      }

      return new Intl.DateTimeFormat(
        'ar-EG',
        {
          hour: 'numeric',
          minute: '2-digit'
        }
      ).format(
        date
      );
    },

    /* ---------- Badge ---------- */
    badge(
      text,
      type = 'default'
    ) {

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
          {
            length: count
          },
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
    document.readyState ===
    'loading'
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
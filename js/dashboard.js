/* ============================================
   مُعلّمي | dashboard.js
   الصفحة الرئيسية - إحصائيات + حصص اليوم
   + تنبيهات + يحتاج متابعة
   ============================================ */

const Dashboard = {

  /* ============================================
     Helpers
     ============================================ */

  safeList(key, filter) {
    try {
      if (
        typeof Storage === 'undefined' ||
        typeof Storage.list !== 'function'
      ) {
        return [];
      }

      const data = Storage.list(key);

      if (!Array.isArray(data)) return [];

      return typeof filter === 'function'
        ? data.filter(filter)
        : data;

    } catch (error) {
      console.error('Dashboard.safeList error:', error);
      return [];
    }
  },

  safeGet(key, fallback = {}) {
    try {
      if (
        typeof Storage === 'undefined' ||
        typeof Storage.get !== 'function'
      ) {
        return fallback;
      }

      const value = Storage.get(key, fallback);
      return value ?? fallback;

    } catch (error) {
      console.error('Dashboard.safeGet error:', error);
      return fallback;
    }
  },

  safeFind(key, id) {
    try {
      if (
        typeof Storage === 'undefined' ||
        typeof Storage.find !== 'function'
      ) {
        return null;
      }

      return Storage.find(key, id) || null;

    } catch (error) {
      console.error('Dashboard.safeFind error:', error);
      return null;
    }
  },

  today() {
    try {
      if (
        typeof Utils !== 'undefined' &&
        typeof Utils.today === 'function'
      ) {
        return Utils.today();
      }
    } catch (error) {
      console.error('Dashboard.today error:', error);
    }

    const d = new Date();

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  },

  escape(value) {
    try {
      if (
        typeof Utils !== 'undefined' &&
        typeof Utils.escapeHTML === 'function'
      ) {
        return Utils.escapeHTML(String(value ?? ''));
      }
    } catch (error) {
      console.error('Dashboard.escape error:', error);
    }

    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  icon(name, size = 20) {
    try {
      if (
        typeof Icons !== 'undefined' &&
        typeof Icons.get === 'function'
      ) {
        return Icons.get(name, size);
      }
    } catch (error) {
      console.error(`Dashboard.icon(${name}) error:`, error);
    }

    return '';
  },

  money(value) {
    const amount = Number(value) || 0;

    try {
      if (
        typeof UI !== 'undefined' &&
        typeof UI.money === 'function'
      ) {
        return UI.money(amount);
      }
    } catch (error) {
      console.error('Dashboard.money error:', error);
    }

    return `${amount.toLocaleString('ar-EG')} ج.م`;
  },

  emptyState(icon, title, message, buttonLabel, action) {
    try {
      if (
        typeof UI !== 'undefined' &&
        typeof UI.emptyState === 'function'
      ) {
        return UI.emptyState(
          icon,
          title,
          message,
          buttonLabel,
          action
        );
      }
    } catch (error) {
      console.error('Dashboard.emptyState error:', error);
    }

    return `
      <div class="empty-state">
        <div class="empty-state-icon">${icon || ''}</div>
        <h3>${this.escape(title || '')}</h3>
        <p>${this.escape(message || '')}</p>
        ${
          buttonLabel && action
            ? `
              <button class="btn btn-primary" data-action="${this.escape(action)}">
                ${this.escape(buttonLabel)}
              </button>
            `
            : ''
        }
      </div>
    `;
  },

  /* ============================================
     Main Render
     ============================================ */

  render(container) {

    try {

      const today = this.today();

      const students = this.safeList(
        Storage?.KEYS?.students
      );

      const groups = this.safeList(
        Storage?.KEYS?.groups
      );

      const lessons = this.safeList(
        Storage?.KEYS?.lessons
      );

      const attendance = this.safeList(
        Storage?.KEYS?.attendance,
        a => a && a.date === today
      );

      const payments = this.safeList(
        Storage?.KEYS?.payments
      );

      const todayLessons = lessons.filter(
        l => l && l.date === today
      );

      /* ---------- Statistics ---------- */

      const totalStudents = students.length;

      const activeStudents = students.filter(
        s => s && s.status === 'نشط'
      ).length;

      const todayPresent = attendance.filter(
        a => a && a.status === 'حاضر'
      ).length;

      const todayAbsent = attendance.filter(
        a => a && a.status === 'غائب'
      ).length;

      const todayRevenue = payments
        .filter(p => p && p.date === today)
        .reduce(
          (sum, p) => sum + (Number(p.paid) || 0),
          0
        );

      const outstanding = payments.reduce(
        (sum, p) => {
          const required = Number(p?.required) || 0;
          const paid = Number(p?.paid) || 0;

          return sum + Math.max(0, required - paid);
        },
        0
      );

      /* ---------- Alerts ---------- */

      const alerts = this.getAlerts();

      /* ---------- Needs Attention ---------- */

      let needsAttention = [];

      try {
        if (
          typeof AIAnalysis !== 'undefined' &&
          typeof AIAnalysis.needsAttention === 'function'
        ) {
          const result = AIAnalysis.needsAttention();

          if (Array.isArray(result)) {
            needsAttention = result;
          }
        }
      } catch (error) {
        console.error(
          'Dashboard: AIAnalysis.needsAttention error:',
          error
        );

        needsAttention = [];
      }

      /* ---------- Quick Actions ---------- */

      const quickActions = [
        {
          icon: 'user',
          label: 'إضافة طالب',
          action: 'add-student',
          color: ''
        },
        {
          icon: 'groups',
          label: 'مجموعة',
          action: 'add-group',
          color: 'gold'
        },
        {
          icon: 'check',
          label: 'حضور',
          action: 'quick-attendance',
          color: 'success'
        },
        {
          icon: 'exam',
          label: 'اختبار',
          action: 'add-exam',
          color: 'warning'
        },
        {
          icon: 'assignment',
          label: 'واجب',
          action: 'add-assignment',
          color: 'info'
        },
        {
          icon: 'payment',
          label: 'دفعة',
          action: 'quick-payment',
          color: 'gold'
        },
        {
          icon: 'report',
          label: 'تقرير',
          action: 'add-report',
          color: ''
        }
      ];

      /* ---------- HTML ---------- */

      const html = `
        <div class="page-header">
          <h1 class="page-title">الرئيسية</h1>
          <p class="page-subtitle">نظرة عامة على نشاطك اليوم</p>
        </div>

        <div class="stats-grid stagger">

          <div class="stat-card" onclick="App.navigate('students')">
            <div class="stat-icon">
              ${this.icon('students', 20)}
            </div>

            <div class="stat-value">
              ${totalStudents}
            </div>

            <div class="stat-label">
              إجمالي الطلاب
            </div>
          </div>

          <div class="stat-card gold" onclick="App.navigate('groups')">
            <div class="stat-icon">
              ${this.icon('groups', 20)}
            </div>

            <div class="stat-value">
              ${groups.length}
            </div>

            <div class="stat-label">
              المجموعات
            </div>
          </div>

          <div class="stat-card info">
            <div class="stat-icon">
              ${this.icon('calendar', 20)}
            </div>

            <div class="stat-value">
              ${todayLessons.length}
            </div>

            <div class="stat-label">
              حصص اليوم
            </div>
          </div>

          <div class="stat-card success">
            <div class="stat-icon">
              ${this.icon('attendance', 20)}
            </div>

            <div class="stat-value">
              ${todayPresent}
            </div>

            <div class="stat-label">
              حضور اليوم
            </div>
          </div>

          <div class="stat-card danger">
            <div class="stat-icon">
              ${this.icon('x', 20)}
            </div>

            <div class="stat-value">
              ${todayAbsent}
            </div>

            <div class="stat-label">
              غياب اليوم
            </div>
          </div>

          <div class="stat-card gold">
            <div class="stat-icon">
              ${this.icon('payment', 20)}
            </div>

            <div class="stat-value">
              ${this.money(todayRevenue).replace(' ج.م', '')}
            </div>

            <div class="stat-label">
              دخل اليوم (ج.م)
            </div>
          </div>

          <div class="stat-card warning">
            <div class="stat-icon">
              ${this.icon('warn', 20)}
            </div>

            <div class="stat-value">
              ${this.money(outstanding).replace(' ج.م', '')}
            </div>

            <div class="stat-label">
              مستحقات (ج.م)
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon">
              ${this.icon('trendUp', 20)}
            </div>

            <div class="stat-value">
              ${activeStudents}
            </div>

            <div class="stat-label">
              طالب نشط
            </div>
          </div>

        </div>

        <!-- Quick Actions -->

        <div class="section">

          <div class="section-header">
            <h2 class="section-title">
              إجراءات سريعة
            </h2>
          </div>

          <div class="quick-actions stagger">

            ${quickActions.map(action => `
              <button
                class="quick-action"
                data-action="${this.escape(action.action)}"
              >

                <div class="quick-action-icon ${this.escape(action.color)}">
                  ${this.icon(action.icon, 20)}
                </div>

                <span>
                  ${this.escape(action.label)}
                </span>

              </button>
            `).join('')}

          </div>

        </div>

        <!-- Alerts -->

        ${
          alerts.length
            ? `
              <div class="section">

                <div class="section-header">

                  <h2 class="section-title">
                    تنبيهات مهمة
                  </h2>

                  <span class="badge badge-danger">
                    ${alerts.length}
                  </span>

                </div>

                <div class="stagger">

                  ${alerts.map(alert => `
                    <div class="alert alert-${this.escape(alert.type)}">

                      <div class="alert-icon">
                        ${this.icon(alert.icon, 20)}
                      </div>

                      <div class="alert-body">

                        <strong>
                          ${alert.title}
                        </strong>

                        <span>
                          ${alert.message}
                        </span>

                        ${
                          alert.action
                            ? `
                              <div style="margin-top:6px;">

                                <button
                                  class="btn btn-text btn-sm"
                                  style="padding:4px 0;"
                                  data-alert-action="${this.escape(alert.action.id)}"
                                  data-alert-data="${this.escape(alert.action.data || '')}"
                                >
                                  ${this.escape(alert.action.label)}
                                </button>

                              </div>
                            `
                            : ''
                        }

                      </div>

                    </div>
                  `).join('')}

                </div>

              </div>
            `
            : ''
        }

        <!-- Needs Attention -->

        ${
          needsAttention.length
            ? `
              <div class="section">

                <div class="section-header">

                  <h2 class="section-title">
                    يحتاج متابعة
                  </h2>

                  <span class="badge badge-warning">
                    ${needsAttention.length}
                  </span>

                </div>

                <div class="stagger">

                  ${needsAttention.slice(0, 3).map(item => {

                    const student = item?.student || {};
                    const reasons = Array.isArray(item?.reasons)
                      ? item.reasons
                      : [];

                    const firstReason =
                      reasons[0] || {
                        severity: 'warning'
                      };

                    const severity =
                      ['danger', 'warning', 'info'].includes(
                        firstReason.severity
                      )
                        ? firstReason.severity
                        : 'warning';

                    return `
                      <div class="alert alert-${severity}">

                        <div class="alert-icon">
                          ${this.icon(
                            severity === 'danger'
                              ? 'warn'
                              : 'info',
                            20
                          )}
                        </div>

                        <div class="alert-body">

                          <strong>
                            ${this.escape(student.name || 'طالب')}
                          </strong>

                          <div>
                            ${reasons
                              .map(reason =>
                                this.escape(reason?.label || '')
                              )
                              .join(' • ')}
                          </div>

                          <div
                            style="
                              display:flex;
                              gap:8px;
                              margin-top:8px;
                              flex-wrap:wrap;
                            "
                          >

                            <button
                              class="btn btn-text btn-sm"
                              style="padding:4px 0;"
                              data-attention-profile="${this.escape(student.id || '')}"
                            >
                              فتح الملف ←
                            </button>

                            <button
                              class="btn btn-text btn-sm"
                              style="padding:4px 0;"
                              data-attention-plan="${this.escape(student.id || '')}"
                            >
                              خطة تحسين
                            </button>

                            <button
                              class="btn btn-text btn-sm"
                              style="padding:4px 0;"
                              data-attention-report="${this.escape(student.id || '')}"
                            >
                              تقرير
                            </button>

                          </div>

                        </div>

                      </div>
                    `;

                  }).join('')}

                </div>

                ${
                  needsAttention.length > 3
                    ? `
                      <button
                        class="btn btn-outline btn-block"
                        style="margin-top:var(--space-3);"
                        data-nav-needs="1"
                      >
                        عرض كل الطلاب الذين يحتاجون متابعة
                        (${needsAttention.length})
                      </button>
                    `
                    : ''
                }

              </div>
            `
            : ''
        }

        <!-- Today's Lessons -->

        <div class="section">

          <div class="section-header">

            <h2 class="section-title">
              حصص اليوم
            </h2>

            <span class="badge">
              ${todayLessons.length}
            </span>

          </div>

          ${
            todayLessons.length === 0
              ? this.emptyState(
                  this.icon('coffee', 36),
                  'يبدو أن جدولك هادئ اليوم',
                  'لا توجد حصص مجدولة. استمتع بيومك أو أضف حصة جديدة.',
                  'إضافة حصة',
                  'add-lesson'
                )
              : `
                <div class="stagger">
                  ${todayLessons
                    .map(lesson =>
                      this.renderLessonCard(lesson)
                    )
                    .join('')}
                </div>
              `
          }

        </div>
      `;

      /* ========================================
         Render into container if supplied
         ======================================== */

      if (
        container &&
        typeof container === 'object'
      ) {
        container.innerHTML = html;
      }

      return html;

    } catch (error) {

      console.error(
        'Dashboard.render error:',
        error
      );

      const fallback = `
        <div class="empty-state">
          <div class="empty-state-icon">
            ${this.icon('warn', 36)}
          </div>

          <h3>
            تعذر تحميل الصفحة
          </h3>

          <p>
            حدث خطأ أثناء تحميل لوحة التحكم.
          </p>

          <button
            class="btn btn-primary"
            onclick="location.reload()"
          >
            إعادة المحاولة
          </button>
        </div>
      `;

      if (
        container &&
        typeof container === 'object'
      ) {
        container.innerHTML = fallback;
      }

      return fallback;
    }
  },

  /* ============================================
     Needs Attention Page
     ============================================ */

  renderNeeds() {

    let items = [];

    try {

      if (
        typeof AIAnalysis !== 'undefined' &&
        typeof AIAnalysis.needsAttention === 'function'
      ) {
        const result =
          AIAnalysis.needsAttention();

        if (Array.isArray(result)) {
          items = result;
        }
      }

    } catch (error) {

      console.error(
        'Dashboard.renderNeeds error:',
        error
      );

      items = [];
    }

    return `
      <div class="page-header">

        <h1 class="page-title">
          يحتاج متابعة
        </h1>

        <p class="page-subtitle">
          طلاب لديهم مؤشرات تحتاج انتباهك
        </p>

      </div>

      ${
        items.length === 0
          ? this.emptyState(
              this.icon('check', 36),
              'لا يوجد من يحتاج متابعة',
              'جميع الطلاب بحالة جيدة وفق البيانات المتاحة.'
            )
          : `
            <div class="stagger">

              ${items.map(item => {

                const student = item?.student || {};
                const reasons = Array.isArray(item?.reasons)
                  ? item.reasons
                  : [];

                let perf = null;

                try {

                  if (
                    typeof AIAnalysis !== 'undefined' &&
                    typeof AIAnalysis.prepare === 'function' &&
                    typeof AIAnalysis.performance === 'function'
                  ) {

                    const data =
                      AIAnalysis.prepare(student.id);

                    perf =
                      AIAnalysis.performance(data);
                  }

                } catch (error) {

                  console.error(
                    'Dashboard.performance error:',
                    error
                  );

                }

                const score =
                  perf &&
                  perf.score != null
                    ? perf.score
                    : null;

                const attendanceRate =
                  item.attRate != null
                    ? item.attRate
                    : '—';

                const severity =
                  reasons[0]?.severity || 'warning';

                return `
                  <div class="card needs-card">

                    <div class="needs-header">

                      <div class="list-item-avatar">
                        ${this.escape(
                          student.name
                            ? student.name
                                .split(' ')
                                .map(x => x[0] || '')
                                .slice(0, 2)
                                .join('')
                            : '?'
                        )}
                      </div>

                      <div
                        style="
                          flex:1;
                          min-width:0;
                        "
                      >

                        <div style="font-weight:700;">
                          ${this.escape(
                            student.name || 'طالب'
                          )}
                        </div>

                        <div
                          style="
                            font-size:var(--font-size-xs);
                            color:var(--text-tertiary);
                          "
                        >

                          ${this.escape(
                            student.className || ''
                          )}

                          • حضور ${attendanceRate}%

                          ${
                            score != null
                              ? ` • أداء ${score}%`
                              : ''
                          }

                        </div>

                      </div>

                      <span
                        class="badge badge-${
                          severity === 'danger'
                            ? 'danger'
                            : severity === 'warning'
                            ? 'warning'
                            : 'info'
                        }"
                      >
                        ${reasons.length} سبب
                      </span>

                    </div>

                    <ul
                      style="
                        margin:var(--space-3) 0;
                        padding-inline-start:18px;
                        font-size:var(--font-size-sm);
                        color:var(--text-secondary);
                      "
                    >

                      ${reasons
                        .map(reason => `
                          <li style="margin-bottom:3px;">
                            ${this.escape(
                              reason?.label || ''
                            )}
                          </li>
                        `)
                        .join('')}

                    </ul>

                    <div
                      style="
                        display:flex;
                        gap:8px;
                        flex-wrap:wrap;
                      "
                    >

                      <button
                        class="btn btn-outline btn-sm"
                        data-attention-profile="${this.escape(student.id || '')}"
                      >
                        ${this.icon('user', 14)}
                        الملف
                      </button>

                      <button
                        class="btn btn-outline btn-sm"
                        data-attention-plan="${this.escape(student.id || '')}"
                      >
                        ${this.icon('target', 14)}
                        خطة تحسين
                      </button>

                      <button
                        class="btn btn-whatsapp btn-sm"
                        data-attention-report="${this.escape(student.id || '')}"
                      >
                        ${this.icon('whatsapp', 14)}
                        تقرير ولي الأمر
                      </button>

                    </div>

                  </div>
                `;

              }).join('')}

            </div>
          `
      }
    `;
  },

  /* ============================================
     Lesson Card
     ============================================ */

  renderLessonCard(lesson) {

    if (!lesson) return '';

    const group =
      this.safeFind(
        Storage?.KEYS?.groups,
        lesson.groupId
      );

    if (!group) return '';

    const studentCount =
      this.safeList(
        Storage?.KEYS?.students,
        student =>
          student &&
          student.groupId === group.id &&
          student.status === 'نشط'
      ).length;

    const todayAttendance =
      this.safeList(
        Storage?.KEYS?.attendance,
        attendance =>
          attendance &&
          attendance.lessonId === lesson.id
      ).length;

    const isCompleted =
      lesson.status === 'تمت' ||
      todayAttendance > 0;

    let timeText = '';

    try {

      if (
        typeof UI !== 'undefined' &&
        typeof UI.formatTime === 'function'
      ) {
        timeText =
          `${UI.formatTime(lesson.startTime)} - ${UI.formatTime(lesson.endTime)}`;
      } else {
        timeText =
          `${lesson.startTime || ''} - ${lesson.endTime || ''}`;
      }

    } catch (error) {

      timeText =
        `${lesson.startTime || ''} - ${lesson.endTime || ''}`;

    }

    let statusBadge = '';

    try {

      if (
        typeof UI !== 'undefined' &&
        typeof UI.lessonStatusBadge === 'function'
      ) {
        statusBadge =
          UI.lessonStatusBadge(
            lesson.status
          );
      }

    } catch (error) {
      console.error(
        'Dashboard.lessonStatusBadge error:',
        error
      );
    }

    return `
      <div
        class="lesson-card ${
          lesson.status === 'تمت'
            ? 'completed'
            : ''
        }"
        data-lesson="${this.escape(lesson.id || '')}"
      >

        <div
          style="
            display:flex;
            justify-content:space-between;
            align-items:flex-start;
            gap:var(--space-2);
            margin-bottom:var(--space-2);
          "
        >

          <div style="flex:1;">

            <h3
              style="
                font-weight:700;
                color:var(--text-primary);
                font-size:var(--font-size-md);
                margin-bottom:4px;
              "
            >
              ${this.escape(group.name || 'مجموعة')}
            </h3>

            <p
              style="
                font-size:var(--font-size-xs);
                color:var(--text-tertiary);
              "
            >

              ${this.escape(group.subject || '')}

              • ${this.escape(group.className || '')}

              ${
                group.section
                  ? ` • ${this.escape(group.section)}`
                  : ''
              }

            </p>

          </div>

          ${statusBadge}

        </div>

        <div
          style="
            display:flex;
            flex-wrap:wrap;
            gap:var(--space-3);
            margin-top:var(--space-3);
            font-size:var(--font-size-xs);
            color:var(--text-secondary);
          "
        >

          <span
            style="
              display:inline-flex;
              align-items:center;
              gap:4px;
            "
          >
            ${this.icon('clock', 14)}
            ${timeText}
          </span>

          <span
            style="
              display:inline-flex;
              align-items:center;
              gap:4px;
            "
          >
            ${this.icon('students', 14)}
            ${studentCount} طالب
          </span>

          ${
            lesson.location
              ? `
                <span
                  style="
                    display:inline-flex;
                    align-items:center;
                    gap:4px;
                  "
                >
                  ${this.icon('location', 14)}
                  ${this.escape(lesson.location)}
                </span>
              `
              : ''
          }

        </div>

        ${
          !isCompleted
            ? `
              <button
                class="btn btn-primary btn-block"
                style="margin-top:var(--space-3);"
                data-start-lesson="${this.escape(lesson.id || '')}"
              >
                بدء الحصة وتسجيل الحضور
              </button>
            `
            : `
              <button
                class="btn btn-secondary btn-block"
                style="margin-top:var(--space-3);"
                data-lesson-detail="${this.escape(lesson.id || '')}"
              >
                عرض التفاصيل
              </button>
            `
        }

      </div>
    `;
  },

  /* ============================================
     Alerts
     ============================================ */

  getAlerts() {

    const alerts = [];

    try {

      const students =
        this.safeList(Storage?.KEYS?.students);

      const payments =
        this.safeList(Storage?.KEYS?.payments);

      const lessons =
        this.safeList(Storage?.KEYS?.lessons);

      const exams =
        this.safeList(Storage?.KEYS?.exams);

      const submissions =
        this.safeList(Storage?.KEYS?.submissions);

      const settings =
        this.safeGet(
          Storage?.KEYS?.settings,
          {}
        );

      const threshold =
        Number(
          settings?.absenceAlertThreshold
        ) || 3;

      /* ---------- Payments ---------- */

      const outstandingStudents =
        students.filter(student => {

          const studentPayments =
            payments.filter(
              payment =>
                payment &&
                payment.studentId === student.id
            );

          const totalRequired =
            studentPayments.reduce(
              (sum, payment) =>
                sum +
                (Number(payment?.required) || 0),
              0
            );

          const totalPaid =
            studentPayments.reduce(
              (sum, payment) =>
                sum +
                (Number(payment?.paid) || 0),
              0
            );

          return totalRequired - totalPaid > 0;
        });

      if (outstandingStudents.length > 0) {

        alerts.push({
          type: 'warning',
          icon: 'payment',
          title:
            `${outstandingStudents.length} طالب لديهم اشتراك مستحق`,
          message:
            'يحتاجون لمتابعة المدفوعات هذا الشهر',
          action: {
            id: 'go-payments',
            label: 'عرض المدفوعات'
          }
        });

      }

      /* ---------- Absence ---------- */

      const completedLessons =
        lessons.filter(
          lesson =>
            lesson &&
            lesson.status === 'تمت'
        );

      students.forEach(student => {

        if (!student?.id) return;

        const studentAttendance =
          this.safeList(
            Storage?.KEYS?.attendance,
            attendance =>
              attendance &&
              attendance.studentId === student.id &&
              attendance.status === 'غائب'
          );

        const groupLessons =
          completedLessons
            .filter(
              lesson =>
                lesson.groupId === student.groupId
            )
            .sort(
              (a, b) =>
                String(b.date || '')
                  .localeCompare(
                    String(a.date || '')
                  )
            )
            .slice(0, threshold);

        if (
          groupLessons.length >= threshold
        ) {

          const recentAbsences =
            groupLessons.filter(
              lesson =>
                studentAttendance.some(
                  attendance =>
                    attendance.lessonId === lesson.id
                )
            ).length;

          if (
            recentAbsences >= threshold
          ) {

            alerts.push({
              type: 'danger',
              icon: 'warn',
              title:
                `${this.escape(student.name || 'طالب')} غاب عن آخر ${threshold} حصص`,
              message:
                'ينصح بالتواصل مع ولي الأمر',
              action: {
                id: 'contact-parent',
                data: student.id,
                label:
                  'تجهيز رسالة لولي الأمر'
              }
            });

          }

        }

      });

      /* ---------- Tomorrow Exams ---------- */

      const tomorrow =
        new Date();

      tomorrow.setDate(
        tomorrow.getDate() + 1
      );

      const tomorrowStr =
        `${tomorrow.getFullYear()}-${String(
          tomorrow.getMonth() + 1
        ).padStart(2, '0')}-${String(
          tomorrow.getDate()
        ).padStart(2, '0')}`;

      const tomorrowExams =
        exams.filter(
          exam =>
            exam &&
            exam.date === tomorrowStr
        );

      if (
        tomorrowExams.length > 0
      ) {

        const exam =
          tomorrowExams[0];

        const group =
          this.safeFind(
            Storage?.KEYS?.groups,
            exam.groupId
          );

        alerts.push({
          type: 'info',
          icon: 'exam',
          title:
            `اختبار ${this.escape(exam.name || '')} غدًا`,
          message:
            `لمجموعة ${this.escape(group?.name || '')}`,
          action: {
            id: 'go-exams',
            label: 'عرض الاختبارات'
          }
        });

      }

      /* ---------- Pending Assignments ---------- */

      const pending =
        submissions.filter(
          submission =>
            submission &&
            (
              submission.status === 'not_submitted' ||
              submission.status === 'late'
            )
        ).length;

      if (pending > 0) {

        alerts.push({
          type: 'warning',
          icon: 'assignment',
          title:
            `${pending} واجب لم يتم تسليمه`,
          message:
            'طلاب بحاجة لمتابعة الواجبات',
          action: {
            id: 'go-assignments',
            label: 'عرض الواجبات'
          }
        });

      }

      /* ---------- Backup Reminder ---------- */

      let meta = {};

      try {

        if (
          typeof Storage !== 'undefined' &&
          typeof Storage.getMeta === 'function'
        ) {
          meta =
            Storage.getMeta() || {};
        }

      } catch (error) {

        console.error(
          'Dashboard.getMeta error:',
          error
        );

      }

      const lastBackup =
        meta.lastBackupAt || null;

      if (
        !lastBackup ||
        (
          Date.now() -
          Number(lastBackup)
        ) >
        7 * 86400000
      ) {

        alerts.push({
          type: 'info',
          icon: 'database',
          title:
            'لم تأخذ نسخة احتياطية مؤخرًا',
          message:
            'بياناتك محفوظة في هذا الجهاز فقط - صدّر نسخة احتياطية للحفاظ عليها',
          action: {
            id: 'go-backup',
            label: 'إنشاء نسخة الآن'
          }
        });

      }

    } catch (error) {

      console.error(
        'Dashboard.getAlerts error:',
        error
      );

    }

    return alerts.slice(0, 6);
  },

  /* ============================================
     Needs Bindings
     ============================================ */

  bindNeeds() {

    document
      .querySelectorAll(
        '[data-attention-profile]'
      )
      .forEach(button => {

        button.addEventListener(
          'click',
          () => {

            try {

              if (
                typeof Students !== 'undefined' &&
                typeof Students.openProfile === 'function'
              ) {
                Students.openProfile(
                  button.dataset.attentionProfile
                );
              }

            } catch (error) {

              console.error(
                'Dashboard profile action error:',
                error
              );

            }

          }
        );

      });

    document
      .querySelectorAll(
        '[data-attention-plan]'
      )
      .forEach(button => {

        button.addEventListener(
          'click',
          () => {

            try {

              if (
                typeof Students !== 'undefined' &&
                typeof Students.openProfile === 'function'
              ) {

                Students.openProfile(
                  button.dataset.attentionPlan
                );

                setTimeout(() => {

                  const tab =
                    document.querySelector(
                      '#profile-tabs [data-tab="plan"]'
                    );

                  if (tab) {
                    tab.click();
                  }

                }, 150);

              }

            } catch (error) {

              console.error(
                'Dashboard plan action error:',
                error
              );

            }

          }
        );

      });

    document
      .querySelectorAll(
        '[data-attention-report]'
      )
      .forEach(button => {

        button.addEventListener(
          'click',
          () => {

            try {

              if (
                typeof ParentReport !== 'undefined' &&
                typeof ParentReport.open === 'function'
              ) {

                ParentReport.open(
                  button.dataset.attentionReport
                );

              }

            } catch (error) {

              console.error(
                'Dashboard report action error:',
                error
              );

            }

          }
        );

      });

  },

  /* ============================================
     Main Bind
     ============================================ */

  bind() {

    /* ---------- Quick Actions ---------- */

    document
      .querySelectorAll('[data-action]')
      .forEach(button => {

        button.addEventListener(
          'click',
          () => {

            const action =
              button.dataset.action;

            try {

              switch (action) {

                case 'add-student':
                  if (
                    typeof Students !== 'undefined' &&
                    typeof Students.openAddForm === 'function'
                  ) {
                    Students.openAddForm();
                  }
                  break;

                case 'add-group':
                  if (
                    typeof Groups !== 'undefined' &&
                    typeof Groups.openAddForm === 'function'
                  ) {
                    Groups.openAddForm();
                  }
                  break;

                case 'quick-attendance':
                  if (
                    typeof Attendance !== 'undefined' &&
                    typeof Attendance.openQuick === 'function'
                  ) {
                    Attendance.openQuick();
                  }
                  break;

                case 'add-exam':
                  if (
                    typeof Exams !== 'undefined' &&
                    typeof Exams.openAddForm === 'function'
                  ) {
                    Exams.openAddForm();
                  }
                  break;

                case 'add-assignment':
                  if (
                    typeof Assignments !== 'undefined' &&
                    typeof Assignments.openAddForm === 'function'
                  ) {
                    Assignments.openAddForm();
                  }
                  break;

                case 'quick-payment':
                  if (
                    typeof Payments !== 'undefined' &&
                    typeof Payments.openQuick === 'function'
                  ) {
                    Payments.openQuick();
                  }
                  break;

                case 'add-report':
                  if (
                    typeof Reports !== 'undefined' &&
                    typeof Reports.openGenerator === 'function'
                  ) {
                    Reports.openGenerator();
                  }
                  break;

                case 'add-lesson':
                  if (
                    typeof Lessons !== 'undefined' &&
                    typeof Lessons.openAddForm === 'function'
                  ) {
                    Lessons.openAddForm();
                  }
                  break;

              }

            } catch (error) {

              console.error(
                `Dashboard action "${action}" error:`,
                error
              );

            }

          }
        );

      });

    /* ---------- Start Lesson ---------- */

    document
      .querySelectorAll(
        '[data-start-lesson]'
      )
      .forEach(button => {

        button.addEventListener(
          'click',
          () => {

            try {

              if (
                typeof Lessons !== 'undefined' &&
                typeof Lessons.startLesson === 'function'
              ) {

                Lessons.startLesson(
                  button.dataset.startLesson
                );

              }

            } catch (error) {

              console.error(
                'Dashboard start lesson error:',
                error
              );

            }

          }
        );

      });

    /* ---------- Lesson Detail ---------- */

    document
      .querySelectorAll(
        '[data-lesson-detail]'
      )
      .forEach(button => {

        button.addEventListener(
          'click',
          () => {

            try {

              if (
                typeof Lessons !== 'undefined' &&
                typeof Lessons.openDetail === 'function'
              ) {

                Lessons.openDetail(
                  button.dataset.lessonDetail
                );

              }

            } catch (error) {

              console.error(
                'Dashboard lesson detail error:',
                error
              );

            }

          }
        );

      });

    /* ---------- Alert Actions ---------- */

    document
      .querySelectorAll(
        '[data-alert-action]'
      )
      .forEach(button => {

        button.addEventListener(
          'click',
          () => {

            try {

              const action =
                button.dataset.alertAction;

              const data =
                button.dataset.alertData;

              if (
                action === 'go-payments'
              ) {

                App.navigate('payments');

              } else if (
                action === 'go-exams'
              ) {

                App.navigate('exams');

              } else if (
                action === 'go-assignments'
              ) {

                App.navigate('assignments');

              } else if (
                action === 'go-backup'
              ) {

                App.navigate('settings');

                setTimeout(() => {

                  document
                    .getElementById(
                      'backup-section'
                    )
                    ?.scrollIntoView({
                      behavior: 'smooth'
                    });

                }, 200);

              } else if (
                action === 'contact-parent'
              ) {

                if (
                  typeof ParentReport !== 'undefined' &&
                  typeof ParentReport.open === 'function'
                ) {

                  ParentReport.open(data);

                }

              }

            } catch (error) {

              console.error(
                'Dashboard alert action error:',
                error
              );

            }

          }
        );

      });

    /* ---------- Needs ---------- */

    this.bindNeeds();

    /* ---------- Needs Page ---------- */

    document
      .querySelectorAll(
        '[data-nav-needs]'
      )
      .forEach(button => {

        button.addEventListener(
          'click',
          () => {

            try {

              App.navigate('needs');

            } catch (error) {

              console.error(
                'Dashboard needs navigation error:',
                error
              );

            }

          }
        );

      });

  }
};


/* ============================================
   Global Export
   ============================================ */

window.Dashboard = Dashboard;
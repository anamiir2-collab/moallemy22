/* ============================================
   مُعلّمي | calendar.js
   التقويم - شهري/أسبوعي/يومي
   ============================================ */

const Calendar = {
  view: 'month',
  current: new Date(),

  render() {
    return `
      <div class="page-header">
        <h1 class="page-title">التقويم</h1>
        <p class="page-subtitle">جدول الحصص والاختبارات والمواعيد</p>
      </div>

      <div class="tabs" id="cal-tabs" style="margin-bottom: var(--space-4);">
        <button class="tab ${this.view === 'month' ? 'active' : ''}" data-view="month">شهري</button>
        <button class="tab ${this.view === 'week' ? 'active' : ''}" data-view="week">أسبوعي</button>
        <button class="tab ${this.view === 'day' ? 'active' : ''}" data-view="day">يومي</button>
      </div>

      <div class="card" style="margin-bottom: var(--space-4);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: var(--space-3);">
          <button class="icon-btn" id="cal-prev"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg></button>
          <h3 id="cal-title" style="font-weight: 700; font-size: var(--font-size-md);"></h3>
          <button class="icon-btn" id="cal-next"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" style="transform: scaleX(-1);"><path d="m9 18 6-6-6-6"/></svg></button>
        </div>
        <div id="cal-content"></div>
      </div>

      <div class="legend">
        <div class="legend-item"><span class="legend-dot" style="background: var(--color-primary);"></span> حصة</div>
        <div class="legend-item"><span class="legend-dot" style="background: var(--color-warning);"></span> اختبار</div>
        <div class="legend-item"><span class="legend-dot" style="background: var(--color-info);"></span> واجب</div>
        <div class="legend-item"><span class="legend-dot" style="background: var(--color-success);"></span> مدفوعات</div>
      </div>

      <div id="cal-events" style="margin-top: var(--space-5);"></div>
    `;
  },

  bind() {
    document.querySelectorAll('#cal-tabs .tab').forEach(t => {
      t.addEventListener('click', () => {
        this.view = t.dataset.view;
        this.renderCalendar();
      });
    });
    document.getElementById('cal-prev').addEventListener('click', () => this.navigate(-1));
    document.getElementById('cal-next').addEventListener('click', () => this.navigate(1));
    this.renderCalendar();
  },

  navigate(dir) {
    if (this.view === 'month') {
      this.current.setMonth(this.current.getMonth() + dir);
    } else if (this.view === 'week') {
      this.current.setDate(this.current.getDate() + dir * 7);
    } else {
      this.current.setDate(this.current.getDate() + dir);
    }
    this.renderCalendar();
  },

  renderCalendar() {
    const titleEl = document.getElementById('cal-title');
    const contentEl = document.getElementById('cal-content');
    const eventsEl = document.getElementById('cal-events');
    if (!titleEl || !contentEl) return;

    const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    const days = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
    const daysShort = ['أحد','إثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت'];

    if (this.view === 'month') {
      titleEl.textContent = `${months[this.current.getMonth()]} ${this.current.getFullYear()}`;
      contentEl.innerHTML = this.renderMonth(daysShort);
    } else if (this.view === 'week') {
      const start = new Date(this.current);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      titleEl.textContent = `${start.getDate()} ${months[start.getMonth()].slice(0,3)} - ${end.getDate()} ${months[end.getMonth()].slice(0,3)}`;
      contentEl.innerHTML = this.renderWeek(days, start);
    } else {
      titleEl.textContent = UI.formatDate(this.current.toISOString(), { weekday: true });
      contentEl.innerHTML = '';
    }

    this.renderEvents(eventsEl);
  },

  renderMonth(daysShort) {
    const year = this.current.getFullYear();
    const month = this.current.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const todayStr = new Date().toISOString().slice(0, 10);

    let html = '<div class="calendar-grid">';
    daysShort.forEach(d => html += `<div class="calendar-header">${d}</div>`);

    // Empty cells before first day
    for (let i = 0; i < startDayOfWeek; i++) html += '<div class="calendar-cell empty"></div>';

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = new Date(year, month, d).toISOString().slice(0, 10);
      const hasEvents = this.getEventsForDate(dateStr).length > 0;
      const isToday = dateStr === todayStr;
      html += `<div class="calendar-cell ${isToday ? 'today' : ''} ${hasEvents ? 'has-events' : ''}" data-date="${dateStr}">${d}</div>`;
    }

    html += '</div>';
    return html;
  },

  renderWeek(days, start) {
    const todayStr = new Date().toISOString().slice(0, 10);
    let html = '<div class="list">';
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().slice(0, 10);
      const events = this.getEventsForDate(dateStr);
      const isToday = dateStr === todayStr;
      html += `
        <div class="card" style="margin-bottom: var(--space-2); ${isToday ? 'border-color: var(--color-primary);' : ''}">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: ${events.length ? 'var(--space-2)' : '0'};">
            <div>
              <div style="font-weight: 700; ${isToday ? 'color: var(--color-primary);' : ''}">${days[date.getDay()]}</div>
              <div style="font-size: var(--font-size-xs); color: var(--text-tertiary);">${date.getDate()} ${['ينا','فبر','مار','أبر','ماي','يون','يول','أغس','سبت','أكت','نوف','ديس'][date.getMonth()]}</div>
            </div>
            ${events.length ? `<span class="badge">${events.length} حدث</span>` : '<span class="badge">لا أحداث</span>'}
          </div>
          ${events.length ? `<div style="display:flex; flex-direction: column; gap: 4px; margin-top: var(--space-2);">${events.map(e => this.renderEventItem(e)).join('')}</div>` : ''}
        </div>
      `;
    }
    html += '</div>';
    return html;
  },

  getEventsForDate(dateStr) {
    const events = [];
    const lessons = Storage.list(Storage.KEYS.lessons, l => l.date === dateStr);
    lessons.forEach(l => {
      const g = Storage.find(Storage.KEYS.groups, l.groupId);
      events.push({ type: 'lesson', time: l.startTime, title: g ? g.name : 'حصة', groupId: l.groupId, id: l.id, color: 'primary' });
    });
    const exams = Storage.list(Storage.KEYS.exams, e => e.date === dateStr);
    exams.forEach(e => {
      const g = Storage.find(Storage.KEYS.groups, e.groupId);
      events.push({ type: 'exam', time: '', title: `اختبار: ${e.name}`, subtitle: g ? g.name : '', color: 'warning' });
    });
    const assignments = Storage.list(Storage.KEYS.assignments, a => a.dueDate === dateStr);
    assignments.forEach(a => {
      const g = Storage.find(Storage.KEYS.groups, a.groupId);
      events.push({ type: 'assignment', time: '', title: `تسليم: ${a.name}`, subtitle: g ? g.name : '', color: 'info' });
    });
    const payments = Storage.list(Storage.KEYS.payments, p => p.date === dateStr && p.paid > 0);
    payments.forEach(p => {
      const s = Storage.find(Storage.KEYS.students, p.studentId);
      events.push({ type: 'payment', time: '', title: `دفعة: ${UI.money(p.paid)}`, subtitle: s ? s.name : '', color: 'success' });
    });
    return events;
  },

  renderEventItem(e) {
    const colors = {
      primary: 'var(--color-primary)',
      warning: 'var(--color-warning)',
      info: 'var(--color-info)',
      success: 'var(--color-success)'
    };
    return `
      <div style="display:flex; align-items:center; gap:8px; padding: 6px var(--space-2); background: var(--color-surface-2); border-radius: var(--radius-sm); font-size: var(--font-size-xs);">
        <span style="width:6px;height:6px;border-radius:50%;background:${colors[e.color] || 'var(--color-primary)'};"></span>
        ${e.time ? `<span style="color: var(--text-tertiary); font-weight: 700; min-width: 50px;">${UI.formatTime(e.time)}</span>` : ''}
        <span style="flex:1; font-weight: 600;">${e.title}</span>
        ${e.subtitle ? `<span style="color: var(--text-tertiary);">${e.subtitle}</span>` : ''}
      </div>
    `;
  },

  renderEvents(container) {
    let dateStr;
    if (this.view === 'month') {
      // Show events for selected date (today if none selected)
      dateStr = new Date().toISOString().slice(0, 10);
    } else if (this.view === 'week') {
      dateStr = new Date().toISOString().slice(0, 10);
    } else {
      dateStr = this.current.toISOString().slice(0, 10);
    }
    const events = this.getEventsForDate(dateStr);
    container.innerHTML = `
      <h3 style="font-weight: 700; margin-bottom: var(--space-3);">أحداث ${UI.formatDate(dateStr, { weekday: true })}</h3>
      ${events.length === 0 ? UI.emptyState('📅', 'لا توجد أحداث', 'لا توجد حصص أو اختبارات في هذا اليوم.') : `
        <div class="list stagger">
          ${events.map(e => this.renderEventItemLarge(e)).join('')}
        </div>
      `}
    `;
  },

  renderEventItemLarge(e) {
    const colors = {
      primary: ['lesson', 'حصة', '📚'],
      warning: ['exam', 'اختبار', '📝'],
      info: ['assignment', 'واجب', '📋'],
      success: ['payment', 'دفعة', '💰']
    };
    const [type, label, icon] = colors[e.color] || ['event', 'حدث', '•'];
    return `
      <div class="list-item">
        <div class="quick-action-icon ${e.color === 'primary' ? '' : e.color}">${icon}</div>
        <div class="list-item-body">
          <div class="list-item-title">${e.title}</div>
          <div class="list-item-subtitle">${e.subtitle || ''}${e.time ? ' • ' + UI.formatTime(e.time) : ''}</div>
        </div>
        <span class="badge badge-${e.color === 'primary' ? 'info' : e.color}">${label}</span>
      </div>
    `;
  }
};

window.Calendar = Calendar;

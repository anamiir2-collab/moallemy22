/* ============================================
   مُعلّمي | search.js
   البحث الشامل: طلاب، مجموعات، واجبات، اختبارات، مدفوعات، تقارير
   مع debounce لتجنب إعادة الرسم عند كل حرف
   ============================================ */

const GlobalSearch = {
  open() {
    UI.modal({
      title: 'بحث شامل',
      size: 'large',
      body: `
        <div class="search-bar">
          ${Icons.get('search', 18)}
          <input type="search" id="global-search" placeholder="ابحث في الطلاب، المجموعات، الواجبات، الاختبارات، المدفوعات..." autofocus>
        </div>
        <div id="search-results" style="max-height: 60vh; overflow-y: auto;"></div>
      `
    });
    const input = document.getElementById('global-search');
    input.addEventListener('input', Utils.debounce((e) => this.run(e.target.value), 250));
  },

  run(q) {
    const results = document.getElementById('search-results');
    if (!results) return;
    if (!q || q.length < 2) { results.innerHTML = ''; return; }
    q = q.toLowerCase();

    let html = '';

    // ===== الطلاب =====
    const students = Storage.list(Storage.KEYS.students, s =>
      s.name.toLowerCase().includes(q) ||
      (s.parentName && s.parentName.toLowerCase().includes(q)) ||
      (s.parentPhone && s.parentPhone.includes(q)) ||
      (s.studentPhone && s.studentPhone.includes(q)) ||
      (s.className && s.className.toLowerCase().includes(q))
    );
    if (students.length) {
      html += this.section('الطلاب');
      html += students.slice(0, 8).map(s => `
        <div class="list-item clickable" data-student="${s.id}">
          <div class="list-item-avatar">${Utils.escapeHTML(UI.initials(s.name))}</div>
          <div class="list-item-body">
            <div class="list-item-title">${Utils.escapeHTML(s.name)}</div>
            <div class="list-item-subtitle">${Utils.escapeHTML(s.className || '')} • ${Utils.escapeHTML(s.subject || '')}</div>
          </div>
        </div>
      `).join('');
    }

    // ===== المجموعات =====
    const groups = Storage.list(Storage.KEYS.groups, g =>
      g.name.toLowerCase().includes(q) ||
      (g.subject && g.subject.toLowerCase().includes(q)) ||
      (g.className && g.className.toLowerCase().includes(q))
    );
    if (groups.length) {
      html += this.section('المجموعات');
      html += groups.slice(0, 6).map(g => `
        <div class="list-item clickable" data-group="${g.id}">
          <div class="list-item-avatar">${Utils.escapeHTML(UI.initials(g.name))}</div>
          <div class="list-item-body">
            <div class="list-item-title">${Utils.escapeHTML(g.name)}</div>
            <div class="list-item-subtitle">${Utils.escapeHTML(g.subject)} • ${Utils.escapeHTML(g.className)}</div>
          </div>
        </div>
      `).join('');
    }

    // ===== الواجبات =====
    const assignments = Storage.list(Storage.KEYS.assignments, a =>
      a.name.toLowerCase().includes(q) || (a.topic && a.topic.toLowerCase().includes(q))
    );
    if (assignments.length) {
      html += this.section('الواجبات');
      html += assignments.slice(0, 5).map(a => {
        const g = Storage.find(Storage.KEYS.groups, a.groupId);
        return `
          <div class="list-item clickable" data-assignment="${a.id}">
            <div class="list-item-avatar">${Icons.get('assignment', 18)}</div>
            <div class="list-item-body">
              <div class="list-item-title">${Utils.escapeHTML(a.name)}</div>
              <div class="list-item-subtitle">${g ? Utils.escapeHTML(g.name) : ''} • تسليم ${UI.formatDate(a.dueDate)}</div>
            </div>
          </div>
        `;
      }).join('');
    }

    // ===== الاختبارات =====
    const exams = Storage.list(Storage.KEYS.exams, e =>
      e.name.toLowerCase().includes(q) || (e.topic && e.topic.toLowerCase().includes(q))
    );
    if (exams.length) {
      html += this.section('الاختبارات');
      html += exams.slice(0, 5).map(e => {
        const g = Storage.find(Storage.KEYS.groups, e.groupId);
        return `
          <div class="list-item clickable" data-exam="${e.id}">
            <div class="list-item-avatar">${Icons.get('exam', 18)}</div>
            <div class="list-item-body">
              <div class="list-item-title">${Utils.escapeHTML(e.name)}</div>
              <div class="list-item-subtitle">${g ? Utils.escapeHTML(g.name) : ''} • ${UI.formatDate(e.date)}</div>
            </div>
          </div>
        `;
      }).join('');
    }

    // ===== المدفوعات (بالشهر أو المبلغ) =====
    const payments = Storage.list(Storage.KEYS.payments).filter(p => {
      const s = Storage.find(Storage.KEYS.students, p.studentId);
      return (p.month && p.month.includes(q)) ||
             (p.method && p.method.toLowerCase().includes(q)) ||
             String(p.paid || '').includes(q) ||
             (s && s.name.toLowerCase().includes(q));
    });
    if (payments.length) {
      html += this.section('المدفوعات');
      html += payments.slice(0, 5).map(p => {
        const s = Storage.find(Storage.KEYS.students, p.studentId);
        const st = UI.paymentStatus(p.paid || 0, p.required || 0);
        return `
          <div class="list-item">
            <div class="list-item-avatar">${Icons.get('payment', 18)}</div>
            <div class="list-item-body">
              <div class="list-item-title">${s ? Utils.escapeHTML(s.name) : '—'}</div>
              <div class="list-item-subtitle">${p.month} • ${UI.money(p.paid)} / ${UI.money(p.required)}</div>
            </div>
            <span class="badge badge-${st.cls}">${st.label}</span>
          </div>
        `;
      }).join('');
    }

    // ===== التقارير المحفوظة =====
    const reports = Storage.list(Storage.KEYS.reports, r =>
      (r.title && r.title.toLowerCase().includes(q)) ||
      (r.content && r.content.toLowerCase().includes(q))
    );
    if (reports.length) {
      html += this.section('التقارير المحفوظة');
      html += reports.slice(0, 5).map(r => `
        <div class="list-item clickable" data-report="${r.id}">
          <div class="list-item-avatar">${Icons.get('file', 18)}</div>
          <div class="list-item-body">
            <div class="list-item-title">${Utils.escapeHTML(r.title || r.type)}</div>
            <div class="list-item-subtitle">${UI.relativeTime(r.createdAt)}</div>
          </div>
        </div>
      `).join('');
    }

    if (!html) {
      html = '<p style="text-align:center;color:var(--text-tertiary);padding:var(--space-6);">لا توجد نتائج مطابقة</p>';
    }

    results.innerHTML = html;
    this.bindResults(results);
  },

  section(title) {
    return `<p style="font-size:12px;color:var(--text-tertiary);margin:var(--space-3) 0 var(--space-2);">${title}</p>`;
  },

  bindResults(container) {
    container.querySelectorAll('[data-student]').forEach(el => {
      el.addEventListener('click', () => { UI.closeModal(); Students.openProfile(el.dataset.student); });
    });
    container.querySelectorAll('[data-group]').forEach(el => {
      el.addEventListener('click', () => { UI.closeModal(); Groups.openGroup(el.dataset.group); });
    });
    container.querySelectorAll('[data-assignment]').forEach(el => {
      el.addEventListener('click', () => { UI.closeModal(); App.navigate('assignments'); });
    });
    container.querySelectorAll('[data-exam]').forEach(el => {
      el.addEventListener('click', () => { UI.closeModal(); App.navigate('exams'); });
    });
    container.querySelectorAll('[data-report]').forEach(el => {
      el.addEventListener('click', () => { UI.closeModal(); Reports.viewSaved(el.dataset.report); });
    });
  }
};

window.GlobalSearch = GlobalSearch;

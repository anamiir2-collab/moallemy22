/* ============================================
   مُعلّمي | payments.js
   المدفوعات + الإيصالات + التقارير المالية
   - يدعم تواريخ الاستحقاق وحساب المتأخر
   - يدعم الجداول: شهري، لكل حصة، أسبوعي، مخصص
   - ينشئ تذكيرات واتساب للطلاب المتأخرين
   ============================================ */

const Payments = {
  render() {
    const payments = Storage.list(Storage.KEYS.payments);
    const students = Storage.list(Storage.KEYS.students);
    const today = new Date().toISOString().slice(0, 10);
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const startOfYear = new Date();
    startOfYear.setMonth(0, 1);

    const todayRevenue = payments.filter(p => p.date === today).reduce((s, p) => s + (p.paid || 0), 0);
    const weekRevenue = payments.filter(p => p.date && p.date >= startOfWeek.toISOString().slice(0, 10)).reduce((s, p) => s + (p.paid || 0), 0);
    const monthRevenue = payments.filter(p => p.date && p.date >= startOfMonth.toISOString().slice(0, 10)).reduce((s, p) => s + (p.paid || 0), 0);
    const yearRevenue = payments.filter(p => p.date && p.date >= startOfYear.toISOString().slice(0, 10)).reduce((s, p) => s + (p.paid || 0), 0);

    // ===== Recompute expected vs outstanding vs overdue =====
    const todayDate = new Date(); todayDate.setHours(0,0,0,0);
    let totalExpected = 0;
    let totalCollected = 0;
    let totalOutstanding = 0;
    let overdueCount = 0;
    let overdueAmount = 0;
    let upcomingCount = 0; // due in next 7 days

    payments.forEach(p => {
      const required = p.required || 0;
      const paid = p.paid || 0;
      const remaining = Math.max(0, required - paid);
      totalExpected += required;
      totalCollected += paid;
      totalOutstanding += remaining;

      if (remaining > 0 && p.dueDate) {
        const due = new Date(p.dueDate);
        if (due < todayDate) {
          overdueCount++;
          overdueAmount += remaining;
        } else {
          const daysUntilDue = Math.round((due - todayDate) / 86400000);
          if (daysUntilDue >= 0 && daysUntilDue <= 7) upcomingCount++;
        }
      }
    });

    return `
      <div class="page-header">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <h1 class="page-title">المدفوعات</h1>
            <p class="page-subtitle">الإدارة المالية</p>
          </div>
          <button class="btn btn-primary" onclick="Payments.openQuick()">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            دفعة
          </button>
        </div>
      </div>

      <div class="stats-grid stagger" style="margin-bottom: var(--space-5);">
        <div class="stat-card success">
          <div class="stat-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
          <div class="stat-value">${UI.money(todayRevenue).replace(' ج.م', '')}</div>
          <div class="stat-label">دخل اليوم</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${UI.money(weekRevenue).replace(' ج.م', '')}</div>
          <div class="stat-label">دخل الأسبوع</div>
        </div>
        <div class="stat-card gold">
          <div class="stat-value">${UI.money(monthRevenue).replace(' ج.م', '')}</div>
          <div class="stat-label">دخل الشهر</div>
        </div>
        <div class="stat-card info">
          <div class="stat-value">${UI.money(yearRevenue).replace(' ج.م', '')}</div>
          <div class="stat-label">دخل السنة</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v2m0 4h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg></div>
          <div class="stat-value">${UI.money(totalOutstanding).replace(' ج.م', '')}</div>
          <div class="stat-label">إجمالي المستحقات</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-value">${UI.money(overdueAmount).replace(' ج.م', '')}</div>
          <div class="stat-label">متأخر السداد (${overdueCount})</div>
        </div>
      </div>

      ${overdueCount > 0 ? `
        <div class="action-row" style="margin-bottom: var(--space-4);">
          <button class="btn btn-outline" style="flex:1;" onclick="Payments.openOverdueReminders()">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            تذكير المتأخرين عبر واتساب (${overdueCount})
          </button>
        </div>
      ` : ''}

      <div class="tabs" id="payments-tabs">
        <button class="tab active" data-tab="all">الكل</button>
        <button class="tab" data-tab="overdue">متأخر</button>
        <button class="tab" data-tab="unpaid">غير مدفوع</button>
        <button class="tab" data-tab="partial">جزئي</button>
        <button class="tab" data-tab="paid">مدفوع</button>
      </div>

      <div id="payments-list"></div>
    `;
  },

  // ===== Calculate overdue days from dueDate to today =====
  overdueDays(p) {
    if (!p.dueDate) return 0;
    const due = new Date(p.dueDate); due.setHours(0,0,0,0);
    const today = new Date(); today.setHours(0,0,0,0);
    if (due >= today) return 0;
    return Math.round((today - due) / 86400000);
  },

  bind() {
    const tabs = document.querySelectorAll('#payments-tabs .tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.toggle('active', t === tab));
        this.renderList(tab.dataset.tab);
      });
    });
    this.renderList('all');
  },

  renderList(filter) {
    const container = document.getElementById('payments-list');
    if (!container) return;
    const payments = Storage.list(Storage.KEYS.payments);

    let filtered = payments;
    if (filter !== 'all') {
      filtered = payments.filter(p => {
        const remaining = Math.max(0, (p.required || 0) - (p.paid || 0));
        const st = UI.paymentStatus(p.paid || 0, p.required || 0);
        if (filter === 'paid') return st.label === 'مدفوع';
        if (filter === 'partial') return st.label === 'جزئي';
        if (filter === 'unpaid') return st.label === 'غير مدفوع';
        if (filter === 'overdue') return remaining > 0 && this.overdueDays(p) > 0;
        return true;
      });
    }

    if (filtered.length === 0) {
      container.innerHTML = UI.emptyState('💰', 'لا توجد مدفوعات', 'لم تسجل أي مدفوعات بعد.');
      return;
    }

    // Sort: outstanding first, then by due date asc
    filtered.sort((a, b) => {
      const aOut = Math.max(0, (a.required || 0) - (a.paid || 0));
      const bOut = Math.max(0, (b.required || 0) - (b.paid || 0));
      if (aOut > 0 && bOut <= 0) return -1;
      if (aOut <= 0 && bOut > 0) return 1;
      // Both outstanding or both paid — sort by dueDate asc
      const aDue = a.dueDate || '9999-99-99';
      const bDue = b.dueDate || '9999-99-99';
      return aDue.localeCompare(bDue);
    });

    container.innerHTML = `<div class="list stagger">${filtered.map(p => this.renderCard(p)).join('')}</div>`;

    container.querySelectorAll('[data-payment]').forEach(el => {
      el.addEventListener('click', () => this.openDetail(el.dataset.payment));
    });
  },

  renderCard(p) {
    const s = Storage.find(Storage.KEYS.students, p.studentId);
    const st = UI.paymentStatus(p.paid || 0, p.required || 0);
    const outstanding = Math.max(0, (p.required || 0) - (p.paid || 0));
    const overdue = this.overdueDays(p);
    const scheduleLabel = {
      monthly: 'شهري',
      per_lesson: 'لكل حصة',
      weekly: 'أسبوعي',
      custom: 'مخصص'
    }[p.schedule] || 'شهري';

    return `
      <div class="list-item clickable" data-payment="${p.id}">
        <div class="avatar avatar-sm">${UI.initials(s ? s.name : '؟')}</div>
        <div class="list-item-body">
          <div class="list-item-title">${s ? s.name : '—'}</div>
          <div class="list-item-subtitle">${p.month || '—'} • مدفوع ${UI.money(p.paid || 0)} من ${UI.money(p.required || 0)}</div>
          <div style="display:flex; gap:6px; margin-top:6px; flex-wrap:wrap;">
            ${outstanding > 0 ? `<span class="badge badge-warning">متبقي: ${UI.money(outstanding)}</span>` : ''}
            ${p.dueDate ? `<span class="badge">استحقاق: ${UI.formatDate(p.dueDate, { short: true })}</span>` : ''}
            ${overdue > 0 ? `<span class="badge badge-danger">متأخر ${overdue} يوم</span>` : ''}
            ${p.schedule && p.schedule !== 'monthly' ? `<span class="badge badge-info">${scheduleLabel}</span>` : ''}
          </div>
        </div>
        <span class="badge badge-${st.cls}">${st.label}</span>
      </div>
    `;
  },

  openDetail(paymentId) {
    const p = Storage.find(Storage.KEYS.payments, paymentId);
    if (!p) return;
    const s = Storage.find(Storage.KEYS.students, p.studentId);
    const g = Storage.find(Storage.KEYS.groups, p.groupId);
    const teacher = Auth.getTeacher();
    const outstanding = Math.max(0, (p.required || 0) - (p.paid || 0));
    const overdue = this.overdueDays(p);
    const scheduleLabel = {
      monthly: 'شهري',
      per_lesson: 'لكل حصة',
      weekly: 'أسبوعي',
      custom: 'مخصص'
    }[p.schedule] || 'شهري';

    UI.modal({
      title: 'تفاصيل الدفعة',
      body: `
        <div class="card" style="margin-bottom: var(--space-3);">
          <div style="display:flex; align-items:center; gap: var(--space-3); margin-bottom: var(--space-3);">
            <div class="avatar avatar-md">${UI.initials(s ? s.name : '؟')}</div>
            <div>
              <div style="font-weight:700;">${s ? s.name : '—'}</div>
              <div style="font-size: var(--font-size-xs); color: var(--text-tertiary);">${g ? g.name : ''} • ${p.month || '—'}</div>
            </div>
          </div>
          <div style="display:grid; gap:6px; font-size: var(--font-size-sm);">
            <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-tertiary);">المطلوب</span><span style="font-weight:700;">${UI.money(p.required)}</span></div>
            <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-tertiary);">المدفوع</span><span style="color: var(--color-success); font-weight:700;">${UI.money(p.paid)}</span></div>
            <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-tertiary);">المتبقي</span><span style="font-weight:700; color: ${outstanding > 0 ? 'var(--color-warning)' : 'var(--color-success)'};">${UI.money(outstanding)}</span></div>
            <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-tertiary);">جدول الدفع</span><span>${scheduleLabel}</span></div>
            ${p.dueDate ? `<div style="display:flex; justify-content:space-between;"><span style="color:var(--text-tertiary);">تاريخ الاستحقاق</span><span>${UI.formatDate(p.dueDate)}</span></div>` : ''}
            ${overdue > 0 ? `<div style="display:flex; justify-content:space-between;"><span style="color:var(--text-tertiary);">أيام متأخرة</span><span style="color: var(--color-danger); font-weight:700;">${overdue} يوم</span></div>` : ''}
            ${p.date ? `<div style="display:flex; justify-content:space-between;"><span style="color:var(--text-tertiary);">تاريخ الدفع</span><span>${UI.formatDate(p.date)}</span></div>` : ''}
            ${p.method ? `<div style="display:flex; justify-content:space-between;"><span style="color:var(--text-tertiary);">طريقة الدفع</span><span>${p.method}</span></div>` : ''}
            ${p.notes ? `<div style="margin-top:6px; padding: var(--space-2); background: var(--color-surface-2); border-radius: var(--radius-sm); font-size: var(--font-size-xs);">${p.notes}</div>` : ''}
          </div>
        </div>

        <div class="action-row">
          ${outstanding > 0 ? `<button class="btn btn-primary" style="flex:1;" onclick="UI.closeModal(); setTimeout(() => Payments.openPaymentForm('${p.studentId}', '${p.id}'), 250)">تسجيل دفعة</button>` : ''}
          ${outstanding > 0 ? `<button class="btn btn-outline" style="flex:1;" onclick="Payments.openOverdueReminder('${p.id}')">تذكير واتساب</button>` : ''}
          <button class="btn btn-secondary" style="flex:1;" onclick="UI.closeModal()">إغلاق</button>
        </div>
      `
    });
  },

  openPaymentForm(studentId = null, paymentId = null) {
    let payment = null;
    let student = null;
    if (paymentId) {
      payment = Storage.find(Storage.KEYS.payments, paymentId);
      student = Storage.find(Storage.KEYS.students, payment.studentId);
    } else if (studentId) {
      student = Storage.find(Storage.KEYS.students, studentId);
      const month = new Date().toISOString().slice(0, 7);
      payment = Storage.list(Storage.KEYS.payments, p => p.studentId === studentId && p.month === month)[0];
    }

    if (!student) {
      UI.toast('اختر طالبًا', 'warning');
      return;
    }

    const outstanding = payment ? Math.max(0, (payment.required || 0) - (payment.paid || 0)) : (student.subscriptionAmount || 0);
    const todayStr = new Date().toISOString().slice(0, 10);

    UI.modal({
      title: 'تسجيل دفعة',
      body: `
        <div class="card" style="margin-bottom: var(--space-4); background: var(--color-surface-2);">
          <div style="display:flex; align-items:center; gap: var(--space-3);">
            <div class="avatar avatar-md">${UI.initials(student.name)}</div>
            <div>
              <div style="font-weight:700;">${student.name}</div>
              <div style="font-size: var(--font-size-xs); color: var(--text-tertiary);">${student.className} • ${student.subject}</div>
            </div>
          </div>
        </div>

        <form id="payment-form">
          <input type="hidden" name="studentId" value="${student.id}">
          <input type="hidden" name="paymentId" value="${payment ? payment.id : ''}">
          <input type="hidden" name="groupId" value="${student.groupId}">

          <div class="field-row">
            <div class="field">
              <label>الشهر / الفترة <span class="required">*</span></label>
              <input type="month" name="month" required value="${payment ? payment.month : new Date().toISOString().slice(0, 7)}">
            </div>
            <div class="field">
              <label>جدول الدفع</label>
              <select name="schedule" id="payment-schedule">
                <option value="monthly" ${payment && payment.schedule === 'monthly' ? 'selected' : ''}>شهري</option>
                <option value="per_lesson" ${payment && payment.schedule === 'per_lesson' ? 'selected' : ''}>لكل حصة</option>
                <option value="weekly" ${payment && payment.schedule === 'weekly' ? 'selected' : ''}>أسبوعي</option>
                <option value="custom" ${payment && payment.schedule === 'custom' ? 'selected' : ''}>مخصص</option>
              </select>
            </div>
          </div>

          <div class="field-row">
            <div class="field">
              <label>المطلوب (ج.م) <span class="required">*</span></label>
              <input type="number" name="required" required min="0" value="${payment ? payment.required : (student.subscriptionAmount || 0)}" id="required-amount">
            </div>
            <div class="field">
              <label>تاريخ الاستحقاق</label>
              <input type="date" name="dueDate" value="${payment ? (payment.dueDate || '') : ''}" id="due-date-input">
              <p style="font-size: var(--font-size-xs); color: var(--text-tertiary); margin-top: 4px;">اتركه فارغًا لاستخدام آخر الشهر</p>
            </div>
          </div>

          <div class="field">
            <label>المدفوع الآن (ج.م) <span class="required">*</span></label>
            <input type="number" name="paid" required min="0" value="${outstanding}" id="paid-amount">
            ${outstanding > 0 ? `<p style="font-size: var(--font-size-xs); color: var(--text-tertiary); margin-top: 4px;">المتبقي قبل الدفع: ${UI.money(outstanding)}</p>` : ''}
          </div>

          <div class="field-row">
            <div class="field">
              <label>تاريخ الدفع</label>
              <input type="date" name="date" value="${todayStr}">
            </div>
            <div class="field">
              <label>طريقة الدفع</label>
              <select name="method">
                ${Seeds.paymentMethods.map(m => `<option value="${m}" ${payment && payment.method === m ? 'selected' : ''}>${m}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="field">
            <label>ملاحظات</label>
            <textarea name="notes" placeholder="ملاحظات...">${payment ? (payment.notes || '') : ''}</textarea>
          </div>

          <div class="alert alert-info" style="margin: var(--space-3) 0;">
            <div class="alert-body">
              <strong>المتبقي بعد الدفع:</strong>
              <span id="after-payment">0 ج.م</span>
            </div>
          </div>

          <div class="action-row">
            <button type="button" class="btn btn-secondary" onclick="UI.closeModal()" style="flex:1">إلغاء</button>
            <button type="submit" class="btn btn-primary" style="flex:1">حفظ الدفعة</button>
          </div>
        </form>
      `
    });

    // Auto-fill dueDate based on schedule if empty
    const scheduleSel = document.getElementById('payment-schedule');
    const dueInput = document.getElementById('due-date-input');
    const updateDueDate = () => {
      if (dueInput.value) return; // Don't override existing
      const d = new Date();
      const sched = scheduleSel.value;
      if (sched === 'monthly') {
        d.setMonth(d.getMonth() + 1, 0); // last day of current month
      } else if (sched === 'weekly') {
        d.setDate(d.getDate() + 7);
      } else if (sched === 'per_lesson') {
        d.setDate(d.getDate() + 1); // tomorrow
      } else {
        return; // custom — leave blank
      }
      dueInput.value = d.toISOString().slice(0, 10);
    };
    scheduleSel.addEventListener('change', updateDueDate);
    if (!dueInput.value) updateDueDate();

    // Calculate remaining
    const paidInput = document.getElementById('paid-amount');
    const requiredInput = document.getElementById('required-amount');
    const afterEl = document.getElementById('after-payment');
    const updateRemaining = () => {
      const paid = parseFloat(paidInput.value) || 0;
      const req = parseFloat(requiredInput.value) || 0;
      const remaining = Math.max(0, req - paid);
      afterEl.textContent = UI.money(remaining);
    };
    paidInput.addEventListener('input', updateRemaining);
    requiredInput.addEventListener('input', updateRemaining);
    updateRemaining();

    document.getElementById('payment-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.savePayment(new FormData(e.target));
    });
  },

  savePayment(formData) {
    const data = Object.fromEntries(formData.entries());
    const newPaid = parseFloat(data.paid) || 0;
    const required = parseFloat(data.required) || 0;

    if (newPaid > required) {
      UI.confirm(`المدفوع (${UI.money(newPaid)}) أكبر من المطلوب (${UI.money(required)}). هل تريد المتابعة؟`, () => {
        this.persistPayment(data, newPaid, required);
      }, { title: 'تأكيد المبلغ', confirmText: 'متابعة', danger: false });
      return;
    }
    this.persistPayment(data, newPaid, required);
  },

  persistPayment(data, newPaid, required) {
    const existing = data.paymentId ? Storage.find(Storage.KEYS.payments, data.paymentId) : null;
    const student = Storage.find(Storage.KEYS.students, data.studentId);

    let payment;
    if (existing) {
      // ===== Treat as a new transaction on top of existing record =====
      // We keep the original required amount, accumulate paid amount (clamped),
      // and update dueDate/schedule/method/notes. The transaction history is
      // preserved by storing each payment event as a separate "receipt" record.
      const totalPaid = Math.min((existing.paid || 0) + newPaid, required);
      payment = Storage.update(Storage.KEYS.payments, existing.id, {
        paid: totalPaid,
        required,
        dueDate: data.dueDate || existing.dueDate,
        schedule: data.schedule || existing.schedule,
        date: data.date,
        method: data.method,
        notes: data.notes
      });
      // Store a transaction log entry (for history/traceability)
      this.logTransaction({
        paymentId: existing.id,
        studentId: data.studentId,
        groupId: data.groupId,
        amount: newPaid,
        method: data.method,
        date: data.date,
        notes: data.notes
      });
    } else {
      payment = Storage.insert(Storage.KEYS.payments, {
        studentId: data.studentId,
        groupId: data.groupId,
        month: data.month,
        required,
        paid: newPaid,
        method: data.method,
        date: data.date,
        dueDate: data.dueDate || null,
        schedule: data.schedule || 'monthly',
        notes: data.notes
      });
      this.logTransaction({
        paymentId: payment.id,
        studentId: data.studentId,
        groupId: data.groupId,
        amount: newPaid,
        method: data.method,
        date: data.date,
        notes: data.notes
      });
    }

    UI.toast('تم تسجيل الدفعة بنجاح ✓', 'success');
    UI.closeModal();
    Notifications.add('payment', 'دفعة مسجلة', `${student.name} - ${UI.money(newPaid)}`, payment.id);

    // Offer receipt
    if (newPaid > 0) {
      setTimeout(() => {
        UI.modal({
          title: 'تم تسجيل الدفعة',
          body: `
            <div style="text-align:center; padding: var(--space-4) 0;">
              <div style="width:60px;height:60px;background:var(--color-success-soft);color:var(--color-success);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto var(--space-3);font-size:28px;">✓</div>
              <h3 style="font-weight:700;margin-bottom:8px;">تم بنجاح</h3>
              <p style="color:var(--text-secondary);margin-bottom:var(--space-4);">سجلت دفعة ${UI.money(newPaid)} من ${student.name}</p>
              <button class="btn btn-primary btn-block" onclick="Payments.showReceipt('${payment.id}')">🧾 عرض الإيصال</button>
              <button class="btn btn-text btn-block" style="margin-top:8px;" onclick="UI.closeModal()">إغلاق</button>
            </div>
          `
        });
      }, 300);
    }

    if (App.currentPage === 'payments') this.renderList('all');
  },

  // ===== Transaction log (traceability) =====
  logTransaction(tx) {
    const txs = Storage.get(Storage.KEYS.receipts, []);
    txs.push({
      id: Storage.uid('tx_'),
      ...tx,
      createdAt: Date.now()
    });
    Storage.set(Storage.KEYS.receipts, txs);
  },

  showReceipt(paymentId) {
    const p = Storage.find(Storage.KEYS.payments, paymentId);
    if (!p) return;
    const s = Storage.find(Storage.KEYS.students, p.studentId);
    const g = Storage.find(Storage.KEYS.groups, p.groupId);
    const teacher = Auth.getTeacher();
    const remaining = (p.required || 0) - (p.paid || 0);

    UI.modal({
      title: 'إيصال دفع',
      body: `
        <div class="receipt" id="receipt-print">
          <div class="receipt-header">
            <div style="width:50px;height:50px;background:var(--color-primary);color:var(--color-gold);border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;margin:0 auto var(--space-2);">م</div>
            <div class="receipt-title">${teacher ? teacher.name : 'مُعلّمي'}</div>
            <div class="receipt-meta">${teacher ? teacher.subject : ''} ${teacher && teacher.phone ? ' • ' + teacher.phone : ''}</div>
            <div class="receipt-meta">رقم الإيصال: ${p.id.slice(-8).toUpperCase()}</div>
          </div>
          <hr style="border: none; border-top: 1px dashed var(--color-surface-3); margin: var(--space-3) 0;">
          <div class="receipt-row"><span class="label">اسم الطالب</span><span class="value">${s ? s.name : '—'}</span></div>
          <div class="receipt-row"><span class="label">المجموعة</span><span class="value">${g ? g.name : '—'}</span></div>
          <div class="receipt-row"><span class="label">الشهر</span><span class="value">${p.month || '—'}</span></div>
          <div class="receipt-row"><span class="label">تاريخ الدفع</span><span class="value">${UI.formatDate(p.date)}</span></div>
          <div class="receipt-row"><span class="label">طريقة الدفع</span><span class="value">${p.method || '—'}</span></div>
          <hr style="border: none; border-top: 1px dashed var(--color-surface-3); margin: var(--space-3) 0;">
          <div class="receipt-row"><span class="label">المطلوب</span><span class="value">${UI.money(p.required)}</span></div>
          <div class="receipt-row"><span class="label">المدفوع</span><span class="value">${UI.money(p.paid)}</span></div>
          <div class="receipt-row receipt-total"><span class="label">المتبقي</span><span class="value">${UI.money(remaining)}</span></div>
          <hr style="border: none; border-top: 1px dashed var(--color-surface-3); margin: var(--space-3) 0;">
          <p style="text-align:center; font-size: var(--font-size-xs); color: var(--text-tertiary); margin-top: var(--space-3);">شكرًا لتعاملكم معنا 🌿</p>
        </div>

        <div class="action-row" style="margin-top: var(--space-4);">
          <button class="btn btn-secondary" onclick="window.print()" style="flex:1">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            طباعة
          </button>
          <button class="btn btn-whatsapp" onclick="Payments.shareReceipt('${p.id}')" style="flex:1">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M17.6 6.32A7.85 7.85 0 0 0 12.05 4 7.94 7.94 0 0 0 5.1 15.94L4 20l4.16-1.09a7.93 7.93 0 0 0 3.79.97h.01a7.94 7.94 0 0 0 5.64-13.55z"/></svg>
            مشاركة
          </button>
        </div>
      `
    });
  },

  shareReceipt(paymentId) {
    const p = Storage.find(Storage.KEYS.payments, paymentId);
    const s = Storage.find(Storage.KEYS.students, p.studentId);
    if (!s || !s.parentPhone) {
      UI.toast('لا يوجد رقم لولي الأمر', 'warning');
      return;
    }
    const teacher = Auth.getTeacher();
    const remaining = (p.required || 0) - (p.paid || 0);
    const msg = `*إيصال دفع - مُعلّمي*\n\n` +
      `أ/ ${teacher ? teacher.name : ''}\n` +
      `الطالب: ${s.name}\n` +
      `الشهر: ${p.month}\n` +
      `المطلوب: ${UI.money(p.required)}\n` +
      `المدفوع: ${UI.money(p.paid)}\n` +
      `المتبقي: ${UI.money(remaining)}\n` +
      `طريقة الدفع: ${p.method || '—'}\n` +
      `التاريخ: ${UI.formatDate(p.date)}\n\n` +
      `شكرًا لتعاملكم معنا 🌿`;
    const phone = WhatsAppTemplates.validatePhone(s.parentPhone);
    if (!phone) {
      UI.toast('رقم هاتف ولي الأمر غير صالح', 'error');
      return;
    }
    WhatsAppTemplates.openWhatsApp(phone.international, msg);
  },

  // ===== WhatsApp reminders for overdue students =====
  openOverdueReminders() {
    const payments = Storage.list(Storage.KEYS.payments);
    const today = new Date(); today.setHours(0,0,0,0);
    const overdue = payments.filter(p => {
      const remaining = Math.max(0, (p.required || 0) - (p.paid || 0));
      return remaining > 0 && p.dueDate && new Date(p.dueDate) < today;
    });

    if (overdue.length === 0) {
      UI.toast('لا توجد مدفوعات متأخرة', 'info');
      return;
    }

    const teacher = Auth.getTeacher();
    const settings = Storage.get(Storage.KEYS.settings, {});
    const tpl = settings.overdueTemplate || WhatsAppTemplates.defaultOverdue;

    const built = overdue.map(p => {
      const s = Storage.find(Storage.KEYS.students, p.studentId);
      if (!s) return null;
      const remaining = Math.max(0, (p.required || 0) - (p.paid || 0));
      const overdueDays = this.overdueDays(p);
      const msg = WhatsAppTemplates.fillOverdue(tpl, {
        studentName: s.name,
        amount: p.required,
        dueDate: UI.formatDate(p.dueDate),
        remaining: remaining
      });
      const phoneValid = WhatsAppTemplates.validatePhone(s.parentPhone);
      return { student: s, payment: p, remaining, overdueDays, msg, phoneValid };
    }).filter(Boolean);

    const validCount = built.filter(b => b.phoneValid).length;
    const invalidCount = built.length - validCount;

    UI.modal({
      title: `تذكيرات المتأخرين (${built.length})`,
      body: `
        <div class="alert alert-warning" style="margin-bottom: var(--space-3);">
          <div class="alert-icon">⚠️</div>
          <div class="alert-body" style="font-size: var(--font-size-sm);">
            سيتم تجهيز رسالة لكل طالب متأخر. اضغط "فتح واتساب" لإرسال التذكير عبر واتساب.
            <strong>لا يتم الإرسال تلقائيًا</strong> — يجب على المدرس تأكيد الإرسال يدويًا داخل واتساب.
          </div>
        </div>

        ${invalidCount > 0 ? `
          <div class="alert alert-info" style="margin-bottom: var(--space-3);">
            <div class="alert-icon">ℹ️</div>
            <div class="alert-body" style="font-size: var(--font-size-sm);">
              <strong>${invalidCount}</strong> طالب ليس لديهم رقم هاتف صالح لولي الأمر.
            </div>
          </div>
        ` : ''}

        <div class="list">
          ${built.map(b => `
            <div class="card" style="padding: var(--space-3); margin-bottom: var(--space-2);">
              <div style="display:flex; align-items:center; gap: var(--space-3); margin-bottom: var(--space-2);">
                <div class="avatar avatar-sm">${UI.initials(b.student.name)}</div>
                <div style="flex:1; min-width:0;">
                  <div style="font-weight:700;">${b.student.name}</div>
                  <div style="font-size: var(--font-size-xs); color: ${b.phoneValid ? 'var(--color-success)' : 'var(--color-danger)'}; direction: ltr; text-align: right;">
                    ${b.phoneValid ? b.phoneValid.formatted : (b.student.parentPhone || '— لا يوجد رقم —')}
                  </div>
                </div>
                <div style="text-align:center;">
                  <div style="font-weight:700; color: var(--color-danger);">${UI.money(b.remaining).replace(' ج.م', '')}</div>
                  <span class="badge badge-danger">متأخر ${b.overdueDays} يوم</span>
                </div>
              </div>
              <div style="background: var(--color-surface-2); padding: var(--space-2); border-radius: var(--radius-sm); font-size: var(--font-size-xs); line-height: 1.6; max-height: 110px; overflow-y: auto; white-space: pre-wrap;">${b.msg}</div>
              <div style="display:flex; gap: 6px; margin-top: var(--space-2);">
                ${b.phoneValid ? `
                  <button class="btn btn-primary btn-sm" style="flex:1;" data-overdue-wa="${b.student.id}">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M17.6 6.32A7.85 7.85 0 0 0 12.05 4 7.94 7.94 0 0 0 5.1 15.94L4 20l4.16-1.09a7.93 7.93 0 0 0 3.79.97h.01a7.94 7.94 0 0 0 5.64-13.55z"/></svg>
                    فتح واتساب
                  </button>
                  <button class="btn btn-secondary btn-sm" data-copy="${b.student.id}">نسخ</button>
                ` : `
                  <button class="btn btn-secondary btn-sm" style="flex:1;" data-edit-phone="${b.student.id}">تعديل الرقم</button>
                `}
              </div>
            </div>
          `).join('')}
        </div>

        <button class="btn btn-text btn-block" style="margin-top: var(--space-3);" onclick="UI.closeModal()">إغلاق</button>
      `
    });

    document.querySelectorAll('[data-overdue-wa]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sid = btn.dataset.overdueWa;
        const item = built.find(b => b.student.id === sid);
        if (!item || !item.phoneValid) return;
        WhatsAppTemplates.openWhatsApp(item.phoneValid.international, item.msg);
      });
    });
    document.querySelectorAll('[data-copy]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const sid = btn.dataset.copy;
        const item = built.find(b => b.student.id === sid);
        if (!item) return;
        try {
          await navigator.clipboard.writeText(item.msg);
          UI.toast('تم نسخ الرسالة ✓', 'success', 1500);
        } catch (e) {
          UI.toast('تعذّر النسخ', 'warning');
        }
      });
    });
    document.querySelectorAll('[data-edit-phone]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sid = btn.dataset.editPhone;
        UI.closeModal();
        setTimeout(() => Students.openProfile(sid, 'parent'), 250);
      });
    });
  },

  openOverdueReminder(paymentId) {
    const p = Storage.find(Storage.KEYS.payments, paymentId);
    if (!p) return;
    const s = Storage.find(Storage.KEYS.students, p.studentId);
    if (!s) return;
    const phoneValid = WhatsAppTemplates.validatePhone(s.parentPhone);
    if (!phoneValid) {
      UI.toast('رقم هاتف ولي الأمر غير صالح', 'error');
      return;
    }
    const teacher = Auth.getTeacher();
    const settings = Storage.get(Storage.KEYS.settings, {});
    const tpl = settings.overdueTemplate || WhatsAppTemplates.defaultOverdue;
    const remaining = Math.max(0, (p.required || 0) - (p.paid || 0));
    const overdueDays = this.overdueDays(p);
    const msg = WhatsAppTemplates.fillOverdue(tpl, {
      studentName: s.name,
      amount: p.required,
      dueDate: UI.formatDate(p.dueDate),
      remaining: remaining
    });
    UI.closeModal();
    setTimeout(() => {
      WhatsAppTemplates.openWhatsApp(phoneValid.international, msg);
    }, 200);
  },

  openQuick() {
    const students = Storage.list(Storage.KEYS.students, s => s.status === 'نشط');
    if (students.length === 0) {
      UI.toast('لا يوجد طلاب نشطون', 'warning');
      return;
    }
    UI.modal({
      title: 'تسجيل دفعة',
      body: `
        <p style="color:var(--text-secondary);margin-bottom:var(--space-3);">اختر الطالب:</p>
        <div class="search-bar">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="search" id="payment-student-search" placeholder="ابحث بالاسم...">
        </div>
        <div id="payment-students-list" style="max-height: 60vh; overflow-y: auto;">
          ${students.map(s => {
            const month = new Date().toISOString().slice(0, 7);
            const pays = Storage.list(Storage.KEYS.payments, p => p.studentId === s.id && p.month === month);
            const outstanding = pays.reduce((sum, p) => sum + Math.max(0, (p.required || 0) - (p.paid || 0)), 0);
            const overdue = pays.some(p => p.dueDate && new Date(p.dueDate) < new Date() && (p.required || 0) - (p.paid || 0) > 0);
            return `
              <div class="list-item clickable" data-payment-student="${s.id}">
                <div class="avatar avatar-sm">${UI.initials(s.name)}</div>
                <div class="list-item-body">
                  <div class="list-item-title">${s.name}</div>
                  <div class="list-item-subtitle">${s.className} • ${s.subject}</div>
                </div>
                ${outstanding > 0 ? `<span class="badge badge-${overdue ? 'danger' : 'warning'}">متبقي ${UI.money(outstanding).replace(' ج.م', '')}</span>` : '<span class="badge badge-success">مسدد</span>'}
              </div>
            `;
          }).join('')}
        </div>
      `
    });

    const search = document.getElementById('payment-student-search');
    search.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('[data-payment-student]').forEach(el => {
        const name = el.querySelector('.list-item-title').textContent.toLowerCase();
        el.style.display = name.includes(q) ? '' : 'none';
      });
    });

    document.querySelectorAll('[data-payment-student]').forEach(el => {
      el.addEventListener('click', () => {
        UI.closeModal();
        setTimeout(() => this.openPaymentForm(el.dataset.paymentStudent), 300);
      });
    });
  }
};

window.Payments = Payments;

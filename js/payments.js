/* ============================================
   مُعلّمي | payments.js
   المدفوعات + الإيصالات + التقارير المالية
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
    const outstanding = payments.reduce((s, p) => s + Math.max(0, (p.required || 0) - (p.paid || 0)), 0);
    const overdueCount = payments.filter(p => (p.required || 0) - (p.paid || 0) > 0).length;

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
          <div class="stat-value">${UI.money(outstanding).replace(' ج.م', '')}</div>
          <div class="stat-label">مستحقات</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-value">${overdueCount}</div>
          <div class="stat-label">طالب متأخر</div>
        </div>
      </div>

      <div class="tabs" id="payments-tabs">
        <button class="tab active" data-tab="all">الكل</button>
        <button class="tab" data-tab="unpaid">غير مدفوع</button>
        <button class="tab" data-tab="partial">جزئي</button>
        <button class="tab" data-tab="paid">مدفوع</button>
      </div>

      <div id="payments-list"></div>
    `;
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
        const st = UI.paymentStatus(p.paid || 0, p.required || 0);
        if (filter === 'paid') return st.label === 'مدفوع';
        if (filter === 'partial') return st.label === 'جزئي';
        if (filter === 'unpaid') return st.label === 'غير مدفوع';
        return true;
      });
    }

    if (filtered.length === 0) {
      container.innerHTML = UI.emptyState('💰', 'لا توجد مدفوعات', 'لم تسجل أي مدفوعات بعد.');
      return;
    }

    // Sort: outstanding first, then by date desc
    filtered.sort((a, b) => {
      const aOutstanding = (a.required || 0) - (a.paid || 0);
      const bOutstanding = (b.required || 0) - (b.paid || 0);
      if (aOutstanding > 0 && bOutstanding <= 0) return -1;
      if (aOutstanding <= 0 && bOutstanding > 0) return 1;
      return (b.month || '').localeCompare(a.month || '');
    });

    container.innerHTML = `<div class="list stagger">${filtered.map(p => this.renderCard(p)).join('')}</div>`;

    container.querySelectorAll('[data-payment]').forEach(el => {
      el.addEventListener('click', () => this.openDetail(el.dataset.payment));
    });
    container.querySelectorAll('[data-payment-action]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openPaymentForm(null, el.dataset.paymentAction);
      });
    });
  },

  renderCard(p) {
    const s = Storage.find(Storage.KEYS.students, p.studentId);
    const st = UI.paymentStatus(p.paid || 0, p.required || 0);
    const outstanding = (p.required || 0) - (p.paid || 0);
    return `
      <div class="list-item clickable" data-payment="${p.id}">
        <div class="avatar avatar-sm">${UI.initials(s ? s.name : '؟')}</div>
        <div class="list-item-body">
          <div class="list-item-title">${s ? s.name : '—'}</div>
          <div class="list-item-subtitle">${p.month || '—'} • مدفوع ${UI.money(p.paid || 0)} من ${UI.money(p.required || 0)}</div>
          ${outstanding > 0 ? `<div style="margin-top:4px;"><span class="badge badge-warning">متبقي: ${UI.money(outstanding)}</span></div>` : ''}
        </div>
        <span class="badge badge-${st.cls}">${st.label}</span>
      </div>
    `;
  },

  openPaymentForm(studentId = null, paymentId = null) {
    let payment = null;
    let student = null;
    if (paymentId) {
      payment = Storage.find(Storage.KEYS.payments, paymentId);
      student = Storage.find(Storage.KEYS.students, payment.studentId);
    } else if (studentId) {
      student = Storage.find(Storage.KEYS.students, studentId);
      // Find current month payment
      const month = new Date().toISOString().slice(0, 7);
      payment = Storage.list(Storage.KEYS.payments, p => p.studentId === studentId && p.month === month)[0];
    }

    if (!student) {
      UI.toast('اختر طالبًا', 'warning');
      return;
    }

    const outstanding = payment ? Math.max(0, (payment.required || 0) - (payment.paid || 0)) : (student.subscriptionAmount || 0);

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
              <label>الشهر <span class="required">*</span></label>
              <input type="month" name="month" required value="${payment ? payment.month : new Date().toISOString().slice(0, 7)}">
            </div>
            <div class="field">
              <label>المطلوب (ج.م) <span class="required">*</span></label>
              <input type="number" name="required" required min="0" value="${payment ? payment.required : (student.subscriptionAmount || 0)}" readonly>
            </div>
          </div>

          <div class="field">
            <label>المدفوع الآن (ج.م) <span class="required">*</span></label>
            <input type="number" name="paid" required min="0" value="${outstanding}" max="${outstanding}" id="paid-amount">
            ${outstanding > 0 ? `<p style="font-size: var(--font-size-xs); color: var(--text-tertiary); margin-top: 4px;">المتبقي: ${UI.money(outstanding)}</p>` : ''}
          </div>

          <div class="field-row">
            <div class="field">
              <label>تاريخ الدفع</label>
              <input type="date" name="date" value="${new Date().toISOString().slice(0, 10)}">
            </div>
            <div class="field">
              <label>طريقة الدفع</label>
              <select name="method">
                ${Seeds.paymentMethods.map(m => `<option value="${m}">${m}</option>`).join('')}
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

    // Calculate remaining
    const paidInput = document.getElementById('paid-amount');
    const afterEl = document.getElementById('after-payment');
    const updateRemaining = () => {
      const paid = parseFloat(paidInput.value) || 0;
      const remaining = outstanding - paid;
      afterEl.textContent = UI.money(Math.max(0, remaining));
    };
    paidInput.addEventListener('input', updateRemaining);
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
    const group = Storage.find(Storage.KEYS.groups, student.groupId);
    
    let payment;
    if (existing) {
      // Update: paid is the new total (existing paid + new paid)
      const totalPaid = (existing.paid || 0) + newPaid;
      payment = Storage.update(Storage.KEYS.payments, existing.id, {
        paid: Math.min(totalPaid, required),
        date: data.date,
        method: data.method,
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
    const phone = s.parentPhone.replace(/^0/, '20');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
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
            return `
              <div class="list-item clickable" data-payment-student="${s.id}">
                <div class="avatar avatar-sm">${UI.initials(s.name)}</div>
                <div class="list-item-body">
                  <div class="list-item-title">${s.name}</div>
                  <div class="list-item-subtitle">${s.className} • ${s.subject}</div>
                </div>
                ${outstanding > 0 ? `<span class="badge badge-warning">متبقي ${UI.money(outstanding).replace(' ج.م', '')}</span>` : '<span class="badge badge-success">مسدد</span>'}
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

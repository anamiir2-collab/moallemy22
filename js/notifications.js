/* ============================================
   مُعلّمي | notifications.js
   الإشعارات داخل التطبيق
   ============================================ */

const Notifications = {
  render() {
    const notifs = Storage.list(Storage.KEYS.notifications).sort((a, b) => b.createdAt - a.createdAt);
    const unreadCount = notifs.filter(n => !n.read).length;

    return `
      <div class="page-header">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <h1 class="page-title">الإشعارات</h1>
            <p class="page-subtitle">${notifs.length} إشعار ${unreadCount ? `• ${unreadCount} غير مقروء` : ''}</p>
          </div>
          ${notifs.length ? `
            <div style="display:flex; gap: 6px;">
              <button class="btn btn-text btn-sm" id="mark-all-read">تعليم الكل كمقروء</button>
              <button class="btn btn-text btn-sm" id="clear-all" style="color: var(--color-danger);">مسح الكل</button>
            </div>
          ` : ''}
        </div>
      </div>

      <div id="notifications-list"></div>
    `;
  },

  bind() {
    this.renderList();
    document.getElementById('mark-all-read')?.addEventListener('click', () => {
      const notifs = Storage.list(Storage.KEYS.notifications);
      notifs.forEach(n => Storage.update(Storage.KEYS.notifications, n.id, { read: true }));
      UI.toast('تم تعليم الكل كمقروء', 'success');
      this.renderList();
      this.updateBadge();
    });
    document.getElementById('clear-all')?.addEventListener('click', () => {
      UI.confirm('هل تريد مسح كل الإشعارات؟', () => {
        Storage.set(Storage.KEYS.notifications, []);
        UI.toast('تم مسح الإشعارات', 'success');
        this.renderList();
        this.updateBadge();
      }, { title: 'مسح الإشعارات', confirmText: 'مسح الكل' });
    });
  },

  renderList() {
    const container = document.getElementById('notifications-list');
    if (!container) return;
    const notifs = Storage.list(Storage.KEYS.notifications).sort((a, b) => b.createdAt - a.createdAt);

    if (notifs.length === 0) {
      container.innerHTML = UI.emptyState('🔔', 'لا توجد إشعارات', 'ستظهر هنا التنبيهات الجديدة.');
      return;
    }

    const iconMap = {
      lesson: '📚', exam: '📝', assignment: '📋', attendance: '✓',
      payment: '💰', report: '📊', student: '👤', group: '👥',
      absence: '⚠️', announcement: '📢', generic: '🔔'
    };
    const colorMap = {
      lesson: 'info', exam: 'warning', assignment: 'info', attendance: 'success',
      payment: 'gold', report: '', student: '', group: '',
      absence: 'danger', announcement: 'info', generic: ''
    };

    container.innerHTML = `<div class="list stagger">${notifs.map(n => `
      <div class="list-item clickable ${n.read ? '' : 'unread'}" data-notif="${n.id}" style="${n.read ? '' : 'background: var(--color-primary-softer); border-inline-start: 3px solid var(--color-primary);'}">
        <div class="quick-action-icon ${colorMap[n.type] || ''}">${iconMap[n.type] || '🔔'}</div>
        <div class="list-item-body">
          <div class="list-item-title">${n.title}</div>
          <div class="list-item-subtitle">${n.message}</div>
          <div style="font-size: 11px; color: var(--text-tertiary); margin-top: 4px;">${UI.relativeTime(n.createdAt)}</div>
        </div>
        ${n.read ? '' : '<span style="width:8px;height:8px;border-radius:50%;background:var(--color-primary);"></span>'}
      </div>
    `).join('')}</div>`;

    container.querySelectorAll('[data-notif]').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.notif;
        const n = Storage.find(Storage.KEYS.notifications, id);
        if (n && !n.read) {
          Storage.update(Storage.KEYS.notifications, id, { read: true });
          el.style.background = '';
          el.style.borderInlineStart = '';
          this.updateBadge();
        }
        // Navigate based on type
        if (n) {
          if (n.type === 'lesson') App.navigate('lessons');
          else if (n.type === 'student') App.navigate('students');
          else if (n.type === 'group') App.navigate('groups');
          else if (n.type === 'exam') App.navigate('exams');
          else if (n.type === 'assignment') App.navigate('assignments');
          else if (n.type === 'payment') App.navigate('payments');
        }
      });
    });
  },

  add(type, title, message, relatedId = null) {
    const notif = Storage.insert(Storage.KEYS.notifications, {
      type, title, message, read: false, relatedId
    });
    this.updateBadge();
    return notif;
  },

  updateBadge() {
    const unread = Storage.list(Storage.KEYS.notifications, n => !n.read).length;
    const badge = document.getElementById('notif-badge');
    if (badge) {
      if (unread > 0) {
        badge.textContent = unread > 9 ? '9+' : unread;
        badge.hidden = false;
      } else {
        badge.hidden = true;
      }
    }
  }
};

window.Notifications = Notifications;

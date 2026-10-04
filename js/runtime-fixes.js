/* مُعلّمي — runtime compatibility and resilient page shell */
(function (global) {
  'use strict';

  const App = global.App;
  const UI = global.UI;
  if (!App || !UI) return;

  // The repository's settings module is present but was not referenced by index.html.
  // Load it before the first authenticated render, without replacing any module.
  const originalInit = App.init;
  App.init = async function () {
    if (!global.Settings) {
      await new Promise(resolve => {
        const script = document.createElement('script');
        script.src = 'js/settings.js';
        script.onload = resolve;
        script.onerror = () => { console.warn('Settings module could not be loaded'); resolve(); };
        document.head.appendChild(script);
      });
    }
    return originalInit.call(this);
  };

  // search.js exports GlobalSearch, while the shell historically looked for Search.
  if (!global.Search && global.GlobalSearch) global.Search = global.GlobalSearch;

  // Existing modules use #modal-content and pass `body`; keep the original modal DOM/API.
  UI.modal = function (options = {}) {
    const host = document.getElementById('modal-container');
    const content = document.getElementById('modal-content');
    const body = options.body ?? options.content ?? '';
    if (!host || !content) {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `<div class="modal"><div class="modal-header"><h3>${options.title || ''}</h3><button type="button" class="modal-close">×</button></div><div class="modal-body">${body}</div><div class="modal-footer"></div></div>`;
      document.body.appendChild(overlay);
      const close = () => overlay.remove();
      overlay.querySelector('.modal-close')?.addEventListener('click', close);
      return { close };
    }

    content.innerHTML = `<div class="modal-header"><h3>${options.title || ''}</h3><button type="button" class="modal-close" aria-label="إغلاق">×</button></div><div class="modal-body">${body}</div><div class="modal-footer"></div>`;
    host.classList.remove('hidden');
    const close = () => {
      host.classList.add('hidden');
      content.innerHTML = '';
    };
    content.querySelector('.modal-close')?.addEventListener('click', close);
    const footer = content.querySelector('.modal-footer');
    (options.buttons || []).forEach(button => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `btn ${button.class || ''}`;
      el.textContent = button.text || 'إغلاق';
      el.addEventListener('click', async () => {
        try { await button.onClick?.(); } finally { if (button.close !== false) close(); }
      });
      footer?.appendChild(el);
    });
    return { close };
  };

  const closeModal = UI.closeModal;
  UI.closeModal = function () {
    closeModal?.call(UI);
    document.getElementById('modal-container')?.classList.add('hidden');
    const content = document.getElementById('modal-content');
    if (content) content.innerHTML = '';
    document.querySelectorAll('body > .modal-overlay').forEach(el => el.remove());
  };
})(window);

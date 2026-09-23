(function () {
  'use strict';

  const SUPABASE_URL = 'https://secejwjzxfjgjozpteld.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_yRvbXije9GeeLjMesgOTNw_hu35TSpe';

  if (window.supabase) {
    window.supabaseClient = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );
  } else {
    console.warn('Supabase library is unavailable; local mode will be used.');
  }

  // Bootstrap dependencies before App.init() runs. All application scripts use
  // defer, while this listener was registered during head parsing; therefore it
  // runs before app.js's DOMContentLoaded handler.
  document.addEventListener('DOMContentLoaded', () => {
    const loadScript = (src) => new Promise(resolve => {
      if ([...document.scripts].some(script => script.src.endsWith(src))) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => {
        console.warn(`Optional module failed to load: ${src}`);
        resolve();
      };
      document.head.appendChild(script);
    });

    const originalAuthInit = window.Auth?.init;
    if (originalAuthInit && !window.Auth.__bootstrapWrapped) {
      window.Auth.__bootstrapWrapped = true;
      window.Auth.init = async function (...args) {
        if (!window.Settings) await loadScript('js/settings.js');
        return originalAuthInit.apply(this, args);
      };
    }

    if (!window.Search && window.GlobalSearch) window.Search = window.GlobalSearch;
  }, { once: true });
})();

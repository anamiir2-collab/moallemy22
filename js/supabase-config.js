(function () {
  'use strict';

  const SUPABASE_URL = 'https://secejwjzxfjgjozpteld.supabase.co';

  const SUPABASE_KEY =
    'sb_publishable_yRvbXije9GeeLjMesgOTNw_hu35TSpe';

  if (!window.supabase) {
    console.error('Supabase library is not loaded.');
    return;
  }

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

})();
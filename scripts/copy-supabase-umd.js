/**
 * copy-supabase-umd.js
 * ينسخ حزمة supabase-js (UMD) من node_modules إلى js/vendor/
 * حتى يعمل التطبيق على GitHub Pages بدون CDN وبدون خطوة build.
 */
const fs = require('fs');
const path = require('path');

const candidates = [
  path.join(__dirname, '..', 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js'),
  path.join(__dirname, '..', 'node_modules', '@supabase', 'supabase-js', 'dist', 'main', 'index.js')
];
const targetDir = path.join(__dirname, '..', 'js', 'vendor');
const target = path.join(targetDir, 'supabase.js');

for (const src of candidates) {
  if (fs.existsSync(src)) {
    const code = fs.readFileSync(src, 'utf8');
    // UMD فقط (يُعرِّف window.supabase)
    if (code.includes('window.supabase') || code.includes('global.supabase') || code.includes('globalThis.supabase') || src.includes('umd')) {
      fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(target, code);
      console.log('[copy-supabase-umd] Copied', src, '->', target, `(${(code.length / 1024).toFixed(0)} KB)`);
      process.exit(0);
    }
  }
}
console.warn('[copy-supabase-umd] UMD bundle not found — will keep existing js/vendor/supabase.js');

// ub-stickers.js - add to every page that gives a sticker (NOT the /stickers page itself, it has its own).
// Usage: UBStickers.give('d7')  -> saves it and shows a small "New sticker!" pill linking to /stickers.
// Ids: d1-d24 advent doors (/market), t1-t4 Lost Tapes books, g1 derby win, g2 puzzle done, g3 quiz done,
// g4 all 7 market gags, h1 homepage Wrench peek, h2 /couch cushion tap, h3 404 page. Gold is automatic on /stickers.
window.UBStickers = window.UBStickers || (() => {
  const KEY = 'ub-stickers-v1';
  const list = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  function pill(text) {
    try {
      const a = document.createElement('a'); a.href = '/stickers'; a.textContent = text;
      a.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:9999;background:#d4ed8b;color:#111210;font:800 15px Archivo,Arial,sans-serif;padding:10px 16px;border-radius:999px;text-decoration:none;box-shadow:0 6px 20px #0008;max-width:calc(100vw - 32px);text-align:center';
      document.body.appendChild(a); setTimeout(() => a.remove(), 4500);
    } catch (e) {}
  }
  function give(id) {
    const l = list(); if (l.includes(id)) return false;
    l.push(id); try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (e) {}
    pill('New crew sticker! See your album →'); return true;
  }
  return { give, has: id => list().includes(id), list };
})();

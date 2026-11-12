// Runs in the page's own world so it can reach the MathType (WIRIS) editor objects.
(() => {
  if (window.__waVoiceMain) return;
  window.__waVoiceMain = true;
  const editors = new WeakMap();          // container element -> editor
  const getJsEditor = () => window.com && com.wiris && com.wiris.jsEditor && com.wiris.jsEditor.JsEditor;

  // Remember every editor the page creates and where it puts it.
  const poll = setInterval(() => {
    const J = getJsEditor();
    if (!J || !J.newInstance) return;
    clearInterval(poll);
    const orig = J.newInstance;
    J.newInstance = function () {
      const ed = orig.apply(this, arguments);
      try {
        const ins = ed.insertInto;
        ed.insertInto = function (el) { try { editors.set(el, ed); } catch (e) {} return ins.apply(this, arguments); };
      } catch (e) {}
      return ed;
    };
  }, 20);
  setTimeout(() => clearInterval(poll), 60000);

  function findEditor(el) {
    const J = getJsEditor();
    for (let n = el, k = 0; n && k < 12; n = n.parentElement, k++) {
      if (editors.has(n)) return editors.get(n);
      if (J && J.getInstance) { try { const ed = J.getInstance(n); if (ed && ed.setMathML) return ed; } catch (e) {} }
    }
    return null;
  }

  document.addEventListener('wa-voice-insert', e => {
    const el = e.target;
    try {
      const ed = findEditor(el);
      if (!ed) { el.dataset.waVoice = getJsEditor() ? 'editor not found' : 'no MathType api'; return; }
      const cur = ed.getMathML() || '';
      const m = cur.match(/^\s*<math[^>]*>([\s\S]*)<\/math>\s*$/);
      ed.setMathML('<math xmlns="http://www.w3.org/1998/Math/MathML">' + (m ? m[1] : '') + e.detail + '</math>');
      el.dataset.waVoice = 'ok';
    } catch (err) {
      el.dataset.waVoice = 'api error ' + err.message;
    }
  }, true);
})();

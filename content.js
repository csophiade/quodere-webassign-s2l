// Click an answer box, press comma, say the answer. On/off lives in the toolbar popup.
(() => {
  if (window.__waVoiceLoaded) return;
  window.__waVoiceLoaded = true;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  let enabled = true, listening = false, rec = null, toastEl = null;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  chrome.storage.local.get({ enabled: true }, s => (enabled = s.enabled));
  chrome.storage.onChanged.addListener(ch => {
    if (!ch.enabled) return;
    enabled = ch.enabled.newValue;
    if (!enabled && listening) rec.abort();
  });

  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.style.cssText = 'white-space:pre-wrap;position:fixed;bottom:16px;right:16px;z-index:2147483647;' +
        'background:#16181d;color:#fff;font:14px/1.4 ui-monospace,Menlo,monospace;padding:10px 14px;' +
        'border-radius:8px;max-width:420px;box-shadow:0 4px 16px rgba(0,0,0,.3)';
      document.documentElement.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.style.display = 'block';
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => (toastEl.style.display = 'none'), 6000);
  }

  function pressRight(el) {
    const o = { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39, which: 39, bubbles: true, cancelable: true };
    el.dispatchEvent(new KeyboardEvent('keydown', o));
    el.dispatchEvent(new KeyboardEvent('keyup', o));
  }

  // Preferred: hand MathML to the pad through its own API (main.js, page world).
  // Fallback: type it key by key.
  async function insert(el, heard) {
    el.focus();
    if (!el.classList.contains('wrs_focusElement')) {            // plain text answer box
      document.execCommand('insertText', false, speechToWebAssign(heard));
      return 'text box';
    }
    el.dataset.waVoice = 'no page script';
    el.dispatchEvent(new CustomEvent('wa-voice-insert', { bubbles: true, detail: speechToMathML(heard) }));
    const status = el.dataset.waVoice;
    if (status === 'ok') return 'pad api';
    for (const ch of speechToKeys(heard)) {
      el.value = '';
      if (ch === RIGHT) pressRight(el);
      else document.execCommand('insertText', false, ch);
      await sleep(40);
    }
    el.value = '';
    return 'typed, because: ' + status;
  }

  function start(target) {
    rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    // Some browsers fire onresult repeatedly with growing partial transcripts.
    // Only remember the latest one here; insert exactly once when listening ends.
    let heard = '';
    rec.onresult = e => {
      const finals = Array.from(e.results).filter(r => r.isFinal).map(r => r[0].transcript);
      heard = (finals.length ? finals.join(' ') : e.results[e.results.length - 1][0].transcript).trim();
      toast('listening...\n' + heard);
    };
    rec.onerror = e => { if (e.error !== 'aborted') toast('speech error: ' + e.error); };
    rec.onend = async () => {
      listening = false;
      if (!heard || !enabled) { if (!heard) toast('heard nothing'); return; }
      const out = speechToWebAssign(heard);
      const how = await insert(target, heard);
      toast('heard: ' + heard + '\n-> ' + out + '\n[' + how + ']');
      chrome.storage.local.set({ last: { heard, out } });
    };
    rec.start();
    listening = true;
    toast('listening...');
  }

  const isBox = el => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

  window.addEventListener('keydown', e => {
    if (!enabled || e.key !== ',' || e.ctrlKey || e.metaKey || e.altKey) return;
    const el = document.activeElement;
    if (!isBox(el)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.repeat) return;
    if (listening) rec.stop(); else start(el);
  }, true);
})();

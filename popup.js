const toggle = document.getElementById('toggle');
const state = document.getElementById('state');
const hint = document.getElementById('hint');

function show(on) {
  toggle.checked = on;
  state.textContent = on ? 'On' : 'Off';
  hint.style.opacity = on ? 1 : 0.4;
}

chrome.storage.local.get({ enabled: true, last: null }, s => {
  show(s.enabled);
  if (s.last) {
    document.getElementById('out').textContent = s.last.out;
    document.getElementById('heard').textContent = '"' + s.last.heard + '"';
  }
});
toggle.addEventListener('change', () => {
  chrome.storage.local.set({ enabled: toggle.checked });
  show(toggle.checked);
});

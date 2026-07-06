// just-ate — themed dialogs and toasts, replacing native alert/confirm/prompt.
//
// Built on <dialog> (focus trap, Esc, top layer) and styled entirely with the
// app's CSS variables, so it tracks the theme. Promise-based: the native calls
// blocked synchronously, so callers now `await`.
//
//   await UI.confirm('Delete this?', { danger: true, okText: 'Delete' }) -> bool
//   await UI.prompt('Type DELETE', { placeholder: 'DELETE' })            -> string | null
//   await UI.alert('Saved.')                                             -> resolves on dismiss
//   UI.toast('kcal is needed', { type: 'error' })                        -> transient, no await

const UI = (() => {
  const esc = (s) => String(s).replace(/[&<>"']/g, (m) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

  function dialog({ title, message, buttons, input }) {
    return new Promise((resolve) => {
      const dlg = document.createElement('dialog');
      dlg.className = 'ui-dialog';
      dlg.innerHTML = `
        <div class="ui-card">
          ${title ? `<h3 class="ui-title">${esc(title)}</h3>` : ''}
          <p class="ui-msg">${esc(message).replace(/\n/g, '<br>')}</p>
          ${input ? `<input class="ui-input" id="ui-input" placeholder="${esc(input.placeholder || '')}" autocomplete="off">` : ''}
          <div class="ui-actions">
            ${buttons.map((b, i) => `<button class="btn ${b.class || ''}" data-i="${i}">${esc(b.label)}</button>`).join('')}
          </div>
        </div>`;
      document.body.appendChild(dlg);
      const inputEl = dlg.querySelector('#ui-input');

      let done = false;
      const settle = (val) => {
        if (done) return;               // guard against Esc + click both firing
        done = true;
        dlg.close();
        dlg.remove();
        resolve(val);
      };

      dlg.querySelectorAll('.ui-actions button').forEach((el, i) => {
        el.addEventListener('click', () => {
          const b = buttons[i];
          settle(b.value === '__input' ? (inputEl ? inputEl.value.trim() : '') : b.value);
        });
      });
      // Esc and backdrop click cancel: null for prompt, false for confirm/alert.
      const cancelVal = input ? null : false;
      dlg.addEventListener('cancel', (e) => { e.preventDefault(); settle(cancelVal); });
      dlg.addEventListener('click', (e) => { if (e.target === dlg) settle(cancelVal); });

      dlg.showModal();
      if (inputEl) {
        inputEl.focus();
        inputEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); dlg.querySelector('.ui-actions button:last-child').click(); }
        });
      } else {
        // Default focus to the primary action — unless it's destructive, then
        // to Cancel, so a stray Enter can't confirm a delete.
        const btns = dlg.querySelectorAll('.ui-actions button');
        const last = btns[btns.length - 1];
        const danger = last && /\bdanger\b/.test(last.className);
        (danger && btns.length > 1 ? btns[0] : last).focus();
      }
    });
  }

  return {
    alert(message, opts = {}) {
      return dialog({ title: opts.title, message, buttons: [{ label: opts.okText || 'OK', value: true, class: 'primary' }] });
    },
    confirm(message, opts = {}) {
      return dialog({
        title: opts.title,
        message,
        buttons: [
          { label: opts.cancelText || 'Cancel', value: false },
          { label: opts.okText || 'Confirm', value: true, class: opts.danger ? 'danger solid' : 'primary' },
        ],
      });
    },
    prompt(message, opts = {}) {
      return dialog({
        title: opts.title,
        message,
        input: { placeholder: opts.placeholder || '' },
        buttons: [
          { label: opts.cancelText || 'Cancel', value: null },
          { label: opts.okText || 'OK', value: '__input', class: opts.danger ? 'danger solid' : 'primary' },
        ],
      });
    },
    toast(message, opts = {}) {
      let host = document.getElementById('ui-toasts');
      if (!host) { host = document.createElement('div'); host.id = 'ui-toasts'; document.body.appendChild(host); }
      const t = document.createElement('div');
      t.className = 'ui-toast' + (opts.type === 'error' ? ' error' : '');
      t.textContent = message;
      host.appendChild(t);
      requestAnimationFrame(() => t.classList.add('in'));
      setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 250); }, opts.duration || 3200);
    },
  };
})();

if (typeof window !== 'undefined') window.UI = UI;

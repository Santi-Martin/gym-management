/* ==========================================
   MODAL.JS — Global modal component
   ========================================== */

const Modal = {
  show(title, bodyHTML, footerHTML = '') {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHTML;
    document.getElementById('modal-footer').innerHTML = footerHTML;
    document.getElementById('global-modal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
  },

  hide() {
    document.getElementById('global-modal').style.display = 'none';
    document.body.style.overflow = '';
  },

  confirm(title, message, onConfirm, confirmLabel = 'Confirmar', danger = false) {
    this.show(
      title,
      `<p style="color:var(--text-muted);line-height:1.7;">${message}</p>`,
      `<button class="btn btn--ghost" id="modal-cancel-btn">Cancelar</button>
       <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" id="modal-confirm-btn">${confirmLabel}</button>`
    );
    document.getElementById('modal-cancel-btn').onclick = () => this.hide();
    document.getElementById('modal-confirm-btn').onclick = () => {
      this.hide();
      onConfirm();
    };
  }
};

// Close modal on overlay click and X button
document.getElementById('modal-close').addEventListener('click', () => Modal.hide());
document.getElementById('global-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('global-modal')) Modal.hide();
});

// Toast notifications
const Toast = {
  show(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      toast.style.transition = '0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },
  success(msg) { this.show(msg, 'success'); },
  error(msg) { this.show(msg, 'error'); },
  info(msg) { this.show(msg, 'info'); }
};

import { Component, inject } from '@angular/core';
import { SessionExpiredService } from './session-expired.service';

@Component({
  selector: 'app-session-expired-modal',
  template: `
    @if (expired.visible()) {
      <div class="session-expired-backdrop">
        <section class="modal-dialog modal-dialog-centered session-expired-dialog" role="dialog" aria-modal="true" aria-labelledby="expired-title" aria-describedby="expired-description">
          <div class="modal-content">
            <div class="modal-header"><h2 id="expired-title" class="modal-title h4">La sessione di accesso è scaduta</h2></div>
            <div class="modal-body">
              <p id="expired-description">Per continuare a lavorare, accedi di nuovo con le credenziali CNR.</p>
              <p class="mb-0 fw-semibold">Le presenze già registrate sono salvate.</p>
            </div>
            <div class="modal-footer"><button class="btn btn-primary" type="button" (click)="expired.loginAgain()">Accedi di nuovo</button></div>
          </div>
        </section>
      </div>
    }
  `,
  styles: `
    .session-expired-backdrop { position:fixed; z-index:2000; inset:0; display:grid; place-items:center; padding:1rem; background:#102a43aa; }
    .session-expired-dialog { width:min(560px,100%); margin:0; }
  `,
})
export class SessionExpiredModalComponent {
  readonly expired = inject(SessionExpiredService);
}

import { Component, inject } from '@angular/core';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-logged-out',
  template: `
    <main class="container my-5 logged-out" aria-labelledby="logged-out-title">
      <h1 id="logged-out-title">Sessione terminata</h1>
      <p class="text-muted">Hai effettuato il logout dall'applicazione.</p>
      <button class="btn btn-primary" type="button" (click)="auth.login('/')">Effettua il login</button>
    </main>
  `,
  styles: `.logged-out { max-width: 720px; }`,
})
export class LoggedOutComponent {
  readonly auth = inject(AuthService);
}

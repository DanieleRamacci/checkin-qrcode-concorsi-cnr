import { Injectable, signal } from '@angular/core';
import { currentLocalReturnUrl } from '../auth.service';

@Injectable({ providedIn: 'root' })
export class SessionExpiredService {
  readonly visible = signal(false);
  private opened = false;

  show(): void {
    if (this.opened) return;
    this.opened = true;
    this.visible.set(true);
  }

  loginAgain(): void {
    const next = currentLocalReturnUrl(window.location);
    window.location.assign(`/login?next=${encodeURIComponent(next)}`);
  }

  reset(): void { this.opened = false; this.visible.set(false); }
}

import { Component, HostListener } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SessionExpiredModalComponent } from './core/session-expired/session-expired-modal.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SessionExpiredModalComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  @HostListener('window:pageshow', ['$event'])
  onPageShow(event: PageTransitionEvent): void {
    if (event.persisted) {
      window.location.reload();
    }
  }
}

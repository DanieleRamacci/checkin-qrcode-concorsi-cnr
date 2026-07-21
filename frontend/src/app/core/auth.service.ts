import { inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiClient } from './api-client';
import { CsrfTokenStore } from './csrf.interceptor';
import { AppSettings, UserContext } from './models/api.models';

export function currentLocalReturnUrl(
  location: Pick<Location, 'pathname' | 'search' | 'hash'>,
): string {
  const path = `${location.pathname}${location.search}${location.hash}`;
  return path.startsWith('/') && !path.startsWith('//') ? path : '/';
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiClient);
  private readonly csrf = inject(CsrfTokenStore);
  readonly user = signal<UserContext | null>(null);
  readonly defaultSettings: AppSettings = {
    slim_title: 'Consiglio Nazionale delle Ricerche',
    institution_name: 'CNR',
    app_title: 'Check-in CNR Concorsi',
    tagline: 'Sistema gestione presenze concorsi',
    footer_owner: 'CNR - Consiglio Nazionale delle Ricerche',
  };

  load(): Observable<UserContext> {
    return this.api.get<UserContext>('/me').pipe(
      tap((user) => {
        this.user.set(user);
        this.csrf.set(user.csrf_token);
      }),
    );
  }

  hasCapability(capability: string): boolean {
    return this.user()?.capabilities.includes(capability) ?? false;
  }

  settings(): AppSettings {
    return { ...this.defaultSettings, ...(this.user()?.app_settings ?? {}) };
  }

  login(returnUrl = currentLocalReturnUrl(window.location)): void {
    window.location.assign(`/login?next=${encodeURIComponent(returnUrl)}`);
  }

  logout(): void {
    this.api.post<{ authenticated: false }>('/logout').subscribe({
      next: () => this.finishLogout(),
      error: () => this.finishLogout(),
    });
  }

  private finishLogout(): void {
    this.user.set(null);
    this.csrf.set(null);
    this.login('/');
  }
}

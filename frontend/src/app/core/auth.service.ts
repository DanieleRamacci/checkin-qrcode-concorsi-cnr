import { inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiClient } from './api-client';
import { CsrfTokenStore } from './csrf.interceptor';
import { UserContext } from './models/api.models';

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

  login(returnUrl = currentLocalReturnUrl(window.location)): void {
    window.location.assign(`/login?next=${encodeURIComponent(returnUrl)}`);
  }
}

import { Injectable, signal } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CsrfTokenStore {
  readonly token = signal<string | null>(null);

  set(token: string | null): void {
    this.token.set(token);
  }
}

export const csrfInterceptor: HttpInterceptorFn = (request, next) => {
  const token = inject(CsrfTokenStore).token();
  const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  let headers = request.headers;
  if (mutation && token) {
    headers = headers.set('X-CSRF-Token', token);
  }
  return next(
    request.clone({
      headers,
      withCredentials: true,
    }),
  );
};

import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { SessionExpiredService } from './session-expired/session-expired.service';

const REDIRECT_CODES = new Set([
  'authentication_required',
  'reauthentication_required',
]);

let redirectInProgress = false;

export function resetReauthRedirectState(): void {
  redirectInProgress = false;
}

export function shouldRedirectToLogin(error: unknown): error is HttpErrorResponse {
  if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
    return false;
  }
  const payload = error.error as
    | { error?: { code?: string }; code?: string }
    | null
    | undefined;
  const code = payload?.error?.code ?? payload?.code;
  return !!code && REDIRECT_CODES.has(code);
}

export const reauthInterceptor: HttpInterceptorFn = (request, next) => {
  const expired = inject(SessionExpiredService);
  return next(request).pipe(
    catchError((error) => {
      if (shouldRedirectToLogin(error) && !redirectInProgress) {
        redirectInProgress = true;
        expired.show();
      }
      return throwError(() => error);
    }),
  );
};

import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

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

function currentLocalReturnUrl(
  location: Pick<Location, 'pathname' | 'search' | 'hash'>,
): string {
  const path = `${location.pathname}${location.search}${location.hash}`;
  return path.startsWith('/') && !path.startsWith('//') ? path : '/';
}

export const reauthInterceptor: HttpInterceptorFn = (request, next) =>
  next(request).pipe(
    catchError((error) => {
      if (shouldRedirectToLogin(error) && !redirectInProgress) {
        redirectInProgress = true;
        window.location.assign(
          `/login?next=${encodeURIComponent(currentLocalReturnUrl(window.location))}`,
        );
      }
      return throwError(() => error);
    }),
  );

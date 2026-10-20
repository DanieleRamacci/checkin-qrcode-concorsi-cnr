import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from './auth.service';
import { ProfileService, sessionMode } from './profile.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (auth.user()) {
    return true;
  }
  return auth.load().pipe(
    map(() => true),
    catchError(() => {
      auth.login();
      return of(false);
    }),
  );
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const allow = () =>
    auth.hasCapability('admin') ? true : router.createUrlTree(['/']);
  if (auth.user()) return allow();
  return auth.load().pipe(
    map(allow),
    catchError(() => of(router.createUrlTree(['/']))),
  );
};

/**
 * Una pagina sessione aperta senza `mode` (per esempio tornando dallo scanner
 * collegato col QR) prende il profilo attivo dell'utente, o il suo primo
 * profilo operativo, invece di aprirsi sempre come segretario.
 */
export const sessionModeGuard: CanActivateFn = (route) => {
  if (route.queryParamMap.get('mode')) return true;
  const auth = inject(AuthService);
  const profiles = inject(ProfileService);
  const router = inject(Router);
  const redirect = () => router.createUrlTree(['/sessioni', route.paramMap.get('sessionId') ?? ''], {
    queryParams: { ...route.queryParams, mode: sessionMode(profiles.sessionProfile()) },
  });
  if (auth.user()) return redirect();
  return auth.load().pipe(map(redirect), catchError(() => of(true)));
};

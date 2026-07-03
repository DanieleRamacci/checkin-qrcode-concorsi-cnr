import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from './auth.service';

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

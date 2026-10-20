import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRouteSnapshot, convertToParamMap, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';
import { sessionModeGuard } from './auth.guard';

function run(user: Record<string, unknown>, query: Record<string, string>) {
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthService, useValue: { user: signal(user) } }] });
  window.localStorage.clear();
  const route = { paramMap: convertToParamMap({ sessionId: 's1' }), queryParamMap: convertToParamMap(query), queryParams: query } as unknown as ActivatedRouteSnapshot;
  return TestBed.runInInjectionContext(() => sessionModeGuard(route, {} as RouterStateSnapshot));
}

describe('sessionModeGuard', () => {
  it('keeps a session URL that already declares the profile', () => {
    expect(run({ email: 'a@cnr.it', profiles: ['segretario'] }, { mode: 'sede' })).toBe(true);
  });

  it('opens the session as informatico in sede for a support-only user, not as secretary', () => {
    const result = run({ email: 'sede@cnr.it', profiles: ['sede'] }, {}) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/sessioni/s1?mode=sede');
  });
});

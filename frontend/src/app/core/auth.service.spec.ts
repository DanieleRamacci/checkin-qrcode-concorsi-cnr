import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ApiClient } from './api-client';
import { AuthService, currentLocalReturnUrl } from './auth.service';
import { CsrfTokenStore } from './csrf.interceptor';

describe('AuthService', () => {
  it('preserves scanner path and query for the OIDC return URL', () => {
    expect(
      currentLocalReturnUrl({
        pathname: '/scanner',
        search: '?sessionId=session-1&token=registration-token',
        hash: '',
      }),
    ).toBe('/scanner?sessionId=session-1&token=registration-token');
  });

  it('loads the current user and stores CSRF', () => {
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        CsrfTokenStore,
        {
          provide: ApiClient,
          useValue: {
            get: () =>
              of({
                authenticated: true,
                email: 'expert@cnr.it',
                display_name: 'Esperto',
                roles: ['esperto_informatico'],
                capabilities: ['expert_workflow'],
                csrf_token: 'csrf-token',
              }),
          },
        },
      ],
    });

    const service = TestBed.inject(AuthService);
    service.load().subscribe();

    expect(service.user()?.email).toBe('expert@cnr.it');
    expect(TestBed.inject(CsrfTokenStore).token()).toBe('csrf-token');
  });

  it('uses the OIDC logout route instead of only clearing the API session', () => {
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        CsrfTokenStore,
        {
          provide: ApiClient,
          useValue: { get: () => of({}) },
        },
      ],
    });
    const assign = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, assign },
    });

    TestBed.inject(AuthService).logout();

    expect(assign).toHaveBeenCalledWith('/logout');
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });
});

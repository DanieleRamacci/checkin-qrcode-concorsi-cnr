import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ApiClient } from './api-client';
import { SessionExpiredService } from './session-expired/session-expired.service';
import {
  reauthInterceptor,
  resetReauthRedirectState,
} from './reauth.interceptor';

describe('reauthInterceptor', () => {
  let api: ApiClient;
  let http: HttpTestingController;
  let originalLocation: Location;
  let assign: ReturnType<typeof vi.fn>;
  let expired: SessionExpiredService;

  beforeEach(() => {
    resetReauthRedirectState();
    assign = vi.fn();
    originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        pathname: '/bandi',
        search: '?mode=sede',
        hash: '#lista',
        assign,
      },
    });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([reauthInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    api = TestBed.inject(ApiClient);
    http = TestBed.inject(HttpTestingController);
    expired = TestBed.inject(SessionExpiredService);
    expired.reset();
  });

  afterEach(() => {
    http.verify();
    expired.reset();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
    resetReauthRedirectState();
  });

  it('opens one modal for multiple auth failures and redirects only after the user clicks', () => {
    api.get('/bandi').subscribe({ error: () => undefined });
    api.get('/sessioni').subscribe({ error: () => undefined });

    const request = http.expectOne('/api/v1/bandi');
    request.flush(
      { error: { code: 'reauthentication_required', message: 'Sessione scaduta.' } },
      { status: 401, statusText: 'Unauthorized' },
    );
    const second = http.expectOne('/api/v1/sessioni');
    second.flush({ error: { code: 'authentication_required', message: 'Sessione scaduta.' } }, { status: 401, statusText: 'Unauthorized' });

    expect(expired.visible()).toBe(true);
    expect(assign).not.toHaveBeenCalled();
    expired.loginAgain();
    expect(assign).toHaveBeenCalledOnce();
    expect(assign).toHaveBeenCalledWith('/login?next=%2Fbandi%3Fmode%3Dsede%23lista');
  });

  it('does not redirect for non-authentication API errors', () => {
    api.get('/bandi').subscribe({ error: () => undefined });

    const request = http.expectOne('/api/v1/bandi');
    request.flush(
      { error: { code: 'external_service_unavailable', message: 'Servizio non disponibile.' } },
      { status: 502, statusText: 'Bad Gateway' },
    );

    expect(assign).not.toHaveBeenCalled();
    expect(expired.visible()).toBe(false);
  });
});

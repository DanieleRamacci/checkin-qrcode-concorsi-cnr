import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ApiClient } from './api-client';
import { CsrfTokenStore, csrfInterceptor } from './csrf.interceptor';

describe('ApiClient', () => {
  let api: ApiClient;
  let http: HttpTestingController;
  let csrf: CsrfTokenStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([csrfInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    api = TestBed.inject(ApiClient);
    http = TestBed.inject(HttpTestingController);
    csrf = TestBed.inject(CsrfTokenStore);
  });

  afterEach(() => http.verify());

  it('uses cookie credentials for API requests', () => {
    api.get('/me').subscribe();

    const request = http.expectOne('/api/v1/me');
    expect(request.request.withCredentials).toBe(true);
    request.flush({});
  });

  it('adds the CSRF token to mutations', () => {
    csrf.set('csrf-token');

    api.post('/resource', {}).subscribe();

    const request = http.expectOne('/api/v1/resource');
    expect(request.request.headers.get('X-CSRF-Token')).toBe('csrf-token');
    request.flush({});
  });
});

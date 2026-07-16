import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApiClient } from '../../core/api-client';
import { DispositiviComponent } from './dispositivi.component';

describe('DispositiviComponent', () => {
  it('renders the legacy device fields and status', async () => {
    await TestBed.configureTestingModule({
      imports: [DispositiviComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: new Map([['sessionId', 'session-1']]),
              queryParamMap: new Map([['mode', 'sede']]),
            },
          },
        },
        {
          provide: ApiClient,
          useValue: {
            get: (path: string) => {
              if (path.includes('/devices?')) {
                return of({ items: [{
                  id: 1,
                  session_id: 'session-1',
                  nome_dispositivo: 'Tablet sede',
                  status: 'online',
                  user_agent: 'Browser',
                  ip_address: '127.0.0.1',
                }] });
              }
              if (path.startsWith('/sessioni/session-1?')) {
                return of({
                  session_id: 'session-1',
                  commission_id: 'c1',
                  name: 'Sessione mattina',
                  date: '2026-07-03',
                  time: '09:00',
                  location: 'Roma',
                });
              }
              return of({});
            },
            post: () => of({ registration_token: 'registration-token' }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DispositiviComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Tablet sede');
    expect(fixture.nativeElement.textContent).toContain('connesso');
    fixture.destroy();
  });
});

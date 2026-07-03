import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { SessioniComponent } from './sessioni.component';
import { SessioniService } from './sessioni.service';
import { BandiService } from '../bandi/bandi.service';
import { AuthService } from '../../core/auth.service';
import { signal } from '@angular/core';

describe('SessioniComponent', () => {
  it('renders sessions for the selected bando', async () => {
    await TestBed.configureTestingModule({
      imports: [SessioniComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: new Map([['commissionId', 'c1']]) } },
        },
        {
          provide: SessioniService,
          useValue: {
            sync: () => of({ success: true, inserted: 0 }),
            list: () =>
              of({
                commission_id: 'c1',
                items: [
                  {
                    session_id: 's1',
                    commission_id: 'c1',
                    name: 'Prova scritta',
                    date: '02/07/2026',
                    time: '10:00',
                    location: 'Roma',
                    current_state: 'iniziale',
                    candidate_count: 0,
                    checked_in_count: 0,
                    device_count: 0,
                    capabilities: ['manage'],
                  },
                ],
              }),
          },
        },
        {
          provide: BandiService,
          useValue: {
            detail: () =>
              of({
                commission_id: 'c1',
                title: 'Concorso CNR',
                configured: true,
                session_count: 1,
                capabilities: ['view'],
              }),
          },
        },
        {
          provide: AuthService,
          useValue: {
            user: signal(null),
            hasCapability: () => false,
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(SessioniComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Prova scritta');
  });
});

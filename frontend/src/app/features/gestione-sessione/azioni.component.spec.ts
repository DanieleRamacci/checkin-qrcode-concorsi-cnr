import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApiClient } from '../../core/api-client';
import { AzioniComponent } from './azioni.component';

describe('AzioniComponent', () => {
  it('shows the expert workflow instead of secretary actions', async () => {
    await TestBed.configureTestingModule({
      imports: [AzioniComponent],
      providers: [
        provideRouter([]),
        {
          provide: ApiClient,
          useValue: {
            get: () =>
              of({
                id: 1,
                session_id: 'session-1',
                num_presenti: 3,
                generato_da: 'secretary@cnr.it',
                timestamp_creazione: '2026-07-03T10:00:00Z',
                downloads: {
                  xlsx: '/api/v1/sessioni/session-1/lists/1/xlsx',
                  moodle_csv: '/api/v1/sessioni/session-1/lists/1/moodle-csv',
                },
              }),
            post: () => of({}),
            put: () => of({}),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AzioniComponent);
    fixture.componentRef.setInput('sessionId', 'session-1');
    fixture.componentRef.setInput('commissionId', 'commission-1');
    fixture.componentRef.setInput('currentState', 'liste_inviate');
    fixture.componentRef.setInput('viewMode', 'esperto');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Lista presenti aggiornata');
    expect(text).not.toContain('Invia lista ad esperto informatico');
  });
});

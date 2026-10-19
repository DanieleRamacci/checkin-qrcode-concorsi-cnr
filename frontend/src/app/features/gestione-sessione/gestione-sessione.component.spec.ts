import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApiClient } from '../../core/api-client';
import { BandiService } from '../bandi/bandi.service';
import { GestioneSessioneComponent } from './gestione-sessione.component';

describe('GestioneSessioneComponent', () => {
  it('renders expert mode without the secretary timeline', async () => {
    await TestBed.configureTestingModule({
      imports: [GestioneSessioneComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: new Map([['sessionId', 'session-1']]),
              queryParamMap: new Map([['mode', 'expert']]),
            },
          },
        },
        {
          provide: BandiService,
          useValue: { detail: () => of({ configured: true }) },
        },
        {
          provide: ApiClient,
          useValue: {
            get: (path: string) => {
              if (path.startsWith('/sessioni/session-1?')) {
                return of({
                  session_id: 'session-1',
                  commission_id: 'c1',
                  bando_title: '367.222 FA Test - Funzionario di Amministrazione',
                  name: 'Sessione prova',
                  location: 'Roma',
                  date: '2026-07-03',
                  time: '09:00',
                  device_count: 1,
                });
              }
              if (path.includes('/state?')) return of({ current_state: 'liste_inviate', actions: [] });
              if (path.includes('/lists/latest?')) {
                return of({
                  id: 1,
                  session_id: 'session-1',
                  num_presenti: 2,
                  downloads: { xlsx: '/xlsx', moodle_csv: '/csv' },
                });
              }
              if (path.includes('/candidati') || path.includes('/notifications')) return of({ items: [] });
              return of({});
            },
            post: () => of({}),
            put: () => of({}),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(GestioneSessioneComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Stai lavorando come Esperto remoto');
    expect(fixture.nativeElement.textContent).toContain('367.222 FA Test - Funzionario di Amministrazione');
    expect(fixture.nativeElement.textContent).toContain('Avanzamento della sessione');
    fixture.destroy();
  });

  it('keeps the next action in the session panel before check-in starts', async () => {
    await TestBed.configureTestingModule({
      imports: [GestioneSessioneComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: new Map([['sessionId', 'session-1']]),
              queryParamMap: new Map([['mode', 'segretario']]),
            },
          },
        },
        {
          provide: BandiService,
          useValue: { detail: () => of({ configured: true }) },
        },
        {
          provide: ApiClient,
          useValue: {
            get: (path: string) => {
              if (path.startsWith('/sessioni/session-1?')) {
                return of({
                  session_id: 'session-1',
                  commission_id: 'c1',
                  bando_title: 'Bando test',
                  name: 'Sessione prova',
                  location: 'Roma',
                  date: '2026-07-03',
                  time: '09:00',
                  device_count: 1,
                });
              }
              if (path.includes('/state?')) return of({ current_state: 'dispositivi_connessi', actions: [] });
              if (path.includes('/candidati') || path.includes('/notifications')) return of({ items: [] });
              return of({});
            },
            post: () => of({}),
            put: () => of({}),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(GestioneSessioneComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Collega gli smartphone che useranno come scanner');
    expect(fixture.nativeElement.textContent).not.toContain('Prima di iniziare a scansionare le domande');
    fixture.destroy();
  });
});

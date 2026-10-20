import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApiClient } from '../../core/api-client';
import { BandiService } from '../bandi/bandi.service';
import { GestioneSessioneComponent } from './gestione-sessione.component';
import { provideKitForTests } from '../../../testing/kit';

async function render(mode: string, state: string) {
  await TestBed.configureTestingModule({
    imports: [GestioneSessioneComponent],
    providers: [
      provideRouter([]),
      ...provideKitForTests(),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['sessionId', 'session-1']]), queryParamMap: new Map([['mode', mode]]) } } },
      { provide: BandiService, useValue: { detail: () => of({ configured: true }) } },
      {
        provide: ApiClient,
        useValue: {
          get: (path: string) => {
            if (path.startsWith('/sessioni/session-1?')) {
              return of({
                session_id: 'session-1', commission_id: 'c1', bando_title: '367.222 FA Test - Funzionario di Amministrazione',
                name: 'Sessione prova', location: 'Roma', date: '2026-07-03', time: '09:00:00',
                device_count: 1, candidate_count: 2, checked_in_count: 1,
              });
            }
            if (path.includes('/state?')) return of({ current_state: state, actions: [], history: [{ state: 'iniziale', at: '2026-07-03T08:10:00', actor_role: 'Segretario' }] });
            if (path.includes('/lists/latest?')) return of({ id: 1, session_id: 'session-1', num_presenti: 2, downloads: { xlsx: '/xlsx', moodle_csv: '/csv' } });
            if (path.includes('/config?')) return of({ email_segretario: 'seg@cnr.it', email_esperto_remoto: 'esperto@cnr.it' });
            if (path.includes('/candidati') || path.includes('/notifications') || path.includes('/devices')) return of({ items: [] });
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
  return fixture;
}

describe('GestioneSessioneComponent', () => {
  it('lays out the session as in the design: full-width head, actions and candidates, timeline and references', async () => {
    const fixture = await render('segretario', 'iniziale');
    const element = fixture.nativeElement as HTMLElement;
    const head = element.querySelector('section.app-session-head') as HTMLElement;
    expect(head.querySelector('h1')?.textContent).toContain('Sessione prova');
    expect(head.textContent).toContain('03/07/2026 alle 09:00 · Roma · 367.222 FA Test');
    expect(head.querySelector('.breadcrumb')?.textContent).toContain('I miei concorsi');
    expect(head.textContent).not.toContain('Stai lavorando come');
    const main = element.querySelector('.col-lg-8') as HTMLElement;
    expect(main.querySelector('.app-actions-card h3')?.textContent).toContain('Chi ti aiuta in questa sessione?');
    expect(main.querySelector('.app-cand-card .app-empty')?.textContent).toContain('Nessun candidato ancora');
    const side = element.querySelector('.col-lg-4') as HTMLElement;
    expect(side.querySelector('.app-tl-card')?.textContent).toContain('Timeline della sessione');
    expect(side.querySelector('.app-refs')?.textContent).toContain('seg@cnr.it');
    expect(element.querySelector('.app-chat-fab')).toBeTruthy();
    fixture.destroy();
  });

  it('shows the expert role, the expert breadcrumb and the reset table of present candidates', async () => {
    const fixture = await render('expert', 'liste_inviate');
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Stai lavorando come Esperto remoto');
    expect(element.querySelector('.breadcrumb')?.textContent).toContain('Le mie sessioni');
    expect(element.querySelector('.app-actions-card h3')?.textContent).toContain('Carica i presenti su Moodle');
    expect(element.querySelector('.app-cand-card')?.textContent).toContain('Reset password');
    expect(element.querySelector('.app-tl-phase.is-other')).toBeNull();
    fixture.destroy();
  });
});

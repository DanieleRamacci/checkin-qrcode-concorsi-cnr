import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ApiClient } from '../../core/api-client';
import { CandidateSummary } from '../../core/models/api.models';
import { CandidatiComponent, CandidateSectionMode, candidateQrPayload } from './candidati.component';
import { provideKitForTests } from '../../../testing/kit';

function candidate(overrides: Partial<CandidateSummary>): CandidateSummary {
  return {
    uid: 'u1', first_name: 'Ada', last_name: 'Lovelace', document_number: 'DOC1', document_expired: false,
    checkin_effettuato: false, reset_password_richiesto: false, reset_password_effettuato: false, note: '',
    ...overrides,
  };
}

const CANDIDATES = [
  candidate({ uid: 'u1', last_name: 'Rossi', first_name: 'Ada', document_expired: true }),
  candidate({ uid: 'u2', last_name: 'Bianchi', first_name: 'Grace', checkin_effettuato: true, checkin_at: '2026-10-20T14:07:00', checkin_source: 'scanner' }),
  candidate({ uid: 'u3', last_name: 'Verdi', first_name: 'Linus', checkin_effettuato: true, checkin_at: '2026-10-20T14:09:00', checkin_source: 'tabella' }),
];

async function render(mode: CandidateSectionMode, items: CandidateSummary[] = CANDIDATES, api: Record<string, unknown> = {}) {
  const get = vi.fn(() => of({ items }));
  await TestBed.configureTestingModule({
    imports: [CandidatiComponent],
    providers: [...provideKitForTests(), { provide: ApiClient, useValue: { get, post: () => of({}), put: () => of({}), ...api } }],
  }).compileComponents();
  const fixture = TestBed.createComponent(CandidatiComponent);
  fixture.componentRef.setInput('sessionId', 'session-1');
  fixture.componentRef.setInput('sectionMode', mode);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const rows = () => Array.from(element.querySelectorAll('tbody tr')).map((row) => row.textContent ?? '');
  const headers = () => Array.from(element.querySelectorAll('thead th')).map((th) => th.textContent?.trim() ?? '');
  return { fixture, element, rows, headers, get };
}

describe('candidateQrPayload', () => {
  it('matches the payload consumed by the scanner', () => {
    expect(candidateQrPayload('candidate-123')).toBe('{"uid":"candidate-123"}');
  });
});

describe('CandidatiComponent', () => {
  it('shows an empty box with the next step before candidates are downloaded', async () => {
    const { element, get } = await render('vuota');
    expect(element.querySelector('h2')?.textContent).toBe('Candidati');
    expect(element.querySelector('.app-empty')?.textContent).toContain('Nessun candidato ancora');
    expect(get).not.toHaveBeenCalled();
  });

  it('is read-only before check-in, with validity and the expired documents to verify', async () => {
    const { element, headers } = await render('sola-lettura');
    expect(element.querySelector('h2')?.textContent).toBe('Candidati · 3');
    expect(headers()).toEqual(['Cognome e nome', 'Documento', 'Validità']);
    expect(element.textContent).toContain('1 con documento scaduto: verificali in aula');
    expect(element.querySelectorAll('tbody button')).toHaveLength(0);
  });

  it('during check-in starts from the candidates to register, with counts, search and Segna presente', async () => {
    const { fixture, element, rows, headers } = await render('checkin');
    expect(headers()).toEqual(['Cognome e nome', 'Documento', 'Presenza', 'Azioni']);
    const chips = Array.from(element.querySelectorAll('.app-filter-chips button')).map((button) => button.textContent?.trim());
    expect(chips).toEqual(['Da registrare · 1', 'Presenti · 2', 'Documento scaduto · 1', 'Tutti · 3']);
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toContain('Rossi');
    expect(rows()[0]).toContain('Scaduto');
    expect(rows()[0]).toContain('Segna presente');
    fixture.componentInstance.setFilter('presenti');
    fixture.detectChanges();
    expect(rows()[0]).toContain('14:07 · da scanner');
    expect(rows()[1]).toContain('14:09 · da tabella');
    fixture.componentInstance.setFilter('all');
    fixture.componentInstance.setQuery('verdi');
    fixture.detectChanges();
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toContain('Verdi');
  });

  it('after check-in lists present and absent candidates with the conclusion time', async () => {
    const { fixture, element, rows, headers } = await render('finale');
    fixture.componentRef.setInput('concludedAt', '14:41');
    fixture.detectChanges();
    expect(element.querySelector('h2')?.textContent).toBe('Candidati · 2 presenti su 3');
    expect(element.textContent).toContain('Check-in concluso alle 14:41');
    expect(headers()).toEqual(['Cognome e nome', 'Documento', 'Validità', 'Presenza']);
    expect(rows().find((row) => row.includes('Rossi'))).toContain('Assente');
    expect(rows().find((row) => row.includes('Bianchi'))).toContain('Presente 14:07 · da scanner');
  });

  it('for the in-person technician puts open resets on top and asks resets from the row', async () => {
    const present = [
      candidate({ uid: 'a', last_name: 'Abate', checkin_effettuato: true }),
      candidate({ uid: 'z', last_name: 'Zeta', checkin_effettuato: true, reset_password_richiesto: true, reset_password_richiesto_at: '2026-10-20T15:05:00', reset_password_richiesto_role: 'Informatico in sede' }),
      candidate({ uid: 'm', last_name: 'Mori', checkin_effettuato: true, reset_password_effettuato: true, reset_password_effettuato_at: '2026-10-20T15:04:00' }),
    ];
    const post = vi.fn(() => of({}));
    const { fixture, element, rows, headers, get } = await render('reset-sede', present, { post });
    const counts: number[] = [];
    fixture.componentInstance.openResetCountChange.subscribe((count) => counts.push(count));
    fixture.componentInstance.load();
    expect(get).toHaveBeenCalledWith(expect.stringContaining('checkin=yes'));
    expect(element.querySelector('h2')?.textContent).toBe('Candidati · 3 presenti');
    expect(headers()).toEqual(['Cognome e nome', 'Reset password', 'Azioni']);
    expect(element.querySelector('tbody tr')?.classList).toContain('app-row-attn');
    expect(rows()[0]).toContain('Zeta');
    expect(rows()[0]).toContain('Reset richiesto');
    expect(rows()[0]).toContain('dall’informatico in sede alle 15:05');
    expect(rows()[0]).toContain('Annulla richiesta');
    expect(rows().find((row) => row.includes('Mori'))).toContain('Reset fatto');
    expect(rows().find((row) => row.includes('Abate'))).toContain('Serve reset password');
    const chips = Array.from(element.querySelectorAll('.app-filter-chips button')).map((button) => button.textContent?.trim());
    expect(chips).toEqual(['In attesa · 1', 'Reset fatti · 1', 'Tutti i presenti · 3']);
    expect(counts.at(-1)).toBe(1);
    (Array.from(element.querySelectorAll('tbody button')).find((button) => button.textContent?.includes('Serve reset')) as HTMLButtonElement).click();
    expect(post).toHaveBeenCalledWith('/sessioni/session-1/candidati/a/reset-password?mode=segretario', { operation: 'request' });
  });

  it('for the remote expert offers Segna come fatto on open requests and Registra un reset on the others', async () => {
    const present = [
      candidate({ uid: 'a', last_name: 'Abate', checkin_effettuato: true }),
      candidate({ uid: 'z', last_name: 'Zeta', checkin_effettuato: true, reset_password_richiesto: true }),
    ];
    const { element, rows } = await render('reset-esperto', present);
    expect(rows()[0]).toContain('Segna come fatto');
    expect(rows()[1]).toContain('Registra un reset');
    expect(element.querySelector('.app-filter-chips button')?.textContent).toContain('Reset da fare · 1');
  });

  it('saves candidate notes and updates the row', async () => {
    let putPayload: unknown = null;
    const { fixture } = await render('checkin', [candidate({})], {
      put: (_url: string, payload: unknown) => { putPayload = payload; return of(candidate({ note: 'Documento verificato a vista' })); },
    });
    fixture.componentInstance.openNotes(fixture.componentInstance.items()[0]);
    fixture.componentInstance.noteDraft = 'Documento verificato a vista';
    fixture.componentInstance.saveNotes();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(putPayload).toEqual({ note: 'Documento verificato a vista' });
    expect(fixture.componentInstance.items()[0].note).toBe('Documento verificato a vista');
    expect(fixture.nativeElement.textContent).toContain('Note candidato salvate');
  });
});

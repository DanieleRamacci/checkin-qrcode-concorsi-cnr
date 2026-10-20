import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { SecretaryHomeComponent } from './secretary-home.component';
import { AuthService } from '../../core/auth.service';
import { BandiService } from '../bandi/bandi.service';
import { provideKitForTests } from '../../../testing/kit';

describe('SecretaryHomeComponent', () => {
  it('shows the closest next session without listing undownloaded competitions as sessions', async () => {
    await TestBed.configureTestingModule({
      imports: [SecretaryHomeComponent],
      providers: [
        provideRouter([]),
        ...provideKitForTests(),
        { provide: AuthService, useValue: { user: signal({ display_name: 'Ada Lovelace' }) } },
        { provide: BandiService, useValue: { secretarySyncDue: () => false, list: () => of({ items: [
          { commission_id: 'c2', title: 'Concorso futuro', session_count: 2, next_session: { session_id: 's2', name: 'Sessione A', date: '2026-10-22', time: '10:00', location: 'Roma', state: 'configurata' } },
          { commission_id: 'c1', title: 'Concorso senza sessioni', session_count: 0, next_session: null },
          { commission_id: 'c3', title: 'Concorso più vicino', session_count: 1, next_session: { session_id: 's3', name: 'Sessione B', date: '2026-10-20', time: '09:00', location: 'Pisa', state: 'iniziale' } },
        ] }) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(SecretaryHomeComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Buongiorno, Ada');
    expect(text).toContain('Sessione B');
    expect(text).toContain('Prossimo passo: Salva e continua');
    expect(text.indexOf('La tua prossima sessione')).toBeLessThan(text.indexOf('I miei concorsi'));
    // Sotto, i concorsi in ordine di prossima sessione; quelli senza sessioni in fondo.
    const rows = Array.from(fixture.nativeElement.querySelectorAll('table.app-table tbody tr') as NodeListOf<HTMLElement>).map((row) => row.textContent ?? '');
    expect(rows[0]).toContain('Concorso più vicino');
    expect(rows[1]).toContain('Concorso futuro');
    expect(rows[2]).toContain('Concorso senza sessioni');
    expect(rows[2]).toContain('da scaricare');
  });

  it('lists competitions without sessions under a short hint and refreshes them from Selezioni Online', async () => {
    const items = [
      { commission_id: 'c1', title: '999.999', session_count: 0, next_session: null },
      { commission_id: 'c2', title: '999.998', session_count: 0, next_session: null },
    ];
    const sync = vi.fn(() => of({ items, sync_error: null }));
    await TestBed.configureTestingModule({
      imports: [SecretaryHomeComponent],
      providers: [
        provideRouter([]),
        ...provideKitForTests(),
        { provide: AuthService, useValue: { user: signal({ display_name: 'DANIELE RAMACCI' }) } },
        { provide: BandiService, useValue: { secretarySyncDue: () => true, sync, list: () => of({ items }) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(SecretaryHomeComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Buongiorno, Daniele');
    expect(text).toContain('Nessuna sessione in programma tra quelle scaricate');
    expect(sync).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelectorAll('table.app-table tbody tr')).toHaveLength(2);
  });
});

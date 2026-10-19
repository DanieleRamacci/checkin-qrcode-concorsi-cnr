import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { SecretaryHomeComponent } from './secretary-home.component';
import { AuthService } from '../../core/auth.service';
import { BandiService } from '../bandi/bandi.service';

describe('SecretaryHomeComponent', () => {
  it('shows the closest next session and a link for a bando with no downloaded sessions', async () => {
    await TestBed.configureTestingModule({
      imports: [SecretaryHomeComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user: signal({ display_name: 'Ada Lovelace' }) } },
        { provide: BandiService, useValue: { list: () => of({ items: [
          { commission_id: 'c2', title: 'Concorso futuro', session_count: 2, next_session: { session_id: 's2', name: 'Sessione A', date: '2026-10-22', time: '10:00', location: 'Roma', state: 'configurata' } },
          { commission_id: 'c1', title: 'Concorso senza sessioni', session_count: 0, next_session: null },
          { commission_id: 'c3', title: 'Concorso più vicino', session_count: 1, next_session: { session_id: 's3', name: 'Sessione B', date: '2026-10-20', time: '09:00', location: 'Pisa', state: 'iniziale' } },
        ] }) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(SecretaryHomeComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Buongiorno, Ada Lovelace');
    expect(text).toContain('Sessione B');
    expect(text).toContain('Prossimo passo: Salva e continua');
    expect(text).toContain('sessioni non ancora scaricate');
    expect(text.indexOf('Sessione B')).toBeLessThan(text.indexOf('Sessione A'));
  });
});

import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
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
                    date: '20/10/2026',
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
    expect(fixture.nativeElement.textContent).toContain('Concorso c1');
    expect(fixture.nativeElement.textContent).toContain('Apri sessione');
    expect(fixture.nativeElement.textContent).not.toContain('Modifica config bando');
    fixture.componentInstance.setDateFilter('upcoming');
    expect(fixture.componentInstance.filteredItems().map((item) => item.session_id)).toEqual(['s1']);
    fixture.componentInstance.setQuery('Roma');
    expect(fixture.componentInstance.pageItems().length).toBe(1);
  });

  it('shows a guided download action when no local sessions exist', async () => {
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
            list: () => of({ commission_id: 'c1', items: [] }),
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
                session_count: 0,
                commissioners: [],
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

    expect(fixture.nativeElement.textContent).toContain('Nessuna sessione sincronizzata');
    expect(fixture.nativeElement.textContent).toContain('Scarica sessioni da Selezioni Online');
    expect(fixture.nativeElement.textContent).toContain('prima sincronizzazione');
  });

  it('keeps the empty-session retry visible after sync failure', async () => {
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
            sync: () => throwError(() => ({
              status: 409,
              error: {
                error: {
                  code: 'sessions_not_returned',
                  message: 'Verifica il flag di abilitazione del componente in Selezioni Online.',
                },
              },
            })),
            list: () => of({ commission_id: 'c1', items: [] }),
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
                session_count: 0,
                commissioners: [],
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

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button.btn-primary');
    button.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Sincronizzazione sessioni non riuscita');
    expect(fixture.nativeElement.textContent).toContain('flag di abilitazione');
    expect(fixture.nativeElement.textContent).toContain('Non ci sono ancora sessioni locali');
    expect(fixture.nativeElement.textContent).toContain('Scarica sessioni da Selezioni Online');
  });
});

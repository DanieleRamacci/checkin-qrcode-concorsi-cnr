import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApiClient } from '../../core/api-client';
import { BandoConfigComponent } from './bando-config.component';

describe('BandoConfigComponent', () => {
  it('renders configuration data and expert options', async () => {
    await TestBed.configureTestingModule({
      imports: [BandoConfigComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: new Map([['commissionId', 'c1']]),
              queryParamMap: new Map(),
            },
          },
        },
        {
          provide: ApiClient,
          useValue: {
            get: (path: string) => of(path.endsWith('/config')
              ? {
                  expert_options: ['expert@cnr.it'],
                  rdp_options: [{ nome: 'Rita Verdi', email: 'rita.verdi@cnr.it' }],
                  secretary_options: [{ nome: 'Segretaria Uno', email: 'segretaria1@cnr.it' }],
                  email_segretario: 'segretaria1@cnr.it',
                  session_assignments: [
                    {
                      session_id: 's1',
                      nome: 'Prova mattina',
                      giorno: '2026-08-01',
                      ora: '09:00',
                      luogo: 'Aula 1',
                      email_esperto_remoto: 'expert@cnr.it',
                      nome_informatico_sede: 'Tecnico Sede',
                      email_informatico_sede: 'sede@cnr.it',
                      telefono_informatico_sede: '061234',
                      informatici_sede: [
                        { nome: 'Tecnico Sede', email: 'sede@cnr.it', telefono: '061234', principale: true },
                      ],
                    },
                  ],
                }
              : { title: 'Concorso prova' }),
            put: () => of({}),
            post: () => of({}),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BandoConfigComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Concorso prova');
    expect(fixture.nativeElement.textContent).toContain('expert@cnr.it');
    expect(fixture.nativeElement.textContent).toContain('Rita Verdi');
    expect(fixture.nativeElement.textContent).toContain('rita.verdi@cnr.it');
    expect(fixture.nativeElement.textContent).toContain('Segretaria Uno');
    expect(fixture.nativeElement.textContent).toContain('segretaria1@cnr.it');
    expect(fixture.nativeElement.textContent).toContain('Assegnazioni tecniche per sessione');
    expect(fixture.nativeElement.textContent).toContain('Prova mattina');
    expect(fixture.nativeElement.textContent).not.toContain('Principale richiesto');
    expect((fixture.nativeElement.querySelector('#session-sede-name-0-0') as HTMLInputElement).value).toBe('Tecnico Sede');
    expect((fixture.nativeElement.querySelector('#session-sede-email-0-0') as HTMLInputElement).value).toBe('sede@cnr.it');
  });

  it('saves technical assignments only at session level', async () => {
    let payload: Record<string, any> | null = null;
    await TestBed.configureTestingModule({
      imports: [BandoConfigComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: new Map([['commissionId', 'c1']]),
              queryParamMap: new Map(),
            },
          },
        },
        {
          provide: ApiClient,
          useValue: {
            get: (path: string) => of(path.endsWith('/config')
              ? {
                  expert_options: [],
                  rdp_options: [],
                  secretary_options: [],
                  session_assignments: [],
                }
              : { title: 'Concorso prova' }),
            put: (_path: string, body: Record<string, any>) => {
              payload = body;
              return of({});
            },
            post: () => of({}),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BandoConfigComponent);
    fixture.detectChanges();
    fixture.componentInstance.sessionAssignments = [
      {
        session_id: 's1',
        nome: 'Prova mattina',
        giorno: '',
        ora: '',
        luogo: '',
        email_esperto_remoto: 'expert@cnr.it',
        nome_informatico_sede: '',
        email_informatico_sede: '',
        telefono_informatico_sede: '',
        informatici_sede: [
          { nome: 'Supporto Sede', email: 'supporto@cnr.it', telefono: '', principale: false },
          { nome: 'Tecnico Principale', email: 'principale@cnr.it', telefono: '061234', principale: true },
        ],
      },
    ];

    fixture.componentInstance.save();

    expect(payload?.['email_esperto_remoto']).toBeUndefined();
    expect(payload?.['informatici_sede']).toBeUndefined();
    expect(payload?.['session_assignments'][0]).toEqual({
      session_id: 's1',
      nome: 'Prova mattina',
      giorno: '',
      ora: '',
      luogo: '',
      email_esperto_remoto: 'expert@cnr.it',
      nome_informatico_sede: 'Tecnico Principale',
      email_informatico_sede: 'principale@cnr.it',
      telefono_informatico_sede: '061234',
      informatici_sede: [
        { nome: 'Supporto Sede', email: 'supporto@cnr.it', telefono: '', principale: false },
        { nome: 'Tecnico Principale', email: 'principale@cnr.it', telefono: '061234', principale: true },
      ],
    });
  });

  it('does not render a free secretary email input when source options are missing', async () => {
    await TestBed.configureTestingModule({
      imports: [BandoConfigComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: new Map([['commissionId', 'c1']]),
              queryParamMap: new Map(),
            },
          },
        },
        {
          provide: ApiClient,
          useValue: {
            get: (path: string) => of(path.endsWith('/config')
              ? {
                  expert_options: [],
                  rdp_options: [],
                  secretary_options: [],
                  email_segretario: '',
                }
              : { title: 'Concorso prova' }),
            put: () => of({}),
            post: () => of({}),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BandoConfigComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Nessun segretario disponibile da Selezioni Online');
    expect(fixture.nativeElement.querySelector('input#email_segretario')).toBeNull();
  });
});

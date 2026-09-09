import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApiClient } from '../../core/api-client';
import { AzioniComponent } from './azioni.component';

describe('AzioniComponent', () => {
  it('keeps secretary initial actions on in-person technician configuration', async () => {
    await TestBed.configureTestingModule({
      imports: [AzioniComponent],
      providers: [
        provideRouter([]),
        {
          provide: ApiClient,
          useValue: {
            get: () =>
              of({
                nome_informatico_sede: '',
                email_informatico_sede: '',
                telefono_informatico_sede: '',
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
    fixture.componentRef.setInput('currentState', 'iniziale');
    fixture.componentRef.setInput('viewMode', 'segretario');
    fixture.componentRef.setInput('bandoConfigured', false);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Configura Informatico in Sede');
    expect(text).not.toContain('Configura il Bando');
    expect(text).not.toContain('Data accesso piattaforma');
  });

  it('does not save and proceed when remote expert or in-person technician email are missing', async () => {
    let putCalls = 0;
    const api = {
      get: (url: string) => {
        if (url.includes('/bandi/')) {
          return of({ email_esperto_remoto: '', expert_options: ['esperto@cnr.it'] });
        }
        return of({
          nome_informatico_sede: '',
          email_informatico_sede: '',
          telefono_informatico_sede: '',
        });
      },
      post: () => of({}),
      put: () => {
        putCalls += 1;
        return of({});
      },
    };
    await TestBed.configureTestingModule({
      imports: [AzioniComponent],
      providers: [
        provideRouter([]),
        { provide: ApiClient, useValue: api },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AzioniComponent);
    fixture.componentRef.setInput('sessionId', 'session-1');
    fixture.componentRef.setInput('commissionId', 'commission-1');
    fixture.componentRef.setInput('currentState', 'iniziale');
    fixture.componentRef.setInput('viewMode', 'segretario');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    fixture.componentInstance.saveSessionConfig();

    expect(putCalls).toBe(0);
    expect(fixture.componentInstance.error()).toContain('esperto informatico da remoto');
    expect(fixture.componentInstance.error()).toContain("email dell'informatico in sede");
  });

  it('does not prefill technical assignments from bando-level defaults', async () => {
    await TestBed.configureTestingModule({
      imports: [AzioniComponent],
      providers: [
        provideRouter([]),
        {
          provide: ApiClient,
          useValue: {
            get: (url: string) => {
              if (url.includes('/bandi/')) {
                return of({
                  email_esperto_remoto: 'esperto@cnr.it',
                  expert_options: ['esperto@cnr.it'],
                  informatici_sede: [
                    { nome: 'Supporto Sede', email: 'supporto@cnr.it', principale: false },
                    { nome: 'Tecnico Principale', email: 'principale@cnr.it', telefono: '061234', principale: true },
                  ],
                });
              }
              return of({
                nome_informatico_sede: '',
                email_informatico_sede: '',
                telefono_informatico_sede: '',
              });
            },
            post: () => of({}),
            put: () => of({}),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AzioniComponent);
    fixture.componentRef.setInput('sessionId', 'session-1');
    fixture.componentRef.setInput('commissionId', 'commission-1');
    fixture.componentRef.setInput('currentState', 'iniziale');
    fixture.componentRef.setInput('viewMode', 'segretario');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.sessionConfigModel.email_esperto_remoto).toBe('');
    expect(fixture.componentInstance.sessionConfigModel.nome_informatico_sede).toBe('');
    expect(fixture.componentInstance.sessionConfigModel.email_informatico_sede).toBe('');
    expect(fixture.componentInstance.sessionConfigModel.telefono_informatico_sede).toBe('');
    expect(fixture.componentInstance.sessionConfigModel.informatici_sede).toEqual([]);
    const button = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

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

  it('shows generated-but-not-sent state for expert view', async () => {
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
    fixture.componentRef.setInput('currentState', 'liste_generate');
    fixture.componentRef.setInput('viewMode', 'esperto');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Liste generate');
    expect(text).toContain('In attesa che il segretario le invii');
    expect(text).toContain('Lista presenti');
  });

  it('disables candidate import when the session is admin-only', async () => {
    let postCalls = 0;
    await TestBed.configureTestingModule({
      imports: [AzioniComponent],
      providers: [
        provideRouter([]),
        {
          provide: ApiClient,
          useValue: {
            get: () => of({}),
            post: () => {
              postCalls += 1;
              return of({});
            },
            put: () => of({}),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AzioniComponent);
    fixture.componentRef.setInput('sessionId', 'session-1');
    fixture.componentRef.setInput('commissionId', 'commission-1');
    fixture.componentRef.setInput('currentState', 'configurata');
    fixture.componentRef.setInput('viewMode', 'admin');
    fixture.componentRef.setInput('adminOnly', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button.btn-primary') as HTMLButtonElement;
    expect(fixture.nativeElement.textContent).toContain('solo come amministratore locale');
    expect(button.disabled).toBe(true);

    fixture.componentInstance.importCandidati();
    expect(postCalls).toBe(0);
  });

  it('shows a visible success message after sending lists', async () => {
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
                  xlsx: '/api/v1/sessioni/session-1/lists/download?type=xlsx',
                  moodle_csv: '/api/v1/sessioni/session-1/lists/download?type=moodle_csv',
                },
              }),
            post: () =>
              of({
                sent: true,
                already_sent: false,
                status: 'sent',
                message: 'Liste candidati inviate correttamente.',
                recipients: ['esperto@cnr.it'],
              }),
            put: () => of({}),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AzioniComponent);
    fixture.componentRef.setInput('sessionId', 'session-1');
    fixture.componentRef.setInput('commissionId', 'commission-1');
    fixture.componentRef.setInput('currentState', 'liste_generate');
    fixture.componentRef.setInput('viewMode', 'segretario');
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.inviaListe();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Liste candidati inviate correttamente');
    expect(fixture.nativeElement.textContent).toContain('esperto@cnr.it');
  });

  it('shows a warning when lists are available but email notification fails', async () => {
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
                  xlsx: '/api/v1/sessioni/session-1/lists/download?type=xlsx',
                  moodle_csv: '/api/v1/sessioni/session-1/lists/download?type=moodle_csv',
                },
              }),
            post: () =>
              of({
                sent: false,
                already_sent: false,
                state_updated: true,
                status: 'available_email_failed',
                message: "Liste candidati rese disponibili all'informatico da remoto. L'email di notifica non è stata inviata.",
                warning: 'SMTP KO',
                recipients: ['esperto@cnr.it'],
              }),
            put: () => of({}),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AzioniComponent);
    fixture.componentRef.setInput('sessionId', 'session-1');
    fixture.componentRef.setInput('commissionId', 'commission-1');
    fixture.componentRef.setInput('currentState', 'liste_generate');
    fixture.componentRef.setInput('viewMode', 'segretario');
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.inviaListe();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain("Liste candidati rese disponibili all'informatico da remoto");
    expect(fixture.nativeElement.textContent).toContain('Email non inviata: SMTP KO');
    expect(fixture.nativeElement.textContent).toContain('può comunque vedere e scaricare le liste');
  });

  it('does not request bando config before commission id is available', async () => {
    const urls: string[] = [];
    await TestBed.configureTestingModule({
      imports: [AzioniComponent],
      providers: [
        provideRouter([]),
        {
          provide: ApiClient,
          useValue: {
            get: (url: string) => {
              urls.push(url);
              return of({});
            },
            post: () => of({}),
            put: () => of({}),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AzioniComponent);
    fixture.componentRef.setInput('sessionId', 'session-1');
    fixture.componentRef.setInput('commissionId', '');
    fixture.componentRef.setInput('currentState', 'iniziale');
    fixture.componentRef.setInput('viewMode', 'segretario');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(urls).toContain('/sessioni/session-1/config?mode=segretario');
    expect(urls.some((url) => url.includes('/bandi//config'))).toBe(false);
    expect(urls.some((url) => url === '/bandi/config?mode=segretario')).toBe(false);
  });
});

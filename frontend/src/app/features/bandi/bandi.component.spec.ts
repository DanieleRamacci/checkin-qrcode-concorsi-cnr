import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { BandiComponent } from './bandi.component';
import { BandiService } from './bandi.service';
import { ActivatedRoute } from '@angular/router';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { BandoSummary } from '../../core/models/api.models';
import { signal } from '@angular/core';

describe('BandiComponent', () => {
  async function createComponent(mode = 'segretario', isAdmin = false, items?: Partial<BandoSummary>[]) {
    await TestBed.configureTestingModule({
      imports: [BandiComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: new Map([['mode', mode]]) } },
        },
        {
          provide: BandiService,
          useValue: {
            sync: () =>
              of({
                items: items ?? [
                  {
                    commission_id: 'c1',
                    title: 'Concorso CNR',
                    configured: true,
                    session_count: 2,
                    visibility_reason: mode === 'admin' ? 'admin' : 'owner',
                    source_role: mode === 'admin' ? 'PRESIDENTE' : 'SEGRETARIO',
                    access_active: true,
                    capabilities: ['view'],
                  },
                ],
                sync_error: null,
                sync_source: 'remote',
              }),
            list: () =>
              of({
                items: items ?? [
                  {
                    commission_id: 'c1',
                    title: 'Concorso CNR',
                    configured: true,
                    session_count: 2,
                    visibility_reason: mode === 'admin' ? 'admin' : 'owner',
                    source_role: mode === 'admin' ? 'PRESIDENTE' : 'SEGRETARIO',
                    access_active: true,
                    capabilities: ['view'],
                  },
                ],
                sync_error: null,
                sync_source: 'db',
              }),
          },
        },
        {
          provide: AuthService,
          useValue: {
            user: signal({
              authenticated: true,
              email: 'utente@cnr.it',
              display_name: 'Utente CNR',
              roles: [],
              capabilities: isAdmin ? ['admin'] : [],
              csrf_token: 'csrf',
              dev_mode: false,
            }),
            hasCapability: (capability: string) => capability === 'admin' && isAdmin,
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BandiComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('renders bandi returned by the API service', async () => {
    const fixture = await createComponent();

    expect(fixture.nativeElement.textContent).toContain('Concorso CNR');
    expect(fixture.nativeElement.textContent).toContain('Dashboard Segretario');
    expect(fixture.nativeElement.textContent).toContain('Aggiorna da Selezioni Online');
    expect(fixture.nativeElement.textContent).toContain('nominativo deve risultare collegato');
    expect(fixture.nativeElement.textContent).toContain('abilitato su Selezioni Online');
    expect(fixture.nativeElement.textContent).not.toContain('Configura');
  });

  it('renders expert dashboard title in expert mode', async () => {
    const fixture = await createComponent('expert');

    expect(fixture.nativeElement.textContent).toContain('Dashboard Esperto informatico');
    expect(fixture.nativeElement.textContent).not.toContain('Dashboard Segretario');
    expect(fixture.nativeElement.textContent).not.toContain('Permessi Selezioni Online');
  });

  it('renders explicit assignment and admin-support badges in expert mode', async () => {
    const fixture = await createComponent('expert', true, [
      {
        commission_id: 'c1',
        title: 'Bando assegnato',
        configured: true,
        session_count: 1,
        visibility_reason: 'expert',
        access_active: true,
        capabilities: ['view'],
      },
      {
        commission_id: 'c2',
        title: 'Bando supporto',
        configured: true,
        session_count: 1,
        visibility_reason: 'admin',
        access_active: true,
        capabilities: ['view'],
      },
    ]);

    expect(fixture.nativeElement.textContent).toContain('Esperto remoto assegnato');
    expect(fixture.nativeElement.textContent).toContain('Vista admin: non assegnato come esperto remoto');
    expect(fixture.nativeElement.textContent).toContain('Vista admin di supporto');
  });

  it('explains local admin visibility does not grant Selezioni Online permissions', async () => {
    const fixture = await createComponent('segretario', true);

    expect(fixture.nativeElement.textContent).toContain('admin globale');
    expect(fixture.nativeElement.textContent).toContain('membro operativo');
  });

  it('renders the explicit admin dashboard with admin-only badges', async () => {
    const fixture = await createComponent('admin', true);

    expect(fixture.nativeElement.textContent).toContain('Dashboard Amministratore');
    expect(fixture.nativeElement.textContent).toContain('Vista amministratore');
    expect(fixture.nativeElement.textContent).toContain('Solo vista admin');
    expect(fixture.nativeElement.textContent).toContain('Ruolo Selezioni: PRESIDENTE');
  });

  it('loads local bandi first and syncs only on manual refresh', async () => {
    let listCalls = 0;
    let syncCalls = 0;

    await TestBed.configureTestingModule({
      imports: [BandiComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: new Map([['mode', 'segretario']]) } },
        },
        {
          provide: BandiService,
          useValue: {
            list: () => {
              listCalls += 1;
              return of({
                items: [
                  {
                    commission_id: 'local-1',
                    title: 'Bando locale',
                    configured: true,
                    session_count: 1,
                    visibility_reason: 'owner',
                    access_active: true,
                    capabilities: ['view'],
                  },
                ],
                sync_error: null,
                sync_source: 'db',
              });
            },
            sync: () => {
              syncCalls += 1;
              return of({
                items: [
                  {
                    commission_id: 'remote-1',
                    title: 'Bando sincronizzato',
                    configured: true,
                    session_count: 1,
                    visibility_reason: 'owner',
                    access_active: true,
                    capabilities: ['view'],
                  },
                ],
                sync_error: null,
                sync_source: 'remote',
              });
            },
          },
        },
        {
          provide: AuthService,
          useValue: {
            user: signal({
              authenticated: true,
              email: 'utente@cnr.it',
              display_name: 'Utente CNR',
              roles: [],
              capabilities: [],
              csrf_token: 'csrf',
              dev_mode: false,
            }),
            hasCapability: () => false,
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BandiComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(listCalls).toBe(1);
    expect(syncCalls).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('Bando locale');

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button.btn-outline-primary');
    button.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(syncCalls).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Bando sincronizzato');
  });

  it('shows API diagnostic details when expert bandi cannot be loaded', async () => {
    await TestBed.configureTestingModule({
      imports: [BandiComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: new Map([['mode', 'expert']]) } },
        },
        {
          provide: BandiService,
          useValue: {
            sync: () => throwError(() => ({ status: 500 })),
            list: () => throwError(() => ({
              status: 403,
              error: { error: { code: 'forbidden', message: 'Operazione non autorizzata.' } },
            })),
          },
        },
        {
          provide: AuthService,
          useValue: {
            user: signal({
              authenticated: true,
              email: 'expert@cnr.it',
              display_name: 'Expert CNR',
              roles: [],
              capabilities: [],
              csrf_token: 'csrf',
              dev_mode: false,
            }),
            hasCapability: () => false,
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BandiComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Impossibile caricare i bandi.');
    expect(fixture.nativeElement.textContent).toContain('HTTP 403');
    expect(fixture.nativeElement.textContent).toContain('forbidden');
  });
});

import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { BandiComponent } from './bandi.component';
import { BandiService } from './bandi.service';
import { ActivatedRoute } from '@angular/router';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { signal } from '@angular/core';

describe('BandiComponent', () => {
  async function createComponent(mode = 'segretario', isAdmin = false) {
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
                items: [
                  {
                    commission_id: 'c1',
                    title: 'Concorso CNR',
                    configured: true,
                    session_count: 2,
                    visibility_reason: mode === 'admin' ? 'admin' : 'owner',
                    capabilities: ['view'],
                  },
                ],
                sync_error: null,
                sync_source: 'remote',
              }),
            list: () => of({ items: [] }),
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
    expect(fixture.nativeElement.textContent).toContain('nominativo deve essere');
    expect(fixture.nativeElement.textContent).toContain('abilitato su Selezioni Online');
    expect(fixture.nativeElement.textContent).not.toContain('Configura');
  });

  it('renders expert dashboard title in expert mode', async () => {
    const fixture = await createComponent('expert');

    expect(fixture.nativeElement.textContent).toContain('Dashboard Esperto informatico');
    expect(fixture.nativeElement.textContent).not.toContain('Dashboard Segretario');
    expect(fixture.nativeElement.textContent).not.toContain('Permessi Selezioni Online');
  });

  it('explains local admin visibility does not grant Selezioni Online permissions', async () => {
    const fixture = await createComponent('segretario', true);

    expect(fixture.nativeElement.textContent).toContain('admin globale');
    expect(fixture.nativeElement.textContent).toContain('import candidati resta autorizzato da Selezioni Online');
  });

  it('renders the explicit admin dashboard with admin-only badges', async () => {
    const fixture = await createComponent('admin', true);

    expect(fixture.nativeElement.textContent).toContain('Dashboard Amministratore');
    expect(fixture.nativeElement.textContent).toContain('Vista amministratore');
    expect(fixture.nativeElement.textContent).toContain('Solo admin - non sei segretario');
  });
});

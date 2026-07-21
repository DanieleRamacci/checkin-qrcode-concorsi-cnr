import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ReferenteBandiComponent } from './referente-bandi.component';
import { BandiService } from './bandi.service';

describe('ReferenteBandiComponent', () => {
  it('renders RDP bandi and configure action', async () => {
    await TestBed.configureTestingModule({
      imports: [ReferenteBandiComponent],
      providers: [
        provideRouter([]),
        {
          provide: BandiService,
          useValue: {
            listReferente: () =>
              of({
                items: [
                  {
                    commission_id: 'rdp-1',
                    title: 'Bando RDP',
                    configured: false,
                    config_status: 'esperto_assegnato',
                    expert_assigned: true,
                    required_data_complete: false,
                    session_count: 0,
                    capabilities: ['configure', 'view'],
                    rdp_names: ['Rita Verdi'],
                  },
                ],
                sync_error: null,
                sync_source: 'remote',
              }),
            syncReferente: () => of({ items: [], sync_error: null, sync_source: 'remote' }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ReferenteBandiComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Bando RDP');
    expect(fixture.nativeElement.textContent).toContain('Rita Verdi');
    expect(fixture.nativeElement.textContent).toContain('Esperto assegnato');
    expect(fixture.nativeElement.textContent).toContain('da completare');
    expect(fixture.nativeElement.textContent).toContain('Configura bando');
  });

  it('renders the empty state when the user has no assigned bandi', async () => {
    await TestBed.configureTestingModule({
      imports: [ReferenteBandiComponent],
      providers: [
        provideRouter([]),
        {
          provide: BandiService,
          useValue: {
            listReferente: () =>
              of({
                items: [],
                sync_error: null,
                sync_source: 'remote',
              }),
            syncReferente: () => of({ items: [], sync_error: null, sync_source: 'remote' }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ReferenteBandiComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Non risultano bandi per cui la tua utenza e indicata come RDP o referente.',
    );
  });

  it('shows API diagnostic details when referente sync fails', async () => {
    await TestBed.configureTestingModule({
      imports: [ReferenteBandiComponent],
      providers: [
        provideRouter([]),
        {
          provide: BandiService,
          useValue: {
            listReferente: () => of({ items: [], sync_error: null, sync_source: 'local' }),
            syncReferente: () => throwError(() => ({
              status: 502,
              error: {
                error: {
                  code: 'external_service_unavailable',
                  message: 'Selezioni Online non disponibile.',
                },
              },
            })),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ReferenteBandiComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('HTTP 502');
    expect(fixture.nativeElement.textContent).toContain('external_service_unavailable');
  });
});

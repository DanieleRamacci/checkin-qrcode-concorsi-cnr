import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
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
            syncReferente: () =>
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
            syncReferente: () =>
              of({
                items: [],
                sync_error: null,
                sync_source: 'remote',
              }),
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
});

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

    expect(fixture.nativeElement.textContent).toContain('Concorso prova');
    expect(fixture.nativeElement.textContent).toContain('expert@cnr.it');
    expect(fixture.nativeElement.textContent).toContain('Rita Verdi');
    expect(fixture.nativeElement.textContent).toContain('rita.verdi@cnr.it');
    expect(fixture.nativeElement.textContent).toContain('Segretaria Uno');
    expect(fixture.nativeElement.textContent).toContain('segretaria1@cnr.it');
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

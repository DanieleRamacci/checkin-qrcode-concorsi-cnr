import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { BandiComponent } from './bandi.component';
import { BandiService } from './bandi.service';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { signal } from '@angular/core';

describe('BandiComponent', () => {
  it('renders bandi returned by the API service', async () => {
    await TestBed.configureTestingModule({
      imports: [BandiComponent],
      providers: [
        provideRouter([]),
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
          useValue: { user: signal(null) },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BandiComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Concorso CNR');
  });
});

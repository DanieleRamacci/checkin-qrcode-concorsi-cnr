import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { AuthService } from '../core/auth.service';
import { AppLayoutComponent } from './app-layout.component';

describe('AppLayoutComponent', () => {
  it('renders the legacy-aligned shell landmarks', async () => {
    await TestBed.configureTestingModule({
      imports: [AppLayoutComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            user: signal({
              app_version: 'abc1234',
              app_build_time: '2026-07-16T12:00:00Z',
            }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppLayoutComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('header')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#main-content')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('footer')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Sistema Gestione Presenze Concorsi CNR');
    expect(fixture.nativeElement.textContent).toContain('Versione: abc1234');
    expect(fixture.nativeElement.textContent).toContain('Aggiornato: 2026-07-16T12:00:00Z');
  });
});

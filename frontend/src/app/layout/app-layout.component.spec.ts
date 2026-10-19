import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { AuthService } from '../core/auth.service';
import { ProfileService } from '../core/profile.service';
import { AppLayoutComponent } from './app-layout.component';

describe('AppLayoutComponent', () => {
  it('renders the single-band header, main landmark, and dark footer', async () => {
    await TestBed.configureTestingModule({
      imports: [AppLayoutComponent],
      providers: [
        provideRouter([]),
        { provide: ProfileService, useValue: { label: () => 'Segretario', navigation: () => [{ label: 'Home', path: '/' }] } },
        {
          provide: AuthService,
          useValue: {
            user: signal({ display_name: 'Utente Test', email: 'utente@cnr.it', capabilities: ['admin'], app_version: 'abc1234', app_build_time: '2026-07-16T12:00:00Z' }),
            hasCapability: (capability: string) => capability === 'admin',
            settings: () => ({ institution_name: 'CNR', app_title: 'Check-in Concorsi', tagline: '', footer_owner: 'CNR Test' }),
            login: () => undefined,
            logout: () => undefined,
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AppLayoutComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('header.app-header')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#main-content')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('footer.app-footer')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('CNR');
    expect(fixture.nativeElement.textContent).toContain('Check-in Concorsi');
    expect(fixture.nativeElement.textContent).toContain('Utente Test');
    expect(fixture.nativeElement.textContent).toContain('Versione: abc1234');
  });
});

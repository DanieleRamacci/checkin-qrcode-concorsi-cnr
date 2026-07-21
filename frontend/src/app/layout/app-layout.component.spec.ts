import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { AuthService } from '../core/auth.service';
import { AppLayoutComponent } from './app-layout.component';

vi.mock('design-angular-kit', async () => {
  const { Component } = await vi.importActual<typeof import('@angular/core')>('@angular/core');
  const ItHeaderComponent = Component({
    selector: 'it-header',
    standalone: true,
    inputs: ['slimTitle', 'slimTitleLink', 'loginStyle', 'showSearch', 'megamenu', 'expand'],
    template: `
      <header>
        <ng-content select="[brand]"></ng-content>
        <ng-content select="[slimRightZone]"></ng-content>
        <nav><ng-content select="[navItems]"></ng-content></nav>
      </header>
    `,
  })(class {});
  const ItIconComponent = Component({
    selector: 'it-icon',
    standalone: true,
    inputs: ['name'],
    template: '',
  })(class {});
  const ItNavBarItemComponent = Component({
    selector: 'it-navbar-item',
    standalone: true,
    template: '<ng-content></ng-content>',
  })(class {});
  return { ItHeaderComponent, ItIconComponent, ItNavBarItemComponent };
});

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
              display_name: 'Utente Test',
              email: 'utente@cnr.it',
              capabilities: ['admin'],
              app_version: 'abc1234',
              app_build_time: '2026-07-16T12:00:00Z',
            }),
            hasCapability: (capability: string) => capability === 'admin',
            settings: () => ({
              slim_title: 'Ente Test',
              institution_name: 'Istituzione Test',
              app_title: 'Applicazione Test',
              tagline: 'Tagline Test',
              footer_owner: 'Footer Test',
            }),
            login: () => undefined,
            logout: () => undefined,
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppLayoutComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('header')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#main-content')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('footer')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Istituzione Test');
    expect(fixture.nativeElement.textContent).toContain('Applicazione Test');
    expect(fixture.nativeElement.textContent).toContain('Utente Test');
    expect(fixture.nativeElement.textContent).toContain('Versione: abc1234');
    expect(fixture.nativeElement.textContent).toContain('Aggiornato: 2026-07-16T12:00:00Z');
  });
});

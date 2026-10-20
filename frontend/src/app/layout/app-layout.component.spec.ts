import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, Routes } from '@angular/router';
import { Component, signal } from '@angular/core';
import { AuthService } from '../core/auth.service';
import { AppLayoutComponent } from './app-layout.component';
import { provideKitForTests } from '../../testing/kit';

function setup(user: Record<string, unknown>, routes: Routes = []) {
  TestBed.configureTestingModule({
    imports: [AppLayoutComponent],
    providers: [
      provideRouter(routes),
        ...provideKitForTests(),
      {
        provide: AuthService,
        useValue: {
          user: signal(user),
          hasCapability: (capability: string) => ((user['capabilities'] as string[]) ?? []).includes(capability),
          settings: () => ({ institution_name: 'CNR', app_title: 'Check-in Concorsi', tagline: '', footer_owner: 'CNR Test' }),
          login: () => undefined,
          logout: () => undefined,
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(AppLayoutComponent);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

function navLabels(element: HTMLElement): string[] {
  return Array.from(element.querySelectorAll('#menu-principale .list-item')).map((link) => link.textContent?.trim() ?? '');
}

describe('AppLayoutComponent', () => {
  it('renders the blue slim header, main landmark and dark footer of the design', () => {
    const element = setup({ display_name: 'Utente Test', email: 'utente@cnr.it', profiles: ['segretario'], capabilities: [], app_version: 'abc1234' });
    expect(element.querySelector('header.it-header-wrapper.app-header .it-header-slim-wrapper')).toBeTruthy();
    expect(element.querySelector('.app-profile-switch')?.getAttribute('href')).toBe('/');
    expect(element.querySelector('#main-content')).toBeTruthy();
    expect(element.querySelector('footer.it-footer.app-footer .it-footer-small-prints')).toBeTruthy();
    expect(element.textContent).toContain('CNR · Check-in Concorsi');
    expect(element.textContent).toContain('Utente Test');
    expect(element.textContent).toContain('Versione: abc1234');
  });

  it('hides site header and footer on smartphones only for immersive pages', async () => {
    @Component({ template: '' })
    class SessionPage {}
    const element = setup({ email: 'seg@cnr.it', profiles: ['segretario'], capabilities: [] }, [{ path: 'sessioni/:id', component: SessionPage, data: { mobileImmersive: true } }]);
    const fixture = TestBed.inject(Router);
    expect(element.querySelector('.app-shell--immersive')).toBeNull();
    await fixture.navigateByUrl('/sessioni/s1');
    TestBed.tick();
    expect(element.querySelector('.app-shell--immersive')).toBeTruthy();
    expect(element.querySelector('.app-brand')?.textContent).toContain('CNR · Check-in Concorsi');
  });

  it('keeps the design menu for a secretary only', () => {
    const element = setup({ email: 'seg@cnr.it', profiles: ['segretario'], capabilities: [] });
    expect(navLabels(element)).toEqual(['Home', 'I miei concorsi', 'Scanner']);
  });

  it('shows the pages of every profile, whatever profile is active', () => {
    const element = setup({ email: 'admin@cnr.it', profiles: ['segretario', 'referente', 'sede', 'esperto', 'admin'], capabilities: ['admin'] });
    expect(navLabels(element)).toEqual(['Home', 'Concorsi', 'Sessioni', 'Referente', 'Amministrazione', 'Scanner']);
  });
});

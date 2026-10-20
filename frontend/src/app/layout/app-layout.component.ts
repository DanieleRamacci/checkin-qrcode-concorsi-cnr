import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { ItIconComponent } from 'design-angular-kit';
import { AuthService } from '../core/auth.service';
import { ProfileService } from '../core/profile.service';
import { InPageLinkDirective } from '../shared/in-page-link.directive';

/**
 * Header a una fascia (docs/design-revisione/prototipo, P00 "Header compatto"):
 * fascia slim Bootstrap Italia con brand, navigazione, profilo attivo e utente.
 * `it-header` del kit disegna sempre anche fascia centrale e navbar, quindi si
 * usa il markup del prototipo (research R3).
 */
@Component({
  selector: 'app-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, ItIconComponent, InPageLinkDirective],
  template: `
    <a class="skip-link" href="#main-content" appInPageLink="main-content">Vai al contenuto principale</a>
    <div class="app-shell" [class.app-shell--immersive]="immersive()">
      <header class="it-header-wrapper app-header">
        <div class="it-header-slim-wrapper">
          <div class="container">
            <div class="it-header-slim-wrapper-content">
              <a class="navbar-brand app-brand" routerLink="/">{{ brand() }}</a>
              <div class="nav-mobile">
                <nav aria-label="Navigazione principale">
                  <a class="it-opener d-lg-none" href="#menu-principale" role="button"
                    [attr.aria-expanded]="menuOpen()" aria-controls="menu-principale"
                    (click)="$event.preventDefault(); menuOpen.set(!menuOpen())">
                    <span>Menu</span><it-icon name="expand" />
                  </a>
                  <div class="link-list-wrapper collapse" id="menu-principale" [class.show]="menuOpen()">
                    <ul class="link-list">
                      @for (item of navigationItems(); track item.label) {
                        <li>
                          <a class="list-item" [routerLink]="item.path" [queryParams]="item.queryParams ?? null"
                            routerLinkActive="active" [routerLinkActiveOptions]="activeOptions"
                            ariaCurrentWhenActive="page" (click)="menuOpen.set(false)">{{ item.label }}</a>
                        </li>
                      }
                    </ul>
                  </div>
                </nav>
              </div>
              <div class="it-header-slim-right-zone">
                @if (auth.user() && profiles.available().length > 1) {
                  <a class="btn btn-dropdown app-profile-switch" routerLink="/">
                    <span class="d-none d-md-inline">Profilo:&nbsp;</span><strong>{{ profiles.label() }}</strong>
                    <it-icon name="exchange-circle" size="xs" color="white" />
                    <span class="visually-hidden">, cambia profilo</span>
                  </a>
                } @else if (auth.user()) {
                  <span class="app-profile-switch small"><span class="d-none d-md-inline">Profilo:&nbsp;</span><strong>{{ profiles.label() }}</strong></span>
                }
                <div class="it-access-top-wrapper position-relative">
                  <button class="btn btn-primary btn-sm btn-icon btn-full app-user-button" type="button"
                    [attr.aria-expanded]="auth.user() ? userMenuOpen() : null" [attr.aria-controls]="auth.user() ? 'user-menu' : null"
                    (click)="toggleUserMenu()">
                    <span class="rounded-icon"><it-icon name="user" color="primary" /></span>
                    <span class="d-none d-lg-block" [attr.title]="auth.user()?.display_name || null">{{ auth.user() ? (auth.user()?.display_name || auth.user()?.email) : 'Accedi' }}</span>
                  </button>
                  @if (userMenuOpen()) {
                    <div id="user-menu" class="app-user-menu shadow">
                      <p class="mb-0 fw-semibold">{{ auth.user()?.display_name || auth.user()?.email }}</p>
                      <p class="mb-2 text-secondary small text-break">{{ auth.user()?.email }}</p>
                      <ul class="link-list mb-0">
                        <li><a class="list-item" routerLink="/area-personale" (click)="userMenuOpen.set(false)">Area personale</a></li>
                        @if (auth.hasCapability('admin')) {
                          <li><a class="list-item" routerLink="/admin/impostazioni" (click)="userMenuOpen.set(false)">Impostazioni</a></li>
                        }
                        <li><button class="list-item btn btn-link p-0 text-decoration-none" type="button" (click)="logout()">Esci</button></li>
                      </ul>
                    </div>
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" tabindex="-1" class="flex-grow-1">
        <router-outlet />
      </main>

      <footer class="it-footer app-footer">
        <div class="it-footer-small-prints clearfix">
          <div class="container">
            <ul class="it-footer-small-prints-list list-inline mb-0 d-flex flex-column flex-md-row">
              <li class="list-inline-item">Realizzato per {{ settings.footer_owner }}</li>
              <li class="list-inline-item"><a href="/privacy-policy" title="Privacy Policy">Privacy policy</a></li>
              <li class="list-inline-item ms-md-auto" [attr.title]="'Aggiornato: ' + appBuildTime">Versione: {{ appVersion }}</li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  `,
  styles: `
    .app-shell { min-height: 100vh; display: flex; flex-direction: column; }
    @media (max-width: 767.98px) { .app-shell--immersive > .app-header, .app-shell--immersive > .app-footer { display: none; } }
    .skip-link { position: absolute; left: -10000px; top: auto; }
    .skip-link:focus { left: 1rem; top: 1rem; z-index: 10000; background: white; padding: .75rem; }
    .app-user-button { min-height: 44px; white-space: nowrap; }
    .app-profile-switch { white-space: nowrap; }
    .app-user-button .d-lg-block { max-width: 14rem; overflow: hidden; text-overflow: ellipsis; }
    .link-list .list-item { white-space: nowrap; }
    .app-user-menu {
      position: absolute; right: 0; top: calc(100% + .25rem); z-index: 1000; min-width: 16rem;
      padding: .75rem 1rem; border-radius: 4px; background: #fff; color: var(--app-ink); text-align: left;
    }
    .app-user-menu .list-item { display: block; padding: .5rem 0; color: var(--app-primary); text-align: left; }
  `,
})
export class AppLayoutComponent {
  readonly auth = inject(AuthService);
  readonly profiles = inject(ProfileService);
  /** Menu del profilo attivo: cambia insieme al pulsante "Profilo". */
  readonly navigationItems = computed(() => this.profiles.navigation(this.profiles.active()));
  /** "I miei concorsi" resta evidenziata nelle pagine del concorso; `mode` deve coincidere con quello della voce. */
  readonly activeOptions = { paths: 'subset', queryParams: 'subset', fragment: 'ignored', matrixParams: 'ignored' } as const;
  private readonly router = inject(Router);
  /** La pagina corrente chiede la vista a tutto schermo su smartphone (route data mobileImmersive). */
  readonly immersive = toSignal(this.router.events.pipe(
    filter((event) => event instanceof NavigationEnd),
    startWith(null),
    map(() => {
      let snapshot = this.router.routerState.snapshot.root;
      while (snapshot.firstChild) snapshot = snapshot.firstChild;
      return !!snapshot.data?.['mobileImmersive'];
    }),
  ), { initialValue: false });
  readonly userMenuOpen = signal(false);
  readonly menuOpen = signal(false);

  get settings() { return this.auth.settings(); }
  get appVersion(): string { return this.auth.user()?.app_version || 'n/d'; }
  get appBuildTime(): string { return this.auth.user()?.app_build_time || 'n/d'; }

  brand(): string {
    const institution = this.settings.institution_name || 'CNR';
    return `${institution} · Check-in Concorsi`;
  }

  toggleUserMenu(): void {
    if (!this.auth.user()) { this.auth.login(); return; }
    this.userMenuOpen.set(!this.userMenuOpen());
  }

  logout(): void { this.userMenuOpen.set(false); this.auth.logout(); }
}

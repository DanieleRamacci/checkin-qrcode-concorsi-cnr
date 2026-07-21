import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ItHeaderComponent, ItNavBarItemComponent } from 'design-angular-kit';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-layout',
  imports: [
    ItHeaderComponent,
    ItNavBarItemComponent,
    RouterLink,
    RouterOutlet,
  ],
  template: `
    <a class="skip-link" href="#main-content">Vai al contenuto principale</a>

    <div class="app-shell">
      <it-header
        [slimTitle]="settings.institution_name"
        slimTitleLink="#"
        loginStyle="none"
        [showSearch]="false"
        [smallHeader]="true"
        [megamenu]="false"
        [expand]="true">
        <ul class="link-list" slimLinkList>
          <li><a class="dropdown-item list-item" routerLink="/">Home</a></li>
        </ul>

        <ng-container slimRightZone>
          <div class="user-zone position-relative">
            <button
              class="btn btn-primary btn-sm"
              type="button"
              [attr.aria-expanded]="userMenuOpen()"
              aria-controls="user-menu"
              (click)="toggleUserMenu()">
              @if (auth.user()) {
                {{ auth.user()?.display_name || auth.user()?.email }}
              } @else {
                Effettua il login
              }
            </button>
            @if (userMenuOpen()) {
              <div id="user-menu" class="user-menu shadow" role="menu">
                @if (auth.user()) {
                  <p class="mb-1 fw-semibold">{{ auth.user()?.display_name || auth.user()?.email }}</p>
                  <p class="mb-3 text-muted small">{{ auth.user()?.email }}</p>
                  <a class="dropdown-item" routerLink="/area-personale" (click)="userMenuOpen.set(false)">Area personale</a>
                  @if (auth.hasCapability('admin')) {
                    <a class="dropdown-item" routerLink="/admin/impostazioni" (click)="userMenuOpen.set(false)">Impostazioni applicazione</a>
                  }
                  <button class="dropdown-item text-danger" type="button" (click)="logout()">Logout</button>
                } @else {
                  <button class="dropdown-item" type="button" (click)="login()">Effettua il login</button>
                }
              </div>
            }
          </div>
        </ng-container>

        <ng-container brand>
          <a class="compact-brand" routerLink="/">
            <div class="it-brand-text">
              <div class="it-brand-title">{{ settings.institution_name }}</div>
              <div class="it-brand-tagline d-none d-md-block">{{ settings.app_title }} - {{ settings.tagline }}</div>
            </div>
          </a>
        </ng-container>

        <ng-container navItems>
          <it-navbar-item>
            <a class="nav-link" routerLink="/"><span>Profili</span></a>
          </it-navbar-item>
          <it-navbar-item>
            <a class="nav-link" routerLink="/scanner"><span>Scanner</span></a>
          </it-navbar-item>
        </ng-container>
      </it-header>

      <main id="main-content" tabindex="-1" class="flex-grow-1">
        <router-outlet />
      </main>

      <footer class="it-footer bg-light mt-5">
        <div class="it-footer-main">
          <div class="container-xxl">
            <div class="row">
              <div class="col-12 col-md-8">
                <p class="mb-1">Realizzato per {{ settings.footer_owner }}</p>
                <p class="mb-1"><a href="/privacy-policy">Privacy Policy</a></p>
              </div>
              <div class="col-12 col-md-4 text-md-end text-start mt-3 mt-md-0">
                <small class="d-block">Versione: {{ appVersion }}</small>
                <small class="d-block">Aggiornato: {{ appBuildTime }}</small>
              </div>
            </div>
          </div>
        </div>
        <div class="it-footer-small-prints bg-dark text-white">
          <div class="container-xxl">
            <div class="row">
              <div class="col text-center py-3">
                <small>&copy; {{ currentYear }} {{ settings.institution_name }} - Tutti i diritti riservati.</small>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  `,
  styles: `
    .app-shell {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .skip-link {
      position: absolute;
      left: -10000px;
      top: auto;
    }
    .skip-link:focus {
      left: 1rem;
      top: 1rem;
      z-index: 10000;
      background: white;
      padding: 0.75rem;
    }
    .user-zone {
      min-width: 12rem;
      text-align: right;
    }
    .compact-brand {
      min-height: 0;
      text-decoration: none;
    }
    .compact-brand .it-brand-title {
      font-size: 1.05rem;
      line-height: 1.15;
    }
    .compact-brand .it-brand-tagline {
      font-size: 0.8rem;
      line-height: 1.2;
    }
    :host ::ng-deep .it-header-center-wrapper.it-small-header .it-header-center-content-wrapper {
      min-height: 4rem;
      padding-top: 0.35rem;
      padding-bottom: 0.35rem;
    }
    :host ::ng-deep .it-header-navbar-wrapper .navbar {
      min-height: 2.6rem;
    }
    .user-menu {
      position: absolute;
      right: 0;
      top: calc(100% + 0.35rem);
      z-index: 1000;
      min-width: 17rem;
      padding: 0.75rem;
      border-radius: 4px;
      background: white;
      color: #17324d;
      text-align: left;
    }
    .user-menu .dropdown-item {
      display: block;
      width: 100%;
      padding: 0.45rem 0.5rem;
      border: 0;
      background: transparent;
      text-align: left;
      color: inherit;
      text-decoration: none;
    }
  `,
})
export class AppLayoutComponent {
  readonly auth = inject(AuthService);
  readonly userMenuOpen = signal(false);
  readonly currentYear = new Date().getFullYear();

  get settings() {
    return this.auth.settings();
  }

  get appVersion(): string {
    return this.auth.user()?.app_version || 'n/d';
  }

  get appBuildTime(): string {
    return this.auth.user()?.app_build_time || 'n/d';
  }

  toggleUserMenu(): void {
    if (!this.auth.user()) {
      this.login();
      return;
    }
    this.userMenuOpen.set(!this.userMenuOpen());
  }

  login(): void {
    this.auth.login();
  }

  logout(): void {
    this.userMenuOpen.set(false);
    this.auth.logout();
  }
}

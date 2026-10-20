import { Routes } from '@angular/router';
import { adminGuard, authGuard, sessionModeGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'scanner',
    title: 'Scanner — Check-in CNR Concorsi',
    canActivate: [authGuard],
    loadComponent: () => import('./features/scanner/scanner.component').then((module) => module.ScannerComponent),
  },
  {
    path: 'logged-out',
    title: 'Sessione terminata — Check-in CNR Concorsi',
    loadComponent: () =>
      import('./features/auth/logged-out.component').then(
        (module) => module.LoggedOutComponent,
      ),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/app-layout.component').then(
        (module) => module.AppLayoutComponent,
      ),
    children: [
      {
        path: '',
        title: 'Check-in CNR Concorsi',
        loadComponent: () =>
          import('./features/home/home.component').then(
            (module) => module.HomeComponent,
          ),
      },
      {
        path: 'bandi',
        title: 'Bandi — Check-in CNR Concorsi',
        loadComponent: () =>
          import('./features/bandi/bandi.component').then(
            (module) => module.BandiComponent,
          ),
      },
      {
        path: 'segretario',
        title: 'Home segretario — Check-in CNR Concorsi',
        loadComponent: () =>
          import('./features/home/secretary-home.component').then(
            (module) => module.SecretaryHomeComponent,
          ),
      },
      {
        path: 'le-mie-sessioni',
        title: 'Le mie sessioni — Check-in CNR Concorsi',
        loadComponent: () =>
          import('./features/le-mie-sessioni/my-sessions.component').then(
            (module) => module.MySessionsComponent,
          ),
      },
      {
        path: 'bandi/:commissionId/sessioni',
        title: 'Sessioni — Check-in CNR Concorsi',
        loadComponent: () =>
          import('./features/sessioni/sessioni.component').then(
            (module) => module.SessioniComponent,
          ),
      },
      {
        path: 'bandi/:commissionId/config',
        title: 'Configurazione bando — Check-in CNR Concorsi',
        loadComponent: () =>
          import('./features/configurazioni/bando-config.component').then(
            (module) => module.BandoConfigComponent,
          ),
      },
      {
        path: 'referenti/bandi',
        title: 'Bandi referente — Check-in CNR Concorsi',
        loadComponent: () =>
          import('./features/bandi/referente-bandi.component').then(
            (module) => module.ReferenteBandiComponent,
          ),
      },
      {
        path: 'bandi/:commissionId/detail',
        title: 'Dettaglio bando — Check-in CNR Concorsi',
        loadComponent: () =>
          import('./features/bandi/bando-detail.component').then(
            (module) => module.BandoDetailComponent,
          ),
      },
      {
        path: 'sessioni/:sessionId',
        title: 'Gestione sessione — Check-in CNR Concorsi',
        // Su smartphone la sessione ha una testata propria (P08): header e footer del sito si nascondono.
        data: { mobileImmersive: true },
        canActivate: [sessionModeGuard],
        loadComponent: () =>
          import('./features/gestione-sessione/gestione-sessione.component').then(
            (module) => module.GestioneSessioneComponent,
          ),
      },
      {
        path: 'sessioni/:sessionId/dispositivi',
        redirectTo: (snapshot) => {
          const sessionId = snapshot.paramMap.get('sessionId') ?? '';
          const mode = snapshot.queryParamMap.get('mode');
          return `/sessioni/${encodeURIComponent(sessionId)}${mode ? `?mode=${encodeURIComponent(mode)}` : ''}`;
        },
      },
      {
        path: 'admin',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/admin/admin-layout.component').then((module) => module.AdminLayoutComponent),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'permessi' },
          {
            path: 'permessi', title: 'Gestione permessi — Check-in CNR Concorsi',
            loadComponent: () => import('./features/admin/admin-roles.component').then((module) => module.AdminRolesComponent),
          },
          {
            path: 'impostazioni', title: 'Impostazioni applicazione — Check-in CNR Concorsi',
            loadComponent: () => import('./features/admin/admin-settings.component').then((module) => module.AdminSettingsComponent),
          },
          {
            path: 'logs', title: 'Log sistema — Check-in CNR Concorsi',
            loadComponent: () => import('./features/admin/admin-logs.component').then((module) => module.AdminLogsComponent),
          },
        ],
      },
      {
        path: 'area-personale',
        title: 'Area personale — Check-in CNR Concorsi',
        loadComponent: () =>
          import('./features/user/personal-area.component').then(
            (module) => module.PersonalAreaComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];

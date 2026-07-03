import { Routes } from '@angular/router';
import { adminGuard, authGuard } from './core/auth.guard';

export const routes: Routes = [
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
        loadComponent: () =>
          import('./features/gestione-sessione/gestione-sessione.component').then(
            (module) => module.GestioneSessioneComponent,
          ),
      },
      {
        path: 'sessioni/:sessionId/dispositivi',
        title: 'Dispositivi — Check-in CNR Concorsi',
        loadComponent: () =>
          import('./features/dispositivi/dispositivi.component').then(
            (module) => module.DispositiviComponent,
          ),
      },
      {
        path: 'admin/permessi',
        title: 'Gestione permessi — Check-in CNR Concorsi',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/admin/admin-roles.component').then(
            (module) => module.AdminRolesComponent,
          ),
      },
      {
        path: 'admin/logs',
        title: 'Log sistema — Check-in CNR Concorsi',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/admin/admin-logs.component').then(
            (module) => module.AdminLogsComponent,
          ),
      },
      {
        path: 'scanner',
        title: 'Scanner — Check-in CNR Concorsi',
        loadComponent: () =>
          import('./features/scanner/scanner.component').then(
            (module) => module.ScannerComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];

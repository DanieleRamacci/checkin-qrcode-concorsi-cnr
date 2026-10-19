import { Injectable, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

export type AppProfile = 'segretario' | 'referente' | 'sede' | 'esperto' | 'admin';

export interface ProfileNavigationItem {
  label: string;
  path: string;
  queryParams?: Record<string, string>;
}

const PROFILE_LABELS: Record<AppProfile, string> = {
  segretario: 'Segretario', referente: 'Referente', sede: 'Informatico in sede',
  esperto: 'Esperto remoto', admin: 'Amministratore',
};

@Injectable({ providedIn: 'root' })
export class ProfileService {
  readonly active = signal<AppProfile>('segretario');
  readonly homeDestinations: Record<AppProfile, string> = {
    segretario: '/segretario', referente: '/referenti/bandi',
    sede: '/le-mie-sessioni?mode=sede', esperto: '/le-mie-sessioni?mode=expert', admin: '/admin',
  };

  constructor(private readonly router: Router) {
    this.applyUrl(this.router.url);
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe((event) => {
      this.applyUrl((event as NavigationEnd).urlAfterRedirects);
    });
  }

  label(profile = this.active()): string { return PROFILE_LABELS[profile]; }

  select(profile: AppProfile): void {
    this.active.set(profile);
    try { localStorage.setItem('checkin.activeProfile', profile); } catch { /* Storage may be unavailable. */ }
  }

  navigation(): ProfileNavigationItem[] {
    const common: ProfileNavigationItem[] = [{ label: 'Home', path: '/' }];
    switch (this.active()) {
      case 'segretario': return [...common, { label: 'I miei concorsi', path: '/bandi' }, { label: 'Scanner', path: '/scanner' }];
      case 'sede': return [...common, { label: 'Le mie sessioni', path: '/le-mie-sessioni', queryParams: { mode: 'sede' } }, { label: 'Scanner', path: '/scanner' }];
      case 'esperto': return [...common, { label: 'Le mie sessioni', path: '/le-mie-sessioni', queryParams: { mode: 'expert' } }];
      case 'referente': return [...common, { label: 'I bandi di cui sei referente', path: '/referenti/bandi' }];
      case 'admin': return [...common, { label: 'Amministrazione', path: this.homeDestinations.admin }];
    }
  }

  private applyUrl(url: string): void {
    const [path, query = ''] = url.split('?');
    const params = new URLSearchParams(query);
    const mode = params.get('mode');
    const byMode: Record<string, AppProfile> = { sede: 'sede', expert: 'esperto', esperto: 'esperto', admin: 'admin', referente: 'referente', segretario: 'segretario' };
    if (mode && byMode[mode]) { this.select(byMode[mode]); return; }
    if (path.startsWith('/referenti/')) { this.select('referente'); return; }
    if (path.startsWith('/admin/')) { this.select('admin'); return; }
    if (path === '/segretario') { this.select('segretario'); return; }
    if (path === '/' || path === '') {
      try {
        const saved = localStorage.getItem('checkin.activeProfile') as AppProfile | null;
        if (saved && saved in PROFILE_LABELS) this.active.set(saved);
      } catch { /* Storage may be unavailable. */ }
    }
  }
}

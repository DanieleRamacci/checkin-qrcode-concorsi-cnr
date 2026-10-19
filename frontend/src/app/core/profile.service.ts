import { Injectable, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { UserContext } from './models/api.models';

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

export function availableProfiles(user: UserContext | null): AppProfile[] {
  if (!user) return [];
  if (user.profiles?.length) return user.profiles;
  const capabilities = user.capabilities ?? [];
  const profiles: AppProfile[] = ['segretario', 'referente'];
  if (capabilities.includes('sede_workflow') || capabilities.includes('admin')) profiles.push('sede');
  if (capabilities.includes('expert_workflow')) profiles.push('esperto');
  if (capabilities.includes('admin')) profiles.push('admin');
  return profiles;
}

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
  }

  linksFor(profile: AppProfile): ProfileNavigationItem[] {
    switch (profile) {
      case 'segretario': return [{ label: 'Home segretario', path: '/segretario' }, { label: 'I miei concorsi', path: '/bandi' }, { label: 'Scanner', path: '/scanner' }];
      case 'sede': return [{ label: 'Le mie sessioni', path: '/le-mie-sessioni', queryParams: { mode: 'sede' } }, { label: 'Scanner', path: '/scanner' }];
      case 'esperto': return [{ label: 'Le mie sessioni', path: '/le-mie-sessioni', queryParams: { mode: 'expert' } }];
      case 'referente': return [{ label: 'I bandi di cui sei referente', path: '/referenti/bandi' }];
      case 'admin': return [{ label: 'Amministrazione', path: '/admin' }, { label: 'Permessi', path: '/admin/permessi' }, { label: 'Impostazioni', path: '/admin/impostazioni' }, { label: 'Log di sistema', path: '/admin/logs' }];
    }
  }

  navigation(multipleProfiles = false): ProfileNavigationItem[] {
    const common: ProfileNavigationItem[] = [{ label: multipleProfiles ? 'Scegli profilo' : 'Home', path: '/' }];
    const links = this.linksFor(this.active());
    if (this.active() === 'admin') return [...common, links[0]];
    return [...common, ...links];
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
  }
}

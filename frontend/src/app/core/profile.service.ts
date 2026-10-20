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
  esperto: 'Esperto remoto', admin: 'Amministrazione',
};

const PROFILE_HOMES: Record<AppProfile, ProfileNavigationItem> = {
  segretario: { label: 'Home segretario', path: '/segretario' },
  referente: { label: 'I bandi di cui sei referente', path: '/referenti/bandi' },
  sede: { label: 'Le mie sessioni', path: '/le-mie-sessioni', queryParams: { mode: 'sede' } },
  esperto: { label: 'Le mie sessioni', path: '/le-mie-sessioni', queryParams: { mode: 'expert' } },
  admin: { label: 'Amministrazione', path: '/admin' },
};

const LAST_PROFILE_KEY = 'checkin.lastProfile.';

const SHORT_LABELS: Record<string, string> = {
  'I miei concorsi': 'Concorsi', 'Le mie sessioni': 'Sessioni', 'Bandi da referente': 'Referente',
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

  constructor(private readonly router: Router) {
    this.applyUrl(this.router.url);
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe((event) => {
      this.applyUrl((event as NavigationEnd).urlAfterRedirects);
    });
  }

  label(profile = this.active()): string { return PROFILE_LABELS[profile]; }

  select(profile: AppProfile): void { this.active.set(profile); }

  home(profile: AppProfile): ProfileNavigationItem { return PROFILE_HOMES[profile]; }

  /**
   * Voci dell'header: dipendono dai profili che l'utente ha, non da quello
   * attivo, così chi ha più profili (per esempio un amministratore) trova
   * sempre le stesse voci. Per chi ha solo il profilo segretario restano
   * quelle del design: Home, I miei concorsi, Scanner.
   */
  navigation(available: AppProfile[]): ProfileNavigationItem[] {
    const items: ProfileNavigationItem[] = [{ label: 'Home', path: '/' }];
    if (available.includes('segretario')) items.push({ label: 'I miei concorsi', path: '/bandi' });
    if (available.includes('sede') || available.includes('esperto')) items.push(this.mySessionsItem(available));
    if (available.includes('referente')) items.push({ label: 'Bandi da referente', path: '/referenti/bandi' });
    if (available.includes('admin')) items.push({ label: 'Amministrazione', path: '/admin' });
    if (available.includes('segretario') || available.includes('sede')) items.push({ label: 'Scanner', path: '/scanner' });
    // Con molti profili (es. amministratore) le etichette brevi tengono l'header su una riga.
    return items.length > 4 ? items.map((item) => ({ ...item, label: SHORT_LABELS[item.label] ?? item.label })) : items;
  }

  /** Ultimo profilo scelto, conservato per singolo account: su un PC condiviso non passa al collega. */
  lastUsed(email: string | null | undefined): AppProfile | null {
    if (!email) return null;
    try {
      const value = window.localStorage.getItem(LAST_PROFILE_KEY + email.toLowerCase());
      return value && value in PROFILE_LABELS ? (value as AppProfile) : null;
    } catch {
      return null;
    }
  }

  remember(email: string | null | undefined, profile: AppProfile): void {
    this.select(profile);
    if (!email) return;
    try {
      window.localStorage.setItem(LAST_PROFILE_KEY + email.toLowerCase(), profile);
    } catch {
      // Archiviazione del browser non disponibile: la scelta vale solo per questa visita.
    }
  }

  private mySessionsItem(available: AppProfile[]): ProfileNavigationItem {
    const active = this.active();
    const mode = active === 'esperto' || (active !== 'sede' && !available.includes('sede')) ? 'expert' : 'sede';
    return { label: 'Le mie sessioni', path: '/le-mie-sessioni', queryParams: { mode } };
  }

  private applyUrl(url: string): void {
    const [path, query = ''] = url.split('?');
    const mode = new URLSearchParams(query).get('mode');
    const byMode: Record<string, AppProfile> = {
      sede: 'sede', expert: 'esperto', esperto: 'esperto', admin: 'admin', referente: 'referente', segretario: 'segretario',
    };
    if (mode && byMode[mode]) { this.select(byMode[mode]); return; }
    if (path.startsWith('/referenti/')) { this.select('referente'); return; }
    if (path === '/admin' || path.startsWith('/admin/')) { this.select('admin'); return; }
    if (path === '/segretario' || path === '/bandi' || path.startsWith('/bandi/')) { this.select('segretario'); }
  }
}

import { computed, inject, Injectable, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from './auth.service';
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

/**
 * Voci dell'header per profilo attivo: chi ha più profili (per esempio un
 * amministratore) vede solo le pagine del profilo con cui sta lavorando e cambia
 * profilo dal pulsante "Profilo". Per il segretario sono quelle del design.
 */
const PROFILE_NAVIGATION: Record<AppProfile, ProfileNavigationItem[]> = {
  segretario: [
    { label: 'Home', path: '/segretario' },
    { label: 'I miei concorsi', path: '/bandi', queryParams: { mode: 'segretario' } },
    { label: 'Scanner', path: '/scanner', queryParams: { mode: 'segretario' } },
  ],
  referente: [{ label: 'Bandi da referente', path: '/referenti/bandi' }],
  sede: [
    { label: 'Le mie sessioni', path: '/le-mie-sessioni', queryParams: { mode: 'sede' } },
    { label: 'Scanner', path: '/scanner', queryParams: { mode: 'sede' } },
  ],
  esperto: [{ label: 'Le mie sessioni', path: '/le-mie-sessioni', queryParams: { mode: 'expert' } }],
  admin: [
    { label: 'Amministrazione', path: '/admin' },
    { label: 'Tutti i bandi', path: '/bandi', queryParams: { mode: 'admin' } },
  ],
};

/** Profili con cui si apre una pagina sessione, in ordine di preferenza. */
const SESSION_PROFILES: AppProfile[] = ['segretario', 'sede', 'esperto', 'admin'];

const LAST_PROFILE_KEY = 'checkin.lastProfile.';

const PROFILE_BY_MODE: Record<string, AppProfile> = {
  sede: 'sede', expert: 'esperto', esperto: 'esperto', admin: 'admin', referente: 'referente', segretario: 'segretario',
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

/** Valore di `?mode=` con cui le pagine sessione e scanner chiedono i dati al backend. */
export function sessionMode(profile: AppProfile): string {
  return profile === 'esperto' ? 'expert' : profile;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  /** Profilo scelto in questa scheda (scelta profilo o URL con `mode`). */
  private readonly selected = signal<AppProfile | null>(null);
  readonly available = computed(() => availableProfiles(this.auth.user()));
  /**
   * Profilo attivo: quello scelto se l'utente lo ha ancora, altrimenti l'ultimo
   * usato da questo account, altrimenti il primo disponibile. Così una
   * ricarica o il tasto indietro non riportano al profilo segretario.
   */
  readonly active = computed<AppProfile>(() => {
    const available = this.available();
    const selected = this.selected();
    if (selected && (!available.length || available.includes(selected))) return selected;
    const last = this.lastUsed(this.auth.user()?.email);
    if (last && available.includes(last)) return last;
    return available[0] ?? 'segretario';
  });

  constructor() {
    this.applyUrl(this.router.url);
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe((event) => {
      this.applyUrl((event as NavigationEnd).urlAfterRedirects);
    });
  }

  label(profile = this.active()): string { return PROFILE_LABELS[profile]; }

  select(profile: AppProfile): void {
    this.selected.set(profile);
    this.persist(this.auth.user()?.email, profile);
  }

  home(profile: AppProfile): ProfileNavigationItem { return PROFILE_HOMES[profile]; }

  navigation(profile = this.active()): ProfileNavigationItem[] { return PROFILE_NAVIGATION[profile]; }

  /**
   * Profilo con cui aprire una sessione arrivando senza `mode` (per esempio dallo
   * scanner collegato col QR): quello attivo se vale per le sessioni, altrimenti
   * il primo profilo operativo dell'utente.
   */
  sessionProfile(): AppProfile {
    const active = this.active();
    if (SESSION_PROFILES.includes(active)) return active;
    return SESSION_PROFILES.find((profile) => this.available().includes(profile)) ?? 'segretario';
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
    this.selected.set(profile);
    this.persist(email, profile);
  }

  private persist(email: string | null | undefined, profile: AppProfile): void {
    if (!email) return;
    try {
      window.localStorage.setItem(LAST_PROFILE_KEY + email.toLowerCase(), profile);
    } catch {
      // Archiviazione del browser non disponibile: la scelta vale solo per questa visita.
    }
  }

  /**
   * Il profilo cambia solo con URL che lo dichiarano (`mode`) o che appartengono
   * a un solo profilo. Le pagine condivise (configurazione bando, area
   * personale, scanner senza `mode`) lasciano il profilo attivo com'è.
   */
  private applyUrl(url: string): void {
    const [path, query = ''] = url.split('?');
    const mode = new URLSearchParams(query).get('mode');
    if (mode && PROFILE_BY_MODE[mode]) { this.select(PROFILE_BY_MODE[mode]); return; }
    if (path.startsWith('/referenti/')) { this.select('referente'); return; }
    if (path === '/admin' || path.startsWith('/admin/')) { this.select('admin'); return; }
    if (path === '/segretario' || path === '/bandi' || /^\/bandi\/[^/]+\/(sessioni|detail)$/.test(path)) this.select('segretario');
  }
}

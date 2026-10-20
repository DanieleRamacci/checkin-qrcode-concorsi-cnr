import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { availableProfiles, ProfileService } from './profile.service';

@Component({ template: '' })
class EmptyPage {}

describe('ProfileService', () => {
  const user = signal<Record<string, unknown> | null>(null);

  beforeEach(() => {
    user.set({ email: 'tutti@cnr.it', profiles: ['segretario', 'referente', 'sede', 'esperto', 'admin'] });
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', component: EmptyPage }]), { provide: AuthService, useValue: { user } }] });
    window.localStorage.clear();
  });

  it('builds the header menu from the active profile', () => {
    const service = TestBed.inject(ProfileService);
    expect(service.navigation('segretario').map((item) => item.label)).toEqual(['Home', 'I miei concorsi', 'Scanner']);
    expect(service.navigation('sede').map((item) => item.label)).toEqual(['Le mie sessioni', 'Scanner']);
    expect(service.navigation('esperto')[0].queryParams).toEqual({ mode: 'expert' });
    expect(service.navigation('admin').map((item) => item.label)).toEqual(['Amministrazione', 'Tutti i bandi']);
  });

  it('keeps the active profile on shared pages and follows URLs that declare it', async () => {
    const service = TestBed.inject(ProfileService);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/le-mie-sessioni?mode=sede');
    expect(service.active()).toBe('sede');
    await router.navigateByUrl('/bandi/b1/config?returnUrl=%2Freferenti%2Fbandi');
    expect(service.active()).toBe('sede');
    await router.navigateByUrl('/bandi/b1/sessioni?mode=admin');
    expect(service.active()).toBe('admin');
  });

  it('opens a session without mode with a profile the user has', () => {
    user.set({ email: 'sede@cnr.it', profiles: ['sede'] });
    const service = TestBed.inject(ProfileService);
    expect(service.active()).toBe('sede');
    expect(service.sessionProfile()).toBe('sede');
    user.set({ email: 'ref@cnr.it', profiles: ['referente', 'esperto'] });
    expect(service.sessionProfile()).toBe('esperto');
  });

  it('remembers the last profile per account', () => {
    const service = TestBed.inject(ProfileService);
    service.remember('Uno@cnr.it', 'sede');
    expect(service.active()).toBe('sede');
    expect(service.lastUsed('uno@cnr.it')).toBe('sede');
    expect(service.lastUsed('due@cnr.it')).toBeNull();
  });

  it('derives profiles from capabilities when the backend does not list them', () => {
    expect(availableProfiles(null)).toEqual([]);
    expect(availableProfiles({ capabilities: ['expert_workflow'] } as never)).toEqual(['segretario', 'referente', 'esperto']);
    expect(availableProfiles({ profiles: ['referente'], capabilities: ['admin'] } as never)).toEqual(['referente']);
  });
});

import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { availableProfiles, ProfileService } from './profile.service';

describe('ProfileService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    window.localStorage.clear();
  });

  it('builds the header menu from the profiles of the user, not from the active one', () => {
    const service = TestBed.inject(ProfileService);
    const all = ['segretario', 'referente', 'sede', 'esperto', 'admin'] as const;
    service.select('esperto');
    const asExpert = service.navigation([...all]).map((item) => item.label);
    service.select('segretario');
    expect(service.navigation([...all]).map((item) => item.label)).toEqual(asExpert);
    expect(service.navigation(['segretario']).map((item) => item.label)).toEqual(['Home', 'I miei concorsi', 'Scanner']);
    expect(service.navigation(['esperto']).map((item) => item.label)).toEqual(['Home', 'Le mie sessioni']);
  });

  it('opens Le mie sessioni in the mode of the profiles the user has', () => {
    const service = TestBed.inject(ProfileService);
    service.select('segretario');
    expect(service.navigation(['esperto']).find((item) => item.label === 'Le mie sessioni')?.queryParams).toEqual({ mode: 'expert' });
    expect(service.navigation(['sede', 'esperto']).find((item) => item.label === 'Le mie sessioni')?.queryParams).toEqual({ mode: 'sede' });
    service.select('esperto');
    expect(service.navigation(['sede', 'esperto']).find((item) => item.label === 'Le mie sessioni')?.queryParams).toEqual({ mode: 'expert' });
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

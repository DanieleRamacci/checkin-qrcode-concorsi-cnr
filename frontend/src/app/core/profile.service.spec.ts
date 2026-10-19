import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { ProfileService } from './profile.service';

describe('ProfileService', () => {
  it('provides profile-specific navigation destinations', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const service = TestBed.inject(ProfileService);
    service.select('sede');
    expect(service.label()).toBe('Informatico in sede');
    expect(service.homeDestinations.sede).toBe('/le-mie-sessioni?mode=sede');
    expect(service.navigation().some((item) => item.label === 'Scanner')).toBe(true);
    expect(service.navigation().find((item) => item.label === 'Home')).toMatchObject({
      path: '/le-mie-sessioni', queryParams: { mode: 'sede' },
    });
  });

  it('continues to work when browser storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('storage unavailable'); },
      setItem: () => { throw new Error('storage unavailable'); },
    });
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const service = TestBed.inject(ProfileService);
    expect(() => service.select('esperto')).not.toThrow();
    expect(service.active()).toBe('esperto');
    vi.unstubAllGlobals();
  });
});

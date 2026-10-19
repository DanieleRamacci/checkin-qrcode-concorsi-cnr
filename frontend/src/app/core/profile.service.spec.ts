import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProfileService } from './profile.service';

describe('ProfileService', () => {
  it('provides a fixed Home link and profile-specific navigation destinations', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const service = TestBed.inject(ProfileService);
    service.select('sede');
    expect(service.label()).toBe('Informatico in sede');
    expect(service.homeDestinations.sede).toBe('/le-mie-sessioni?mode=sede');
    expect(service.navigation().some((item) => item.label === 'Scanner')).toBe(true);
    expect(service.navigation().find((item) => item.label === 'Home')).toEqual({ label: 'Home', path: '/' });
  });

});

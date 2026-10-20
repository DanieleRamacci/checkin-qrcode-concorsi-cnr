import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { HomeComponent } from './home.component';
import { AuthService } from '../../core/auth.service';
import { provideKitForTests } from '../../../testing/kit';

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;

  async function createHome(capabilities: string[], profiles?: string[]) {
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideRouter([]),
        ...provideKitForTests(),
        {
          provide: AuthService,
          useValue: {
            user: signal({
              authenticated: true,
              email: 'utente@cnr.it',
              display_name: 'Utente CNR',
              roles: [],
              capabilities,
              profiles,
              csrf_token: 'token',
            }),
            hasCapability: (capability: string) => capabilities.includes(capability),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('shows one design card per operational profile and admin links apart', async () => {
    fixture = await createHome(['expert_workflow', 'admin']);
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toContain('Con quale profilo vuoi lavorare?');
    expect(element.querySelectorAll('.app-role-grid article.app-role').length).toBe(4);
    expect(element.textContent).toContain('Entra come Esperto remoto');
    expect(element.textContent).toContain('Amministrazione');
    expect(element.textContent).toContain('Log di sistema');
    expect(element.querySelector('[role="tablist"]')).toBeNull();
  });

  it('highlights the first card when the account has no last used profile', async () => {
    fixture = await createHome([]);
    const element = fixture.nativeElement as HTMLElement;
    const highlighted = element.querySelector('article.app-role--last');
    expect(highlighted?.textContent).toContain('Segretario');
    expect(highlighted?.querySelector('a.btn-primary')).toBeTruthy();
    expect(element.textContent).not.toContain('Informatico in sede');
  });

  it('enters directly the home of the only profile', async () => {
    const navigate = vi.spyOn(Router.prototype, 'navigate').mockResolvedValue(true);
    fixture = await createHome([], ['referente']);
    TestBed.flushEffects();
    expect(navigate).toHaveBeenCalledWith(['/referenti/bandi'], expect.objectContaining({ replaceUrl: true }));
    navigate.mockRestore();
  });
});

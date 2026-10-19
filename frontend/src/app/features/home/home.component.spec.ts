import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { HomeComponent } from './home.component';
import { AuthService } from '../../core/auth.service';

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;

  async function createHome(capabilities: string[]) {
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            user: signal({
              authenticated: true,
              email: 'utente@cnr.it',
              display_name: 'Utente CNR',
              roles: [],
              capabilities,
              csrf_token: 'token',
            }),
            hasCapability: (capability: string) =>
              capabilities.includes(capability),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('shows only profiles allowed by capabilities when the API omits profiles', async () => {
    fixture = await createHome(['expert_workflow', 'admin']);

    expect(fixture.nativeElement.textContent).toContain('Esperto remoto');
    expect(fixture.nativeElement.textContent).toContain('Informatico in sede');
    expect(fixture.nativeElement.textContent).toContain('Referente');
    expect(fixture.nativeElement.textContent).toContain('Amministrazione');
    expect(fixture.nativeElement.textContent).not.toContain('Continua come Amministratore');
    expect(fixture.nativeElement.querySelector('[role="tablist"]')).toBeTruthy();
  });

  it('hides sede profile when the user has no assigned sede workflow', async () => {
    fixture = await createHome([]);

    expect(fixture.nativeElement.textContent).not.toContain('Informatico in sede');
    expect(fixture.nativeElement.textContent).toContain('Segretario');
    expect(fixture.nativeElement.textContent).toContain('Referente');
  });

  it('shows sede profile for assigned sede workflow users', async () => {
    fixture = await createHome(['sede_workflow']);

    expect(fixture.nativeElement.textContent).toContain('Informatico in sede');
    expect(fixture.nativeElement.textContent).not.toContain('Amministratore');
  });

  it('uses the profiles returned by the API as the source of available cards', async () => {
    fixture = await createHome([]);
    const auth = TestBed.inject(AuthService);
    auth.user.set({ ...auth.user()!, profiles: ['referente'] });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Referente');
    expect(fixture.nativeElement.textContent).not.toContain('Segretario');
  });
});

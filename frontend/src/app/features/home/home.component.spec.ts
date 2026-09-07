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

  it('shows expert profile and admin menu from capabilities', async () => {
    fixture = await createHome(['expert_workflow', 'admin']);

    expect(fixture.nativeElement.textContent).toContain('Esperto informatico');
    expect(fixture.nativeElement.textContent).toContain('Informatico in sede');
    expect(fixture.nativeElement.textContent).toContain('Referenti');
    expect(fixture.nativeElement.textContent).toContain('Menu admin');
    expect(fixture.nativeElement.textContent).not.toContain('LEGACY HTML');
  });

  it('hides sede profile when the user has no assigned sede workflow', async () => {
    fixture = await createHome([]);

    expect(fixture.nativeElement.textContent).not.toContain('Informatico in sede');
    expect(fixture.nativeElement.textContent).toContain('Segretario');
    expect(fixture.nativeElement.textContent).toContain('Referenti');
  });

  it('shows sede profile for assigned sede workflow users', async () => {
    fixture = await createHome(['sede_workflow']);

    expect(fixture.nativeElement.textContent).toContain('Informatico in sede');
    expect(fixture.nativeElement.textContent).not.toContain('Menu admin');
  });
});

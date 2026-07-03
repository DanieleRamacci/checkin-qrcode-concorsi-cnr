import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { HomeComponent } from './home.component';
import { AuthService } from '../../core/auth.service';

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;

  it('shows expert profile and admin menu from capabilities', async () => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            user: signal({
              authenticated: true,
              email: 'expert@cnr.it',
              display_name: 'Esperto',
              roles: ['admin_globale'],
              capabilities: ['expert_workflow', 'admin'],
              csrf_token: 'token',
            }),
            hasCapability: (capability: string) =>
              ['expert_workflow', 'admin'].includes(capability),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Esperto informatico');
    expect(fixture.nativeElement.textContent).toContain('Menu admin');
  });
});

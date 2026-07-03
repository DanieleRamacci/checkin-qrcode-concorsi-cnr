import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApiClient } from '../../core/api-client';
import { AdminRolesComponent } from './admin-roles.component';

describe('AdminRolesComponent', () => {
  it('separates expert and administrator permissions', async () => {
    await TestBed.configureTestingModule({
      imports: [AdminRolesComponent],
      providers: [
        provideRouter([]),
        {
          provide: ApiClient,
          useValue: {
            get: () => of({ items: [
              { user_email: 'expert@cnr.it', role: 'esperto_informatico' },
              { user_email: 'admin@cnr.it', role: 'admin_globale' },
            ] }),
            post: () => of({}),
            delete: () => of({}),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdminRolesComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('expert@cnr.it');
    expect(fixture.nativeElement.textContent).toContain('admin@cnr.it');
  });
});

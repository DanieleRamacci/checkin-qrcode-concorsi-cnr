import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ApiClient } from '../../core/api-client';
import { AdminRolesComponent } from './admin-roles.component';

describe('AdminRolesComponent', () => {
  it('shows readable role names and asks for confirmation before removal', async () => {
    const remove = vi.fn(() => of({}));
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
            delete: remove,
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdminRolesComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('expert@cnr.it');
    expect(fixture.nativeElement.textContent).toContain('admin@cnr.it');
    expect(fixture.nativeElement.textContent).toContain('Esperto remoto');
    expect(fixture.nativeElement.textContent).toContain('Amministratore');
    expect(fixture.nativeElement.textContent).toContain('Altri ruoli');
    expect(fixture.nativeElement.querySelector('#role-select')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('esperto_informatico');
    fixture.nativeElement.querySelector('button.btn-link').click();
    fixture.detectChanges();
    expect(remove).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Rimuovere questo permesso?');
    fixture.nativeElement.querySelector('.modal .btn-danger').click();
    expect(remove).toHaveBeenCalledOnce();
  });
});

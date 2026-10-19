import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ApiClient } from '../../core/api-client';
import { AuthService } from '../../core/auth.service';
import { AdminSettingsComponent } from './admin-settings.component';

describe('AdminSettingsComponent', () => {
  it('previews the application identity and saves the configured values', async () => {
    const put = vi.fn((_: string, value: unknown) => of(value));
    await TestBed.configureTestingModule({
      imports: [AdminSettingsComponent],
      providers: [
        provideRouter([]),
        { provide: ApiClient, useValue: { get: () => of({ institution_name: 'CNR', app_title: 'Check-in Concorsi', tagline: 'Gestione prove', footer_owner: 'CNR' }), put } },
        { provide: AuthService, useValue: { defaultSettings: { institution_name: 'CNR', app_title: 'App', tagline: 'Test', footer_owner: 'CNR' }, load: () => of({}) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AdminSettingsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Anteprima intestazione');
    expect(fixture.nativeElement.textContent).toContain('Check-in Concorsi');
    fixture.componentInstance.save();
    expect(put).toHaveBeenCalledOnce();
  });
});

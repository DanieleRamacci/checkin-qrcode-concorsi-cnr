import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiClient } from '../../core/api-client';
import { ResetPasswordComponent, resetFilterForApi } from './reset-password.component';

describe('resetFilterForApi', () => {
  it('maps expert pending and completed filters to API values', () => {
    expect(resetFilterForApi('esperto', 'da_evade')).toBe('requested');
    expect(resetFilterForApi('esperto', 'evasi')).toBe('completed');
  });

  it('maps site filters to API values', () => {
    expect(resetFilterForApi('sede', 'richiesto')).toBe('requested');
    expect(resetFilterForApi('sede', 'effettuato')).toBe('completed');
  });
});

describe('ResetPasswordComponent', () => {
  it('renders pending resets in expert mode', async () => {
    await TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [{
        provide: ApiClient,
        useValue: {
          get: () => of({ items: [{
            uid: 'candidate-1',
            first_name: 'Ada',
            last_name: 'Lovelace',
            document_number: 'DOC1',
            checkin_effettuato: true,
            reset_password_richiesto: true,
            reset_password_effettuato: false,
          }] }),
          post: () => of({}),
        },
      }],
    }).compileComponents();

    const fixture = TestBed.createComponent(ResetPasswordComponent);
    fixture.componentRef.setInput('sessionId', 'session-1');
    fixture.componentRef.setInput('viewMode', 'esperto');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Segna come fatto');
    expect(fixture.nativeElement.textContent).toContain('Reset richiesto');
  });

  it('keeps open reset requests above other present candidates in the all filter', async () => {
    await TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [{
        provide: ApiClient,
        useValue: {
          get: () => of({ items: [
            { uid: 'done', first_name: 'Ada', last_name: 'Aaa', checkin_effettuato: true, reset_password_richiesto: false, reset_password_effettuato: false },
            { uid: 'open', first_name: 'Grace', last_name: 'Zzz', checkin_effettuato: true, reset_password_richiesto: true, reset_password_effettuato: false },
          ] }),
          post: () => of({}),
        },
      }],
    }).compileComponents();
    const fixture = TestBed.createComponent(ResetPasswordComponent);
    fixture.componentRef.setInput('sessionId', 'session-1');
    fixture.componentRef.setInput('viewMode', 'sede');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.setFilter('all');
    fixture.detectChanges();

    const firstRow = (fixture.nativeElement as HTMLElement).querySelector('tbody tr')?.textContent ?? '';
    expect(firstRow).toContain('Zzz Grace');
    expect(fixture.componentInstance.filterOptions().find((item) => item.id === 'richiesto')?.count).toBe(1);
  });
});

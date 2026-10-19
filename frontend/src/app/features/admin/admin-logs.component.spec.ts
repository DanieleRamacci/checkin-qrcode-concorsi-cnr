import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiClient } from '../../core/api-client';
import { AdminLogsComponent } from './admin-logs.component';

describe('AdminLogsComponent', () => {
  it('shows grouped log counts, readable session states and filters records', async () => {
    await TestBed.configureTestingModule({
      imports: [AdminLogsComponent],
      providers: [{ provide: ApiClient, useValue: { get: () => of({
        limit: 200,
        system_errors: [{ id: 1, created_at: '2026-10-19T09:00:00Z', error_type: 'Timeout', raw_error: 'Connection failed' }],
        email_logs: [{ id: 2, sent_at: '2026-10-19T09:10:00Z', smtp_status: 'sent', to_emails: 'esperto@cnr.it' }],
        session_state_logs: [{ id: 3, timestamp: '2026-10-19T09:20:00Z', session_id: 's-1', stato: 'checkin_avviato' }],
        exam_state_logs: [],
      }) } }],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdminLogsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Cambi di stato');
    expect(fixture.nativeElement.textContent).toContain('Check-in avviato');
    expect(fixture.nativeElement.textContent).toContain('checkin_avviato');
    expect(fixture.nativeElement.textContent).toContain('Errori tecnici');
    fixture.componentInstance.query.set('Connection failed');
    expect(fixture.componentInstance.sections().map((section) => section.items.length)).toEqual([1, 0, 0]);
  });
});

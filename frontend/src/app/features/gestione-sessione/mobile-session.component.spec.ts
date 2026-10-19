import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MobileSessionComponent } from './mobile-session.component';

describe('MobileSessionComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [MobileSessionComponent], providers: [provideRouter([])] }));

  it('shows the session summary and missing candidate count', () => {
    const fixture = TestBed.createComponent(MobileSessionComponent);
    fixture.componentRef.setInput('session', {
      session_id: 'session-1', commission_id: 'c1', name: 'Prova scritta', date: '20/10/2026', time: '09:00',
      location: 'Roma', current_state: 'checkin_avviato', candidate_count: 12, checked_in_count: 8, device_count: 2, capabilities: [],
    });
    fixture.componentRef.setInput('currentState', 'checkin_avviato');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Check-in avviato');
    expect(fixture.nativeElement.textContent).toContain('Mancano 4 candidati');
  });

  it('switches between the three mobile sections', () => {
    const fixture = TestBed.createComponent(MobileSessionComponent);
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('.mobile-tabs button') as NodeListOf<HTMLButtonElement>;
    buttons[1].click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.mobile-tab-panel[aria-label="Candidati"]').hidden).toBe(false);
    buttons[2].click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.mobile-tab-panel[aria-label="Messaggi"]').hidden).toBe(false);
  });
});

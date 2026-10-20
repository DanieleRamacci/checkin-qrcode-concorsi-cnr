import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ApiClient } from '../../core/api-client';
import { MobileSessionComponent } from './mobile-session.component';
import { provideKitForTests } from '../../../testing/kit';

const SESSION = {
  session_id: 'session-1', commission_id: 'c1', bando_title: '999.999', name: 'Prova scritta', date: '2026-10-20', time: '14:17',
  location: 'Roma', current_state: 'checkin_avviato', candidate_count: 4, checked_in_count: 2, device_count: 1, capabilities: [],
};

async function render(mode = 'segretario', post = vi.fn(() => of({}))) {
  await TestBed.configureTestingModule({
    imports: [MobileSessionComponent],
    providers: [provideRouter([]), ...provideKitForTests(), { provide: ApiClient, useValue: {
      get: () => of({ items: [
        { uid: 'u1', first_name: 'Ada', last_name: 'Rossi', document_number: 'D1', document_expired: true, checkin_effettuato: false },
        { uid: 'u4', first_name: 'Linus', last_name: 'Verdi', document_number: 'D4', document_expired: false, checkin_effettuato: false },
      ] }),
      post,
    } }],
  }).compileComponents();
  const fixture = TestBed.createComponent(MobileSessionComponent);
  fixture.componentRef.setInput('session', SESSION);
  fixture.componentRef.setInput('currentState', 'checkin_avviato');
  fixture.componentRef.setInput('checkinSince', '14:05');
  fixture.componentRef.setInput('mode', mode);
  fixture.componentRef.setInput('unreadCount', 2);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('MobileSessionComponent', () => {
  it('shows the compact head, the counter with Apri scanner and who is missing', async () => {
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.app-m-head')?.textContent).toContain('Prova scritta');
    expect(element.querySelector('.app-m-head [aria-label="Messaggi, 2 non letti"]')).toBeTruthy();
    expect(element.textContent).toContain('Check-in avviato');
    expect(element.textContent).toContain('dalle 14:05');
    expect(element.querySelector('.app-counter')?.textContent).toContain('2 / 4 presenti');
    expect(element.textContent).toContain('Apri scanner');
    expect(element.querySelector('#m-mancano')?.textContent).toBe('Mancano 2');
    expect(element.querySelector('.app-m-list')?.textContent).toContain('Documento scaduto');
    expect(element.querySelector('.app-m-tabs')?.textContent).toContain('Messaggi · 2');
  });

  it('registers a presence from the missing list', async () => {
    const post = vi.fn(() => of({}));
    const fixture = await render('segretario', post);
    const changed: void[] = [];
    fixture.componentInstance.changed.subscribe(() => changed.push(undefined));
    (fixture.nativeElement.querySelector('.app-m-list button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(post).toHaveBeenCalledWith('/sessioni/session-1/candidati/u1/toggle-checkin?mode=segretario');
    expect(fixture.nativeElement.querySelector('#m-mancano')?.textContent).toBe('Mancano 1');
    expect(changed).toHaveLength(1);
  });

  it('switches to candidates and opens messages from the bottom bar', async () => {
    const fixture = await render('esperto');
    const opened: void[] = [];
    fixture.componentInstance.openMessages.subscribe(() => opened.push(undefined));
    expect(fixture.nativeElement.querySelector('#m-mancano')).toBeNull();
    const tabs = fixture.nativeElement.querySelectorAll('.app-m-tabs a') as NodeListOf<HTMLAnchorElement>;
    tabs[1].click();
    fixture.detectChanges();
    expect(tabs[1].getAttribute('aria-current')).toBe('page');
    tabs[2].click();
    expect(opened).toHaveLength(1);
  });
});

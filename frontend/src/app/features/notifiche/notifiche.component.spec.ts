import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ApiClient } from '../../core/api-client';
import { AuthService } from '../../core/auth.service';
import { NotificheComponent } from './notifiche.component';

describe('NotificheComponent', () => {
  it('excludes state events, shows readable messages, sends quick replies and closes on Escape', async () => {
    const post = vi.fn(() => of({}));
    const notifications = [
      { id: 1, type: 'state', payload: 'checkin_avviato', author_role: 'Sistema' },
      { id: 2, type: 'candidate_note', payload: 'Nota candidato aggiornata (u1)', author_role: 'Inf. sede', author_email: 'sede@cnr.it' },
      { id: 3, type: 'reset', payload: 'Reset password: request (u1)', author_role: 'Segretario', author_email: 'segretario@cnr.it' },
    ];
    await TestBed.configureTestingModule({
      imports: [NotificheComponent],
      providers: [
        { provide: ApiClient, useValue: { get: (url: string) => url.includes('/candidati?')
          ? of({ items: [{ uid: 'u1', first_name: 'Ada', last_name: 'Rossi' }] })
          : of({ items: notifications }), post } },
        { provide: AuthService, useValue: { user: signal({ email: 'sede@cnr.it' }) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(NotificheComponent);
    fixture.componentRef.setInput('sessionId', 's1');
    fixture.detectChanges();
    fixture.componentInstance.load();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.messages()).toHaveLength(2);
    (fixture.nativeElement.querySelector('.app-chat-fab') as HTMLButtonElement).click();
    fixture.detectChanges();
    const drawer = fixture.nativeElement.querySelector('.app-chat-drawer') as HTMLElement;
    expect(drawer).toBeTruthy();
    expect(getComputedStyle(drawer).visibility).toBe('visible');
    expect(fixture.nativeElement.textContent).toContain('Nota di Rossi Ada aggiornata');
    expect(fixture.nativeElement.textContent).toContain('Richiesto un reset password per Rossi Ada');
    expect(fixture.nativeElement.textContent).not.toContain('checkin_avviato');
    expect(fixture.nativeElement.textContent).toContain('Informatico in sede');
    const quickReply = [...fixture.nativeElement.querySelectorAll('button')].find((button: Element) => button.textContent?.includes('Ok, ricevuto')) as HTMLButtonElement;
    quickReply.click();
    expect(post).toHaveBeenCalledWith('/sessioni/s1/notifications', { type: 'message', payload: 'Ok, ricevuto' });
    const fab = fixture.nativeElement.querySelector('.app-chat-fab') as HTMLButtonElement;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect(fixture.componentInstance.drawerOpen()).toBe(false);
    expect(document.activeElement).toBe(fab);
    notifications.push({ id: 4, type: 'message', payload: 'Nuovo messaggio', author_role: 'Segretario' });
    fixture.componentInstance.load();
    await fixture.whenStable();
    expect(fixture.componentInstance.newCount()).toBe(1);
    fixture.componentInstance.openDrawer();
    expect(fixture.componentInstance.newCount()).toBe(0);
  });
});

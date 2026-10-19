import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { vi } from 'vitest';
import { ActionsPanelComponent } from './actions-panel.component';

@Component({ imports: [ActionsPanelComponent], template: '<app-actions-panel titolo="Scarica candidati" [inCorso]="true"><p>Dettaglio</p><button azione>Avvia</button></app-actions-panel>' })
class HostComponent {}

describe('ActionsPanelComponent', () => {
  it('shows the next step, content, action, and long operation status', async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Scarica candidati');
    expect(fixture.nativeElement.textContent).toContain('Dettaglio');
    expect(fixture.nativeElement.textContent).toContain('Non chiudere la pagina');
    expect(fixture.nativeElement.querySelector('[azione]')).toBeTruthy();
  });
});

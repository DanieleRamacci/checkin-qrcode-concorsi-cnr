import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ActionsPanelComponent } from './actions-panel.component';
import { provideKitForTests } from '../../testing/kit';

@Component({
  imports: [ActionsPanelComponent],
  template: `<app-actions-panel etichetta="Passo 2 di 3 · Preparazione" titolo="Scarica i candidati" nota="Al termine l'elenco compare qui sotto."
    [inCorso]="true" messaggioInCorso="Sto scaricando i candidati da Selezioni Online…"><p>Dettaglio</p><button azione>Scarica candidati</button></app-actions-panel>`,
})
class HostComponent {}

describe('ActionsPanelComponent', () => {
  it('renders the design head, step, content, long operation and footer action', async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent], providers: [...provideKitForTests()] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.app-actions-head h2')?.textContent).toBe('Azioni');
    expect(element.querySelector('.app-actions-sub')?.textContent).toBe('cosa fare adesso');
    expect(element.querySelector('.app-eyebrow')?.textContent).toContain('Passo 2 di 3');
    expect(element.querySelector('h3')?.textContent).toContain('Scarica i candidati');
    expect(element.querySelector('.app-longop')?.textContent).toContain('Non chiudere la pagina');
    expect(element.querySelector('.app-next-footer [azione]')?.textContent).toBe('Scarica candidati');
    expect(element.querySelector('.app-next-footer p')?.textContent).toContain('Al termine');
  });
});

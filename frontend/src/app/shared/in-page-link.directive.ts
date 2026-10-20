import { Directive, HostListener, input } from '@angular/core';

/**
 * Link a una sezione della stessa pagina. Con `<base href="/">` un semplice
 * href="#id" porterebbe alla radice del sito: qui si scorre alla sezione e le si
 * dà il focus, così anche chi usa la tastiera o un lettore di schermo ci arriva.
 */
@Directive({ selector: 'a[appInPageLink]' })
export class InPageLinkDirective {
  /** id dell'elemento di destinazione, senza "#". */
  readonly appInPageLink = input.required<string>();

  @HostListener('click', ['$event'])
  onClick(event: Event): void {
    const target = document.getElementById(this.appInPageLink());
    if (!target) return;
    event.preventDefault();
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target.focus({ preventScroll: true });
  }
}

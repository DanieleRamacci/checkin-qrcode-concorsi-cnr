import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { InPageLinkDirective } from './in-page-link.directive';

@Component({
  imports: [InPageLinkDirective],
  template: `<a href="#target" appInPageLink="target">Vai</a><h2 id="target">Sezione</h2>`,
})
class HostComponent {}

describe('InPageLinkDirective', () => {
  it('focuses the section instead of navigating to the site root', () => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const target = fixture.nativeElement.querySelector('#target') as HTMLElement;
    target.scrollIntoView = () => undefined;
    document.body.appendChild(fixture.nativeElement);
    const event = new MouseEvent('click', { cancelable: true, bubbles: true });
    fixture.nativeElement.querySelector('a').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(target);
    fixture.nativeElement.remove();
  });
});

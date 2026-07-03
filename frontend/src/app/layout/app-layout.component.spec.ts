import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppLayoutComponent } from './app-layout.component';

describe('AppLayoutComponent', () => {
  it('renders the legacy-aligned shell landmarks', async () => {
    await TestBed.configureTestingModule({
      imports: [AppLayoutComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppLayoutComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('header')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#main-content')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('footer')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Sistema Gestione Presenze Concorsi CNR');
  });
});

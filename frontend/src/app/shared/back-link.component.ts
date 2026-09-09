import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-back-link',
  imports: [RouterLink],
  template: `
    <a class="btn btn-outline-secondary btn-sm mb-3" [routerLink]="target()" [queryParams]="queryParams()">
      <span aria-hidden="true">&larr;</span>
      <span>{{ label() }}</span>
    </a>
  `,
})
export class BackLinkComponent {
  readonly target = input<string | any[]>('/');
  readonly queryParams = input<Record<string, unknown> | null>(null);
  readonly label = input('Torna indietro');
}

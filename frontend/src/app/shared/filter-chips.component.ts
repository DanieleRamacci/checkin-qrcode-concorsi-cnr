import { Component, input, output } from '@angular/core';

export interface FilterChipOption { id: string; label: string; count?: number; }

@Component({
  selector: 'app-filter-chips',
  template: `
    <div class="app-filter-chips d-flex flex-wrap gap-2" role="group" [attr.aria-label]="label()">
      @for (option of options(); track option.id) {
        <button type="button" class="btn btn-sm rounded-pill"
          [class.btn-primary]="option.id === selected()"
          [class.btn-outline-secondary]="option.id !== selected()"
          [attr.aria-pressed]="option.id === selected()"
          (click)="selectedChange.emit(option.id)">
          {{ option.label }}@if (option.count !== undefined) { · {{ option.count }} }
        </button>
      }
    </div>
  `,
})
export class FilterChipsComponent {
  readonly label = input('Filtri');
  readonly options = input<FilterChipOption[]>([]);
  readonly selected = input.required<string>();
  readonly selectedChange = output<string>();
}

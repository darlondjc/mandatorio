import { ChangeDetectionStrategy, Component, ElementRef, inject, input, output } from '@angular/core';

export interface Aba {
  id: string;
  rotulo: string;
}

/** Abas segmentadas (Tabs). A aba ativa fica na URL (?aba=…) — quem usa decide. */
@Component({
  selector: 'mt-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mt-tabs" role="tablist" [attr.aria-label]="rotulo()" (keydown)="teclado($event)">
      @for (a of abas(); track a.id) {
        <button
          class="mt-tab"
          role="tab"
          type="button"
          [id]="'aba-' + a.id"
          [attr.aria-selected]="a.id === ativa()"
          [attr.aria-controls]="'painel-' + a.id"
          [tabIndex]="a.id === ativa() ? 0 : -1"
          (click)="trocar.emit(a.id)"
        >
          {{ a.rotulo }}
        </button>
      }
    </div>
  `,
})
export class Tabs {
  readonly abas = input.required<Aba[]>();
  readonly ativa = input.required<string>();
  readonly rotulo = input('Seções');
  readonly trocar = output<string>();
  private readonly el = inject(ElementRef<HTMLElement>);

  protected teclado(e: KeyboardEvent) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const ids = this.abas().map((a) => a.id);
    const i = ids.indexOf(this.ativa());
    const prox = ids[(i + (e.key === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length];
    this.trocar.emit(prox);
    queueMicrotask(() => (this.el.nativeElement.querySelector(`#aba-${prox}`) as HTMLElement | null)?.focus());
    e.preventDefault();
  }
}

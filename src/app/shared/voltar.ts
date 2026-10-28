import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Historico, rotuloVoltar } from '../core/historico';

/** "← Voltar": para a página de onde a pessoa veio; se chegou direto, para `padrao`. */
@Component({
  selector: 'mt-voltar',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (anterior()) {
      <button class="voltar" type="button" (click)="voltar()">← {{ rotulo() }}</button>
    } @else {
      <a class="voltar" [routerLink]="padrao()">← {{ rotuloPadrao() }}</a>
    }
  `,
  styles: `
    :host { align-self: flex-start; }
    .voltar {
      padding: 0; border: 0; background: none; cursor: pointer; text-decoration: none;
      color: var(--brand-700); font: 600 15px var(--font-sans);
    }
  `,
})
export class Voltar {
  readonly padrao = input.required<string>();
  readonly rotuloPadrao = input.required<string>();
  private readonly location = inject(Location);
  // Reativo: ao ir de um perfil para outro a página é reaproveitada, e o destino muda.
  protected readonly anterior = inject(Historico).anterior;
  protected readonly rotulo = computed(() => rotuloVoltar(this.anterior() ?? ''));

  protected voltar() {
    this.location.back();
  }
}

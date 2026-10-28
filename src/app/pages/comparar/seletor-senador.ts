import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import type { Cadeira } from '../../core/models';
import { ufNome } from '../../core/format';
import { Avatar } from '../../shared/avatar';

export interface Opcao extends Cadeira {
  saiu: boolean;
}

const normalizar = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** Busca um senador por nome, partido ou estado; com um escolhido, mostra o cartão e "Trocar". */
@Component({
  selector: 'mt-seletor-senador',
  imports: [Avatar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (escolhido(); as e) {
      <div class="escolhido">
        <mt-avatar [nome]="e.nome" [partido]="e.partido" [foto]="foto()" />
        <span class="mt-stack nome">
          <span class="nome__texto">{{ e.nome }}</span>
          <span class="nome__sub">{{ e.partido }} · {{ ufNome(e.uf) }}@if (e.saiu) { · saiu}</span>
        </span>
        <button class="mt-btn mt-btn--ghost mt-btn--sm" type="button" (click)="trocar.emit()">Trocar</button>
      </div>
    } @else {
      <label class="mt-sr" [for]="id()">{{ rotulo() }}</label>
      <input [id]="id()" class="mt-search" type="search" autocomplete="off" [placeholder]="rotulo()"
        [value]="termo()" (input)="termo.set($any($event.target).value)" />
      @if (termo().trim()) {
        <ul class="opcoes" role="listbox" [attr.aria-label]="rotulo()">
          @for (o of resultados(); track o.codigo) {
            <li>
              <button type="button" class="opcao" (click)="escolher.emit(o.codigo); termo.set('')">
                <mt-avatar [nome]="o.nome" [partido]="o.partido" />
                <span class="mt-stack nome">
                  <span class="nome__texto">{{ o.nome }}</span>
                  <span class="nome__sub">{{ o.partido }} · {{ ufNome(o.uf) }}@if (o.saiu) { · saiu}</span>
                </span>
              </button>
            </li>
          } @empty {
            <li class="vazio">Ninguém com esse nome, partido ou estado.</li>
          }
        </ul>
      }
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 8px; min-width: 0; position: relative; }
    .escolhido { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 2px solid var(--line); border-radius: var(--radius-lg); }
    .nome { gap: 0; min-width: 0; flex: 1; }
    .nome__texto { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .nome__sub { font-size: 13px; color: var(--ink-muted); }
    .opcoes { list-style: none; margin: 0; padding: 6px; display: flex; flex-direction: column; gap: 2px; border: 2px solid var(--line); border-radius: var(--radius-lg); background: var(--surface); max-height: 320px; overflow-y: auto; }
    .opcao { width: 100%; display: flex; align-items: center; gap: 10px; padding: 6px 8px; border: 0; border-radius: var(--radius-md); background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
    .opcao:hover, .opcao:focus-visible { background: var(--brand-100); }
    :host ::ng-deep .opcao .mt-avatar, :host ::ng-deep .escolhido .mt-avatar { width: 40px; height: 40px; font-size: 14px; }
    .vazio { padding: 8px; font-size: 14px; color: var(--ink-muted); }
  `,
})
export class SeletorSenador {
  readonly opcoes = input.required<Opcao[]>();
  readonly selecionado = input<string | null>(null);
  readonly foto = input<string | null>(null);
  readonly rotulo = input('Buscar senador');
  readonly id = input('seletor-senador');
  readonly escolher = output<string>();
  readonly trocar = output<void>();

  protected readonly termo = signal('');
  protected readonly ufNome = ufNome;
  protected readonly escolhido = computed(() => this.opcoes().find((o) => o.codigo === this.selecionado()) ?? null);
  protected readonly resultados = computed(() => {
    const t = normalizar(this.termo().trim());
    if (!t) return [];
    return this.opcoes()
      .filter((o) => normalizar(`${o.nome} ${o.partido} ${o.uf} ${ufNome(o.uf)}`).includes(t))
      .sort((x, y) => Number(x.saiu) - Number(y.saiu) || x.nome.localeCompare(y.nome, 'pt-BR'))
      .slice(0, 8);
  });
}

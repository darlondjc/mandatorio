import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type FormaEsqueleto = 'senado' | 'perfil' | 'ranking' | 'grafico' | 'lista' | 'duelo' | 'votacao';

/**
 * Esqueleto de carregamento: blocos cinza no formato da tela que vai aparecer, com um brilho
 * passando (parado com movimento reduzido). Diz a leitores de tela o que está carregando.
 */
@Component({
  selector: 'mt-esqueleto',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'status', 'aria-live': 'polite', '[attr.aria-busy]': 'true' },
  template: `
    <span class="mt-sr">{{ texto() }}</span>
    <div class="esq" aria-hidden="true">
      @switch (forma()) {
        @case ('senado') {
          <div class="caixa plenario">
            <span class="osso" style="width: 34%; height: 22px"></span>
            <span class="osso arco"></span>
            <div class="fila centro">
              @for (i of n(7); track i) { <span class="osso chip"></span> }
            </div>
          </div>
          <span class="osso" style="width: 180px; height: 22px"></span>
          <div class="grade">
            @for (i of n(6); track i) {
              <div class="cartao fila"><span class="osso bola"></span><span class="col"><span class="osso" style="width: 70%"></span><span class="osso fino" style="width: 45%"></span></span></div>
            }
          </div>
        }
        @case ('perfil') {
          <div class="fila topo">
            <span class="osso foto"></span>
            <span class="col cresce">
              <span class="fila"><span class="osso chip"></span><span class="osso chip"></span><span class="osso chip"></span></span>
              <span class="osso titulo"></span>
              <span class="osso fino" style="width: 60%"></span>
            </span>
          </div>
          <span class="osso" style="height: 46px; border-radius: 14px"></span>
          <div class="quatro">
            @for (i of n(4); track i) { <span class="osso stat"></span> }
          </div>
          <div class="col">
            @for (i of n(4); track i) { <span class="osso linha"></span> }
          </div>
        }
        @case ('ranking') {
          <div class="fila">@for (i of n(4); track i) { <span class="osso chip largo"></span> }</div>
          <span class="osso" style="height: 96px; border-radius: 20px"></span>
          <div class="col">
            @for (i of n(8); track i) {
              <div class="cartao fila"><span class="osso bola"></span><span class="col cresce"><span class="osso" style="width: 50%"></span><span class="osso barra"></span></span><span class="osso" style="width: 56px; height: 20px"></span></div>
            }
          </div>
        }
        @case ('grafico') {
          <div class="fila">@for (i of n(6); track i) { <span class="osso chip largo"></span> }</div>
          <div class="caixa">
            <span class="osso" style="width: 40%; height: 22px"></span>
            <span class="osso fino" style="width: 25%"></span>
            <span class="osso area"></span>
            <div class="sete">@for (i of n(7); track i) { <span class="osso media"></span> }</div>
          </div>
        }
        @case ('duelo') {
          <div class="fila entre">
            <span class="col centro"><span class="osso foto"></span><span class="osso" style="width: 120px"></span></span>
            <span class="col centro"><span class="osso foto"></span><span class="osso" style="width: 120px"></span></span>
          </div>
          <div class="col">@for (i of n(5); track i) { <span class="osso linha"></span> }</div>
        }
        @case ('votacao') {
          <span class="osso titulo" style="width: 70%"></span>
          <span class="osso fino" style="width: 90%"></span>
          <span class="osso fino" style="width: 50%"></span>
          <div class="caixa plenario"><span class="osso arco"></span></div>
        }
        @default {
          <div class="col">@for (i of n(5); track i) { <span class="osso linha"></span> }</div>
        }
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .esq { display: flex; flex-direction: column; gap: var(--space-4); }
    .osso {
      display: block; height: 14px; border-radius: 8px;
      background: linear-gradient(90deg, var(--line) 30%, var(--surface) 50%, var(--line) 70%);
      background-size: 300% 100%;
      animation: brilho 1.4s ease-in-out infinite;
    }
    .fino { height: 11px; }
    .titulo { width: 55%; height: 30px; }
    .bola { width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0; }
    .foto { width: 120px; height: 120px; border-radius: 50%; flex-shrink: 0; }
    .chip { width: 64px; height: 26px; border-radius: 999px; }
    .chip.largo { width: 96px; height: 34px; }
    .stat { height: 112px; border-radius: 20px; }
    .linha { height: 64px; border-radius: 16px; }
    .barra { height: 10px; border-radius: 999px; }
    .area { height: 220px; border-radius: 12px; }
    .media { height: 64px; border-radius: 14px; }
    .arco { width: min(560px, 100%); aspect-ratio: 2 / 1; height: auto; margin-inline: auto; border-radius: 999px 999px 12px 12px; }
    .fila { display: flex; gap: var(--space-3); align-items: center; flex-wrap: wrap; }
    .fila.centro { justify-content: center; }
    .fila.entre { justify-content: space-around; }
    .col { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
    .col.centro { align-items: center; }
    .cresce { flex: 1; }
    .topo { flex-wrap: nowrap; gap: var(--space-5); }
    .caixa { display: flex; flex-direction: column; gap: 14px; padding: var(--space-5); border-radius: 24px; background: var(--brand-100); }
    .caixa .osso { background: linear-gradient(90deg, var(--surface) 30%, var(--brand-100) 50%, var(--surface) 70%); background-size: 300% 100%; }
    .plenario { gap: var(--space-4); }
    .cartao { padding: 12px 16px; border: 2px solid var(--line); border-radius: 16px; flex-wrap: nowrap; }
    .cartao .col { flex: 1; }
    .grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: var(--space-3); }
    .quatro { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
    .sete { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
    @keyframes brilho { from { background-position: 100% 0; } to { background-position: 0 0; } }
    @media (prefers-reduced-motion: reduce) { .osso { animation: none; } }
    @media (max-width: 720px) {
      .foto { width: 92px; height: 92px; }
      .quatro { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .sete { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .grade { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .grade .cartao { flex-direction: column; text-align: center; }
      .grade .cartao .col { width: 100%; align-items: center; }
      .area { height: 180px; }
    }
  `,
})
export class Esqueleto {
  readonly forma = input<FormaEsqueleto>('lista');
  /** O que está carregando, para leitores de tela. */
  readonly texto = input('Carregando…');
  protected n(q: number) {
    return Array.from({ length: q }, (_, i) => i);
  }
}

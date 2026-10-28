import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Cadeira, PartidoBancada } from '../core/models';
import { corPartido } from '../core/format';

export type ModoCor = 'partido' | 'genero';

// Geometria do semicírculo, em unidades de um quadro de 740 × 360.
const W = 740;
const H = 360;
const SEAT = 18;
const RAIOS = [150, 192, 234, 276, 318];
const POR_FILEIRA = [10, 13, 16, 19, 23]; // soma 81
const CX = W / 2;
const CY = H - 16;

interface Posicao {
  t: number;
  r: number;
}

/** Posições das cadeiras, ordenadas da esquerda para a direita (por ângulo). */
function posicoes(total: number): Posicao[] {
  // Mantém as 5 fileiras e redistribui se o total não for 81 (ex.: vagas em aberto).
  const soma = POR_FILEIRA.reduce((a, b) => a + b, 0);
  const contagem = POR_FILEIRA.map((n) => Math.round((n / soma) * total));
  contagem[contagem.length - 1] += total - contagem.reduce((a, b) => a + b, 0);
  const todas: Posicao[] = [];
  RAIOS.forEach((r, i) => {
    const n = contagem[i];
    for (let k = 0; k < n; k++) todas.push({ t: n === 1 ? Math.PI / 2 : Math.PI - (k * Math.PI) / (n - 1), r });
  });
  return todas.sort((a, b) => b.t - a.t || a.r - b.r);
}

@Component({
  selector: 'mt-seat-map',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mapa" role="group" [attr.aria-label]="'Plenário do Senado com ' + cadeiras().length + ' cadeiras'">
      @for (s of assentos(); track s.codigo) {
        <a
          class="mt-seat"
          [class.mt-seat--dim]="s.apagada"
          [class.mt-seat--me]="s.codigo === destaque()"
          [routerLink]="['/senado', s.codigo]"
          [style.left.%]="s.x"
          [style.top.%]="s.y"
          [style.transform]="'rotate(' + s.rot + 'deg)'"
          [style.background]="s.cor"
          [attr.aria-label]="s.rotulo"
          [title]="s.rotulo"
        ></a>
      }
      <div class="mt-seatmap__total">
        <b>{{ total() }}</b>
        <span>{{ legenda() }}</span>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .mapa { position: relative; width: 100%; max-width: 740px; margin: 0 auto; aspect-ratio: 740 / 360; container-type: inline-size; }
    .mt-seat { width: 2.43%; height: auto; aspect-ratio: 1; transition: opacity 0.15s ease; }
    .mt-seat:hover { outline: 2px solid var(--ink); outline-offset: 1px; }
    .mt-seatmap__total b { font-size: clamp(32px, 9.7cqw, 72px); }
    .mt-seatmap__total span { font-size: clamp(12px, 1.9cqw, 14px); }
  `,
})
export class SeatMap {
  readonly cadeiras = input.required<Cadeira[]>();
  readonly partidos = input.required<PartidoBancada[]>();
  readonly modo = input<ModoCor>('partido');
  readonly filtroPartido = input<string | null>(null);
  readonly destaque = input<string | null>(null);

  protected readonly assentos = computed(() => {
    const ordem = new Map(this.partidos().map((p, i) => [p.sigla, i]));
    const ordenadas = [...this.cadeiras()].sort(
      (a, b) => (ordem.get(a.partido) ?? 99) - (ordem.get(b.partido) ?? 99) || a.nome.localeCompare(b.nome),
    );
    const pos = posicoes(ordenadas.length);
    const filtro = this.filtroPartido();
    return ordenadas.map((c, i) => {
      const p = pos[i];
      const x = CX + p.r * Math.cos(p.t) - SEAT / 2;
      const y = CY - p.r * Math.sin(p.t) - SEAT / 2;
      return {
        codigo: c.codigo,
        x: (x / W) * 100,
        y: (y / H) * 100,
        rot: 90 - (p.t * 180) / Math.PI,
        cor: this.modo() === 'genero' ? (c.sexo === 'F' ? 'var(--coral-500)' : 'var(--abstain)') : corPartido(c.partido),
        apagada: !!filtro && c.partido !== filtro,
        rotulo: `${c.nome}, ${c.partido}–${c.uf}`,
      };
    });
  });

  protected readonly total = computed(() => {
    const f = this.filtroPartido();
    return f ? this.cadeiras().filter((c) => c.partido === f).length : this.cadeiras().length;
  });

  protected readonly legenda = computed(() => {
    const f = this.filtroPartido();
    if (f) return `cadeiras do ${f}`;
    if (this.modo() === 'genero') {
      const m = this.cadeiras().filter((c) => c.sexo === 'F').length;
      return `cadeiras · ${m} ocupadas por mulheres`;
    }
    return 'cadeiras';
  });
}

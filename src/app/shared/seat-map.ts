import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
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
          [class.realce]="s.codigo === ativo()"
          [routerLink]="['/senado', s.codigo]"
          [style.left.%]="s.x"
          [style.top.%]="s.y"
          [style.transform]="'rotate(' + s.rot + 'deg)'"
          [style.background]="s.cor"
          [attr.aria-label]="s.rotulo"
          (mouseenter)="sobre.set(s.codigo)"
          (mouseleave)="sobre.set(null)"
          (focus)="sobre.set(s.codigo)"
          (blur)="sobre.set(null)"
        ></a>
      }
      @if (balao(); as b) {
        <div class="balao" aria-hidden="true" [style.left.%]="b.x" [style.top.%]="b.y" [style.--desloc]="b.desloc">
          <strong>{{ b.nome }}</strong>
          <span>{{ b.sub }}</span>
        </div>
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
    .mt-seat:hover, .mt-seat.realce { outline: 3px solid var(--ink); outline-offset: 2px; z-index: 1; }
    /* O número central fica por cima das cadeiras de baixo: não pode capturar o mouse. */
    .mt-seatmap__total { pointer-events: none; }
    .balao {
      position: absolute; z-index: 2; pointer-events: none;
      transform: translate(var(--desloc, -50%), calc(-100% - 10px));
      display: flex; flex-direction: column; gap: 1px; width: max-content; max-width: 240px;
      padding: 8px 12px; border-radius: var(--radius-md);
      background: var(--ink); color: var(--on-ink); font: 400 12px/1.35 var(--font-sans);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
    }
    .balao strong { font-size: 14px; font-weight: 600; }
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
  /** Cadeira a realçar por fora (ex.: o senador sob o mouse na lista). */
  readonly realce = input<string | null>(null);

  /** Cadeira sob o mouse ou com foco do teclado. */
  protected readonly sobre = signal<string | null>(null);
  protected readonly ativo = computed(() => this.sobre() ?? this.realce());

  protected readonly balao = computed(() => {
    const cod = this.ativo();
    const s = cod ? this.assentos().find((a) => a.codigo === cod) : null;
    if (!s) return null;
    const c = this.cadeiras().find((x) => x.codigo === cod)!;
    const meio = SEAT / 2 / W * 100;
    // Perto das bordas, o balão se apoia para dentro para não sair do quadro.
    const desloc = s.x < 12 ? '-12%' : s.x > 86 ? '-88%' : '-50%';
    return { x: s.x + meio, y: s.y, nome: c.nome, sub: `${c.partido} · ${c.uf}`, desloc };
  });

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

import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, input, signal } from '@angular/core';
import { donoDoAno, fimEfetivo, formatarIndicador, MandatoLinha, valoresDaSerie } from '../core/mandatos';
import type { SerieIndicador } from '../core/models';

const ALTURA = 300, ALTURA_MOBILE = 260, BASE = 24;

/** Passo "redondo" para a grade: 1, 2, 2,5 ou 5 vezes uma potência de 10. */
function passoRedondo(amplitude: number, linhas = 4): number {
  const bruto = amplitude / linhas, pot = 10 ** Math.floor(Math.log10(bruto));
  return [1, 2, 2.5, 5, 10].map((f) => f * pot).find((p) => p >= bruto) ?? pot * 10;
}

const anoDecimal = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`), ini = Date.UTC(d.getUTCFullYear(), 0, 1);
  return d.getUTCFullYear() + (d.getTime() - ini) / (Date.UTC(d.getUTCFullYear() + 1, 0, 1) - ini);
};

/**
 * Linha anual de um indicador com os mandatos presidenciais como faixas ao fundo. Uma
 * leitura acima do gráfico mostra o ano sob o dedo/mouse (ou o último, sem interação);
 * as setas do teclado andam pelos anos.
 */
@Component({
  selector: 'mt-grafico-mandatos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (leitura(); as l) {
      <p class="leitura" aria-live="polite">
        <strong>{{ l.valor }}</strong> em {{ l.ano }}@if (l.parcial) { (até agora)}@if (l.mandato) { · {{ l.mandato }}}
      </p>
    }
    <svg
      [attr.viewBox]="'0 0 ' + largura() + ' ' + altura()"
      [attr.height]="altura()"
      role="img"
      tabindex="0"
      [attr.aria-label]="rotuloAcessivel()"
      (pointermove)="aoMover($event)"
      (pointerleave)="ativo.set(null)"
      (keydown)="aoTeclar($event)"
    >
      @for (f of g().faixas; track f.chave) {
        <rect class="faixa" [class.faixa--par]="f.par" [class.faixa--destaque]="f.destaque" [class.faixa--apagada]="f.apagada"
          [attr.x]="f.x" [attr.y]="g().topoFaixa" [attr.width]="f.w" [attr.height]="g().alturaFaixa" rx="6" />
      }
      @for (f of g().faixas; track f.chave) {
        @if (f.rotulo) {
          <text class="faixa__rotulo" [class.faixa__rotulo--destaque]="f.destaque" [attr.x]="f.x + f.w / 2" [attr.y]="f.yRotulo" text-anchor="middle">{{ f.rotulo }}</text>
        }
      }
      @for (t of g().grade; track t.v) {
        <line class="grade" [class.grade--zero]="t.v === 0" [attr.x1]="g().esq" [attr.x2]="largura()" [attr.y1]="t.y" [attr.y2]="t.y" />
        <text class="eixo" [attr.x]="g().esq - 6" [attr.y]="t.y + 4" text-anchor="end">{{ t.rotulo }}</text>
      }
      @for (t of g().anosEixo; track t.ano) {
        <text class="eixo" [attr.x]="t.x" [attr.y]="altura() - 6" [attr.text-anchor]="t.ancora">{{ t.ano }}</text>
      }
      @if (g().antiga) {
        <path class="serie serie--antiga" [attr.d]="g().antiga" />
      }
      <path class="serie" [attr.d]="g().linha" />
      @for (p of g().parciais; track p.ano) {
        <circle class="ponto ponto--parcial" [attr.cx]="p.x" [attr.cy]="p.y" r="4" />
      }
      @if (marcado(); as m) {
        <line class="cruz" [attr.x1]="m.x" [attr.x2]="m.x" [attr.y1]="g().topo - 6" [attr.y2]="altura() - BASE" />
        <circle class="ponto" [attr.cx]="m.x" [attr.cy]="m.y" r="5" />
      }
    </svg>
  `,
  styles: `
    :host { display: block; position: relative; }
    .leitura { margin: 0 0 6px; font-size: 14px; color: var(--ink-muted); min-height: 26px; }
    .leitura strong { font: 500 20px var(--font-display); color: var(--ink); font-variant-numeric: tabular-nums; }
    svg { display: block; width: 100%; overflow: visible; touch-action: pan-y; outline: none; }
    svg:focus-visible { outline: 2px solid var(--brand-700); outline-offset: 4px; border-radius: 8px; }
    .faixa { fill: var(--surface); }
    .faixa--par { fill: var(--surface); opacity: 0.55; }
    .faixa--apagada { opacity: 0.25; }
    .faixa--destaque { opacity: 1; stroke: var(--brand-700); stroke-width: 2; }
    .faixa__rotulo { font: 600 12px var(--font-sans); fill: var(--ink-muted); }
    .faixa__rotulo--destaque { fill: var(--brand-700); }
    .grade { stroke: var(--line); stroke-width: 1; }
    .grade--zero { stroke: var(--ink-muted); opacity: 0.5; }
    .eixo { font: 500 11px var(--font-sans); fill: var(--ink-muted); font-variant-numeric: tabular-nums; }
    .serie { fill: none; stroke: var(--brand-700); stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
    .serie--antiga { stroke-dasharray: 5 5; opacity: 0.75; }
    .ponto { fill: var(--brand-700); stroke: var(--surface); stroke-width: 2; }
    .ponto--parcial { fill: var(--surface); stroke: var(--brand-700); stroke-width: 2; }
    .cruz { stroke: var(--ink); stroke-width: 1; stroke-dasharray: 3 3; opacity: 0.5; }
  `,
})
export class GraficoMandatos {
  readonly serie = input.required<SerieIndicador>();
  readonly mandatos = input.required<MandatoLinha[]>();
  readonly corrigido = input(false);
  /** Mandato em destaque (os outros ficam apagados). */
  readonly destaque = input<string | null>(null);

  protected readonly BASE = BASE;
  protected readonly largura = signal(800);
  protected readonly altura = computed(() => (this.largura() < 600 ? ALTURA_MOBILE : ALTURA));
  protected readonly ativo = signal<number | null>(null);

  constructor() {
    const el = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
    const obs = new ResizeObserver(([e]) => this.largura.set(Math.max(280, Math.round(e.contentRect.width))));
    obs.observe(el);
    inject(DestroyRef).onDestroy(() => obs.disconnect());
  }

  private readonly valores = computed(() => valoresDaSerie(this.serie(), this.corrigido()));
  private readonly anos = computed(() => Object.keys(this.valores()).map(Number).sort((a, b) => a - b));

  protected readonly g = computed(() => {
    const L = this.largura(), H = this.altura(), mob = L < 600;
    const s = this.serie(), v = this.valores(), anos = this.anos(), mandatos = this.mandatos(), destaque = this.destaque();
    const topo = mob ? 46 : 32, esq = mob ? 40 : 52;
    const x0 = Math.min(anos[0] ?? 2003, anoDecimal(mandatos[0]?.inicio ?? '2003-01-01'));
    const x1 = Math.max((anos.at(-1) ?? 2025) + 1, ...mandatos.map((m) => anoDecimal(fimEfetivo(m))));
    const X = (t: number) => esq + ((t - x0) / (x1 - x0)) * (L - esq);
    const vals = anos.map((a) => v[a]);
    const min = Math.min(0, ...vals), max = Math.max(...vals) * 1.1 || 1;
    const passo = passoRedondo(max - min);
    const lo = Math.floor(min / passo) * passo, hi = Math.ceil(max / passo) * passo;
    const Y = (val: number) => topo + (1 - (val - lo) / (hi - lo)) * (H - topo - BASE);

    const faixas = mandatos.map((m, i) => {
      const x = X(Math.max(x0, anoDecimal(m.inicio))), w = Math.max(0, X(anoDecimal(fimEfetivo(m))) - x - 2);
      const cabe = (t: string) => t.length * 7 + 6 <= w;
      const rotulo = cabe(m.curto) ? m.curto : cabe(m.sigla) || w > 12 ? m.sigla : '';
      return {
        chave: m.chave, x, w, par: i % 2 === 1, rotulo,
        yRotulo: mob && i % 2 === 1 ? topo - 26 : topo - 9,
        destaque: destaque === m.chave, apagada: !!destaque && destaque !== m.chave,
      };
    });
    const grade = [];
    for (let t = lo; t <= hi + passo / 2; t += passo) {
      const rot = s.unidade === '%' ? `${+t.toFixed(2)}%` : t >= 1000 ? `${+(t / 1000).toFixed(1)} mil` : String(+t.toFixed(2));
      grade.push({ v: +t.toFixed(6), y: Y(t), rotulo: `${s.unidade === 'R$' ? 'R$ ' : ''}${rot.replace('.', ',')}` });
    }
    const marcos = mob ? [Math.ceil(x0), 2011, 2019, Math.floor(x1 - 0.01)] : [Math.ceil(x0), 2007, 2011, 2015, 2019, 2023, Math.floor(x1 - 0.01)];
    const anosEixo = [...new Set(marcos)].filter((a) => a >= x0 && a <= x1).map((a, i, arr) => ({ ano: a, x: X(a), ancora: i === 0 ? 'start' : i === arr.length - 1 ? 'end' : 'middle' }));
    const ponto = (a: number) => ({ ano: a, x: X(a + 0.5), y: Y(v[a]) });
    const caminho = (lista: number[]) => {
      let d = '', anterior: number | null = null;
      for (const a of lista) {
        const p = ponto(a);
        d += `${anterior !== null && a === anterior + 1 ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
        anterior = a;
      }
      return d;
    };
    const corte = s.metodologiaAntigaAte;
    return {
      topo, esq, faixas, grade, anosEixo,
      topoFaixa: topo - (mob ? 42 : 24),
      alturaFaixa: H - BASE - topo + (mob ? 42 : 24),
      linha: caminho(corte ? anos.filter((a) => a > corte) : anos),
      antiga: corte ? caminho(anos.filter((a) => a <= corte)) : '',
      parciais: anos.filter((a) => s.parciais.includes(String(a))).map(ponto),
      ponto, x0, x1, X,
    };
  });

  /** Ano marcado: o do ponteiro ou, sem interação, nenhum (a leitura mostra o último). */
  protected readonly marcado = computed(() => {
    const a = this.ativo();
    return a === null || this.valores()[a] === undefined ? null : this.g().ponto(a);
  });

  protected readonly leitura = computed(() => {
    const anos = this.anos();
    const a = this.ativo() ?? anos.at(-1);
    if (a === undefined) return null;
    const s = this.serie();
    return {
      ano: a,
      valor: formatarIndicador(this.valores()[a], s),
      parcial: s.parciais.includes(String(a)),
      mandato: donoDoAno(a, this.mandatos())?.curto ?? null,
    };
  });

  protected readonly rotuloAcessivel = computed(() => {
    const s = this.serie(), anos = this.anos();
    return `${s.titulo}, de ${anos[0]} a ${anos.at(-1)}, com os mandatos presidenciais ao fundo. Use as setas para percorrer os anos.`;
  });

  protected aoMover(e: PointerEvent) {
    const svg = e.currentTarget as SVGSVGElement, r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * this.largura();
    const { X } = this.g();
    let melhor: number | null = null, dist = Infinity;
    for (const a of this.anos()) {
      const d = Math.abs(X(a + 0.5) - x);
      if (d < dist) [melhor, dist] = [a, d];
    }
    this.ativo.set(melhor);
  }

  protected aoTeclar(e: KeyboardEvent) {
    const anos = this.anos();
    if (!anos.length || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const i = anos.indexOf(this.ativo() ?? anos.at(-1)!);
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? anos.length - 1 : Math.max(0, Math.min(anos.length - 1, i + (e.key === 'ArrowLeft' ? -1 : 1)));
    this.ativo.set(anos[j]);
  }
}

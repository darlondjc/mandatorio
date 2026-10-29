import { ChangeDetectionStrategy, Component, computed, inject, input, resource } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DataSource } from '../../core/data-source';
import { data } from '../../core/format';
import { donoDoAno, formatarFaixa, formatarIndicador, listaMandatos, periodoDosAnos, resumoNoMandato, valoresDaSerie } from '../../core/mandatos';
import { Carregando } from '../../shared/carregando';
import { GraficoMandatos } from '../../shared/grafico-mandatos';

/** O país em cada mandato: um indicador por vez, com os mandatos ao fundo. */
@Component({
  selector: 'mt-indicadores-page',
  imports: [Carregando, RouterLink, GraficoMandatos],
  templateUrl: './indicadores-page.html',
  styleUrl: './indicadores-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndicadoresPage {
  private readonly ds = inject(DataSource);
  private readonly router = inject(Router);

  /** ?indicador=desemprego&valor=epoca */
  readonly indicador = input<string>();
  readonly valor = input<string>();

  protected readonly dados = resource({ loader: () => Promise.all([this.ds.indicadores(), this.ds.presidentes()]) });
  protected readonly series = computed(() => this.dados.value()?.[0]?.series ?? []);
  protected readonly mandatos = computed(() => listaMandatos(this.dados.value()?.[1] ?? []));
  protected readonly serie = computed(() => this.series().find((s) => s.id === this.indicador()) ?? this.series()[0] ?? null);
  /** Valores em reais vêm corrigidos pela inflação, a não ser que se peça o da época. */
  protected readonly corrigido = computed(() => !!this.serie()?.reais && this.valor() !== 'epoca');

  protected readonly medias = computed(() => {
    const s = this.serie();
    if (!s) return [];
    return this.mandatos().map((m) => {
      const r = resumoNoMandato(s, m, this.mandatos(), this.corrigido());
      const valor =
        r.media === null ? null
        : s.tipo === 'taxa' || r.anos.length === 1 ? formatarIndicador(r.media, s)
        : formatarFaixa(r.inicio!.valor, r.fim!.valor, s);
      return { m, valor, nota: r.media === null ? 'sem dados' : `${s.tipo === 'taxa' ? 'média ' : ''}${periodoDosAnos(r.anos)}${r.parcial ? ' (parcial)' : ''}` };
    });
  });

  protected readonly tabela = computed(() => {
    const s = this.serie();
    if (!s) return [];
    const v = valoresDaSerie(s, this.corrigido());
    return Object.keys(v)
      .map(Number)
      .sort((a, b) => b - a)
      .map((a) => ({ ano: a, valor: formatarIndicador(v[a], s), epoca: s.reais ? formatarIndicador(s.anos[a], s) : null, mandato: donoDoAno(a, this.mandatos())?.curto ?? '—', parcial: s.parciais.includes(String(a)) }));
  });

  protected readonly data = data;

  protected trocar(id: string) {
    this.router.navigate([], { queryParams: { indicador: id === this.series()[0]?.id ? null : id }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected trocarValor(epoca: boolean) {
    this.router.navigate([], { queryParams: { valor: epoca ? 'epoca' : null }, queryParamsHandling: 'merge', replaceUrl: true });
  }
}

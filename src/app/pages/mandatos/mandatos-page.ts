import { ChangeDetectionStrategy, Component, computed, inject, input, resource } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DataSource } from '../../core/data-source';
import { anoFinal, listaMandatos, MandatoLinha } from '../../core/mandatos';
import { Avatar } from '../../shared/avatar';
import { Esqueleto } from '../../shared/esqueleto';
import { Voltar } from '../../shared/voltar';
import { CRITERIOS_ATUACAO, criteriosDoPais } from './criterios';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Os mandatos presidenciais lado a lado, um critério por vez (mesmo padrão dos rankings). */
@Component({
  selector: 'mt-mandatos-page',
  imports: [Esqueleto, RouterLink, Avatar, Voltar],
  templateUrl: './mandatos-page.html',
  styleUrl: './mandatos-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MandatosPage {
  private readonly ds = inject(DataSource);
  private readonly router = inject(Router);

  /** ?criterio=desemprego&ordem=asc */
  readonly criterio = input<string>();
  readonly ordem = input<string>();

  protected readonly dados = resource({ loader: () => Promise.all([this.ds.presidentes(), this.ds.indicadores().catch(() => null)]) });
  protected readonly mandatos = computed(() => listaMandatos(this.dados.value()?.[0] ?? []));
  protected readonly criterios = computed(() => [...CRITERIOS_ATUACAO, ...criteriosDoPais(this.dados.value()?.[1]?.series ?? [])]);
  protected readonly atuacao = computed(() => this.criterios().filter((c) => c.grupo === 'atuacao'));
  protected readonly pais = computed(() => this.criterios().filter((c) => c.grupo === 'pais'));
  protected readonly atual = computed(() => this.criterios().find((c) => c.id === this.criterio()) ?? this.criterios()[0]);
  protected readonly crescente = computed(() => this.ordem() === 'asc');

  protected readonly periodo = computed(() => {
    const ms = this.mandatos(), hoje = new Date();
    return ms.length ? `${ms[0].inicio.slice(0, 4)} a ${MESES[hoje.getMonth()]}/${hoje.getFullYear()}` : '';
  });

  protected readonly classificacao = computed(() => {
    const c = this.atual(), todos = this.mandatos();
    const com: { m: MandatoLinha; v: number; nota: string }[] = [], sem: MandatoLinha[] = [];
    for (const m of todos) {
      const r = c.valor(m, todos);
      if (r.v === null || !Number.isFinite(r.v)) sem.push(m);
      else com.push({ m, v: r.v, nota: r.nota });
    }
    com.sort((a, b) => (this.crescente() ? a.v - b.v : b.v - a.v) || a.m.inicio.localeCompare(b.m.inicio));
    const vs = com.map((l) => l.v);
    const lo = c.escala === 'pct' ? 0 : Math.min(0, ...vs), hi = c.escala === 'pct' ? 100 : Math.max(0, ...vs) || 1;
    const X = (v: number) => ((v - lo) / (hi - lo)) * 100;
    const media = vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null;
    return {
      linhas: com.map((l, i) => ({ ...l, pos: i + 1, esq: X(Math.min(0, l.v)), larg: Math.abs(X(l.v) - X(0)) })),
      sem, media, mediaX: media === null ? null : X(media), zeroX: lo < 0 ? X(0) : null,
    };
  });

  protected readonly curto = (m: MandatoLinha) => m.curto;
  protected readonly anoFinal = anoFinal;

  protected trocar(id: string) {
    this.router.navigate([], { queryParams: { criterio: id === this.criterios()[0].id ? null : id, ordem: null }, replaceUrl: true });
  }

  protected trocarOrdem(asc: boolean) {
    this.router.navigate([], { queryParams: { ordem: asc ? 'asc' : null }, queryParamsHandling: 'merge', replaceUrl: true });
  }
}

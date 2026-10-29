import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, resource, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DataSource } from '../../core/data-source';
import { Esqueleto } from '../../shared/esqueleto';
import { data, pctExibido, ROTULO_VOTO, ufNome } from '../../core/format';
import { linhaRanking } from '../../core/ranking';
import { perfilTematico, VOLTADO_A } from '../../core/temas';
import { DescricaoCurtaPipe } from '../../shared/descricao-curta';
import { Avatar, Photo } from '../../shared/avatar';
import { compararCriterios, concordancia } from './comparacao';
import { criterioGastos, CRITERIOS } from '../rankings/criterios';
import { Opcao, SeletorSenador } from './seletor-senador';

@Component({
  selector: 'mt-comparar-page',
  imports: [Esqueleto, RouterLink, Photo, Avatar, SeletorSenador, DescricaoCurtaPipe],
  templateUrl: './comparar-page.html',
  styleUrl: './comparar-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompararPage {
  private readonly ds = inject(DataSource);
  private readonly router = inject(Router);

  /** ?a=…&b=…: os dois senadores, para dar para compartilhar a comparação. */
  readonly a = input<string>();
  readonly b = input<string>();

  protected readonly plenario = resource({ loader: () => this.ds.plenario() });
  protected readonly ranking = resource({ loader: () => this.ds.ranking() });
  protected readonly senadorA = resource({ params: () => this.a() || undefined, loader: ({ params }) => this.ds.senador(params) });
  protected readonly senadorB = resource({ params: () => this.b() || undefined, loader: ({ params }) => this.ds.senador(params) });
  protected readonly votosA = resource({ params: () => this.a() || undefined, loader: ({ params }) => this.ds.votos(params, 100_000) });
  protected readonly votosB = resource({ params: () => this.b() || undefined, loader: ({ params }) => this.ds.votos(params, 100_000) });
  protected readonly projetosA = resource({ params: () => this.a() || undefined, loader: ({ params }) => this.ds.proposicoes(params) });
  protected readonly projetosB = resource({ params: () => this.b() || undefined, loader: ({ params }) => this.ds.proposicoes(params) });

  protected readonly data = data;
  protected readonly ufNome = ufNome;
  protected readonly rotuloVoto = ROTULO_VOTO;
  protected readonly voltadoA = VOLTADO_A;
  protected readonly exibirDiscordancias = signal(10);

  /** As fotos grandes; quando saem da tela por cima, aparece o cabeçalho fixo com as duas. */
  private readonly duelo = viewChild<ElementRef<HTMLElement>>('duelo');
  protected readonly cabecalhoFixo = signal(false);

  constructor() {
    let observador: IntersectionObserver | undefined;
    inject(DestroyRef).onDestroy(() => observador?.disconnect());
    effect(() => {
      const el = this.duelo()?.nativeElement;
      observador?.disconnect();
      if (!el) {
        this.cabecalhoFixo.set(false);
        return;
      }
      // A barra do topo do celular cobre o começo da página: desconta a altura dela.
      const topo = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--altura-topo')) || 0;
      observador = new IntersectionObserver(
        ([e]) => this.cabecalhoFixo.set(!e.isIntersecting && e.boundingClientRect.top < topo),
        { rootMargin: `-${topo}px 0px 0px 0px` },
      );
      observador.observe(el);
    });
  }

  /** Em exercício primeiro; quem saiu nesta legislatura também pode ser comparado. */
  protected readonly opcoes = computed<Opcao[]>(() => {
    const p = this.plenario.value();
    if (!p) return [];
    return [...p.cadeiras.map((c) => ({ ...c, saiu: false })), ...(p.exSenadores ?? []).map((c) => ({ ...c, saiu: true }))];
  });

  /** Sugestões para o segundo: os outros dois senadores do mesmo estado. */
  protected readonly mesmoEstado = computed(() => {
    const s = this.senadorA.value();
    return s ? (this.plenario.value()?.cadeiras ?? []).filter((c) => c.uf === s.uf && c.codigo !== s.codigo) : [];
  });

  /** Ano dos gastos na comparação; null = o ano corrente da coleta. */
  protected readonly anoGastos = signal<number | null>(null);

  /** Anos em que pelo menos um dos dois tem cota registrada, do mais recente ao mais antigo. */
  protected readonly anosGastos = computed(() => {
    const [a, b] = [this.senadorA.value(), this.senadorB.value()];
    const anos = new Set([...Object.keys(a?.cotas ?? {}), ...Object.keys(b?.cotas ?? {})].map(Number));
    return [...anos].sort((x, y) => y - x);
  });

  protected readonly criterios = computed(() => {
    const [r, a, b] = [this.ranking.value(), this.senadorA.value(), this.senadorB.value()];
    if (!r || !a || !b) return [];
    const ano = this.anoGastos();
    const lista = ano == null || ano === r.cotaAno ? CRITERIOS : CRITERIOS.map((c) => (c.id === 'gastos' ? criterioGastos(ano) : c));
    return compararCriterios(r, linhaRanking(a), linhaRanking(b), lista);
  });

  protected readonly votos = computed(() => {
    const [a, b] = [this.votosA.value(), this.votosB.value()];
    return a && b ? concordancia(a, b) : null;
  });

  protected readonly perfis = computed(() => ({
    a: perfilTematico(this.projetosA.value() ?? [], this.ranking.value()?.mediaTemas ?? undefined),
    b: perfilTematico(this.projetosB.value() ?? [], this.ranking.value()?.mediaTemas ?? undefined),
  }));

  protected pct(v: number) {
    return `${pctExibido(v).toLocaleString('pt-BR')}%`;
  }

  protected escolher(lado: 'a' | 'b', codigo: string | null) {
    this.exibirDiscordancias.set(10);
    this.router.navigate([], { queryParams: { [lado]: codigo }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected inverter() {
    this.router.navigate([], { queryParams: { a: this.b() ?? null, b: this.a() ?? null }, replaceUrl: true });
  }
}

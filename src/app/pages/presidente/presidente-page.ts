import { ChangeDetectionStrategy, Component, computed, inject, input, resource, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DataSource } from '../../core/data-source';
import { Esqueleto } from '../../shared/esqueleto';
import { data, diasAte, pct } from '../../core/format';
import { formatarFaixa, formatarIndicador, listaMandatos, periodoDosAnos, resumoNoMandato, valoresDaSerie } from '../../core/mandatos';
import { EtapaProjeto, MandatoIndice, SituacaoMP, SituacaoVeto } from '../../core/models';
import { Photo } from '../../shared/avatar';
import { CabecalhoFixo } from '../../shared/cabecalho-fixo';
import { Segmento, SplitBar } from '../../shared/split-bar';
import { Aba, Tabs } from '../../shared/tabs';

const ABAS: Aba[] = [
  { id: 'projetos', rotulo: 'Projetos' },
  { id: 'medidas', rotulo: 'Medidas provisórias' },
  { id: 'vetos', rotulo: 'Vetos' },
];

export const ROTULO_MP: Record<SituacaoMP, string> = {
  tramitando: 'Em tramitação',
  lei: 'Virou lei',
  caducou: 'Perdeu a validade',
  rejeitada: 'Rejeitada',
};
export const ROTULO_VETO: Record<SituacaoVeto, string> = {
  aguardando: 'Aguardando',
  mantido: 'Mantido',
  derrubado: 'Derrubado',
  'derrubado-parcial': 'Derrubado em parte',
  prejudicado: 'Prejudicado',
};
export const ETAPAS: { id: EtapaProjeto; rotulo: string }[] = [
  { id: 'camara', rotulo: 'Câmara' },
  { id: 'senado', rotulo: 'Senado' },
  { id: 'sancao', rotulo: 'Sanção' },
  { id: 'lei', rotulo: 'Lei' },
];
/** Etapas oferecidas no filtro: as do caminho do projeto mais o arquivamento. */
const FILTRO_ETAPAS: { id: EtapaProjeto; rotulo: string }[] = [...ETAPAS, { id: 'arquivado', rotulo: 'Arquivado' }];
const PRAZO_MP_DIAS = 120;
/** Indicadores do bloco "O país no mandato", nesta ordem (os que existirem). */
const NO_MANDATO = ['inflacao', 'desemprego', 'pib', 'salarioMinimo', 'desmatamento', 'feminicidio'];

@Component({
  selector: 'mt-presidente-page',
  imports: [Esqueleto, Photo, SplitBar, Tabs, RouterLink, CabecalhoFixo],
  templateUrl: './presidente-page.html',
  styleUrl: './presidente-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PresidentePage {
  readonly presidenteId = input<string>();
  readonly mandatoId = input<string>();
  readonly aba = input<string>();

  private readonly ds = inject(DataSource);
  private readonly router = inject(Router);

  protected readonly abas = ABAS;
  protected readonly abaAtiva = computed(() => (ABAS.some((a) => a.id === this.aba()) ? this.aba()! : 'projetos'));
  protected readonly rotuloMP = ROTULO_MP;
  protected readonly rotuloVeto = ROTULO_VETO;
  protected readonly etapas = ETAPAS;
  protected readonly data = data;

  protected readonly presidentes = resource({ loader: () => this.ds.presidentes() });

  /** Todos os mandatos, do mais recente para o mais antigo. */
  protected readonly indice = computed<MandatoIndice[]>(() =>
    (this.presidentes.value() ?? [])
      .flatMap((p) => p.mandatos.map((m) => ({ presidenteId: p.id, mandatoId: m.id, nome: p.nome, inicio: m.inicio, fim: m.fim, atual: m.atual })))
      .sort((a, b) => b.inicio.localeCompare(a.inicio)),
  );

  protected readonly selecionado = computed(() => {
    const idx = this.indice();
    const alvo =
      idx.find((m) => m.presidenteId === this.presidenteId() && m.mandatoId === this.mandatoId()) ?? idx.find((m) => m.atual) ?? idx[0];
    if (!alvo) return null;
    const presidente = this.presidentes.value()!.find((p) => p.id === alvo.presidenteId)!;
    const mandato = presidente.mandatos.find((m) => m.id === alvo.mandatoId)!;
    return { presidente, mandato, chave: `${alvo.presidenteId}/${alvo.mandatoId}` };
  });

  private readonly chaveAba = (aba: string) =>
    computed(() => {
      const s = this.selecionado();
      return s && this.abaAtiva() === aba ? { p: s.presidente.id, m: s.mandato.id } : undefined;
    });

  protected readonly medidas = resource({ params: this.chaveAba('medidas'), loader: ({ params }) => this.ds.medidas(params.p, params.m) });
  protected readonly vetos = resource({ params: this.chaveAba('vetos'), loader: ({ params }) => this.ds.vetos(params.p, params.m) });
  protected readonly projetos = resource({ params: this.chaveAba('projetos'), loader: ({ params }) => this.ds.projetos(params.p, params.m) });

  protected readonly filtroMP = signal<SituacaoMP | null>(null);
  protected readonly filtroVeto = signal<SituacaoVeto | null>(null);
  protected readonly filtroEtapa = signal<EtapaProjeto | null>(null);

  protected readonly indicadores = resource({ loader: () => this.ds.indicadores().catch(() => null) });

  /**
   * O país no mandato: cada indicador resumido no mandato (média, para taxas; início e fim,
   * para níveis), comparado com o mandato anterior, e um mini gráfico com o período em destaque.
   */
  protected readonly paisNoMandato = computed(() => {
    const sel = this.selecionado(), series = this.indicadores.value()?.series ?? [];
    if (!sel || !series.length) return [];
    const mandatos = listaMandatos(this.presidentes.value() ?? []);
    const i = mandatos.findIndex((m) => m.chave === sel.chave);
    const m = mandatos[i], anterior = mandatos[i - 1] ?? null;
    if (!m) return [];
    return NO_MANDATO.map((id) => series.find((s) => s.id === id))
      .filter((s) => !!s)
      .map((s) => {
        const real = !!s.reais;
        const r = resumoNoMandato(s, m, mandatos, real);
        if (r.media === null) return null;
        const resumo = (x: typeof r) =>
          s.tipo === 'taxa' || x.anos.length === 1 ? formatarIndicador(x.media!, s) : formatarFaixa(x.inicio!.valor, x.fim!.valor, s);
        const ant = anterior ? resumoNoMandato(s, anterior, mandatos, real) : null;
        const valores = valoresDaSerie(s, real);
        const anos = Object.keys(valores).map(Number).sort((a, b) => a - b);
        const vs = anos.map((a) => valores[a]), lo = Math.min(...vs), hi = Math.max(...vs);
        const X = (a: number) => ((a - anos[0]) / Math.max(1, anos.at(-1)! - anos[0])) * 100;
        const Y = (v: number) => 30 - ((v - lo) / (hi - lo || 1)) * 26;
        return {
          id: s.id,
          rotulo: s.rotulo,
          valor: s.tipo === 'taxa' ? `${resumo(r)}${s.unidade === '%' ? ' ao ano' : ''}` : resumo(r),
          nota: [
            `${s.tipo === 'taxa' ? 'média ' : ''}${periodoDosAnos(r.anos)}${r.parcial ? ' (parcial)' : ''}`,
            ant && ant.media !== null ? `${anterior!.curto}: ${resumo(ant)}` : null,
            real ? `em R$ de ${s.referenciaReal}` : null,
          ].filter(Boolean).join(' · '),
          real: real ? s.referenciaReal : null,
          linha: anos.map((a, k) => `${k ? 'L' : 'M'}${X(a).toFixed(1)},${Y(valores[a]).toFixed(1)}`).join(''),
          faixa: { x: X(r.anos[0] - 0.5), w: X(r.anos.at(-1)! + 0.5) - X(r.anos[0] - 0.5) },
        };
      })
      .filter((x) => !!x);
  });

  protected readonly cards = computed(() => {
    const r = this.selecionado()?.mandato.resumo;
    if (!r) return null;
    return { ...r, pctMpsLei: pct(r.mpsLei, r.mps) };
  });

  protected readonly segmentosMP = computed<Segmento[]>(() => {
    const r = this.selecionado()?.mandato.resumo;
    if (!r) return [];
    return [
      { rotulo: 'viraram lei', valor: r.mpsLei, cor: 'var(--brand-700)' },
      { rotulo: 'em tramitação', valor: r.mpsTramitando, cor: 'var(--abstain)' },
      { rotulo: 'perderam a validade', valor: r.mpsCaducadas, cor: 'var(--line)' },
      { rotulo: 'rejeitadas', valor: r.mpsRejeitadas, cor: 'var(--coral-500)' },
    ];
  });

  protected readonly segmentosVeto = computed<Segmento[]>(() => {
    const r = this.selecionado()?.mandato.resumo;
    if (!r) return [];
    return [
      { rotulo: 'mantidos', valor: r.vetosMantidos, cor: 'var(--brand-700)' },
      { rotulo: 'derrubados', valor: r.vetosDerrubados, cor: 'var(--coral-500)' },
      { rotulo: 'aguardando', valor: r.vetosAguardando, cor: 'var(--line)' },
      ...(r.vetosPrejudicados ? [{ rotulo: 'prejudicados', valor: r.vetosPrejudicados, cor: 'var(--abstain)' }] : []),
    ];
  });

  protected readonly listaMP = computed(() =>
    (this.medidas.value() ?? [])
      .filter((m) => !this.filtroMP() || m.situacao === this.filtroMP())
      .map((m) => {
        const restam = m.situacao === 'tramitando' && m.prazoFinal ? Math.max(0, diasAte(m.prazoFinal)) : null;
        return {
          ...m,
          restam,
          decorrido: restam == null ? 0 : Math.min(100, Math.round(((PRAZO_MP_DIAS - Math.min(PRAZO_MP_DIAS, restam)) / PRAZO_MP_DIAS) * 100)),
          urgente: restam != null && restam <= 30,
        };
      }),
  );

  protected readonly listaVeto = computed(() => (this.vetos.value() ?? []).filter((v) => !this.filtroVeto() || v.situacao === this.filtroVeto()));

  protected readonly chipsEtapa = computed(() => {
    const lista = this.projetos.value() ?? [];
    return FILTRO_ETAPAS.map((e) => ({ ...e, total: lista.filter((p) => p.etapa === e.id).length })).filter((e) => e.total > 0);
  });

  protected readonly listaProjetos = computed(() =>
    (this.projetos.value() ?? [])
      .filter((p) => !this.filtroEtapa() || p.etapa === this.filtroEtapa())
      .map((p) => ({ ...p, passo: ETAPAS.findIndex((e) => e.id === p.etapa) })),
  );

  protected alternarEtapa(id: EtapaProjeto) {
    this.filtroEtapa.update((atual) => (atual === id ? null : id));
  }

  protected trocarMandato(chave: string) {
    const [p, m] = chave.split('/');
    const atual = this.indice().find((x) => x.atual);
    const destino = atual && atual.presidenteId === p && atual.mandatoId === m ? ['/presidente'] : ['/presidente', p, m];
    this.router.navigate(destino, { queryParamsHandling: 'preserve' });
  }

  protected trocarAba(id: string) {
    this.router.navigate([], { queryParams: { aba: id === 'projetos' ? null : id }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected classeMP(s: SituacaoMP) {
    return `mt-status mt-status--${s}`;
  }
  protected classeVeto(s: SituacaoVeto) {
    return `mt-status mt-status--${s}`;
  }
}

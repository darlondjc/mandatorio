import { ChangeDetectionStrategy, Component, computed, inject, input, resource, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DataSource } from '../../core/data-source';
import { inicioDaLegislatura, periodoExercicio } from '../../core/ranking';
import { data, dinheiro, dinheiroCurto, pct, ROTULO_VOTO, ufNome } from '../../core/format';
import { Voto, VotoSenador } from '../../core/models';
import { Photo } from '../../shared/avatar';
import { Segmento, SplitBar } from '../../shared/split-bar';
import { Aba, Tabs } from '../../shared/tabs';
import { Voltar } from '../../shared/voltar';

type FiltroVoto = 'abertas' | 'divergiu' | 'ausente' | 'secretas';

const ABAS: Aba[] = [
  { id: 'votos', rotulo: 'Como vota' },
  { id: 'projetos', rotulo: 'Projetos' },
  { id: 'gastos', rotulo: 'Gastos' },
  { id: 'comissoes', rotulo: 'Comissões' },
];

@Component({
  selector: 'mt-senador-page',
  imports: [RouterLink, Photo, SplitBar, Tabs, Voltar],
  templateUrl: './senador-page.html',
  styleUrl: './senador-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SenadorPage {
  /** Parâmetros da rota (withComponentInputBinding). */
  readonly codigo = input.required<string>();
  readonly aba = input<string>();

  private readonly ds = inject(DataSource);
  private readonly router = inject(Router);

  protected readonly abas = ABAS;
  protected readonly abaAtiva = computed(() => (ABAS.some((a) => a.id === this.aba()) ? this.aba()! : 'votos'));

  protected readonly senador = resource({ params: () => this.codigo(), loader: ({ params }) => this.ds.senador(params) });

  protected readonly limiteVotos = signal(30);
  protected readonly votos = resource({
    params: () => ({ codigo: this.codigo(), limite: this.limiteVotos() }),
    loader: ({ params }) => this.ds.votos(params.codigo, params.limite),
  });
  protected readonly projetos = resource({
    params: () => (this.abaAtiva() === 'projetos' ? this.codigo() : undefined),
    loader: ({ params }) => this.ds.proposicoes(params),
  });
  protected readonly gastos = resource({
    params: () => (this.abaAtiva() === 'gastos' ? this.codigo() : undefined),
    loader: ({ params }) => this.ds.gastos(params),
  });

  protected readonly filtro = signal<FiltroVoto>('abertas');
  protected readonly anoGasto = signal<number | null>(null);

  protected readonly data = data;
  protected readonly dinheiro = dinheiro;
  protected readonly ufNome = ufNome;
  protected readonly rotuloVoto = ROTULO_VOTO;

  protected readonly tratamento = computed(() => (this.senador.value()?.sexo === 'F' ? 'Senadora' : 'Senador'));

  /** Suplente no cargo: as datas do mandato são as da vaga, não de quando assumiu. */
  protected readonly suplente = computed(() => {
    const s = this.senador.value();
    return !!s?.emExercicio && /suplente/i.test(s.participacao ?? '') && !!s.exercicioDesde;
  });

  /** Assumiu (ou voltou ao cargo) bem depois do início do mandato. */
  protected readonly exercicioRecente = computed(() => {
    const s = this.senador.value();
    return !!s?.exercicioDesde && Date.parse(s.exercicioDesde) - Date.parse(s.mandato.inicio) > 30 * 864e5;
  });

  /**
   * Períodos em exercício, quando dizem algo além do mandato: suplentes, quem voltou de
   * licença ou quem saiu. Um titular que nunca se afastou não precisa da lista.
   */
  protected readonly periodos = computed(() => {
    const s = this.senador.value();
    const ps = s?.exercicios ?? [];
    if (!s || !ps.length) return [];
    const continuo = ps.length === 1 && !ps[0].fim && !this.exercicioRecente();
    return continuo ? [] : ps;
  });

  protected readonly cards = computed(() => {
    const s = this.senador.value();
    if (!s) return null;
    const r = s.resumo;
    const presentes = r.votacoes - r.distribuicao.ausente;
    // Quem saiu já tem a data de saída no topo do perfil.
    const periodo = s.emExercicio
      ? periodoExercicio(r.votacoes, r.votacoesLegislatura, r.primeiraVotacao, inicioDaLegislatura(s.atualizadoEm))
      : null;
    const presenca = pct(presentes, r.votacoes);
    const alinhamento = pct(r.votosComPartido, r.votosComparaveis);
    const difCota = r.cotaMediaSenado ? Math.round(((r.cotaAno - r.cotaMediaSenado) / r.cotaMediaSenado) * 100) : null;
    return {
      presenca,
      presencaNota: `${presentes} de ${r.votacoes} votações${periodo ? ` · ${periodo}` : ''}`,
      alinhamento,
      alinhamentoNota: r.mediaPartido != null ? `média do partido: ${r.mediaPartido}%` : `${r.votosComparaveis} votos comparados`,
      cota: dinheiroCurto(r.cotaAno),
      cotaRotulo: `Cota parlamentar em ${r.cotaAnoReferencia}`,
      cotaNota:
        difCota == null
          ? 'Gastos reembolsados (CEAPS)'
          : difCota === 0
            ? 'igual à média do Senado'
            : `${Math.abs(difCota)}% ${difCota < 0 ? 'abaixo' : 'acima'} da média do Senado`,
      projetos: r.proposicoes,
      projetosNota: `${r.proposicoesLei} viraram lei`,
    };
  });

  protected readonly segmentos = computed<Segmento[]>(() => {
    const d = this.senador.value()?.resumo.distribuicao;
    if (!d) return [];
    return [
      { rotulo: 'Sim', valor: d.sim, cor: 'var(--brand-700)' },
      { rotulo: 'Não', valor: d.nao, cor: 'var(--coral-500)' },
      { rotulo: 'Abstenção', valor: d.abstencao, cor: 'var(--abstain)' },
      ...(d.secreto ? [{ rotulo: 'Secreto', valor: d.secreto, cor: 'var(--brand-800)' }] : []),
      { rotulo: 'Ausente', valor: d.ausente, cor: 'var(--line)' },
    ];
  });

  protected readonly notaDivergencia = computed(() => {
    const r = this.senador.value()?.resumo;
    if (!r) return null;
    const n = r.votosComparaveis - r.votosComPartido;
    return `${n} ${n === 1 ? 'voto' : 'votos'} diferente${n === 1 ? '' : 's'} da maioria do ${this.senador.value()!.partido}`;
  });

  protected readonly votosFiltrados = computed(() => {
    const lista = this.votos.value() ?? [];
    switch (this.filtro()) {
      case 'divergiu':
        return lista.filter((v) => v.divergiu);
      case 'ausente':
        return lista.filter((v) => v.voto === 'ausente');
      case 'secretas':
        return lista.filter((v) => v.voto === 'secreto');
      default:
        // Votações secretas (indicações de autoridades) ficam num filtro próprio: o voto não é público.
        return lista.filter((v) => v.voto !== 'secreto');
    }
  });

  protected readonly gastoSelecionado = computed(() => {
    const anos = this.gastos.value() ?? [];
    return anos.find((g) => g.ano === this.anoGasto()) ?? anos[0] ?? null;
  });
  protected readonly maiorCategoria = computed(() => Math.max(1, ...(this.gastoSelecionado()?.porCategoria.map((c) => c.valor) ?? [])));
  protected readonly maiorMes = computed(() => Math.max(1, ...(this.gastoSelecionado()?.porMes ?? [])));
  protected readonly meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  protected trocarAba(id: string) {
    this.router.navigate([], { queryParams: { aba: id === 'votos' ? null : id }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected classeVoto(v: Voto) {
    return `mt-vote mt-vote--${v}`;
  }

  protected orientacao(v: VotoSenador) {
    return v.maioriaPartido ? ROTULO_VOTO[v.maioriaPartido] : 'dividida';
  }
}

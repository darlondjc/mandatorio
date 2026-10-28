import { ChangeDetectionStrategy, Component, computed, inject, input, resource, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DataSource } from '../../core/data-source';
import { data, diasAte, pct } from '../../core/format';
import { EtapaProjeto, MandatoIndice, SituacaoMP, SituacaoVeto } from '../../core/models';
import { Photo } from '../../shared/avatar';
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
};
export const ETAPAS: { id: EtapaProjeto; rotulo: string }[] = [
  { id: 'camara', rotulo: 'Câmara' },
  { id: 'senado', rotulo: 'Senado' },
  { id: 'sancao', rotulo: 'Sanção' },
  { id: 'lei', rotulo: 'Lei' },
];
const PRAZO_MP_DIAS = 120;

@Component({
  selector: 'mt-presidente-page',
  imports: [RouterLink, Photo, SplitBar, Tabs],
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

  protected readonly listaProjetos = computed(() =>
    (this.projetos.value() ?? []).map((p) => ({ ...p, passo: ETAPAS.findIndex((e) => e.id === p.etapa) })),
  );

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
    return `selo selo--${s}`;
  }
  protected classeVeto(s: SituacaoVeto) {
    return `selo selo--veto-${s}`;
  }
}

import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DataSource } from '../../core/data-source';
import { data, ROTULO_VOTO, ufNome } from '../../core/format';
import { Cadeira, PartidoBancada, Voto } from '../../core/models';
import { SeatMap } from '../../shared/seat-map';
import { Segmento, SplitBar } from '../../shared/split-bar';

/** Cor de cada voto no plenário. Ausente é a cadeira vazia. */
const COR_VOTO: Record<Voto, string> = {
  sim: 'var(--brand-700)',
  nao: 'var(--coral-500)',
  abstencao: 'var(--abstain)',
  secreto: 'var(--brand-800)',
  ausente: 'var(--surface)',
};
const ORDEM_VOTOS: Voto[] = ['sim', 'nao', 'abstencao', 'secreto', 'ausente'];

@Component({
  selector: 'mt-votacao-page',
  imports: [RouterLink, SeatMap, SplitBar],
  templateUrl: './votacao-page.html',
  styleUrl: './votacao-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VotacaoPage {
  readonly id = input.required<string>();

  private readonly ds = inject(DataSource);
  private readonly location = inject(Location);

  protected readonly votacao = resource({ params: () => this.id(), loader: ({ params }) => this.ds.votacao(params) });
  /** O plenário atual dá a ordem dos partidos e diz quem ainda tem página de senador. */
  protected readonly plenario = resource({ loader: () => this.ds.plenario() });

  protected readonly filtro = signal<Voto | null>(null);
  protected readonly realce = signal<string | null>(null);

  protected readonly data = data;
  protected readonly ufNome = ufNome;
  protected readonly rotuloVoto = ROTULO_VOTO;
  protected readonly corVoto = COR_VOTO;

  protected readonly emExercicio = computed(() => new Set(this.plenario.value()?.cadeiras.map((c) => c.codigo) ?? []));

  protected readonly cadeiras = computed<Cadeira[]>(() => {
    const sexo = new Map(this.plenario.value()?.cadeiras.map((c) => [c.codigo, c.sexo]) ?? []);
    return (this.votacao.value()?.votos ?? []).map((v) => ({ codigo: v.codigo, nome: v.nome, partido: v.partido, uf: v.uf, sexo: sexo.get(v.codigo) ?? 'M' }));
  });

  protected readonly partidos = computed<PartidoBancada[]>(() => {
    const ordem = (this.plenario.value()?.partidos ?? []).map((p) => p.sigla);
    const cont = new Map<string, number>();
    this.cadeiras().forEach((c) => cont.set(c.partido, (cont.get(c.partido) ?? 0) + 1));
    const pos = (s: string) => (ordem.includes(s) ? ordem.indexOf(s) : ordem.length);
    return [...cont].map(([sigla, total]) => ({ sigla, total })).sort((a, b) => pos(a.sigla) - pos(b.sigla) || b.total - a.total);
  });

  protected readonly cores = computed(() => Object.fromEntries((this.votacao.value()?.votos ?? []).map((v) => [v.codigo, COR_VOTO[v.voto]])));
  protected readonly detalhes = computed(() =>
    Object.fromEntries((this.votacao.value()?.votos ?? []).map((v) => [v.codigo, v.voto === 'secreto' ? 'votou' : ROTULO_VOTO[v.voto]])),
  );
  protected readonly apagadas = computed(() => {
    const f = this.filtro();
    return f ? new Set((this.votacao.value()?.votos ?? []).filter((v) => v.voto !== f).map((v) => v.codigo)) : null;
  });

  protected readonly centro = computed(() => {
    const v = this.votacao.value();
    if (!v) return null;
    if (v.secreta) return { numero: v.placar.secreto, legenda: 'senadores votaram · voto secreto' };
    return { numero: `${v.placar.sim} × ${v.placar.nao}`, legenda: 'Sim × Não' };
  });

  /** Chips da legenda: só os votos que aconteceram nesta votação. */
  protected readonly chips = computed(() => {
    const v = this.votacao.value();
    if (!v) return [];
    return ORDEM_VOTOS.filter((k) => v.placar[k] > 0).map((k) => ({ voto: k, total: v.placar[k], rotulo: k === 'secreto' ? 'Votaram' : ROTULO_VOTO[k] }));
  });

  protected readonly segmentos = computed<Segmento[]>(() => this.chips().map((c) => ({ rotulo: c.rotulo, valor: c.total, cor: c.voto === 'ausente' ? 'var(--line)' : COR_VOTO[c.voto] })));

  protected readonly bancadas = computed(() => {
    const v = this.votacao.value();
    if (!v) return [];
    return this.partidos().map((p) => {
      const votos = v.votos.filter((x) => x.partido === p.sigla);
      const conta = (k: Voto) => votos.filter((x) => x.voto === k).length;
      const sim = conta('sim');
      const nao = conta('nao');
      return {
        sigla: p.sigla,
        total: votos.length,
        sim,
        nao,
        abstencao: conta('abstencao'),
        ausente: conta('ausente'),
        maioria: sim === nao ? 'Dividida' : sim > nao ? 'Sim' : 'Não',
      };
    });
  });

  protected readonly lista = computed(() => {
    const f = this.filtro();
    return (this.votacao.value()?.votos ?? []).filter((v) => !f || v.voto === f);
  });

  protected alternarFiltro(v: Voto) {
    this.filtro.update((atual) => (atual === v ? null : v));
  }

  protected voltar() {
    this.location.back();
  }
}

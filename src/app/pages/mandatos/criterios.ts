import { anosDeMandato, formatarIndicador, MandatoLinha, periodoDosAnos, resumoNoMandato } from '../../core/mandatos';
import type { SerieIndicador } from '../../core/models';

export interface ValorMandato {
  v: number | null;
  nota: string;
}

export interface CriterioMandato {
  id: string;
  rotulo: string;
  grupo: 'atuacao' | 'pais';
  explicacao: string;
  /** Ressalva que muda a leitura do critério (ex.: vetos antes de 2013). */
  aviso: string | null;
  /** Barras de 0 a 100 (porcentagens) ou proporcionais ao maior valor. */
  escala: 'pct' | 'livre';
  valor(m: MandatoLinha, todos: MandatoLinha[]): ValorMandato;
  formatar(v: number): string;
}

const pct = (v: number) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const fracao = (parte: number, total: number): number | null => (total > 0 ? (parte / total) * 100 : null);

export const CRITERIOS_ATUACAO: CriterioMandato[] = [
  {
    id: 'mps-lei', rotulo: 'MPs que viraram lei', grupo: 'atuacao', escala: 'pct', aviso: null,
    explicacao: 'Das medidas provisórias que já tiveram desfecho, quantas o Congresso transformou em lei. As que caducam perdem a validade sem votação.',
    valor: (m) => {
      const r = m.resumo, comDesfecho = r.mps - r.mpsTramitando;
      return { v: fracao(r.mpsLei, comDesfecho), nota: `${r.mpsLei} de ${comDesfecho} com desfecho` };
    },
    formatar: pct,
  },
  {
    id: 'mps-ano', rotulo: 'MPs por ano', grupo: 'atuacao', escala: 'livre', aviso: null,
    explicacao: 'Medidas provisórias editadas por ano de mandato. A MP vale como lei assim que publicada e o Congresso tem até 120 dias para votá-la.',
    valor: (m) => {
      const anos = anosDeMandato(m);
      return { v: anos > 0 ? m.resumo.mps / anos : null, nota: `${m.resumo.mps} em ${anos.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} anos` };
    },
    formatar: (v) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
  },
  {
    id: 'projetos-lei', rotulo: 'Projetos que viraram lei', grupo: 'atuacao', escala: 'pct', aviso: null,
    explicacao: 'Dos projetos de lei que o Executivo enviou ao Congresso no mandato, quantos já viraram lei. No mandato em curso, muitos ainda tramitam.',
    valor: (m) => ({ v: fracao(m.resumo.projetosLei, m.resumo.projetos), nota: `${m.resumo.projetosLei} de ${m.resumo.projetos} enviados` }),
    formatar: pct,
  },
  {
    id: 'vetos-derrubados', rotulo: 'Vetos derrubados', grupo: 'atuacao', escala: 'pct',
    aviso: 'Antes de 2013 o Congresso quase não votava vetos: eles se acumulavam sem análise. Por isso os mandatos até 2012 aparecem com pouquíssimos derrubados; a comparação só é justa a partir de 2013.',
    explicacao: 'Dos vetos do presidente que o Congresso já analisou, quantos ele derrubou (no todo ou em parte), fazendo valer o texto aprovado.',
    valor: (m) => {
      const r = m.resumo, analisados = r.vetos - r.vetosAguardando - (r.vetosPrejudicados ?? 0);
      return { v: fracao(r.vetosDerrubados, analisados), nota: `${r.vetosDerrubados} de ${analisados} analisados` };
    },
    formatar: pct,
  },
];

/** Um critério por indicador: a média dos anos de cada mandato. */
export function criteriosDoPais(series: SerieIndicador[]): CriterioMandato[] {
  return series.map((s) => ({
    id: s.id, rotulo: s.rotulo, grupo: 'pais', escala: 'livre',
    aviso: s.metodologiaAntigaAte ? `Até ${s.metodologiaAntigaAte} a metodologia era outra e os números não são diretamente comparáveis com os de depois.` : null,
    explicacao: `${s.titulo}: média dos anos de cada mandato${s.reais ? `, em reais de ${s.referenciaReal} (corrigidos pela inflação)` : ''}. Cada ano conta para quem governou a maior parte dele. Mostra o país durante o mandato, não o efeito direto do governo.`,
    valor: (m, todos) => {
      const r = resumoNoMandato(s, m, todos, !!s.reais);
      return { v: r.media, nota: r.media === null ? 'sem dados' : `média ${periodoDosAnos(r.anos)}${r.parcial ? ' (parcial)' : ''}` };
    },
    formatar: (v) => formatarIndicador(v, s),
  }));
}

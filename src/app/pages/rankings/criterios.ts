// Critérios dos rankings: como cada um calcula o valor, quem entra e como explicar.
import { data, dinheiro, dinheiroCurto, pctExibido } from '../../core/format';
import type { LinhaRanking, RankingSenado } from '../../core/models';

export type CriterioId = 'presenca' | 'fidelidade' | 'gastos' | 'projetos';
export type Ordem = 'desc' | 'asc';
/** Se estar no topo desta ordem é bom, ruim ou só uma característica. */
export type Tom = 'bom' | 'ruim' | 'neutro';

/** Abaixo disso a pessoa chegou há pouco tempo e a porcentagem diz pouco. */
export const MIN_VOTACOES = 30;
export const MIN_COMPARAVEIS = 20;

interface Contexto {
  ranking: RankingSenado;
  /** Senadores em exercício por partido: quem é o único do partido não tem com quem divergir. */
  bancada: Map<string, number>;
}

export interface Criterio {
  id: CriterioId;
  rotulo: string;
  /** Rótulos dos dois sentidos de ordenação: [maior primeiro, menor primeiro]. */
  ordens: [string, string];
  /**
   * Qual ordem põe no topo quem faz o melhor trabalho. Sem valor quando não há lado certo
   * (fidelidade ao partido: ser fiel ou independente depende do ponto de vista).
   */
  boa?: Ordem;
  explicacao: (r: RankingSenado) => string;
  valor: (l: LinhaRanking) => number;
  formatar: (v: number) => string;
  /** Valor como aparece na tela: empata quem mostra o mesmo número. */
  chave: (v: number) => number;
  /** Base da porcentagem. Entre quem mostra o mesmo número, fica acima quem tem mais. */
  base?: (l: LinhaRanking) => number;
  /** Texto curto para a média do Senado. */
  formatarMedia: (v: number) => string;
  nota: (l: LinhaRanking, r: RankingSenado) => string;
  /** Motivo para ficar fora do ranking, ou null se entra. */
  fora: (l: LinhaRanking, c: Contexto) => string | null;
}

const pctDe = (a: number, b: number) => (b ? (a / b) * 100 : 0);
// Uma casa decimal: com mais de 400 votações, 99,5% e 98,6% são diferenças reais.
const pct1 = (v: number) => pctExibido(v, 1);
const pctTexto = (v: number) => `${pct1(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const poucas = (l: LinhaRanking) => (l.votacoes < MIN_VOTACOES ? `chegou há pouco: ${l.votacoes} ${l.votacoes === 1 ? 'votação' : 'votações'}` : null);

export const CRITERIOS: Criterio[] = [
  {
    id: 'presenca',
    rotulo: 'Presença',
    ordens: ['Mais presentes', 'Menos presentes'],
    boa: 'desc',
    explicacao: (r) =>
      `Parcela das votações nominais do plenário, desde ${data(r.inicio)}, em que o senador registrou voto (Sim, Não, abstenção, obstrução ou voto secreto). Licenças, missões e faltas contam como ausência. Quem tem menos de ${MIN_VOTACOES} votações fica de fora.`,
    valor: (l) => pctDe(l.presentes, l.votacoes),
    formatar: pctTexto,
    chave: pct1,
    formatarMedia: pctTexto,
    base: (l) => l.votacoes,
    nota: (l) => `${l.presentes} de ${l.votacoes} votações`,
    fora: (l) => poucas(l),
  },
  {
    id: 'fidelidade',
    rotulo: 'Fidelidade ao partido',
    ordens: ['Mais fiéis', 'Mais independentes'],
    explicacao: () =>
      `Parcela dos votos Sim ou Não em que o senador acompanhou a maioria do próprio partido. Votações em que o partido empatou, secretas e ausências não entram. Ficam de fora quem tem menos de ${MIN_COMPARAVEIS} votos comparáveis e quem é o único senador do partido.`,
    valor: (l) => pctDe(l.comPartido, l.comparaveis),
    formatar: pctTexto,
    chave: pct1,
    formatarMedia: pctTexto,
    base: (l) => l.comparaveis,
    nota: (l) => {
      const dif = l.comparaveis - l.comPartido;
      return `${dif} ${dif === 1 ? 'voto diferente' : 'votos diferentes'} em ${l.comparaveis}`;
    },
    fora: (l, c) =>
      (c.bancada.get(l.partido) ?? 0) < 2
        ? `único senador do ${l.partido}`
        : l.comparaveis < MIN_COMPARAVEIS
          ? `poucos votos comparáveis: ${l.comparaveis}`
          : null,
  },
  {
    id: 'gastos',
    rotulo: 'Gastos',
    ordens: ['Quem mais gastou', 'Quem menos gastou'],
    boa: 'asc',
    explicacao: (r) =>
      `Total reembolsado pela cota parlamentar (CEAPS) em ${r.cotaAno}: passagens, combustível, aluguel de escritório, divulgação e outros. Não inclui salário nem verba de gabinete. Quem chegou há pouco (menos de ${MIN_VOTACOES} votações) ou não tem gasto registrado no ano fica de fora.`,
    valor: (l) => l.cota,
    formatar: dinheiroCurto,
    chave: (v) => v,
    formatarMedia: dinheiroCurto,
    nota: (l) => dinheiro(l.cota),
    fora: (l, c) => poucas(l) ?? (l.cota <= 0 ? `sem gastos registrados em ${c.ranking.cotaAno}` : null),
  },
  {
    id: 'projetos',
    rotulo: 'Projetos',
    ordens: ['Mais projetos', 'Menos projetos'],
    boa: 'desc',
    explicacao: () =>
      'Projetos de lei, PECs, projetos de lei complementar, de decreto legislativo e de resolução de autoria do senador, incluindo os de mandatos anteriores no Senado. Autoria conjunta conta para todos os autores.',
    valor: (l) => l.proposicoes,
    formatar: (v) => String(v),
    chave: (v) => v,
    formatarMedia: (v) => String(Math.round(v)),
    nota: (l) => `${l.leis} ${l.leis === 1 ? 'virou lei' : 'viraram lei'}`,
    fora: () => null,
  },
];

export function tomDaOrdem(c: Criterio, o: Ordem): Tom {
  return !c.boa ? 'neutro' : c.boa === o ? 'bom' : 'ruim';
}

export interface Posicao {
  linha: LinhaRanking;
  valor: number;
  /** Posição com empates: 1, 2, 2, 4… */
  posicao: number;
}

export interface Classificacao {
  ranqueados: Posicao[];
  fora: { linha: LinhaRanking; motivo: string }[];
  media: number | null;
  maximo: number;
}

export function classificar(ranking: RankingSenado, criterio: Criterio, ordem: Ordem): Classificacao {
  const bancada = new Map<string, number>();
  ranking.linhas.forEach((l) => bancada.set(l.partido, (bancada.get(l.partido) ?? 0) + 1));
  const ctx: Contexto = { ranking, bancada };
  const fora: Classificacao['fora'] = [];
  const dentro: { linha: LinhaRanking; valor: number }[] = [];
  for (const linha of ranking.linhas) {
    const motivo = criterio.fora(linha, ctx);
    if (motivo) fora.push({ linha, motivo });
    else dentro.push({ linha, valor: criterio.valor(linha) });
  }
  const sinal = ordem === 'desc' ? -1 : 1;
  // Primeiro o número que aparece na tela (87,4% e 87,2% são "87%"). Entre iguais, fica
  // acima quem tem mais votações na conta: 100% de 426 vale mais que 100% de 59. Depois o
  // valor exato e o nome. Só divide a posição quem empata no número e na base.
  const chave = criterio.chave;
  const base = criterio.base ?? (() => 0);
  dentro.sort(
    (a, b) =>
      sinal * (chave(a.valor) - chave(b.valor)) ||
      base(b.linha) - base(a.linha) ||
      sinal * (a.valor - b.valor) ||
      a.linha.nome.localeCompare(b.linha.nome, 'pt-BR'),
  );
  const ranqueados: Posicao[] = [];
  dentro.forEach((d, i) => {
    const anterior = ranqueados[i - 1];
    const empata = anterior && chave(anterior.valor) === chave(d.valor) && base(anterior.linha) === base(d.linha);
    ranqueados.push({ ...d, posicao: empata ? anterior.posicao : i + 1 });
  });
  fora.sort((a, b) => a.linha.nome.localeCompare(b.linha.nome, 'pt-BR'));
  return {
    ranqueados,
    fora,
    media: dentro.length ? dentro.reduce((s, d) => s + d.valor, 0) / dentro.length : null,
    maximo: Math.max(0, ...dentro.map((d) => d.valor)),
  };
}

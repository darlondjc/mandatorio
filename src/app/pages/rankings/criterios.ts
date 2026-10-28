// Critérios dos rankings: como cada um calcula o valor, quem entra e como explicar.
import { data, dinheiro, dinheiroCurto } from '../../core/format';
import type { LinhaRanking, RankingSenado } from '../../core/models';

export type CriterioId = 'presenca' | 'fidelidade' | 'gastos' | 'projetos';
export type Ordem = 'desc' | 'asc';

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
  explicacao: (r: RankingSenado) => string;
  valor: (l: LinhaRanking) => number;
  formatar: (v: number) => string;
  /** Valor como aparece na tela: empata quem mostra o mesmo número. */
  chave: (v: number) => number;
  /** Texto curto para a média do Senado. */
  formatarMedia: (v: number) => string;
  nota: (l: LinhaRanking, r: RankingSenado) => string;
  /** Motivo para ficar fora do ranking, ou null se entra. */
  fora: (l: LinhaRanking, c: Contexto) => string | null;
}

const pctDe = (a: number, b: number) => (b ? (a / b) * 100 : 0);
const pctTexto = (v: number) => `${Math.round(v)}%`;
const poucas = (l: LinhaRanking) => (l.votacoes < MIN_VOTACOES ? `chegou há pouco: ${l.votacoes} ${l.votacoes === 1 ? 'votação' : 'votações'}` : null);

export const CRITERIOS: Criterio[] = [
  {
    id: 'presenca',
    rotulo: 'Presença',
    ordens: ['Mais presentes', 'Menos presentes'],
    explicacao: (r) =>
      `Parcela das votações nominais do plenário, desde ${data(r.inicio)}, em que o senador registrou voto (Sim, Não, abstenção, obstrução ou voto secreto). Licenças, missões e faltas contam como ausência. Quem tem menos de ${MIN_VOTACOES} votações fica de fora.`,
    valor: (l) => pctDe(l.presentes, l.votacoes),
    formatar: pctTexto,
    chave: Math.round,
    formatarMedia: pctTexto,
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
    chave: Math.round,
    formatarMedia: pctTexto,
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
  // Empata quem aparece com o mesmo número (87,4% e 87,2% são "87%"); dentro do empate,
  // o valor exato decide a ordem, e depois o nome.
  const chave = criterio.chave;
  dentro.sort(
    (a, b) => sinal * (chave(a.valor) - chave(b.valor)) || sinal * (a.valor - b.valor) || a.linha.nome.localeCompare(b.linha.nome, 'pt-BR'),
  );
  const ranqueados: Posicao[] = [];
  dentro.forEach((d, i) => {
    const anterior = ranqueados[i - 1];
    const posicao = anterior && chave(anterior.valor) === chave(d.valor) ? anterior.posicao : i + 1;
    ranqueados.push({ ...d, posicao });
  });
  fora.sort((a, b) => a.linha.nome.localeCompare(b.linha.nome, 'pt-BR'));
  return {
    ranqueados,
    fora,
    media: dentro.length ? dentro.reduce((s, d) => s + d.valor, 0) / dentro.length : null,
    maximo: Math.max(0, ...dentro.map((d) => d.valor)),
  };
}

// Critérios dos rankings: como cada um calcula o valor, quem entra e como explicar.
import { data, dinheiro, dinheiroCurto, pctExibido } from '../../core/format';
import type { LinhaRanking, RankingSenado } from '../../core/models';
import { mesAno } from '../../core/ranking';

export type CriterioId = 'presenca' | 'fidelidade' | 'gastos' | 'projetos' | 'leis';
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
  /** Variante de outro critério: fica dentro da aba dele, num chaveador, em vez de ter aba própria. */
  aba?: CriterioId;
  /** Rótulo no chaveador da aba, quando ela tem variantes. */
  variante?: string;
  /** Rótulos dos dois sentidos de ordenação: [maior primeiro, menor primeiro]. */
  ordens: [string, string];
  /** Como dizer a posição de alguém em cada ordem: "3º mais presente", "2º que menos gastou". */
  frases: [string, string];
  /**
   * Qual ordem põe no topo quem faz o melhor trabalho. Sem valor quando não há lado certo
   * (fidelidade ao partido: ser fiel ou independente depende do ponto de vista).
   */
  boa?: Ordem;
  explicacao: (r: RankingSenado) => string;
  /**
   * Período que os dados cobrem, sempre visível junto do ranking: curto ("fev/2023 a
   * out/2026") e completo ("Votações de fev/2023 a out/2026").
   */
  periodo: (r: RankingSenado) => { curto: string; completo: string };
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

/** Presença e fidelidade: as votações nominais da legislatura até a última coleta. */
function periodoVotacoes(r: RankingSenado) {
  const curto = `${mesAno(r.inicio)} a ${mesAno(r.atualizadoEm)}`;
  return { curto, completo: `Votações de ${curto}` };
}

const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Gastos: a cota de um ano; se for o ano corrente, só até o mês da última coleta. */
function periodoCota(r: RankingSenado) {
  const emCurso = r.atualizadoEm.startsWith(String(r.cotaAno));
  const curto = emCurso ? `jan a ${mesAno(r.atualizadoEm)}` : String(r.cotaAno);
  const mes = MESES_LONGOS[Number(r.atualizadoEm.slice(5, 7)) - 1];
  return { curto, completo: emCurso ? `Cota de ${r.cotaAno}, de janeiro a ${mes} (ano em curso)` : `Cota de ${r.cotaAno}` };
}

export const CRITERIOS: Criterio[] = [
  {
    id: 'presenca',
    rotulo: 'Presença',
    ordens: ['Mais presentes', 'Menos presentes'],
    frases: ['mais presente', 'menos presente'],
    boa: 'desc',
    periodo: periodoVotacoes,
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
    frases: ['mais fiel ao partido', 'mais independente do partido'],
    periodo: periodoVotacoes,
    explicacao: (r) =>
      `Parcela dos votos Sim ou Não, nas votações desde ${data(r.inicio)}, em que o senador acompanhou a maioria do próprio partido. Votações em que o partido empatou, secretas e ausências não entram. Ficam de fora quem tem menos de ${MIN_COMPARAVEIS} votos comparáveis e quem é o único senador do partido.`,
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
    frases: ['que mais gastou', 'que menos gastou'],
    boa: 'asc',
    periodo: periodoCota,
    explicacao: () =>
      `Total reembolsado pela cota parlamentar (CEAPS) no período: passagens, combustível, aluguel de escritório, divulgação e outros. Não inclui salário nem verba de gabinete. Para comparar períodos iguais, fica de fora quem não esteve em exercício o ano todo (chegou ou voltou depois de janeiro) e quem não tem gasto registrado no ano.`,
    valor: (l) => l.cota,
    formatar: dinheiroCurto,
    chave: (v) => v,
    formatarMedia: dinheiroCurto,
    nota: (l) => dinheiro(l.cota),
    fora: (l, c) => {
      // Quem entrou ou voltou no meio do ano gastou só parte dele: compararia períodos diferentes.
      const desde = l.exercicioDesde ?? l.primeiraVotacao;
      if (desde && desde > `${c.ranking.cotaAno}-02-01`) return `em exercício só desde ${mesAno(desde)}`;
      return poucas(l) ?? (l.cota <= 0 ? `sem gastos registrados em ${c.ranking.cotaAno}` : null);
    },
  },
  {
    id: 'projetos',
    rotulo: 'Projetos',
    variante: 'Apresentados',
    ordens: ['Mais projetos', 'Menos projetos'],
    frases: ['com mais projetos', 'com menos projetos'],
    boa: 'desc',
    periodo: () => ({ curto: 'toda a carreira', completo: 'Toda a carreira no Senado' }),
    explicacao: () =>
      'Projetos de lei, de lei complementar, de decreto legislativo e de resolução de autoria do senador, incluindo os de mandatos anteriores no Senado. PECs não entram: exigem a assinatura de 27 senadores e apareceriam para quase todos. Autoria conjunta conta para todos os autores.',
    valor: (l) => l.proposicoes,
    formatar: (v) => String(v),
    chave: (v) => v,
    formatarMedia: (v) => String(Math.round(v)),
    nota: (l) => `${l.leis} ${l.leis === 1 ? 'virou lei' : 'viraram lei'}`,
    fora: () => null,
  },
  {
    id: 'leis',
    aba: 'projetos',
    rotulo: 'Projetos que viraram lei',
    variante: 'Viraram lei',
    ordens: ['Mais leis', 'Menos leis'],
    frases: ['com mais projetos que viraram lei', 'com menos projetos que viraram lei'],
    boa: 'desc',
    periodo: () => ({ curto: 'toda a carreira', completo: 'Toda a carreira no Senado' }),
    explicacao: () =>
      'Projetos de autoria do senador que viraram lei (ou outra norma, como decreto legislativo ou resolução), incluindo os de mandatos anteriores no Senado. PECs não entram, como no ranking de projetos apresentados. Autoria conjunta conta para todos os autores.',
    valor: (l) => l.leis,
    formatar: (v) => String(v),
    chave: (v) => v,
    formatarMedia: (v) => (v < 10 ? v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : String(Math.round(v))),
    nota: (l) => `de ${l.proposicoes} ${l.proposicoes === 1 ? 'apresentado' : 'apresentados'}`,
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

function contexto(ranking: RankingSenado): Contexto {
  const bancada = new Map<string, number>();
  ranking.linhas.forEach((l) => bancada.set(l.partido, (bancada.get(l.partido) ?? 0) + 1));
  return { ranking, bancada };
}

/** Por que alguém fica fora deste critério (mesmas regras do ranking), ou null se entra. */
export function motivoFora(ranking: RankingSenado, criterio: Criterio, linha: LinhaRanking): string | null {
  return criterio.fora(linha, contexto(ranking));
}

export function classificar(ranking: RankingSenado, criterio: Criterio, ordem: Ordem): Classificacao {
  const ctx = contexto(ranking);
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

/** Até que posição um lado do ranking vira destaque no perfil. */
export const TOP_DESTAQUE = 5;

export type PosicaoNoRanking =
  | { criterio: Criterio; fora: false; ordem: Ordem; tom: Tom; posicao: number; total: number; frase: string; destaque: boolean }
  | { criterio: Criterio; fora: true; motivo: string };

/**
 * Onde o senador está em cada ranking, pelo lado em que está mais perto do topo: o 70º de
 * 77 em "quem mais gastou" é o 8º "que menos gastou". Destaque quando está entre os
 * TOP_DESTAQUE primeiros. Ordem: destaques bons, ruins, neutros, depois o resto.
 */
export function posicoesDoSenador(ranking: RankingSenado, codigo: string): PosicaoNoRanking[] {
  if (!ranking.linhas.some((l) => l.codigo === codigo)) return [];
  const out = CRITERIOS.map((criterio): PosicaoNoRanking => {
    const lados = (['desc', 'asc'] as Ordem[]).map((ordem) => {
      const c = classificar(ranking, criterio, ordem);
      return { ordem, c, p: c.ranqueados.find((x) => x.linha.codigo === codigo) };
    });
    if (!lados[0].p) return { criterio, fora: true, motivo: lados[0].c.fora.find((f) => f.linha.codigo === codigo)?.motivo ?? 'sem dados' };
    // Mais perto do topo; no empate, o lado bom.
    const [melhor] = [...lados].sort((a, b) => a.p!.posicao - b.p!.posicao || (tomDaOrdem(criterio, a.ordem) === 'bom' ? -1 : 1));
    const posicao = melhor.p!.posicao;
    const i = melhor.ordem === 'desc' ? 0 : 1;
    return {
      criterio,
      fora: false,
      ordem: melhor.ordem,
      tom: tomDaOrdem(criterio, melhor.ordem),
      posicao,
      total: melhor.c.ranqueados.length,
      frase: `${posicao}º ${criterio.frases[i]}`,
      destaque: posicao <= TOP_DESTAQUE,
    };
  });
  const peso = (x: PosicaoNoRanking) => (x.fora ? 4 : !x.destaque ? 3 : x.tom === 'bom' ? 0 : x.tom === 'ruim' ? 1 : 2);
  return out.sort((a, b) => peso(a) - peso(b));
}

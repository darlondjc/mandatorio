// Linhas do ranking a partir do perfil do senador. Usado pela sincronização (que grava
// rankings/senado) e pelo site, quando esse documento ainda não existe.
import type { LinhaRanking, Senador } from './models';

export function linhaRanking(s: Senador): LinhaRanking {
  const r = s.resumo;
  return {
    codigo: s.codigo,
    nome: s.nome,
    partido: s.partido,
    uf: s.uf,
    sexo: s.sexo,
    foto: s.foto,
    votacoes: r.votacoes,
    presentes: r.votacoes - r.distribuicao.ausente,
    comparaveis: r.votosComparaveis,
    comPartido: r.votosComPartido,
    cota: r.cotaAno,
    proposicoes: r.proposicoes,
    leis: r.proposicoesLei,
    primeiraVotacao: r.primeiraVotacao ?? null,
  };
}

/** Início da legislatura em curso numa data: 1º de fevereiro, de quatro em quatro anos desde 2023. */
export function inicioDaLegislatura(dataISO: string): string {
  const ano = Number(dataISO.slice(0, 4)) - (dataISO.slice(5, 10) < '02-01' ? 1 : 0);
  return `${ano - (((ano - 2023) % 4) + 4) % 4}-02-01`;
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/**
 * Explica por que alguém tem menos votações que o total da legislatura: chegou depois
 * ("desde mar/2026") ou ficou um tempo fora do exercício ("com afastamento").
 */
export function periodoExercicio(votacoes: number, total: number | undefined, primeira: string | null | undefined, inicio: string): string | null {
  if (!total || votacoes >= total) return null;
  if (primeira && Date.parse(primeira) - Date.parse(inicio) > 60 * 864e5) {
    return `desde ${MESES[Number(primeira.slice(5, 7)) - 1]}/${primeira.slice(0, 4)}`;
  }
  return 'com afastamento';
}

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
    participacao: s.participacao ?? null,
    exercicioDesde: s.exercicioDesde ?? null,
  };
}

/** Início da legislatura em curso numa data: 1º de fevereiro, de quatro em quatro anos desde 2023. */
export function inicioDaLegislatura(dataISO: string): string {
  const ano = Number(dataISO.slice(0, 4)) - (dataISO.slice(5, 10) < '02-01' ? 1 : 0);
  return `${ano - (((ano - 2023) % 4) + 4) % 4}-02-01`;
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const mesAno = (iso: string) => `${MESES[Number(iso.slice(5, 7)) - 1]}/${iso.slice(0, 4)}`;

export interface Exercicio {
  participacao?: string | null;
  exercicioDesde?: string | null;
  primeiraVotacao?: string | null;
  votacoes: number;
}

/**
 * Situação no cargo, para quem não está no mandato de forma contínua desde o início da
 * legislatura: suplentes ("1º Suplente desde mar/2026", sempre; "…, de volta desde…" se já
 * tinha estado no cargo antes), quem voltou de um
 * afastamento ("De volta desde abr/2026") ou quem tem menos votações sem data conhecida.
 * null para o titular que está no cargo desde o começo.
 */
export function situacaoExercicio(e: Exercicio, inicioLegislatura: string, totalVotacoes?: number): string | null {
  const desde = e.exercicioDesde ?? e.primeiraVotacao ?? null;
  const tarde = !!desde && Date.parse(desde) - Date.parse(inicioLegislatura) > 60 * 864e5;
  if (/suplente/i.test(e.participacao ?? '')) {
    if (!desde) return e.participacao ?? null;
    // Já tinha votado antes do exercício atual: entrou, saiu e voltou.
    const voltou = !!e.primeiraVotacao && Date.parse(desde) - Date.parse(e.primeiraVotacao) > 30 * 864e5;
    return `${e.participacao}${voltou ? ', de volta' : ''} desde ${mesAno(desde)}`;
  }
  if (tarde) return `${/titular/i.test(e.participacao ?? '') ? 'De volta' : 'Em exercício'} desde ${mesAno(desde!)}`;
  if (totalVotacoes && e.votacoes < totalVotacoes * 0.97) return 'Teve afastamento';
  return null;
}

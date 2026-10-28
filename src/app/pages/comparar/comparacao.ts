// Comparação entre dois senadores: os critérios dos rankings lado a lado e a concordância
// nas votações em que os dois votaram Sim ou Não.
import type { LinhaRanking, RankingSenado, Voto, VotoSenador } from '../../core/models';
import { CRITERIOS, Criterio, motivoFora, Tom } from '../rankings/criterios';

export interface LinhaComparada {
  criterio: Criterio;
  a: { valor: number; texto: string; nota: string; fora: string | null };
  b: { valor: number; texto: string; nota: string; fora: string | null };
  /** Quem leva vantagem no critério; null quando empatam, não há lado melhor ou um está fora. */
  vantagem: 'a' | 'b' | null;
  /** Tom de quem leva vantagem: sempre 'bom' quando há vantagem; 'neutro' nos critérios sem lado. */
  tom: Tom;
  /** Largura das barras, em % do maior dos dois. */
  largura: { a: number; b: number };
}

export function compararCriterios(ranking: RankingSenado, a: LinhaRanking, b: LinhaRanking, criterios: Criterio[] = CRITERIOS): LinhaComparada[] {
  return criterios.map((criterio) => {
    const lado = (l: LinhaRanking) => {
      const valor = criterio.valor(l);
      return { valor, texto: criterio.formatar(valor), nota: criterio.nota(l, ranking), fora: motivoFora(ranking, criterio, l) };
    };
    const [la, lb] = [lado(a), lado(b)];
    let vantagem: LinhaComparada['vantagem'] = null;
    if (criterio.boa && !la.fora && !lb.fora) {
      const [ca, cb] = [criterio.chave(la.valor), criterio.chave(lb.valor)];
      if (ca !== cb) vantagem = (criterio.boa === 'desc' ? ca > cb : ca < cb) ? 'a' : 'b';
    }
    const max = Math.max(la.valor, lb.valor) || 1;
    return {
      criterio,
      a: la,
      b: lb,
      vantagem,
      tom: criterio.boa ? 'bom' : 'neutro',
      largura: { a: (la.valor / max) * 100, b: (lb.valor / max) * 100 },
    };
  });
}

export interface Discordancia {
  id: string;
  data: string;
  materia: string;
  ementa: string;
  descricao: string | null | undefined;
  votoA: Voto;
  votoB: Voto;
}

export interface Concordancia {
  /** Votações em que os dois votaram Sim ou Não. */
  comuns: number;
  iguais: number;
  pct: number;
  /** Onde um votou Sim e o outro Não, da mais recente para a mais antiga. */
  discordancias: Discordancia[];
}

export function concordancia(votosA: VotoSenador[], votosB: VotoSenador[]): Concordancia {
  const decidido = (v: VotoSenador) => v.voto === 'sim' || v.voto === 'nao';
  const deB = new Map(votosB.filter(decidido).map((v) => [v.id, v]));
  let comuns = 0;
  let iguais = 0;
  const discordancias: Discordancia[] = [];
  for (const va of votosA.filter(decidido)) {
    const vb = deB.get(va.id);
    if (!vb) continue;
    comuns++;
    if (va.voto === vb.voto) iguais++;
    else discordancias.push({ id: va.id, data: va.data, materia: va.materia, ementa: va.ementa, descricao: va.descricao, votoA: va.voto, votoB: vb.voto });
  }
  discordancias.sort((x, y) => y.data.localeCompare(x.data));
  return { comuns, iguais, pct: comuns ? (iguais / comuns) * 100 : 0, discordancias };
}

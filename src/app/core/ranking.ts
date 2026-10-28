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
  };
}

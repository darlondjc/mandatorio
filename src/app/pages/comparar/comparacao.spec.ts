import type { LinhaRanking, RankingSenado, VotoSenador } from '../../core/models';
import { compararCriterios, concordancia } from './comparacao';

const linha = (codigo: string, extra: Partial<LinhaRanking>): LinhaRanking => ({
  codigo, nome: codigo, partido: 'X', uf: 'DF', sexo: 'M', foto: null,
  votacoes: 100, presentes: 90, comparaveis: 50, comPartido: 45, cota: 100_000, proposicoes: 10, leis: 1, ...extra,
});
const ranking = (linhas: LinhaRanking[]): RankingSenado => ({ legislatura: 57, inicio: '2023-02-01', cotaAno: 2026, atualizadoEm: '2026-10-28', linhas });
const voto = (id: string, v: VotoSenador['voto']): VotoSenador =>
  ({ id, data: `2026-01-${id.padStart(2, '0')}`, materia: 'PL', ementa: '', voto: v, votoOriginal: '', maioriaPartido: null, divergiu: false, resultado: null }) as VotoSenador;

describe('compararCriterios', () => {
  const a = linha('a', { presentes: 99, cota: 300_000, proposicoes: 40 });
  const b = linha('b', { presentes: 80, cota: 100_000, proposicoes: 40 });
  const r = ranking([a, b, linha('c', {})]);
  const porId = (id: string) => compararCriterios(r, a, b).find((l) => l.criterio.id === id)!;

  it('marca quem leva vantagem conforme o lado bom de cada critério', () => {
    expect(porId('presenca').vantagem).toBe('a');
    expect(porId('gastos').vantagem).toBe('b'); // menos gasto é melhor
    expect(porId('projetos').vantagem).toBeNull(); // empate
    expect(porId('fidelidade').vantagem).toBeNull(); // sem lado melhor
  });

  it('não aponta vantagem quando um está fora do critério', () => {
    const novo = linha('n', { votacoes: 10, presentes: 10 });
    const l = compararCriterios(ranking([a, novo]), a, novo).find((x) => x.criterio.id === 'presenca')!;
    expect(l.b.fora).toContain('chegou há pouco');
    expect(l.vantagem).toBeNull();
  });
});

describe('concordancia', () => {
  it('conta só votações em que os dois votaram Sim ou Não', () => {
    const c = concordancia(
      [voto('1', 'sim'), voto('2', 'sim'), voto('3', 'nao'), voto('4', 'ausente'), voto('5', 'sim')],
      [voto('1', 'sim'), voto('2', 'nao'), voto('3', 'nao'), voto('4', 'sim'), voto('6', 'sim')],
    );
    expect([c.comuns, c.iguais, Math.round(c.pct)]).toEqual([3, 2, 67]);
    expect(c.discordancias.map((d) => [d.id, d.votoA, d.votoB])).toEqual([['2', 'sim', 'nao']]);
  });
});

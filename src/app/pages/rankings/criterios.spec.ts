import type { LinhaRanking, RankingSenado } from '../../core/models';
import { classificar, CRITERIOS, posicoesDoSenador } from './criterios';

const linha = (codigo: string, partido: string, extra: Partial<LinhaRanking>): LinhaRanking => ({
  codigo, nome: `Senador ${codigo}`, partido, uf: 'DF', sexo: 'M', foto: null,
  votacoes: 100, presentes: 90, comparaveis: 50, comPartido: 45, cota: 100_000, proposicoes: 10, leis: 1, ...extra,
});
const ranking = (linhas: LinhaRanking[]): RankingSenado => ({ legislatura: 57, inicio: '2023-02-01', cotaAno: 2026, atualizadoEm: '', linhas });
const crit = (id: string) => CRITERIOS.find((c) => c.id === id)!;

describe('classificar', () => {
  it('ordena e repete a posição nos empates', () => {
    const r = ranking([
      linha('a', 'X', { presentes: 95 }),
      linha('b', 'X', { presentes: 80 }),
      linha('c', 'Y', { presentes: 95 }),
      linha('d', 'Y', { presentes: 70 }),
    ]);
    const c = classificar(r, crit('presenca'), 'desc');
    expect(c.ranqueados.map((p) => [p.linha.codigo, p.posicao])).toEqual([['a', 1], ['c', 1], ['b', 3], ['d', 4]]);
    expect(c.media).toBeCloseTo(85);
    const asc = classificar(r, crit('presenca'), 'asc');
    expect(asc.ranqueados[0].linha.codigo).toBe('d');
  });

  it('99,5% não aparece como 100%: só quem esteve em todas tem 100%', () => {
    const r = ranking([linha('a', 'X', { presentes: 424, votacoes: 426 }), linha('b', 'X', { presentes: 59, votacoes: 59 })]);
    const c = classificar(r, crit('presenca'), 'desc');
    expect(c.ranqueados.map((p) => [p.linha.codigo, p.posicao])).toEqual([['b', 1], ['a', 2]]);
    expect(crit('presenca').formatar(c.ranqueados[1].valor)).toBe('99,5%');
    expect(crit('presenca').formatar(99.97)).toBe('99,9%');
    expect(crit('presenca').formatar(100)).toBe('100%');
  });

  it('deixa de fora quem chegou há pouco e o único do partido', () => {
    const r = ranking([linha('a', 'X', {}), linha('b', 'X', { votacoes: 12, presentes: 12, comparaveis: 8, comPartido: 8 }), linha('c', 'SOLO', {})]);
    expect(classificar(r, crit('presenca'), 'desc').fora.map((f) => f.linha.codigo)).toEqual(['b']);
    const fid = classificar(r, crit('fidelidade'), 'desc');
    expect(fid.fora.map((f) => f.linha.codigo)).toEqual(['b', 'c']);
    expect(fid.fora[1].motivo).toContain('único');
  });

  it('gastos: sem registro no ano fica fora', () => {
    const r = ranking([linha('a', 'X', { cota: 0 }), linha('b', 'X', { cota: 250_000 })]);
    const g = classificar(r, crit('gastos'), 'asc');
    expect(g.ranqueados.map((p) => p.linha.codigo)).toEqual(['b']);
    expect(g.fora[0].motivo).toContain('2026');
  });
});

describe('ordem entre iguais e período em exercício', () => {
  it('entre os 100%, fica acima quem tem mais votações', () => {
    const r = ranking([
      linha('novo', 'X', { votacoes: 59, presentes: 59 }),
      linha('antigo', 'X', { votacoes: 426, presentes: 426 }),
      linha('outro', 'Y', { votacoes: 426, presentes: 426 }),
    ]);
    const c = classificar(r, crit('presenca'), 'desc');
    expect(c.ranqueados.map((p) => [p.linha.codigo, p.posicao])).toEqual([['antigo', 1], ['outro', 1], ['novo', 3]]);
  });

  it('a nota de presença traz só os números', () => {
    const r = { ...ranking([]), votacoes: 426 };
    expect(crit('presenca').nota(linha('a', 'X', { votacoes: 59, presentes: 59 }), r)).toBe('59 de 59 votações');
  });
});

describe('posicoesDoSenador', () => {
  const r = ranking([
    linha('a', 'X', { presentes: 100, cota: 50_000, proposicoes: 3 }),
    linha('b', 'X', { presentes: 90, cota: 300_000, proposicoes: 40 }),
    linha('c', 'Y', { presentes: 80, cota: 200_000, proposicoes: 20 }),
    linha('d', 'Y', { presentes: 50, votacoes: 100, cota: 0, proposicoes: 10 }),
  ]);

  it('mostra o lado mais perto do topo, com o tom certo', () => {
    const ps = posicoesDoSenador(r, 'a');
    const gastos = ps.find((p) => p.criterio.id === 'gastos')!;
    expect(gastos.fora).toBe(false);
    if (!gastos.fora) {
      expect(gastos.frase).toBe('1º que menos gastou');
      expect(gastos.tom).toBe('bom');
      expect(gastos.destaque).toBe(true);
    }
    const projetos = ps.find((p) => p.criterio.id === 'projetos')!;
    if (!projetos.fora) expect([projetos.frase, projetos.tom]).toEqual(['1º com menos projetos', 'ruim']);
    // Destaques bons antes dos ruins.
    expect(ps[0].fora || ps[0].tom).toBe('bom');
  });

  it('explica quando está fora de um ranking', () => {
    const g = posicoesDoSenador(r, 'd').find((p) => p.criterio.id === 'gastos')!;
    expect(g.fora && g.motivo).toContain('sem gastos');
  });
});

describe('período de cada ranking', () => {
  const r = { ...ranking([]), atualizadoEm: '2026-10-28T06:00:00Z' };
  it('diz sempre o período, e que a cota do ano corrente ainda não fechou', () => {
    expect(crit('presenca').periodo(r).completo).toBe('Votações de fev/2023 a out/2026');
    expect(crit('fidelidade').periodo(r).curto).toBe('fev/2023 a out/2026');
    expect(crit('gastos').periodo(r)).toEqual({ curto: 'jan a out/2026', completo: 'Cota de 2026, de janeiro a outubro (ano em curso)' });
    expect(crit('gastos').periodo({ ...r, cotaAno: 2025 }).curto).toBe('2025');
    expect(crit('projetos').periodo(r).curto).toBe('toda a carreira');
  });

  it('gastos: quem entrou ou voltou no meio do ano fica de fora', () => {
    const rr = ranking([linha('a', 'X', {}), linha('b', 'X', { exercicioDesde: '2026-04-02', cota: 40_000 })]);
    const g = classificar(rr, crit('gastos'), 'asc');
    expect(g.ranqueados.map((p) => p.linha.codigo)).toEqual(['a']);
    expect(g.fora[0].motivo).toBe('em exercício só desde abr/2026');
  });
});

describe('projetos que viraram lei', () => {
  it('ordena por leis e mostra quantos foram apresentados', () => {
    const r = ranking([linha('a', 'X', { leis: 2, proposicoes: 50 }), linha('b', 'X', { leis: 9, proposicoes: 30 })]);
    const c = classificar(r, crit('leis'), 'desc');
    expect(c.ranqueados.map((p) => p.linha.codigo)).toEqual(['b', 'a']);
    expect(crit('leis').nota(c.ranqueados[0].linha, r)).toBe('de 30 apresentados');
    expect(crit('leis').aba).toBe('projetos');
  });
});

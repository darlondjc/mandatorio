import { pctExibido } from './format';
import { inicioDaLegislatura, situacaoExercicio } from './ranking';

describe('inicioDaLegislatura', () => {
  it('acha o 1º de fevereiro da legislatura em curso', () => {
    expect(inicioDaLegislatura('2026-10-28T06:00:00Z')).toBe('2023-02-01');
    expect(inicioDaLegislatura('2027-01-31')).toBe('2023-02-01');
    expect(inicioDaLegislatura('2027-02-01')).toBe('2027-02-01');
    expect(inicioDaLegislatura('2022-05-01')).toBe('2019-02-01');
  });
});

describe('pctExibido', () => {
  it('não mostra 100% nem 0% quando não é', () => {
    expect(pctExibido(99.53)).toBe(99);
    expect(pctExibido(99.53, 1)).toBe(99.5);
    expect(pctExibido(99.98, 1)).toBe(99.9);
    expect(pctExibido(100)).toBe(100);
    expect(pctExibido(0.2)).toBe(1);
    expect(pctExibido(0)).toBe(0);
    expect(pctExibido(87.44)).toBe(87);
  });
});

describe('situacaoExercicio', () => {
  const ini = '2023-02-01';
  it('suplente sempre mostra desde quando, mesmo de antes da legislatura', () => {
    expect(situacaoExercicio({ participacao: '1º Suplente', exercicioDesde: '2026-03-11', votacoes: 59 }, ini, 426)).toBe('1º Suplente desde mar/2026');
    expect(situacaoExercicio({ participacao: '1º Suplente', exercicioDesde: '2020-11-03', votacoes: 426 }, ini, 426)).toBe('1º Suplente desde nov/2020');
    expect(situacaoExercicio({ participacao: '2º Suplente', primeiraVotacao: '2026-10-14', votacoes: 3 }, ini, 426)).toBe('2º Suplente desde out/2026');
    expect(
      situacaoExercicio({ participacao: '1º Suplente', exercicioDesde: '2026-05-06', primeiraVotacao: '2023-02-08', votacoes: 401 }, ini, 426),
    ).toBe('1º Suplente, de volta desde mai/2026');
  });
  it('titular que voltou, quem chegou sem dado de participação e quem teve afastamento', () => {
    expect(situacaoExercicio({ participacao: 'Titular', exercicioDesde: '2026-04-02', votacoes: 71 }, ini, 426)).toBe('De volta desde abr/2026');
    expect(situacaoExercicio({ primeiraVotacao: '2026-10-14', votacoes: 3 }, ini, 426)).toBe('Em exercício desde out/2026');
    expect(situacaoExercicio({ participacao: 'Titular', exercicioDesde: '2020-04-17', votacoes: 83 }, ini, 426)).toBe('Teve afastamento');
  });
  it('titular contínuo não ganha etiqueta', () => {
    expect(situacaoExercicio({ participacao: 'Titular', exercicioDesde: '2023-02-01', votacoes: 424 }, ini, 426)).toBeNull();
  });
});

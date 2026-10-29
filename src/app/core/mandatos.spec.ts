import { donoDoAno, formatarIndicador, listaMandatos, resumoNoMandato } from './mandatos';
import type { Presidente, SerieIndicador } from './models';

const resumo = { projetos: 0, projetosLei: 0, mps: 0, mpsLei: 0, mpsTramitando: 0, mpsCaducadas: 0, mpsRejeitadas: 0, vetos: 0, vetosTotais: 0, vetosParciais: 0, vetosMantidos: 0, vetosDerrubados: 0, vetosAguardando: 0 };
const pres = (id: string, mandatos: [string, string, string, number][]): Presidente => ({
  id, nome: id, nomeCompleto: id, foto: null, nascimento: null, naturalidade: null, perfil: null,
  mandatos: mandatos.map(([mid, inicio, fim, ordem]) => ({ id: mid, inicio, fim, ordem, vice: null, partidoVice: null, partido: 'X', atual: fim > '2026-10-29', resumo })),
});
const MANDATOS = listaMandatos([
  pres('dilma', [['2011-2014', '2011-01-01', '2015-01-01', 1], ['2015-2016', '2015-01-01', '2016-05-12', 2]]),
  pres('temer', [['2016-2018', '2016-05-12', '2019-01-01', 1]]),
  pres('bolsonaro', [['2019-2022', '2019-01-01', '2023-01-01', 1]]),
  pres('lula', [['2023-2026', '2023-01-01', '2027-01-05', 3]]),
]);
const HOJE = new Date('2026-10-29T12:00:00Z');

describe('mandatos', () => {
  it('ordena os mandatos e dá nomes curtos', () => {
    expect(MANDATOS.map((m) => m.curto)).toEqual(['Dilma 1', 'Dilma 2', 'Temer', 'Bolsonaro', 'Lula 3']);
    expect(MANDATOS.map((m) => m.sigla)).toEqual(['D1', 'D2', 'T', 'B', 'L3']);
  });

  it('cada ano é de quem governou a maior parte dele', () => {
    expect(donoDoAno(2015, MANDATOS, HOJE)?.curto).toBe('Dilma 2');
    expect(donoDoAno(2016, MANDATOS, HOJE)?.curto).toBe('Temer');
    expect(donoDoAno(2019, MANDATOS, HOJE)?.curto).toBe('Bolsonaro');
    expect(donoDoAno(2026, MANDATOS, HOJE)?.curto).toBe('Lula 3');
    expect(donoDoAno(2027, MANDATOS, HOJE)).toBeNull();
  });

  it('resume a série no mandato: média, início e fim, e marca o ano parcial', () => {
    const serie = {
      id: 'x', rotulo: 'X', titulo: 'X', unidade: '%', casas: 1, tipo: 'nivel', fonte: '', url: '', nota: null,
      anos: { 2018: 12, 2019: 11, 2020: 14, 2021: 13, 2022: 9, 2023: 8, 2024: 7, 2026: 6 },
      reais: null, referenciaReal: null, parciais: ['2026'], metodologiaAntigaAte: null, manual: false,
    } as SerieIndicador;
    const b = resumoNoMandato(serie, MANDATOS[3], MANDATOS, false, HOJE);
    expect(b.anos).toEqual([2019, 2020, 2021, 2022]);
    expect(b.media).toBe(11.75);
    expect([b.inicio?.valor, b.fim?.valor]).toEqual([11, 9]);
    const l = resumoNoMandato(serie, MANDATOS[4], MANDATOS, false, HOJE);
    expect([l.anos, l.parcial]).toEqual([[2023, 2024, 2026], true]);
    expect(resumoNoMandato(serie, MANDATOS[0], MANDATOS, false, HOJE).media).toBeNull();
  });

  it('formata cada unidade', () => {
    expect(formatarIndicador(6.17, { unidade: '%', casas: 1 })).toBe('6,2%');
    expect(formatarIndicador(1518, { unidade: 'R$', casas: 0 })).toBe('R$ 1.518');
    expect(formatarIndicador(9001, { unidade: 'km²', casas: 0 })).toBe('9.001 km²');
    expect(formatarIndicador(1467, { unidade: 'vítimas', casas: 0 })).toBe('1.467');
  });
});

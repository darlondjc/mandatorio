import { descricaoCurta } from './descricao';

describe('descricaoCurta', () => {
  const casos: [string | null, string | null][] = [
    ['Votação nominal da Proposta de Emenda à Constituição nº 221, de 2019, em primeiro turno.', '1º turno'],
    ['Votação nominal da PEC nº 9/2026 (2º Turno).', '2º turno'],
    ['Votação nominal do Projeto de Lei nº 2.159, de 2021, nos termos do parecer, ressalvados os destaques.', 'Texto principal, ressalvados os destaques'],
    ['Votação nominal da Emenda nº 12 ao Projeto de Lei nº 4, de 2025, destacada.', 'Destaque da emenda nº 12'],
    ['Votação nominal da Emenda nº 1 (Substitutivo) ao PL nº 4/2025, nos termos do parecer.', 'Substitutivo (emenda nº 1)'],
    ['Votação nominal do Art. 13 do Projeto de Lei Complementar nº 114, de 2026, destacado.', 'Destaque de trecho'],
    ['Votação nominal da Mensagem nº 12 - Gabriel Muricca Galípolo (Banco Central do Brasil).', 'Indicação de Gabriel Muricca Galípolo (Banco Central do Brasil)'],
    ['Votação nominal do Requerimento nº 911, de 2025, de iniciativa de Líderes, que solicita calendário especial para a Proposta de Emenda à Constituição nº 48, de 2023.', 'Requerimento de calendário especial (PEC 48/2023)'],
    ['(Votação nominal do Requerimento nº 451, de 2025, que solicita urgência para o PL nº 1)', 'Requerimento de urgência'],
    ['Votação nominal do Projeto de Lei Complementar nº 186, de 2026, nos termos do parecer.', null],
    ['Votação nominal do Substitutivo da Câmara dos Deputados ao PLP 124/2022, na forma do texto consolidado.', 'Substitutivo da Câmara'],
    [null, null],
  ];
  for (const [entrada, esperado] of casos) {
    it(`${entrada?.slice(0, 50)} → ${esperado}`, () => expect(descricaoCurta(entrada)).toBe(esperado));
  }
});

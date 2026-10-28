import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dimensoesImagem } from './fotos.ts';
import { etapaProjeto, lerCadastro, resumir, situacaoMP, situacaoVeto } from './presidente.ts';
import { citaSenador, fracaoExercicio, maioriaPorPartido, mandatoDaLegislatura } from './senado.ts';
import { assuntoDoVeto, descricaoVotacao, identificacao, isoData, materiaDoVeto, normalizarVoto, resultadoVotacao, somarDiasSemRecesso } from './util.ts';

test('normaliza votos do Senado', () => {
  assert.equal(normalizarVoto('Sim'), 'sim');
  assert.equal(normalizarVoto('Não'), 'nao');
  assert.equal(normalizarVoto('NAO'), 'nao');
  assert.equal(normalizarVoto('Abstenção'), 'abstencao');
  assert.equal(normalizarVoto('P-NRV'), 'abstencao');
  assert.equal(normalizarVoto('Obstrução'), 'abstencao');
  assert.equal(normalizarVoto('Votou'), 'secreto');
  assert.equal(normalizarVoto('AP'), 'ausente');
  assert.equal(normalizarVoto('MIS'), 'ausente');
  assert.equal(normalizarVoto('LP'), 'ausente');
  assert.equal(normalizarVoto(undefined), 'ausente');
});

test('datas e identificação de matérias', () => {
  assert.equal(isoData('16/09/2026'), '2026-09-16');
  assert.equal(isoData('2026-09-16T10:00:00'), '2026-09-16');
  assert.equal(isoData(''), null);
  assert.equal(identificacao('PL', 4512, 2025), 'PL 4.512/2025');
  assert.equal(identificacao('PEC', '9', '2026'), 'PEC 9/2026');
});

test('prazo de MP pula o recesso', () => {
  // Sem recesso no caminho: 120 dias corridos.
  assert.equal(somarDiasSemRecesso('2026-02-10', 120), '2026-06-10');
  // Atravessa 18–31/jul: 14 dias a mais.
  assert.equal(somarDiasSemRecesso('2026-06-01', 120), '2026-10-13');
});

test('situação de MP', () => {
  assert.equal(situacaoMP('Transformada em Norma Jurídica', null), 'lei');
  assert.equal(situacaoMP('Rejeitada', null), 'rejeitada');
  assert.equal(situacaoMP('Perda de Eficácia', null), 'caducou');
  assert.equal(situacaoMP('Aguardando Deliberação', '2026-01-01', '2026-05-01'), 'caducou');
  assert.equal(situacaoMP('Aguardando Deliberação', '2026-12-01', '2026-10-01'), 'tramitando');
});

test('etapa de projeto e situação de veto', () => {
  assert.equal(etapaProjeto('Transformado em Norma Jurídica', 'PLEN'), 'lei');
  assert.equal(etapaProjeto('Aguardando Sanção', 'SF'), 'sancao');
  assert.equal(etapaProjeto('Remetida ao Senado Federal', 'MESA'), 'senado');
  assert.equal(etapaProjeto('Aguardando Parecer', 'CCJC'), 'camara');
  assert.equal(etapaProjeto('Arquivada', 'MESA'), 'arquivado');
  assert.equal(situacaoVeto('Veto mantido'), 'mantido');
  assert.equal(situacaoVeto('Veto derrubado'), 'derrubado');
  assert.equal(situacaoVeto('Veto derrubado em parte, mantido o restante'), 'derrubado-parcial');
  assert.equal(situacaoVeto('Aguardando sessão'), 'aguardando');
});

test('maioria do partido ignora ausências e empata em null', () => {
  const m = maioriaPorPartido({
    id: '1', data: '2026-01-01', materia: 'PL 1/2026', ementa: '', descricao: null, resultado: null,
    votos: [
      { codigo: 'a', nome: 'a', partido: 'X', uf: 'DF', sigla: 'Sim' },
      { codigo: 'b', nome: 'b', partido: 'X', uf: 'DF', sigla: 'Sim' },
      { codigo: 'c', nome: 'c', partido: 'X', uf: 'DF', sigla: 'Não' },
      { codigo: 'd', nome: 'd', partido: 'X', uf: 'DF', sigla: 'MIS' },
      { codigo: 'e', nome: 'e', partido: 'Y', uf: 'DF', sigla: 'Sim' },
      { codigo: 'f', nome: 'f', partido: 'Y', uf: 'DF', sigla: 'Não' },
    ],
  });
  assert.equal(m.get('X'), 'sim');
  assert.equal(m.get('Y'), null);
});

test('resumo do mandato presidencial', () => {
  const r = resumir({
    medidas: [
      { situacao: 'lei' }, { situacao: 'lei' }, { situacao: 'tramitando' }, { situacao: 'caducou' },
    ] as never,
    vetos: [{ situacao: 'mantido', tipo: 'total' }, { situacao: 'derrubado-parcial', tipo: 'parcial' }] as never,
    projetos: [{ etapa: 'lei' }, { etapa: 'camara' }] as never,
  });
  assert.equal(r.mps, 4);
  assert.equal(r.mpsLei, 2);
  assert.equal(r.vetosDerrubados, 1);
  assert.equal(r.vetosTotais, 1);
  assert.equal(r.projetosLei, 1);
});

test('resultado e textos de veto', () => {
  assert.equal(resultadoVotacao('A'), 'Aprovado');
  assert.equal(resultadoVotacao('R'), 'Rejeitado');
  assert.equal(resultadoVotacao(''), null);
  assert.equal(materiaDoVeto('Veto Parcial aposto ao Projeto de Lei nº 2.159, de 2021, que "Dispõe sobre o licenciamento"'), 'PL 2.159/2021');
  assert.equal(materiaDoVeto('Veto Total aposto ao Projeto de Lei Complementar nº 121, de 2025'), 'PLP 121/2025');
  assert.equal(materiaDoVeto('Veto Parcial aposto ao Projeto de Lei do Congresso Nacional nº 5, de 2024'), 'PLN 5/2024');
  assert.equal(materiaDoVeto('Veto sem referência'), null);
  assert.equal(assuntoDoVeto('Veto Parcial aposto ao Projeto de Lei nº 2.159, de 2021, que "Dispõe sobre o licenciamento ambiental."'), 'Dispõe sobre o licenciamento ambiental.');
  assert.equal(situacaoVeto('PARCIALMENTE_REJEITADO'), 'derrubado-parcial');
  assert.equal(situacaoVeto('REJEITADO'), 'derrubado');
  assert.equal(situacaoVeto('MANTIDO'), 'mantido');
  assert.equal(situacaoVeto('MANTIDO_PARCIALMENTE'), 'derrubado-parcial');
  assert.equal(situacaoVeto('MANTIDA_MATERIA'), 'mantido');
  assert.equal(situacaoVeto('PREJUDICADO'), 'prejudicado');
  assert.equal(situacaoVeto('REJEITADO_PLENARIO'), 'derrubado');
  assert.equal(situacaoVeto(''), 'aguardando');
});

test('reconhece o senador no campo de autoria', () => {
  assert.equal(citaSenador('Senador Alan Rick (REPUBLICANOS/AC)', 'Alan Rick', 'Alan Rick Miranda'), true);
  assert.equal(citaSenador('Senador Marcos Pontes (PL/SP)', 'Astronauta Marcos Pontes', 'Marcos Cesar Pontes'), true);
  assert.equal(citaSenador('Senador Marcos Rogério (PL/RO)', 'Astronauta Marcos Pontes', 'Marcos Cesar Pontes'), false);
  assert.equal(citaSenador('Senadora Damares Alves (REPUBLICANOS/DF)', 'Damares Alves', 'Damares Regina Alves'), true);
  assert.equal(citaSenador('Senador Marcos Cesar Pontes', 'Astronauta Marcos Pontes', 'Marcos Cesar Pontes'), true);
  assert.equal(citaSenador('Senador Davi Alcolumbre (UNIÃO/AP)', 'Alan Rick', 'Alan Rick Miranda'), false);
  assert.equal(citaSenador('', 'Alan Rick', 'Alan Rick Miranda'), false);
});

test('descrição da votação só quando acrescenta algo à ementa', () => {
  assert.equal(descricaoVotacao('Votação em 1º turno', 'Altera a Constituição'), 'Votação em 1º turno');
  assert.equal(descricaoVotacao('Altera a Constituição', 'Altera a  Constituição'), null);
  assert.equal(descricaoVotacao('  ', 'x'), null);
  assert.equal(descricaoVotacao(undefined, 'x'), null);
});

test('cadastro de presidentes: mandatos sem sobreposição e sem buracos', () => {
  const mandatos = lerCadastro()
    .flatMap((p) => p.mandatos.map((m) => ({ ...m, quem: p.id })))
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
  assert.ok(mandatos.length >= 7);
  for (let i = 1; i < mandatos.length; i++) {
    assert.equal(mandatos[i].inicio, mandatos[i - 1].fim, `${mandatos[i - 1].quem} ${mandatos[i - 1].id} → ${mandatos[i].quem} ${mandatos[i].id}`);
  }
  for (const m of mandatos) assert.ok(m.inicio < m.fim, `${m.quem} ${m.id}`);
  const ids = lerCadastro().flatMap((p) => p.mandatos.map((m) => `${p.id}/${m.id}`));
  assert.equal(new Set(ids).size, ids.length);
});

test('mandato da legislatura e saída de quem deixou o exercício', () => {
  const mandatos = [
    {
      UfParlamentar: 'MA',
      DescricaoParticipacao: '1º Suplente',
      PrimeiraLegislaturaDoMandato: { NumeroLegislatura: '57', DataInicio: '2023-02-01', DataFim: '2027-01-31' },
      SegundaLegislaturaDoMandato: { NumeroLegislatura: '58', DataInicio: '2027-02-01', DataFim: '2031-01-31' },
      Exercicios: {
        Exercicio: [
          { DataInicio: '2024-03-01', DataFim: '2024-07-02', DescricaoCausaAfastamento: 'Retorno do titular' },
          { DataInicio: '2023-02-01', DataFim: '2023-05-10', DescricaoCausaAfastamento: 'Retorno do titular ' },
        ],
      },
    },
    { PrimeiraLegislaturaDoMandato: { NumeroLegislatura: '55' }, SegundaLegislaturaDoMandato: { NumeroLegislatura: '56' } },
  ];
  const m = mandatoDaLegislatura(mandatos, 57)!;
  assert.equal(m.uf, 'MA');
  assert.equal(m.participacao, '1º Suplente');
  assert.deepEqual(m.mandato, { inicio: '2023-02-01', fim: '2031-01-31', legislaturas: [57, 58] });
  assert.deepEqual(m.saida, { data: '2024-07-02', motivo: 'Retorno do titular' });
  assert.equal(m.exercicioDesde, '2024-03-01');
  assert.deepEqual(m.exercicios.map((e) => [e.inicio, e.fim, e.motivo]), [
    ['2023-02-01', '2023-05-10', 'Retorno do titular'],
    ['2024-03-01', '2024-07-02', 'Retorno do titular'],
  ]);
  assert.equal(m.titular, null);
  assert.deepEqual(mandatoDaLegislatura([{ ...mandatos[0], Titular: { CodigoParlamentar: '5953', NomeParlamentar: 'Mecias de Jesus' } }], 57)!.titular, {
    codigo: '5953',
    nome: 'Mecias de Jesus',
  });
  // Um exercício só, como objeto e não lista.
  const um = mandatoDaLegislatura([{ ...mandatos[0], Exercicios: { Exercicio: { DataInicio: '2023-02-01' } } }], 58)!;
  assert.deepEqual(um.saida, { data: null, motivo: null });
  assert.equal(mandatoDaLegislatura(mandatos, 54), null);
});

test('lê largura e altura do cabeçalho de JPEG e PNG', () => {
  // SOI, APP0 curto, SOF0 com altura 340 e largura 260.
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x54, 0x01, 0x04, 0x03, 0, 0, 0, 0]);
  assert.deepEqual(dimensoesImagem(jpeg), { largura: 260, altura: 340 });
  const png = new Uint8Array(32);
  png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  new DataView(png.buffer).setUint32(16, 640);
  new DataView(png.buffer).setUint32(20, 800);
  assert.deepEqual(dimensoesImagem(png), { largura: 640, altura: 800 });
  assert.equal(dimensoesImagem(Uint8Array.from([1, 2, 3])), null);
});

test('fração do ano em exercício', () => {
  const todo = [{ inicio: '2019-02-01', fim: null }];
  assert.equal(fracaoExercicio(todo, 2024, '2026-10-28'), 1);
  // Ano corrente: conta só até hoje.
  assert.equal(fracaoExercicio(todo, 2026, '2026-10-28'), 1);
  // Entrou em 11/03/2026: ~ 77% do período de jan a 28/out.
  assert.equal(fracaoExercicio([{ inicio: '2026-03-11', fim: null }], 2026, '2026-10-28'), 0.77);
  // Licença de um mês no meio do ano.
  assert.equal(fracaoExercicio([{ inicio: '2023-02-01', fim: '2025-05-31' }, { inicio: '2025-07-01', fim: null }], 2025, '2026-10-28'), 0.92);
  assert.equal(fracaoExercicio(todo, 2018, '2026-10-28'), 0);
});

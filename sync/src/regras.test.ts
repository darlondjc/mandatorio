import assert from 'node:assert/strict';
import { test } from 'node:test';
import { etapaProjeto, resumir, situacaoMP, situacaoVeto } from './presidente.ts';
import { maioriaPorPartido } from './senado.ts';
import { identificacao, isoData, normalizarVoto, somarDiasSemRecesso } from './util.ts';

test('normaliza votos do Senado', () => {
  assert.equal(normalizarVoto('Sim'), 'sim');
  assert.equal(normalizarVoto('Não'), 'nao');
  assert.equal(normalizarVoto('NAO'), 'nao');
  assert.equal(normalizarVoto('Abstenção'), 'abstencao');
  assert.equal(normalizarVoto('P-NRV'), 'abstencao');
  assert.equal(normalizarVoto('Obstrução'), 'abstencao');
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
    id: '1', data: '2026-01-01', materia: 'PL 1/2026', ementa: '', resultado: null,
    votos: [
      { codigo: 'a', partido: 'X', sigla: 'Sim' },
      { codigo: 'b', partido: 'X', sigla: 'Sim' },
      { codigo: 'c', partido: 'X', sigla: 'Não' },
      { codigo: 'd', partido: 'X', sigla: 'MIS' },
      { codigo: 'e', partido: 'Y', sigla: 'Sim' },
      { codigo: 'f', partido: 'Y', sigla: 'Não' },
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

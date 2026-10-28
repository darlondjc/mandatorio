// Coleta do Senado Federal.
// Fontes:
//   - Dados Abertos do Senado: https://legis.senado.leg.br/dadosabertos (senadores, comissões, autorias, votações)
//   - Transparência / CEAPS:  https://adm.senado.gov.br/adm-dadosabertos (cota parlamentar)
// Os formatos abaixo seguem a documentação pública; o código tolera campos ausentes e nomes
// alternativos porque a API muda com alguma frequência. Rode `npm run sync:dry` para conferir.

import type {
  Cadeira,
  Comissao,
  ExSenador,
  GastoAno,
  PartidoBancada,
  Plenario,
  Proposicao,
  Saida,
  Senador,
  Votacao as VotacaoCompleta,
  Voto,
  VotoSenador,
} from '../../src/app/core/models.ts';
import { escolherFotos } from './fotos.ts';
import { emParalelo, getJson, lista, NaoEncontrado } from './http.ts';
import { descricaoVotacao, identificacao, isoData, normalizarVoto, resultadoVotacao, semAcento } from './util.ts';

const LEGIS = 'https://legis.senado.leg.br/dadosabertos';
const ADM = 'https://adm.senado.gov.br/adm-dadosabertos/api/v1';

/** Ordem dos partidos no semicírculo (da esquerda para a direita), aproximando o espectro político. */
const ORDEM_PARTIDOS = ['PSOL', 'REDE', 'PT', 'PCdoB', 'PV', 'PSB', 'PDT', 'MDB', 'PSD', 'CIDADANIA', 'PODEMOS', 'PODE', 'PSDB', 'SOLIDARIEDADE', 'AVANTE', 'UNIÃO', 'REPUBLICANOS', 'PP', 'PL', 'NOVO'];

type Json = Record<string, any>;

interface SenadorBase {
  codigo: string;
  nome: string;
  nomeCompleto: string;
  sexo: 'M' | 'F';
  partido: string;
  uf: string;
  foto: string | null;
  email: string | null;
  bloco: string | null;
  mandato: Senador['mandato'];
}

export interface ResultadoSenado {
  plenario: Plenario;
  senadores: Senador[];
  votosPorSenador: Map<string, VotoSenador[]>;
  gastosPorSenador: Map<string, GastoAno[]>;
  proposicoesPorSenador: Map<string, Proposicao[]>;
  votacoes: VotacaoCompleta[];
}

// ---------------------------------------------------------------- senadores

async function senadoresEmExercicio(): Promise<{ base: SenadorBase[]; legislatura: number; inicio: string; fim: string }> {
  const j = await getJson<Json>(`${LEGIS}/senador/lista/atual.json`);
  const parlamentares = lista(j?.ListaParlamentarEmExercicio?.Parlamentares?.Parlamentar);
  let legislatura = 0;
  let inicio = '';
  let fim = '';
  const base = parlamentares.map((p: Json): SenadorBase => {
    const id = p.IdentificacaoParlamentar ?? {};
    const m = p.Mandato ?? {};
    const leg1 = m.PrimeiraLegislaturaDoMandato ?? {};
    const leg2 = m.SegundaLegislaturaDoMandato ?? {};
    const legs = [Number(leg1.NumeroLegislatura), Number(leg2.NumeroLegislatura)].filter(Boolean);
    // Legislatura em curso = a de maior número já iniciada.
    for (const l of [leg1, leg2]) {
      const n = Number(l.NumeroLegislatura);
      if (n && isoData(l.DataInicio)! <= new Date().toISOString().slice(0, 10) && n > legislatura) {
        legislatura = n;
        inicio = isoData(l.DataInicio)!;
        fim = isoData(l.DataFim)!;
      }
    }
    return {
      codigo: String(id.CodigoParlamentar),
      nome: id.NomeParlamentar,
      nomeCompleto: id.NomeCompletoParlamentar ?? id.NomeParlamentar,
      sexo: id.SexoParlamentar === 'Feminino' ? 'F' : 'M',
      partido: id.SiglaPartidoParlamentar ?? 'S/Partido',
      uf: id.UfParlamentar ?? m.UfParlamentar,
      foto: id.UrlFotoParlamentar ? String(id.UrlFotoParlamentar).replace(/^http:\/\//, 'https://') : null,
      email: id.EmailParlamentar ?? null,
      bloco: id.Bloco?.NomeBloco ?? null,
      mandato: {
        inicio: isoData(leg1.DataInicio) ?? '',
        fim: isoData(leg2.DataFim ?? leg1.DataFim) ?? '',
        legislaturas: legs,
        ordem: 1,
      },
    };
  });
  return { base, legislatura, inicio, fim };
}

async function detalhes(codigo: string) {
  const out = {
    nascimento: null as string | null,
    naturalidade: null as string | null,
    profissao: null as string | null,
    mandatos: 1,
    comissoes: [] as Comissao[],
    identificacao: {} as Json,
    listaMandatos: [] as Json[],
  };
  try {
    const d = await getJson<Json>(`${LEGIS}/senador/${codigo}.json`);
    out.identificacao = d?.DetalheParlamentar?.Parlamentar?.IdentificacaoParlamentar ?? {};
    const basicos = d?.DetalheParlamentar?.Parlamentar?.DadosBasicosParlamentar ?? {};
    out.nascimento = isoData(basicos.DataNascimento);
    out.naturalidade = basicos.Naturalidade ? `${basicos.Naturalidade}${basicos.UfNaturalidade ? ` (${basicos.UfNaturalidade})` : ''}` : null;
  } catch (e) {
    if (!(e instanceof NaoEncontrado)) throw e;
  }
  // Profissão: o endpoint /profissao devolve o histórico acadêmico, sem a profissão. Fica null por ora.
  try {
    const m = await getJson<Json>(`${LEGIS}/senador/${codigo}/mandatos.json`);
    out.listaMandatos = lista<Json>(m?.MandatoParlamentar?.Parlamentar?.Mandatos?.Mandato);
    out.mandatos = Math.max(1, out.listaMandatos.length);
  } catch {}
  try {
    const c = await getJson<Json>(`${LEGIS}/senador/${codigo}/comissoes.json`);
    out.comissoes = lista(c?.MembroComissaoParlamentar?.Parlamentar?.MembroComissoes?.Comissao)
      .filter((x: Json) => !x.DataFim)
      .map((x: Json) => ({
        sigla: x.IdentificacaoComissao?.SiglaComissao ?? '',
        nome: x.IdentificacaoComissao?.NomeComissao ?? '',
        cargo: x.DescricaoParticipacao ?? 'Membro',
      }));
  } catch {}
  return out;
}

/**
 * O mandato que cobre a legislatura, com a participação (titular ou suplente) e o fim do
 * último exercício. Serve para quem saiu: o Senado registra cada período em exercício, com a
 * causa do afastamento.
 */
export function mandatoDaLegislatura(mandatos: Json[], legislatura: number) {
  const numero = (l: Json | undefined) => Number(l?.NumeroLegislatura) || 0;
  const m = mandatos.find((x) => [numero(x.PrimeiraLegislaturaDoMandato), numero(x.SegundaLegislaturaDoMandato)].includes(legislatura));
  if (!m) return null;
  const leg1 = m.PrimeiraLegislaturaDoMandato ?? {};
  const leg2 = m.SegundaLegislaturaDoMandato ?? {};
  const exercicios = lista<Json>(m.Exercicios?.Exercicio).sort((a, b) => (isoData(a.DataInicio) ?? '').localeCompare(isoData(b.DataInicio) ?? ''));
  const ultimo = exercicios.at(-1);
  return {
    uf: (m.UfParlamentar as string | undefined) ?? null,
    participacao: (m.DescricaoParticipacao as string | undefined) ?? null,
    mandato: {
      inicio: isoData(leg1.DataInicio) ?? '',
      fim: isoData(leg2.DataFim ?? leg1.DataFim) ?? '',
      legislaturas: [numero(leg1), numero(leg2)].filter(Boolean),
    },
    /** Início do período em exercício mais recente (o atual, para quem está no cargo). */
    exercicioDesde: isoData(ultimo?.DataInicio),
    /** Para suplentes: o titular da vaga. */
    titular: m.Titular?.CodigoParlamentar
      ? { codigo: String(m.Titular.CodigoParlamentar), nome: String(m.Titular.NomeParlamentar ?? '') }
      : null,
    /** Todos os períodos em exercício neste mandato, do mais antigo ao atual. */
    exercicios: exercicios.map((e) => ({
      inicio: isoData(e.DataInicio) ?? '',
      fim: isoData(e.DataFim),
      motivo: (e.DescricaoCausaAfastamento as string | undefined)?.trim() || null,
    })),
    saida: {
      data: isoData(ultimo?.DataFim),
      motivo: (ultimo?.DescricaoCausaAfastamento as string | undefined)?.trim() || null,
    },
  };
}

/** Diagnóstico de quem saiu: quantos, e um exemplo do que veio da API. */
export const diagSaidas = { total: 0, exemplos: [] as string[], suplentes: [] as string[] };

const SIGLAS_PROPOSICAO = ['PL', 'PLS', 'PEC', 'PLP', 'PDL', 'PRS'];
const PARTICULAS = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);

/** Diagnóstico das autorias: quantos senadores tiveram proposições e exemplos dos que ficaram sem. */
export const diagAutorias = { comItens: 0, semItens: [] as string[] };

/**
 * O campo de autoria traz o nome como o Senado o escreve ("Senador Fulano (PL/SP)"),
 * que nem sempre é igual ao nome parlamentar. Aceita o nome parlamentar, o nome civil,
 * ou o sobrenome mais metade das palavras do nome parlamentar.
 */
export function citaSenador(autoria: string, nome: string, nomeCompleto: string): boolean {
  const a = semAcento(autoria);
  if (!a) return false;
  if (a.includes(semAcento(nome)) || a.includes(semAcento(nomeCompleto))) return true;
  const palavras = semAcento(nome)
    .split(/\s+/)
    .filter((w) => w.length > 1 && !PARTICULAS.has(w));
  // Apelidos ("Astronauta", "Dr.") nem sempre aparecem: basta o sobrenome e metade das palavras.
  const tem = (w: string) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '')}\\b`).test(a);
  return palavras.length > 0 && tem(palavras.at(-1)!) && palavras.filter(tem).length * 2 >= palavras.length;
}

/**
 * Proposições de autoria do senador, pelo serviço /processo (o antigo autorias.json foi
 * descontinuado). Confere se cada item cita o senador na autoria, para o caso de a API
 * ignorar o filtro de autor.
 */
async function proposicoesDoSenador(codigo: string, nome: string, nomeCompleto: string): Promise<Proposicao[]> {
  let brutos: Json[] = [];
  try {
    const j = await getJson<any>(`${LEGIS}/processo?codigoParlamentarAutor=${codigo}`);
    brutos = lista<Json>(Array.isArray(j) ? j : j?.processos);
  } catch {}
  const itens = brutos.filter((p) => citaSenador(String(p.autoria ?? ''), nome, nomeCompleto));
  if (itens.length) diagAutorias.comItens++;
  else diagAutorias.semItens.push(`${nome}: ${brutos.length} itens da API, autoria ex.: ${String(brutos[0]?.autoria ?? '—').slice(0, 80)}`);
  return itens
    .map((p): Proposicao => {
      const norma = p.normaGerada ? String(p.normaGerada) : '';
      return {
        id: String(p.id ?? p.codigoMateria),
        materia: String(p.identificacao ?? '').replace(/(\d)(?=(\d{3})+\/)/g, '$1.'),
        ementa: p.ementa ?? '',
        data: isoData(p.dataApresentacao) ?? '',
        situacao: norma ? `Virou ${norma}` : p.dataDeliberacao ? 'Deliberada' : 'Em tramitação',
        virouLei: !!norma,
        url: p.codigoMateria ? `https://www25.senado.leg.br/web/atividade/materias/-/materia/${p.codigoMateria}` : null,
      };
    })
    .filter((p) => SIGLAS_PROPOSICAO.some((s) => p.materia.startsWith(s + ' ')))
    .sort((a, b) => b.data.localeCompare(a.data));
}

// ---------------------------------------------------------------- votações

interface Votacao {
  id: string;
  data: string;
  materia: string;
  ementa: string;
  descricao: string | null;
  resultado: string | null;
  votos: { codigo: string; nome: string; partido: string; uf: string; sigla: string }[];
}

/** Votações nominais do plenário, mês a mês (a API limita o intervalo). */
async function votacoes(inicio: string, fim: string): Promise<Votacao[]> {
  const out: Votacao[] = [];
  const cursor = new Date(inicio + 'T12:00:00Z');
  const limite = new Date(fim + 'T12:00:00Z');
  while (cursor <= limite) {
    const a = cursor.toISOString().slice(0, 10);
    const proximo = new Date(cursor);
    proximo.setUTCMonth(proximo.getUTCMonth() + 1);
    const b = new Date(Math.min(proximo.getTime() - 864e5, limite.getTime())).toISOString().slice(0, 10);
    const j = await getJson<any>(`${LEGIS}/votacao?dataInicio=${a}&dataFim=${b}`);
    for (const v of lista<Json>(Array.isArray(j) ? j : j?.votacoes ?? j?.Votacoes)) {
      const votos = lista<Json>(v.votos ?? v.Votos).map((x) => ({
        codigo: String(x.codigoParlamentar ?? x.CodigoParlamentar),
        nome: x.nomeParlamentar ?? x.NomeParlamentar ?? '',
        partido: x.siglaPartidoParlamentar ?? x.SiglaPartido ?? '',
        uf: x.siglaUFParlamentar ?? x.siglaUfParlamentar ?? x.SiglaUF ?? '',
        sigla: x.siglaVotoParlamentar ?? x.descricaoVotoParlamentar ?? x.SiglaVoto ?? '',
      }));
      if (!votos.length) continue; // votação simbólica
      const sigla = v.sigla ?? v.siglaMateria ?? '';
      out.push({
        id: String(v.codigoSessaoVotacao ?? v.codigoVotacao ?? v.CodigoSessaoVotacao),
        data: isoData(v.dataSessao ?? v.DataSessao) ?? a,
        materia: v.identificacao ?? (sigla ? identificacao(sigla, v.numero, v.ano) : (v.descricaoVotacao ?? 'Votação')),
        ementa: v.ementa ?? v.descricaoVotacao ?? '',
        descricao: descricaoVotacao(v.descricaoVotacao, v.ementa),
        resultado: resultadoVotacao(v.resultadoVotacao ?? v.descricaoResultado),
        votos,
      });
    }
    cursor.setTime(proximo.getTime());
  }
  return out.sort((x, y) => y.data.localeCompare(x.data));
}

/** Voto da maioria do partido na votação (empate ou ninguém votando sim/não = null). */
function maioriaPorPartido(v: Votacao): Map<string, Voto | null> {
  const cont = new Map<string, { sim: number; nao: number }>();
  for (const x of v.votos) {
    const n = normalizarVoto(x.sigla);
    if (n !== 'sim' && n !== 'nao') continue;
    const c = cont.get(x.partido) ?? { sim: 0, nao: 0 };
    c[n]++;
    cont.set(x.partido, c);
  }
  const out = new Map<string, Voto | null>();
  for (const [p, c] of cont) out.set(p, c.sim === c.nao ? null : c.sim > c.nao ? 'sim' : 'nao');
  return out;
}

// ---------------------------------------------------------------- CEAPS

async function despesas(ano: number): Promise<Map<string, GastoAno>> {
  const out = new Map<string, GastoAno>();
  let itens: Json[] = [];
  try {
    itens = lista(await getJson<Json[]>(`${ADM}/senadores/despesas_ceaps/${ano}`));
  } catch (e) {
    console.warn(`CEAPS ${ano} indisponível: ${(e as Error).message}`);
    return out;
  }
  const porSenador = new Map<string, { cat: Map<string, number>; mes: number[] }>();
  for (const d of itens) {
    const cod = String(d.codSenador ?? d.CodSenador ?? '');
    const valor = Number(String(d.valorReembolsado ?? d.ValorReembolsado ?? 0).replace(',', '.')) || 0;
    if (!cod || !valor) continue;
    const reg = porSenador.get(cod) ?? { cat: new Map(), mes: Array(12).fill(0) };
    const categoria = d.tipoDespesa ?? d.TipoDespesa ?? 'Outros';
    reg.cat.set(categoria, (reg.cat.get(categoria) ?? 0) + valor);
    const mes = Number(d.mes ?? d.Mes) - 1;
    if (mes >= 0 && mes < 12) reg.mes[mes] += valor;
    porSenador.set(cod, reg);
  }
  for (const [cod, r] of porSenador) {
    const porCategoria = [...r.cat].map(([categoria, valor]) => ({ categoria, valor: Math.round(valor) })).sort((a, b) => b.valor - a.valor);
    out.set(cod, {
      ano,
      total: Math.round(porCategoria.reduce((s, c) => s + c.valor, 0)),
      porCategoria,
      porMes: r.mes.map(Math.round),
    });
  }
  return out;
}

// ---------------------------------------------------------------- tudo

export async function coletarSenado(): Promise<ResultadoSenado> {
  const agora = new Date().toISOString();
  const hoje = agora.slice(0, 10);
  const anoAtual = Number(hoje.slice(0, 4));

  console.log('Senado: senadores em exercício…');
  const { base, legislatura, inicio, fim } = await senadoresEmExercicio();
  console.log(`  ${base.length} senadores, ${legislatura}ª legislatura`);

  console.log(`Senado: votações nominais desde ${inicio}…`);
  const vots = await votacoes(inicio, hoje);
  console.log(`  ${vots.length} votações nominais`);

  // Quem votou nesta legislatura e não está mais em exercício. As votações vêm da mais recente
  // para a mais antiga, então a primeira aparição traz o partido e a UF da época da saída.
  const atuais = new Set(base.map((s) => s.codigo));
  const vistos = new Map<string, Votacao['votos'][number]>();
  for (const v of vots) for (const x of v.votos) if (!atuais.has(x.codigo) && !vistos.has(x.codigo)) vistos.set(x.codigo, x);

  console.log(`Senado: detalhes, comissões e autorias (${base.length} em exercício, ${vistos.size} que saíram)…`);
  const det = await emParalelo(base, 4, (s) => detalhes(s.codigo));
  const detEx = await emParalelo([...vistos.keys()], 4, (c) => detalhes(c));
  const ex: (SenadorBase & { saida: Saida; participacao: string | null })[] = [...vistos.values()].map((x, i) => {
    const id = detEx[i].identificacao;
    const m = mandatoDaLegislatura(detEx[i].listaMandatos, legislatura);
    return {
      codigo: x.codigo,
      nome: id.NomeParlamentar ?? x.nome,
      nomeCompleto: id.NomeCompletoParlamentar ?? id.NomeParlamentar ?? x.nome,
      sexo: id.SexoParlamentar === 'Feminino' ? 'F' : 'M',
      partido: x.partido || id.SiglaPartidoParlamentar || 'S/Partido',
      uf: x.uf || m?.uf || id.UfParlamentar || '',
      foto: id.UrlFotoParlamentar ? String(id.UrlFotoParlamentar).replace(/^http:\/\//, 'https://') : null,
      email: null,
      bloco: null,
      mandato: m ? { ...m.mandato, ordem: 1 } : { inicio, fim, legislaturas: [legislatura], ordem: 1 },
      participacao: m?.participacao ?? null,
      saida: m?.saida ?? { data: null, motivo: null },
    };
  });
  diagSaidas.total = ex.length;
  diagSaidas.exemplos = ex.slice(0, 6).map((s, i) => `${s.nome} (${s.partido}-${s.uf}, ${s.participacao ?? '?'}): saída ${s.saida.data ?? '?'} ${s.saida.motivo ?? ''} · ${detEx[i].listaMandatos.length} mandatos na API`);

  // Em exercício: titular ou suplente, e desde quando (um suplente herda as datas do mandato da vaga).
  const atuaisMandato = base.map((_, i) => mandatoDaLegislatura(det[i].listaMandatos, legislatura));
  diagSaidas.suplentes = base
    .map((s, i) => ({ s, m: atuaisMandato[i], bruto: det[i].listaMandatos.find((x) => /suplente/i.test(String(x.DescricaoParticipacao ?? ''))) }))
    .filter((x) => /suplente/i.test(x.m?.participacao ?? ''))
    .map(({ s, m, bruto }) => `${s.nome} (${m!.participacao}) titular: ${m!.titular?.nome ?? '?'} · exercícios: ${m!.exercicios.map((e) => `${e.inicio}→${e.fim ?? 'atual'}`).join(', ')} · chaves: ${Object.keys(bruto ?? {}).join(',')}`);
  const todos = [...base, ...ex];
  const todosDet = [...det, ...detEx];
  const props = await emParalelo(todos, 4, (s) => proposicoesDoSenador(s.codigo, s.nome, s.nomeCompleto));

  // Em exercício: ano atual e anterior. Quem saiu: todos os anos da legislatura, porque os
  // gastos dele podem ter parado antes.
  console.log('Senado: cota parlamentar (CEAPS)…');
  const anoInicio = Number(inicio.slice(0, 4)) || anoAtual - 1;
  const anosCeaps = Array.from({ length: anoAtual - Math.min(anoInicio, anoAtual - 1) + 1 }, (_, i) => anoAtual - i);
  const ceaps = new Map<number, Map<string, GastoAno>>();
  for (const ano of anosCeaps) ceaps.set(ano, await despesas(ano));

  const votosPorSenador = new Map<string, VotoSenador[]>();
  for (const s of todos) votosPorSenador.set(s.codigo, []);
  for (const v of vots) {
    const maioria = maioriaPorPartido(v);
    const porCodigo = new Map(v.votos.map((x) => [x.codigo, x]));
    for (const s of todos) {
      const x = porCodigo.get(s.codigo);
      // Quem não aparece na lista não estava no exercício do mandato nessa data: fica de fora.
      if (!x) continue;
      const voto = normalizarVoto(x.sigla);
      const m = maioria.get(x.partido) ?? null;
      votosPorSenador.get(s.codigo)!.push({
        id: v.id,
        data: v.data,
        materia: v.materia,
        ementa: v.ementa,
        descricao: v.descricao,
        voto,
        votoOriginal: x.sigla,
        maioriaPartido: m,
        divergiu: m !== null && (voto === 'sim' || voto === 'nao') && voto !== m,
        resultado: v.resultado,
      });
    }
  }

  const cotaAtual = ceaps.get(anoAtual)!;
  const valoresCota = base.map((s) => cotaAtual.get(s.codigo)?.total ?? 0).filter((v) => v > 0);
  const mediaCota = valoresCota.length ? Math.round(valoresCota.reduce((a, b) => a + b, 0) / valoresCota.length) : 0;

  console.log('Senado: fotos…');
  const fotos = await escolherFotos(todos);

  const senadores: Senador[] = todos.map((s, i) => {
    const vs = votosPorSenador.get(s.codigo)!;
    const distribuicao: Record<Voto, number> = { sim: 0, nao: 0, abstencao: 0, secreto: 0, ausente: 0 };
    vs.forEach((v) => distribuicao[v.voto]++);
    const comparaveis = vs.filter((v) => v.maioriaPartido && (v.voto === 'sim' || v.voto === 'nao'));
    const saiu = i >= base.length;
    // Para quem saiu, a cota de referência é a do último ano com gastos.
    const anoCota = saiu ? (anosCeaps.find((a) => ceaps.get(a)!.get(s.codigo)) ?? anoAtual) : anoAtual;
    const d = todosDet[i];
    return {
      ...s,
      participacao: saiu ? (s as (typeof ex)[number]).participacao : (atuaisMandato[i]?.participacao ?? null),
      ...(() => {
        const m = saiu ? mandatoDaLegislatura(d.listaMandatos, legislatura) : atuaisMandato[i];
        return { exercicioDesde: m?.exercicioDesde ?? null, titular: m?.titular ?? null, exercicios: m?.exercicios ?? [] };
      })(),
      foto: fotos.get(s.codigo)?.foto ?? s.foto,
      fotoFonte: fotos.get(s.codigo)?.fonte ?? null,
      emExercicio: !saiu,
      mandato: { ...s.mandato, ordem: d.mandatos },
      nascimento: d.nascimento,
      naturalidade: d.naturalidade,
      profissao: d.profissao,
      comissoes: saiu ? [] : d.comissoes,
      resumo: {
        votacoes: vs.length,
        primeiraVotacao: vs.reduce<string | null>((m, v) => (!m || v.data < m ? v.data : m), null),
        votacoesLegislatura: vots.length,
        distribuicao,
        votosComparaveis: comparaveis.length,
        votosComPartido: comparaveis.filter((v) => !v.divergiu).length,
        mediaPartido: null,
        cotaAno: ceaps.get(anoCota)!.get(s.codigo)?.total ?? 0,
        cotaAnoReferencia: anoCota,
        cotaMediaSenado: mediaCota,
        proposicoes: props[i].length,
        proposicoesLei: props[i].filter((p) => p.virouLei).length,
      },
      atualizadoEm: agora,
    };
  });

  // Titular da vaga de cada suplente, quando a API não informa: quem tem o mesmo mandato
  // (mesma UF e mesmas datas) como titular, esteja no cargo ou não.
  for (const s of senadores) {
    if (s.titular || !/suplente/i.test(s.participacao ?? '')) continue;
    const t = senadores.find(
      (x) => x !== s && /titular/i.test(x.participacao ?? '') && x.uf === s.uf && x.mandato.inicio === s.mandato.inicio && x.mandato.fim === s.mandato.fim,
    );
    if (t) s.titular = { codigo: t.codigo, nome: t.nome };
  }

  // Média de alinhamento por partido, entre os senadores em exercício.
  const porPartido = new Map<string, Senador[]>();
  senadores.filter((s) => s.emExercicio).forEach((s) => porPartido.set(s.partido, [...(porPartido.get(s.partido) ?? []), s]));
  const mediaDoPartido = new Map<string, number | null>();
  for (const [partido, membros] of porPartido) {
    const validos = membros.filter((m) => m.resumo.votosComparaveis > 0);
    mediaDoPartido.set(
      partido,
      validos.length
        ? Math.round((validos.reduce((a, m) => a + m.resumo.votosComPartido / m.resumo.votosComparaveis, 0) / validos.length) * 100)
        : null,
    );
  }
  senadores.forEach((s) => (s.resumo.mediaPartido = mediaDoPartido.get(s.partido) ?? null));

  const contagem = new Map<string, number>();
  base.forEach((s) => contagem.set(s.partido, (contagem.get(s.partido) ?? 0) + 1));
  const posicao = (p: string) => {
    const i = ORDEM_PARTIDOS.findIndex((x) => semAcento(x) === semAcento(p));
    return i < 0 ? ORDEM_PARTIDOS.length : i;
  };
  const partidos: PartidoBancada[] = [...contagem]
    .map(([sigla, total]) => ({ sigla, total }))
    .sort((a, b) => posicao(a.sigla) - posicao(b.sigla) || b.total - a.total);
  const cadeiras: Cadeira[] = base.map((s) => ({ codigo: s.codigo, nome: s.nome, partido: s.partido, uf: s.uf, sexo: s.sexo }));
  const exSenadores: ExSenador[] = ex
    .map((s) => ({
      codigo: s.codigo,
      nome: s.nome,
      partido: s.partido,
      uf: s.uf,
      sexo: s.sexo,
      saida: s.saida,
      votacoes: votosPorSenador.get(s.codigo)!.length,
    }))
    .sort((a, b) => (b.saida.data ?? '').localeCompare(a.saida.data ?? '') || a.nome.localeCompare(b.nome, 'pt-BR'));

  const gastosPorSenador = new Map<string, GastoAno[]>();
  for (const [i, s] of todos.entries()) {
    const anos = i < base.length ? [anoAtual, anoAtual - 1] : anosCeaps;
    gastosPorSenador.set(
      s.codigo,
      anos.map((a) => ceaps.get(a)!.get(s.codigo)).filter((g): g is GastoAno => !!g),
    );
  }

  return {
    plenario: { legislatura, inicio, fim, atualizadoEm: agora, partidos, cadeiras, exSenadores },
    senadores,
    votosPorSenador,
    gastosPorSenador,
    proposicoesPorSenador: new Map(todos.map((s, i) => [s.codigo, props[i]])),
    votacoes: vots.map((v) => votacaoCompleta(v, agora)),
  };
}

/** A votação como o site mostra: placar, se foi secreta e o voto de cada senador. */
function votacaoCompleta(v: Votacao, agora: string): VotacaoCompleta {
  const placar: Record<Voto, number> = { sim: 0, nao: 0, abstencao: 0, secreto: 0, ausente: 0 };
  const votos = v.votos.map((x) => {
    const voto = normalizarVoto(x.sigla);
    placar[voto]++;
    return { codigo: x.codigo, nome: x.nome, partido: x.partido, uf: x.uf, voto, votoOriginal: x.sigla };
  });
  return {
    id: v.id,
    data: v.data,
    materia: v.materia,
    ementa: v.ementa,
    descricao: v.descricao,
    resultado: v.resultado,
    secreta: placar.secreto > 0 && placar.sim + placar.nao === 0,
    placar,
    votos: votos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    atualizadoEm: agora,
  };
}

export { maioriaPorPartido, type Votacao };

// Coleta dos atos do Presidente da República.
// Fontes:
//   - Medidas provisórias e projetos do Executivo: API da Câmara (https://dadosabertos.camara.leg.br/api/v2),
//     onde toda MP e todo projeto do Executivo começam a tramitar.
//   - Vetos: Dados Abertos do Congresso Nacional (https://legis.senado.leg.br/dadosabertos), sigla VET.
// Quem são os presidentes e seus mandatos vem de presidentes.json (cadastro manual).

import { readFileSync } from 'node:fs';
import type {
  AtosMandato,
  EtapaProjeto,
  MandatoPresidente,
  MedidaProvisoria,
  Presidente,
  ProjetoExecutivo,
  ResumoMandatoPresidente,
  SituacaoMP,
  SituacaoVeto,
  Veto,
} from '../../src/app/core/models.ts';
import { emParalelo, getJson, lista } from './http.ts';
import { assuntoDoVeto, hojeISO, identificacao, isoData, materiaDoVeto, semAcento, somarDiasSemRecesso } from './util.ts';

const CAMARA = 'https://dadosabertos.camara.leg.br/api/v2';
const LEGIS = 'https://legis.senado.leg.br/dadosabertos';
const PRAZO_MP = 120;

type Json = Record<string, any>;
type Cadastro = Omit<Presidente, 'mandatos'> & { mandatos: Omit<MandatoPresidente, 'atual' | 'resumo'>[] };

export function lerCadastro(): Cadastro[] {
  const j = JSON.parse(readFileSync(new URL('./presidentes.json', import.meta.url), 'utf8'));
  return j.presidentes;
}

/** Proposições da Câmara num período, paginando. */
async function proposicoesCamara(params: Record<string, string>): Promise<Json[]> {
  const out: Json[] = [];
  for (let pagina = 1; ; pagina++) {
    const q = new URLSearchParams({ ...params, itens: '100', pagina: String(pagina), ordem: 'DESC', ordenarPor: 'id' });
    const j = await getJson<Json>(`${CAMARA}/proposicoes?${q}`);
    const dados = lista<Json>(j?.dados);
    out.push(...dados);
    if (dados.length < 100) break;
  }
  return out;
}

async function detalheCamara(id: number | string): Promise<Json> {
  return (await getJson<Json>(`${CAMARA}/proposicoes/${id}`))?.dados ?? {};
}

export function situacaoMP(descricao: string, prazoFinal: string | null, hoje = hojeISO()): SituacaoMP {
  const s = semAcento(descricao);
  if (/transformad[ao] (em|na) (norma|lei)|norma juridica/.test(s)) return 'lei';
  if (/rejeitad/.test(s)) return 'rejeitada';
  if (/perd(a|eu) (de|da) eficacia|vigencia encerrada|prazo.*encerrad|eficacia encerrada|arquivad/.test(s)) return 'caducou';
  if (prazoFinal && prazoFinal < hoje) return 'caducou';
  return 'tramitando';
}

export function etapaProjeto(descricao: string, orgao: string): EtapaProjeto {
  const s = semAcento(descricao);
  if (/transformad[ao] (em|na) (norma|lei)|norma juridica/.test(s)) return 'lei';
  if (/arquivad|retirad|prejudicad|rejeitad/.test(s)) return 'arquivado';
  if (/sancao/.test(s)) return 'sancao';
  if (/remetid[ao] ao senado|senado federal/.test(s) || orgao === 'SF') return 'senado';
  return 'camara';
}

/** Anos cobertos por um mandato, até hoje. */
function anosDoMandato(m: Cadastro['mandatos'][number]): number[] {
  const ini = Number(m.inicio.slice(0, 4));
  const fim = Math.min(Number(m.fim.slice(0, 4)), Number(hojeISO().slice(0, 4)));
  return Array.from({ length: fim - ini + 1 }, (_, i) => ini + i);
}

/** Proposições de uma sigla nos anos do mandato, filtradas pela data de apresentação dentro do mandato. */
async function doMandato(m: Cadastro['mandatos'][number], siglaTipo: string, extra: Record<string, string> = {}) {
  const itens: Json[] = [];
  for (const ano of anosDoMandato(m)) itens.push(...(await proposicoesCamara({ siglaTipo, ano: String(ano), ...extra })));
  const comDetalhe = await emParalelo(itens, 4, async (p) => ({ p, d: await detalheCamara(p.id) }));
  return comDetalhe.filter(({ d }) => {
    const data = isoData(d.dataApresentacao);
    return !data || (data >= m.inicio && data < m.fim);
  });
}

async function medidasProvisorias(m: Cadastro['mandatos'][number], mandatoId: string): Promise<MedidaProvisoria[]> {
  const unicas = [...new Map((await doMandato(m, 'MPV')).map((x) => [`${x.p.numero}/${x.p.ano}`, x])).values()];
  return unicas.map(({ p, d }): MedidaProvisoria => {
    const dataEdicao = isoData(d.dataApresentacao) ?? `${p.ano}-01-01`;
    const prazoFinal = somarDiasSemRecesso(dataEdicao, PRAZO_MP);
    const status = d.statusProposicao ?? {};
    const descricao = `${status.descricaoSituacao ?? ''} ${status.despacho ?? ''}`;
    const situacao = situacaoMP(descricao, prazoFinal);
    return {
      id: `mpv-${p.numero}-${p.ano}`,
      mandato: mandatoId,
      numero: identificacao('MPV', p.numero, p.ano),
      ementa: p.ementa ?? d.ementa ?? '',
      dataEdicao,
      prazoFinal: situacao === 'tramitando' ? prazoFinal : null,
      situacao,
      desfecho: situacao === 'tramitando' ? null : (status.descricaoSituacao ?? null),
      dataDesfecho: situacao === 'tramitando' ? null : isoData(status.dataHora),
      url: `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${p.id}`,
    };
  });
}

async function projetosExecutivo(m: Cadastro['mandatos'][number], mandatoId: string): Promise<ProjetoExecutivo[]> {
  const out: ProjetoExecutivo[] = [];
  for (const sigla of ['PL', 'PLP', 'PEC']) {
    for (const { p, d } of await doMandato(m, sigla, { autor: 'Poder Executivo' })) {
      const status = d.statusProposicao ?? {};
      const descricao = `${status.descricaoSituacao ?? ''} ${status.despacho ?? ''}`;
      out.push({
        id: `${sigla.toLowerCase()}-${p.numero}-${p.ano}`,
        mandato: mandatoId,
        numero: identificacao(sigla, p.numero, p.ano),
        ementa: p.ementa ?? d.ementa ?? '',
        dataApresentacao: isoData(d.dataApresentacao) ?? `${p.ano}-01-01`,
        etapa: etapaProjeto(descricao, status.siglaOrgao ?? ''),
        situacao: status.descricaoSituacao ?? 'Em tramitação',
        url: `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${p.id}`,
      });
    }
  }
  return [...new Map(out.map((p) => [p.numero, p])).values()].sort((a, b) => b.dataApresentacao.localeCompare(a.dataApresentacao));
}

/** Situação do veto a partir do tipo de deliberação do Congresso (derrubar um veto = "rejeitar"). */
export function situacaoVeto(texto: string): SituacaoVeto {
  const s = semAcento(texto).replace(/_/g, ' ');
  if (/prejudicad/.test(s)) return 'prejudicado';
  // "Mantido parcialmente" = parte do veto foi derrubada.
  if (/parcial|em parte/.test(s) && /(derrubad|rejeitad|mantid)/.test(s)) return 'derrubado-parcial';
  if (/derrubad|rejeitad/.test(s)) return 'derrubado';
  if (/mantid/.test(s)) return 'mantido';
  return 'aguardando';
}

/** Valores de siglaTipoDeliberacao vistos, para o diagnóstico. */
export const deliberacoesVistas = new Map<string, number>();

async function vetos(m: Cadastro['mandatos'][number], mandatoId: string): Promise<Veto[]> {
  const anoIni = Number(m.inicio.slice(0, 4));
  const anoFim = Math.min(Number(m.fim.slice(0, 4)), Number(hojeISO().slice(0, 4)));
  const out: Veto[] = [];
  for (let ano = anoIni; ano <= anoFim; ano++) {
    let itens: Json[] = [];
    try {
      const j = await getJson<any>(`${LEGIS}/processo?sigla=VET&ano=${ano}`);
      itens = lista<Json>(Array.isArray(j) ? j : j?.processos);
    } catch (e) {
      console.warn(`Vetos ${ano} indisponíveis: ${(e as Error).message}`);
      continue;
    }
    for (const v of itens) {
      const dataLeitura = isoData(v.dataApresentacao ?? v.dataAutuacao ?? v.data);
      if (!dataLeitura || dataLeitura < m.inicio || dataLeitura > m.fim) continue;
      const ementa: string = v.ementa ?? '';
      const deliberacao = String(v.siglaTipoDeliberacao ?? '');
      deliberacoesVistas.set(deliberacao || '(vazio)', (deliberacoesVistas.get(deliberacao || '(vazio)') ?? 0) + 1);
      const situacaoTexto = `${deliberacao} ${v.situacaoAtual ?? ''} ${v.descricaoSituacao ?? ''}`;
      const numero = v.identificacao ?? identificacao('VET', v.numero, v.ano ?? ano);
      out.push({
        id: `vet-${String(numero).replace(/\D+/g, '-').replace(/^-|-$/g, '')}`,
        mandato: mandatoId,
        numero,
        tipo: /veto total/i.test(ementa) || /total/i.test(v.tipoVeto ?? '') ? 'total' : 'parcial',
        materia: materiaDoVeto(ementa),
        ementa: assuntoDoVeto(ementa),
        dataLeitura,
        situacao: situacaoVeto(situacaoTexto),
        dataDeliberacao: isoData(v.dataDeliberacao),
        dispositivosVetados: v.quantidadeDispositivos ? Number(v.quantidadeDispositivos) : null,
        url: v.id ? `https://www.congressonacional.leg.br/materias/vetos/-/veto/detalhe/${v.id}` : null,
      });
    }
  }
  const unicos = [...new Map(out.map((v) => [v.numero, v])).values()];
  return unicos.sort((a, b) => (b.dataLeitura ?? '').localeCompare(a.dataLeitura ?? ''));
}

export function resumir(atos: Pick<AtosMandato, 'medidas' | 'vetos' | 'projetos'>): ResumoMandatoPresidente {
  const mp = (s: SituacaoMP) => atos.medidas.filter((m) => m.situacao === s).length;
  const vt = (s: SituacaoVeto) => atos.vetos.filter((v) => v.situacao === s).length;
  return {
    projetos: atos.projetos.length,
    projetosLei: atos.projetos.filter((p) => p.etapa === 'lei').length,
    mps: atos.medidas.length,
    mpsLei: mp('lei'),
    mpsTramitando: mp('tramitando'),
    mpsCaducadas: mp('caducou'),
    mpsRejeitadas: mp('rejeitada'),
    vetos: atos.vetos.length,
    vetosTotais: atos.vetos.filter((v) => v.tipo === 'total').length,
    vetosParciais: atos.vetos.filter((v) => v.tipo === 'parcial').length,
    vetosMantidos: vt('mantido'),
    vetosDerrubados: vt('derrubado') + vt('derrubado-parcial'),
    vetosAguardando: vt('aguardando'),
    vetosPrejudicados: vt('prejudicado'),
  };
}

export async function coletarPresidentes(): Promise<{ presidentes: Presidente[]; atos: AtosMandato[] }> {
  const agora = new Date().toISOString();
  const hoje = agora.slice(0, 10);
  const presidentes: Presidente[] = [];
  const atos: AtosMandato[] = [];
  for (const p of lerCadastro()) {
    const mandatos: MandatoPresidente[] = [];
    for (const m of p.mandatos) {
      console.log(`Presidente: ${p.nome} ${m.id}…`);
      const [medidas, vets, projetos] = [await medidasProvisorias(m, m.id), await vetos(m, m.id), await projetosExecutivo(m, m.id)];
      console.log(`  ${medidas.length} MPs, ${vets.length} vetos, ${projetos.length} projetos`);
      const registro = { presidenteId: p.id, mandato: m.id, medidas, vetos: vets, projetos, atualizadoEm: agora };
      atos.push(registro);
      mandatos.push({ ...m, atual: m.inicio <= hoje && hoje < m.fim, resumo: resumir(registro) });
    }
    presidentes.push({ ...p, mandatos });
  }
  return { presidentes, atos };
}

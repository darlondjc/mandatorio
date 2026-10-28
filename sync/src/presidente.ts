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
import { hojeISO, identificacao, isoData, semAcento, somarDiasSemRecesso } from './util.ts';

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

async function medidasProvisorias(m: Cadastro['mandatos'][number], mandatoId: string): Promise<MedidaProvisoria[]> {
  const fim = m.fim < hojeISO() ? m.fim : hojeISO();
  const itens = await proposicoesCamara({ siglaTipo: 'MPV', dataApresentacaoInicio: m.inicio, dataApresentacaoFim: fim });
  return emParalelo(itens, 4, async (p): Promise<MedidaProvisoria> => {
    const d = await detalheCamara(p.id);
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
  const fim = m.fim < hojeISO() ? m.fim : hojeISO();
  const itens = await proposicoesCamara({
    siglaTipo: 'PL,PLP,PEC',
    autor: 'Poder Executivo',
    dataApresentacaoInicio: m.inicio,
    dataApresentacaoFim: fim,
  });
  return emParalelo(itens, 4, async (p): Promise<ProjetoExecutivo> => {
    const d = await detalheCamara(p.id);
    const status = d.statusProposicao ?? {};
    const descricao = `${status.descricaoSituacao ?? ''} ${status.despacho ?? ''}`;
    return {
      id: `${String(p.siglaTipo).toLowerCase()}-${p.numero}-${p.ano}`,
      mandato: mandatoId,
      numero: identificacao(p.siglaTipo, p.numero, p.ano),
      ementa: p.ementa ?? d.ementa ?? '',
      dataApresentacao: isoData(d.dataApresentacao) ?? `${p.ano}-01-01`,
      etapa: etapaProjeto(descricao, status.siglaOrgao ?? ''),
      situacao: status.descricaoSituacao ?? 'Em tramitação',
      url: `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${p.id}`,
    };
  });
}

export function situacaoVeto(texto: string): SituacaoVeto {
  const s = semAcento(texto);
  if (/derrubad|rejeitad/.test(s)) return /parcial|em parte/.test(s) && /mantid/.test(s) ? 'derrubado-parcial' : 'derrubado';
  if (/mantid/.test(s)) return 'mantido';
  return 'aguardando';
}

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
      const situacaoTexto = `${v.situacaoAtual ?? ''} ${v.descricaoSituacao ?? ''} ${v.tramitando === 'Não' ? 'encerrado' : ''}`;
      const numero = v.identificacao ?? identificacao('VET', v.numero, v.ano ?? ano);
      out.push({
        id: `vet-${String(numero).replace(/\D+/g, '-').replace(/^-|-$/g, '')}`,
        mandato: mandatoId,
        numero,
        tipo: /veto total/i.test(ementa) || /total/i.test(v.tipoVeto ?? '') ? 'total' : 'parcial',
        materia: /(PL|PLP|PLN|PLV)[^\d]*(\d+[.\d]*\/\d{4})/.exec(ementa)?.[0] ?? null,
        ementa: ementa.replace(/^Veto (total|parcial)\s*(aposto ao|ao)\s*/i, '').trim() || ementa,
        dataLeitura,
        situacao: situacaoVeto(situacaoTexto),
        dataDeliberacao: isoData(v.dataUltimaTramitacao ?? v.dataDeliberacao),
        dispositivosVetados: v.quantidadeDispositivos ? Number(v.quantidadeDispositivos) : null,
        url: v.id ? `https://www.congressonacional.leg.br/materias/vetos/-/veto/detalhe/${v.id}` : null,
      });
    }
  }
  return out.sort((a, b) => (b.dataLeitura ?? '').localeCompare(a.dataLeitura ?? ''));
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

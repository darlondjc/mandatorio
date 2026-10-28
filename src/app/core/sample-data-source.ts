import { DataSource } from './data-source';
import {
  Cadeira,
  GastoAno,
  MedidaProvisoria,
  Plenario,
  Presidente,
  ProjetoExecutivo,
  Proposicao,
  Senador,
  Veto,
  Votacao,
  Voto,
  VotoSenador,
} from './models';

// Dados de EXEMPLO, gerados de forma determinística, para desenvolver e demonstrar o site
// sem Firebase. Nomes de senadores e presidentes são fictícios; números são inventados.

const PARTIDOS: [string, number][] = [
  ['PT', 9], ['PSB', 4], ['PDT', 3], ['MDB', 11], ['PSD', 14], ['PODEMOS', 4],
  ['PSDB', 3], ['UNIÃO', 7], ['REPUBLICANOS', 4], ['PP', 7], ['PL', 14], ['NOVO', 1],
];
const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const NOMES_F = ['Marina', 'Juliana', 'Lúcia', 'Fernanda', 'Helena', 'Patrícia', 'Cecília', 'Renata', 'Teresa', 'Beatriz', 'Sônia', 'Adriana'];
const NOMES_M = ['Carlos', 'Roberto', 'Antônio', 'Otávio', 'Eduardo', 'Paulo', 'Sérgio', 'Marcos', 'Rodrigo', 'Fábio', 'Jorge', 'Luiz', 'Ricardo', 'Alexandre', 'Hugo'];
const SOBRENOMES = ['Albuquerque', 'Duarte', 'Ferraz', 'Saldanha', 'Queiroz', 'Lacerda', 'Vasconcelos', 'Rezende', 'Moura', 'Bastos', 'Teixeira', 'Pimentel', 'Coutinho', 'Barreto', 'Macedo', 'Siqueira', 'Aragão', 'Falcão', 'Guimarães', 'Brandão'];
const PROFISSOES = ['Advogada', 'Médico', 'Empresário', 'Professora', 'Engenheiro', 'Economista', 'Produtor rural', 'Jornalista', 'Servidora pública', 'Administrador'];
const COMISSOES: [string, string][] = [
  ['CCJ', 'Constituição, Justiça e Cidadania'], ['CAE', 'Assuntos Econômicos'], ['CAS', 'Assuntos Sociais'],
  ['CRA', 'Agricultura e Reforma Agrária'], ['CE', 'Educação e Cultura'], ['CMA', 'Meio Ambiente'],
  ['CI', 'Serviços de Infraestrutura'], ['CRE', 'Relações Exteriores e Defesa Nacional'],
];
const MATERIAS: [string, string][] = [
  ['PL 4.512/2025', 'Cria o Sistema Nacional de Prevenção a Desastres Climáticos'],
  ['PEC 9/2026', 'Altera as regras das emendas parlamentares impositivas'],
  ['PLP 68/2026', 'Regulamenta a transição dos tributos sobre consumo'],
  ['MPV 1.301/2026', 'Abre crédito extraordinário para a defesa civil'],
  ['PL 2.874/2025', 'Aumenta penas para crimes cometidos por facções'],
  ['PDL 211/2026', 'Susta portaria sobre reajuste de tarifas de energia'],
  ['PL 1.950/2026', 'Institui a Política Nacional de Cuidados'],
  ['PL 3.120/2025', 'Amplia a licença-paternidade para 20 dias'],
  ['PL 877/2026', 'Regulamenta o trabalho por aplicativos de transporte'],
  ['PEC 14/2025', 'Inclui a segurança alimentar entre os direitos sociais'],
  ['PL 5.230/2025', 'Cria o cadastro nacional de pedófilos condenados'],
  ['PLP 33/2026', 'Renegocia dívidas de estados com a União'],
  ['PL 640/2026', 'Proíbe celulares em salas de aula do ensino básico'],
  ['PL 2.019/2025', 'Estabelece o marco legal do hidrogênio de baixo carbono'],
  ['MPV 1.296/2025', 'Altera regras de compensação tributária de créditos judiciais'],
  ['PL 1.415/2026', 'Torna crime hediondo o feminicídio de menores de idade'],
  ['PL 3.987/2025', 'Cria o programa de renegociação de dívidas rurais'],
  ['PL 2.701/2026', 'Regula o uso de inteligência artificial em campanhas eleitorais'],
];
const CATEGORIAS_CEAPS = [
  'Aluguel de imóveis para escritório político',
  'Passagens aéreas, aquáticas e terrestres nacionais',
  'Locomoção, hospedagem, alimentação e combustíveis',
  'Contratação de consultorias e assessorias',
  'Divulgação da atividade parlamentar',
  'Aquisição de material de consumo',
  'Serviços de segurança privada',
];

/** Gerador pseudoaleatório determinístico (mulberry32). */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T>(r: () => number, xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => iso(new Date(new Date(s + 'T12:00:00Z').getTime() + n * 864e5));

const VOTACOES = 60;
const PRIMEIRA_VOTACAO = '2025-02-11';

interface Base {
  senadores: Senador[];
  votos: Map<string, VotoSenador[]>;
  plenario: Plenario;
}

function gerar(): Base {
  const r = rng(2026);
  const ufVagas = UFS.flatMap((uf) => [uf, uf, uf]).sort(() => r() - 0.5);
  const cadeiras: Cadeira[] = [];
  let n = 0;
  for (const [sigla, total] of PARTIDOS) {
    for (let i = 0; i < total; i++) {
      const sexo: 'M' | 'F' = r() < 0.2 ? 'F' : 'M';
      const nome = `${pick(r, sexo === 'F' ? NOMES_F : NOMES_M)} ${pick(r, SOBRENOMES)}`;
      cadeiras.push({ codigo: String(5000 + n), nome, partido: sigla, uf: ufVagas[n], sexo });
      n++;
    }
  }
  // A senadora usada nos protótipos.
  // Troca a UF com um senador de Goiás para manter 3 cadeiras por estado.
  const psd = cadeiras.filter((c) => c.partido === 'PSD')[5];
  const goiano = cadeiras.find((c) => c.uf === 'GO' && c !== psd);
  if (goiano && psd.uf !== 'GO') goiano.uf = psd.uf;
  Object.assign(psd, { nome: 'Marina Leite Albuquerque', uf: 'GO', sexo: 'F' });

  // Três vagas trocaram de mãos durante a legislatura: quem ocupava votou até a votação `ate`.
  const SAIDAS = [
    { vaga: 40, ate: 18, motivo: 'Retorno do titular' },
    { vaga: 57, ate: 31, motivo: 'Renúncia' },
    { vaga: 70, ate: 44, motivo: 'Licença para exercer cargo de Ministro de Estado' },
  ];
  const exCadeiras: Cadeira[] = SAIDAS.map(({ vaga }, k) => {
    const sexo: 'M' | 'F' = k === 1 ? 'F' : 'M';
    const c = cadeiras[vaga];
    return { codigo: String(5900 + k), nome: `${pick(r, sexo === 'F' ? NOMES_F : NOMES_M)} ${pick(r, SOBRENOMES)}`, partido: c.partido, uf: c.uf, sexo };
  });
  const todas = [...cadeiras, ...exCadeiras];
  /** Se o senador estava em exercício na votação i. */
  const ativo = (codigo: string, i: number) => {
    const k = exCadeiras.findIndex((c) => c.codigo === codigo);
    if (k >= 0) return i < SAIDAS[k].ate;
    const vaga = SAIDAS.find((x) => cadeiras[x.vaga].codigo === codigo);
    return !vaga || i >= vaga.ate;
  };

  // Cada partido tem uma tendência por votação; cada senador segue com alguma probabilidade.
  const tendencia = new Map<string, Voto[]>();
  for (const [sigla] of PARTIDOS) {
    tendencia.set(sigla, Array.from({ length: VOTACOES }, () => (r() < 0.72 ? 'sim' : 'nao')));
  }
  const datas = Array.from({ length: VOTACOES }, (_, i) => addDays(PRIMEIRA_VOTACAO, i * 9 + Math.floor(r() * 4)));

  const brutos = new Map<string, Voto[]>();
  for (const c of todas) {
    const assiduidade = 0.82 + r() * 0.17;
    const fidelidade = 0.7 + r() * 0.28;
    brutos.set(
      c.codigo,
      tendencia.get(c.partido)!.map((t) => {
        if (r() > assiduidade) return 'ausente';
        if (r() < 0.04) return 'abstencao';
        return r() < fidelidade ? t : t === 'sim' ? 'nao' : 'sim';
      }),
    );
  }

  // Algumas votações são secretas (indicação de autoridades): quem esteve presente "votou".
  const secreta = (i: number) => i % 10 === 4;
  for (const lista of brutos.values()) lista.forEach((v, i) => { if (secreta(i) && v !== 'ausente') lista[i] = 'secreto'; });

  const maioria = (partido: string, i: number): Voto | null => {
    const cont = { sim: 0, nao: 0 };
    for (const c of todas) {
      if (c.partido !== partido || !ativo(c.codigo, i)) continue;
      const v = brutos.get(c.codigo)![i];
      if (v === 'sim' || v === 'nao') cont[v]++;
    }
    if (cont.sim === cont.nao) return null;
    return cont.sim > cont.nao ? 'sim' : 'nao';
  };

  const votos = new Map<string, VotoSenador[]>();
  const senadores: Senador[] = todas.map((c, idx) => {
    const saiu = idx >= cadeiras.length;
    const lista = brutos.get(c.codigo)!.flatMap((v, i): VotoSenador[] => {
      if (!ativo(c.codigo, i)) return [];
      const [materia, ementa] = secreta(i)
        ? [`MSF ${10 + i}/2026`, 'Submete à apreciação do Senado a indicação de embaixador do Brasil']
        : MATERIAS[i % MATERIAS.length];
      const m = maioria(c.partido, i);
      return [{
        id: `v${i}`,
        data: datas[i],
        materia,
        ementa,
        descricao: i >= MATERIAS.length && !secreta(i) ? (i < 2 * MATERIAS.length ? 'Votação em 2º turno' : 'Destaque para votação em separado') : null,
        voto: v,
        votoOriginal: { sim: 'Sim', nao: 'Não', abstencao: 'Abstenção', secreto: 'Votou', ausente: 'MIS' }[v],
        maioriaPartido: m,
        divergiu: m !== null && (v === 'sim' || v === 'nao') && v !== m,
        resultado: i % 7 === 3 ? 'Rejeitado' : 'Aprovado',
      }];
    }).reverse();
    votos.set(c.codigo, lista);

    const dist = { sim: 0, nao: 0, abstencao: 0, secreto: 0, ausente: 0 };
    lista.forEach((v) => dist[v.voto]++);
    const comparaveis = lista.filter((v) => v.maioriaPartido && (v.voto === 'sim' || v.voto === 'nao'));
    const com = comparaveis.filter((v) => !v.divergiu).length;
    const mandatoInicio = idx % 3 === 0 ? '2019-02-01' : '2023-02-01';
    const props = 8 + Math.floor(r() * 50);
    return {
      codigo: c.codigo,
      nome: c.nome,
      nomeCompleto: c.nome,
      sexo: c.sexo,
      partido: c.partido,
      uf: c.uf,
      foto: null,
      email: null,
      emExercicio: !saiu,
      saida: saiu ? { data: datas[SAIDAS[idx - cadeiras.length].ate - 1], motivo: SAIDAS[idx - cadeiras.length].motivo } : null,
      participacao: saiu && idx - cadeiras.length !== 1 ? '1º Suplente' : 'Titular',
      mandato: {
        inicio: mandatoInicio,
        fim: mandatoInicio === '2019-02-01' ? '2027-01-31' : '2031-01-31',
        legislaturas: mandatoInicio === '2019-02-01' ? [56, 57] : [57, 58],
        ordem: 1 + Math.floor(r() * 2),
      },
      nascimento: `19${50 + Math.floor(r() * 35)}-0${1 + Math.floor(r() * 9)}-1${Math.floor(r() * 9)}`,
      naturalidade: `${pick(r, ['Capital', 'Interior'])} (${c.uf})`,
      profissao: pick(r, PROFISSOES),
      bloco: null,
      comissoes: saiu ? [] : [0, 1, 2].map((k) => {
        const [sigla, nome] = COMISSOES[(idx + k * 3) % COMISSOES.length];
        return { sigla, nome, cargo: k === 2 ? 'Suplente' : 'Titular' };
      }),
      resumo: {
        votacoes: lista.length,
        distribuicao: dist,
        votosComparaveis: comparaveis.length,
        votosComPartido: com,
        mediaPartido: null,
        cotaAno: Math.round(180_000 + r() * 220_000),
        cotaAnoReferencia: 2026,
        cotaMediaSenado: 0,
        proposicoes: props,
        proposicoesLei: Math.floor(props * (0.05 + r() * 0.15)),
      },
      atualizadoEm: '2026-10-27T06:00:00Z',
    };
  });

  const emExercicio = senadores.filter((s) => s.emExercicio);
  const mediaCota = Math.round(emExercicio.reduce((s, x) => s + x.resumo.cotaAno, 0) / emExercicio.length);
  for (const [sigla] of PARTIDOS) {
    const doPartido = senadores.filter((s) => s.partido === sigla && s.emExercicio);
    const media = Math.round(
      (doPartido.reduce((s, x) => s + x.resumo.votosComPartido / Math.max(1, x.resumo.votosComparaveis), 0) / doPartido.length) * 100,
    );
    senadores.filter((s) => s.partido === sigla).forEach((s) => {
      s.resumo.mediaPartido = media;
      s.resumo.cotaMediaSenado = mediaCota;
    });
  }

  return {
    senadores,
    votos,
    plenario: {
      legislatura: 57,
      inicio: '2023-02-01',
      fim: '2027-01-31',
      atualizadoEm: '2026-10-27T06:00:00Z',
      partidos: PARTIDOS.map(([sigla, total]) => ({ sigla, total })),
      cadeiras,
      exSenadores: exCadeiras
        .map((c, k) => ({ ...c, saida: { data: datas[SAIDAS[k].ate - 1], motivo: SAIDAS[k].motivo }, votacoes: votos.get(c.codigo)!.length }))
        .reverse(),
    },
  };
}

const PRESIDENTES: Presidente[] = [
  {
    id: 'exemplo-helena',
    nome: 'Helena Bastos Prado',
    nomeCompleto: 'Helena Bastos Prado',
    foto: null,
    nascimento: '1958-06-14',
    naturalidade: 'Recife (PE)',
    perfil: 'Presidente de exemplo, usada enquanto o site não está ligado ao Firebase.',
    mandatos: [
      {
        id: '2023-2026', inicio: '2023-01-01', fim: '2027-01-05', ordem: 1, vice: 'Carlos Duarte', partidoVice: 'PSB',
        partido: 'PT', atual: true,
        resumo: { projetos: 96, projetosLei: 31, mps: 118, mpsLei: 76, mpsTramitando: 7, mpsCaducadas: 32, mpsRejeitadas: 3, vetos: 87, vetosTotais: 21, vetosParciais: 66, vetosMantidos: 60, vetosDerrubados: 19, vetosAguardando: 8 },
      },
    ],
  },
  {
    id: 'exemplo-rogerio',
    nome: 'Rogério Antunes Leal',
    nomeCompleto: 'Rogério Antunes Leal',
    foto: null,
    nascimento: '1955-03-21',
    naturalidade: 'Campinas (SP)',
    perfil: 'Presidente de exemplo de um mandato anterior.',
    mandatos: [
      {
        id: '2019-2022', inicio: '2019-01-01', fim: '2022-12-31', ordem: 1, vice: 'Antônio Ferraz', partidoVice: 'PRTB',
        partido: 'PL', atual: false,
        resumo: { projetos: 74, projetosLei: 22, mps: 171, mpsLei: 104, mpsTramitando: 0, mpsCaducadas: 60, mpsRejeitadas: 7, vetos: 112, vetosTotais: 33, vetosParciais: 79, vetosMantidos: 81, vetosDerrubados: 31, vetosAguardando: 0 },
      },
    ],
  },
];

const MPS: Omit<MedidaProvisoria, 'mandato'>[] = [
  { id: 'mpv-1318-2026', numero: 'MPV 1.318/2026', ementa: 'Abre crédito extraordinário para a defesa civil nos municípios atingidos pela seca', dataEdicao: '2026-10-02', prazoFinal: '2027-03-12', situacao: 'tramitando', desfecho: null, dataDesfecho: null, url: null },
  { id: 'mpv-1312-2026', numero: 'MPV 1.312/2026', ementa: 'Amplia o prazo de adesão ao programa de renegociação de dívidas rurais', dataEdicao: '2026-07-28', prazoFinal: '2026-11-28', situacao: 'tramitando', desfecho: null, dataDesfecho: null, url: null },
  { id: 'mpv-1301-2026', numero: 'MPV 1.301/2026', ementa: 'Reajusta os valores do auxílio-gás para famílias do Cadastro Único', dataEdicao: '2026-03-10', prazoFinal: null, situacao: 'lei', desfecho: 'Convertida em lei', dataDesfecho: '2026-06-30', url: null },
  { id: 'mpv-1296-2025', numero: 'MPV 1.296/2025', ementa: 'Altera regras de compensação tributária de créditos judiciais', dataEdicao: '2025-12-18', prazoFinal: null, situacao: 'caducou', desfecho: 'Não votada em 120 dias', dataDesfecho: '2026-05-28', url: null },
  { id: 'mpv-1290-2025', numero: 'MPV 1.290/2025', ementa: 'Cria taxa de fiscalização para apostas esportivas on-line', dataEdicao: '2025-11-05', prazoFinal: null, situacao: 'rejeitada', desfecho: 'Rejeitada pela Câmara', dataDesfecho: '2026-02-11', url: null },
];
const VETOS: Omit<Veto, 'mandato'>[] = [
  { id: 'vet-41-2026', numero: 'VET 41/2026', tipo: 'parcial', materia: 'PL 1.950/2026', ementa: 'Política Nacional de Cuidados', dataLeitura: '2026-10-08', situacao: 'aguardando', dataDeliberacao: null, dispositivosVetados: 9, url: null },
  { id: 'vet-37-2026', numero: 'VET 37/2026', tipo: 'total', materia: 'PL 2.210/2025', ementa: 'Reajuste do piso de agentes comunitários de saúde', dataLeitura: '2026-08-12', situacao: 'derrubado', dataDeliberacao: '2026-09-17', dispositivosVetados: null, url: null },
  { id: 'vet-33-2026', numero: 'VET 33/2026', tipo: 'parcial', materia: 'PL 3.754/2024', ementa: 'Marco legal das ferrovias de carga', dataLeitura: '2026-07-01', situacao: 'mantido', dataDeliberacao: '2026-08-20', dispositivosVetados: 4, url: null },
  { id: 'vet-29-2026', numero: 'VET 29/2026', tipo: 'parcial', materia: 'PLP 121/2025', ementa: 'Renegociação de dívidas de estados', dataLeitura: '2026-05-20', situacao: 'derrubado-parcial', dataDeliberacao: '2026-07-02', dispositivosVetados: 6, url: null },
  { id: 'vet-24-2026', numero: 'VET 24/2026', tipo: 'total', materia: 'PL 5.033/2025', ementa: 'Isenção tributária para templos e entidades religiosas', dataLeitura: '2026-04-15', situacao: 'mantido', dataDeliberacao: '2026-06-11', dispositivosVetados: null, url: null },
];
const PROJETOS: Omit<ProjetoExecutivo, 'mandato'>[] = [
  { id: 'pl-4100-2026', numero: 'PL 4.100/2026', ementa: 'Orçamento da União para 2027', dataApresentacao: '2026-08-29', etapa: 'camara', situacao: 'Comissão Mista de Orçamento', url: null },
  { id: 'pl-2950-2026', numero: 'PL 2.950/2026', ementa: 'Cria o programa nacional de residência em saúde mental', dataApresentacao: '2026-05-14', etapa: 'senado', situacao: 'Comissão de Assuntos Sociais', url: null },
  { id: 'plp-12-2026', numero: 'PLP 12/2026', ementa: 'Atualiza a Lei de Responsabilidade Fiscal para consórcios públicos', dataApresentacao: '2026-02-20', etapa: 'sancao', situacao: 'Aguardando sanção', url: null },
  { id: 'pl-1180-2025', numero: 'PL 1.180/2025', ementa: 'Atualiza a tabela do Imposto de Renda da pessoa física', dataApresentacao: '2025-03-18', etapa: 'lei', situacao: 'Transformado em lei', url: null },
  { id: 'pl-3301-2024', numero: 'PL 3.301/2024', ementa: 'Reestrutura carreiras das agências reguladoras', dataApresentacao: '2024-08-09', etapa: 'arquivado', situacao: 'Retirado pelo autor', url: null },
];

export class SampleDataSource extends DataSource {
  readonly exemplo = true;
  private base?: Base;
  private get dados() {
    return (this.base ??= gerar());
  }

  async sincronizacao() {
    return { atualizadoEm: '2026-10-27T06:00:00Z', fontes: ['Dados de exemplo'] };
  }
  async plenario() {
    return this.dados.plenario;
  }
  async senador(codigo: string) {
    return this.dados.senadores.find((s) => s.codigo === codigo) ?? null;
  }
  async votos(codigo: string, limite: number) {
    return (this.dados.votos.get(codigo) ?? []).slice(0, limite);
  }
  async votacao(id: string): Promise<Votacao | null> {
    const placar: Record<Voto, number> = { sim: 0, nao: 0, abstencao: 0, secreto: 0, ausente: 0 };
    let base: VotoSenador | undefined;
    const p = this.dados.plenario;
    const votos = [...p.cadeiras, ...(p.exSenadores ?? [])].flatMap((c) => {
      const v = this.dados.votos.get(c.codigo)?.find((x) => x.id === id);
      if (!v) return [];
      base ??= v;
      placar[v.voto]++;
      return [{ codigo: c.codigo, nome: c.nome, partido: c.partido, uf: c.uf, voto: v.voto, votoOriginal: v.votoOriginal }];
    });
    if (!base) return null;
    return {
      id,
      data: base.data,
      materia: base.materia,
      ementa: base.ementa,
      descricao: base.descricao ?? null,
      resultado: base.resultado,
      secreta: placar.secreto > 0 && placar.sim + placar.nao === 0,
      placar,
      votos: votos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      atualizadoEm: '2026-10-27T06:00:00Z',
    };
  }

  async gastos(codigo: string): Promise<GastoAno[]> {
    const s = await this.senador(codigo);
    if (!s) return [];
    const r = rng(Number(codigo));
    return [2026, 2025].map((ano) => {
      const total = ano === 2026 ? s.resumo.cotaAno : Math.round(s.resumo.cotaAno * (1.1 + r() * 0.2));
      const pesos = CATEGORIAS_CEAPS.map(() => r() ** 2);
      const soma = pesos.reduce((a, b) => a + b, 0);
      const meses = ano === 2026 ? 10 : 12;
      return {
        ano,
        total,
        porCategoria: CATEGORIAS_CEAPS.map((categoria, i) => ({ categoria, valor: Math.round((total * pesos[i]) / soma) })).sort(
          (a, b) => b.valor - a.valor,
        ),
        porMes: Array.from({ length: 12 }, (_, m) => (m < meses ? Math.round((total / meses) * (0.6 + r() * 0.8)) : 0)),
      };
    });
  }
  async proposicoes(codigo: string): Promise<Proposicao[]> {
    const r = rng(Number(codigo) * 7);
    return MATERIAS.slice(0, 8).map(([materia, ementa], i) => ({
      id: `p${i}`,
      materia: materia.replace(/\d[\d.]*\//, `${1000 + Math.floor(r() * 4000)}/`),
      ementa,
      data: addDays('2023-03-01', i * 140),
      situacao: i % 4 === 0 ? 'Transformada em norma jurídica' : i % 3 === 0 ? 'Arquivada' : 'Em tramitação',
      virouLei: i % 4 === 0,
      url: null,
    }));
  }
  async presidentes() {
    return PRESIDENTES;
  }
  async medidas(_p: string, mandato: string) {
    return MPS.map((m) => ({ ...m, mandato }));
  }
  async vetos(_p: string, mandato: string) {
    return VETOS.map((v) => ({ ...v, mandato }));
  }
  async projetos(_p: string, mandato: string) {
    return PROJETOS.map((p) => ({ ...p, mandato }));
  }
}

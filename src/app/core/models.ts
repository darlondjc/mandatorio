// Modelo de dados do Mandatório. É o formato gravado no Firestore pela sincronização (sync/)
// e lido pelo site. Mudou aqui, mude lá.
//
// Firestore:
//   meta/sincronizacao                     -> Sincronizacao
//   plenario/senado                        -> Plenario
//   senadores/{codigo}                     -> Senador
//   senadores/{codigo}/votos/{ano}         -> VotosAno (todas as votações do ano num documento)
//   votacoes/{id}                          -> Votacao (placar e voto de cada senador)
//   senadores/{codigo}/gastos/{ano}        -> GastoAno
//   senadores/{codigo}/listas/proposicoes  -> ListaProposicoes
//   presidentes/{id}                       -> Presidente
//   presidentes/{id}/mandatos/{mandatoId}  -> AtosMandato (MPs, vetos e projetos do mandato)
//
// Listas ficam agrupadas em poucos documentos de propósito: o plano gratuito do Firestore
// permite 20 mil gravações por dia, e um documento por voto passaria disso na primeira carga.

/** Datas sempre como string ISO `AAAA-MM-DD`. */
export type DataISO = string;

/** `secreto`: votação secreta (ex.: indicação de autoridades). O senador votou, mas o voto não é público. */
export type Voto = 'sim' | 'nao' | 'abstencao' | 'secreto' | 'ausente';

export interface Sincronizacao {
  atualizadoEm: string; // ISO com hora
  fontes: string[];
}

export interface PartidoBancada {
  sigla: string;
  total: number;
}

export interface Cadeira {
  codigo: string;
  nome: string;
  partido: string;
  uf: string;
  sexo: 'M' | 'F';
}

export interface Plenario {
  legislatura: number;
  inicio: DataISO;
  fim: DataISO;
  atualizadoEm: string;
  /** Na ordem em que aparecem no semicírculo, da esquerda para a direita. */
  partidos: PartidoBancada[];
  cadeiras: Cadeira[];
  /** Quem votou nesta legislatura e não está mais em exercício (suplentes que devolveram a vaga, renúncias, licenças…). */
  exSenadores?: ExSenador[];
}

export interface Saida {
  /** Último dia em exercício, quando a API informa. */
  data: DataISO | null;
  /** Causa do afastamento como o Senado descreve ("Renúncia", "Retorno do titular"…). */
  motivo: string | null;
}

export interface ExSenador extends Cadeira {
  saida: Saida;
  /** Votações nominais de que participou nesta legislatura. */
  votacoes: number;
}

export interface Comissao {
  sigla: string;
  nome: string;
  cargo: string; // Titular, Suplente, Presidente…
}

export interface ResumoSenador {
  /** Votações nominais no período do mandato atual. */
  votacoes: number;
  distribuicao: Record<Voto, number>;
  /** Votações em que o voto pôde ser comparado com a maioria do partido. */
  votosComparaveis: number;
  votosComPartido: number;
  /** Média de alinhamento dos senadores do mesmo partido (0–100). */
  mediaPartido: number | null;
  cotaAno: number;
  cotaAnoReferencia: number;
  cotaMediaSenado: number;
  proposicoes: number;
  proposicoesLei: number;
}

export interface Senador {
  codigo: string;
  nome: string;
  nomeCompleto: string;
  sexo: 'M' | 'F';
  partido: string;
  uf: string;
  foto: string | null;
  email: string | null;
  emExercicio: boolean;
  /** Só para quem saiu: quando e por quê. */
  saida?: Saida | null;
  /** "Titular", "1º Suplente"… */
  participacao?: string | null;
  mandato: { inicio: DataISO; fim: DataISO; legislaturas: number[]; ordem: number };
  nascimento: DataISO | null;
  naturalidade: string | null;
  profissao: string | null;
  bloco: string | null;
  comissoes: Comissao[];
  resumo: ResumoSenador;
  atualizadoEm: string;
}

export interface VotoSenador {
  id: string;
  data: DataISO;
  materia: string; // "PL 4.512/2025"
  ementa: string;
  /** O que foi votado: turno, destaque, requerimento… Distingue votações da mesma matéria. */
  descricao?: string | null;
  voto: Voto;
  /** Sigla original da API (Sim, Não, Abstenção, P-NRV, MIS, LP…). */
  votoOriginal: string;
  /** Voto da maioria do partido do senador nessa votação. */
  maioriaPartido: Voto | null;
  divergiu: boolean;
  resultado: string | null;
}

export interface VotosAno {
  ano: number;
  /** Mais recentes primeiro. */
  votos: VotoSenador[];
}

export interface ListaProposicoes {
  itens: Proposicao[];
}

export interface GastoAno {
  ano: number;
  total: number;
  porCategoria: { categoria: string; valor: number }[];
  porMes: number[]; // 12 posições, jan–dez
}

export interface Proposicao {
  id: string;
  materia: string;
  ementa: string;
  data: DataISO;
  situacao: string;
  virouLei: boolean;
  url: string | null;
}

export interface ResumoMandatoPresidente {
  projetos: number;
  projetosLei: number;
  mps: number;
  mpsLei: number;
  mpsTramitando: number;
  mpsCaducadas: number;
  mpsRejeitadas: number;
  vetos: number;
  vetosTotais: number;
  vetosParciais: number;
  vetosMantidos: number;
  vetosDerrubados: number;
  vetosAguardando: number;
  vetosPrejudicados?: number;
}

export interface MandatoPresidente {
  id: string; // "2023-2026"
  inicio: DataISO;
  fim: DataISO;
  ordem: number; // 1º, 2º, 3º mandato da pessoa
  vice: string | null;
  partidoVice: string | null;
  partido: string;
  atual: boolean;
  resumo: ResumoMandatoPresidente;
}

export interface Presidente {
  id: string;
  nome: string;
  nomeCompleto: string;
  foto: string | null;
  /** Página da foto no Wikimedia Commons, para o crédito. */
  fotoFonte?: string | null;
  /** Identificador no Wikidata (ex.: Q37181), de onde vem a foto. */
  wikidata?: string;
  nascimento: DataISO | null;
  naturalidade: string | null;
  perfil: string | null;
  mandatos: MandatoPresidente[];
}

/** Item do seletor de mandato: um por mandato de cada presidente. */
export interface MandatoIndice {
  presidenteId: string;
  mandatoId: string;
  nome: string;
  inicio: DataISO;
  fim: DataISO;
  atual: boolean;
}

export type SituacaoMP = 'tramitando' | 'lei' | 'caducou' | 'rejeitada';

export interface MedidaProvisoria {
  id: string;
  mandato: string;
  numero: string; // "MPV 1.318/2026"
  ementa: string;
  dataEdicao: DataISO;
  /** Último dia de vigência (120 dias, descontado o recesso). */
  prazoFinal: DataISO | null;
  situacao: SituacaoMP;
  desfecho: string | null; // "Lei 15.100/2026", "Rejeitada pela Câmara"…
  dataDesfecho: DataISO | null;
  url: string | null;
}

/** `prejudicado`: o Congresso não chegou a deliberar (perda de objeto). */
export type SituacaoVeto = 'aguardando' | 'mantido' | 'derrubado' | 'derrubado-parcial' | 'prejudicado';

export interface Veto {
  id: string;
  mandato: string;
  numero: string; // "VET 41/2026"
  tipo: 'total' | 'parcial';
  materia: string | null; // "PL 1.950/2026"
  ementa: string;
  dataLeitura: DataISO | null;
  situacao: SituacaoVeto;
  dataDeliberacao: DataISO | null;
  dispositivosVetados: number | null;
  url: string | null;
}

export type EtapaProjeto = 'camara' | 'senado' | 'sancao' | 'lei' | 'arquivado';

export interface ProjetoExecutivo {
  id: string;
  mandato: string;
  numero: string; // "PL 2.338/2023"
  ementa: string;
  dataApresentacao: DataISO;
  etapa: EtapaProjeto;
  situacao: string;
  url: string | null;
}

export interface AtosMandato {
  presidenteId: string;
  mandato: string;
  medidas: MedidaProvisoria[];
  vetos: Veto[];
  projetos: ProjetoExecutivo[];
  atualizadoEm: string;
}

export interface VotoNaVotacao {
  codigo: string;
  nome: string;
  partido: string;
  uf: string;
  voto: Voto;
  votoOriginal: string;
}

/** Uma votação nominal do plenário do Senado, com o voto de cada senador. */
export interface Votacao {
  id: string;
  data: DataISO;
  materia: string;
  ementa: string;
  descricao: string | null;
  resultado: string | null;
  /** Votação secreta: só se sabe quem votou, não como. */
  secreta: boolean;
  placar: Record<Voto, number>;
  votos: VotoNaVotacao[];
  atualizadoEm: string;
}

import {
  GastoAno,
  Indicadores,
  MedidaProvisoria,
  Plenario,
  Presidente,
  ProjetoExecutivo,
  Proposicao,
  RankingSenado,
  Senador,
  Sincronizacao,
  Veto,
  Votacao,
  VotoSenador,
} from './models';

/**
 * De onde o site lê os dados. Em produção é o Firestore; sem Firebase configurado,
 * usa dados de exemplo gerados localmente (ver sample-data.ts).
 */
export abstract class DataSource {
  /** true quando os dados são de exemplo e não reais. */
  abstract readonly exemplo: boolean;

  abstract sincronizacao(): Promise<Sincronizacao | null>;
  abstract plenario(): Promise<Plenario | null>;
  abstract senador(codigo: string): Promise<Senador | null>;
  abstract votos(codigo: string, limite: number): Promise<VotoSenador[]>;
  abstract gastos(codigo: string): Promise<GastoAno[]>;
  abstract proposicoes(codigo: string): Promise<Proposicao[]>;
  abstract votacao(id: string): Promise<Votacao | null>;
  abstract ranking(): Promise<RankingSenado | null>;
  abstract presidentes(): Promise<Presidente[]>;
  abstract medidas(presidenteId: string, mandato: string): Promise<MedidaProvisoria[]>;
  abstract vetos(presidenteId: string, mandato: string): Promise<Veto[]>;
  abstract projetos(presidenteId: string, mandato: string): Promise<ProjetoExecutivo[]>;
  abstract indicadores(): Promise<Indicadores | null>;
}

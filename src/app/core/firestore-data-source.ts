import type { FirebaseOptions } from 'firebase/app';
import type { Firestore } from 'firebase/firestore';
import { DataSource } from './data-source';
import { linhaRanking } from './ranking';
import {
  AtosMandato,
  GastoAno,
  Indicadores,
  ListaProposicoes,
  Plenario,
  Presidente,
  RankingSenado,
  Senador,
  Sincronizacao,
  Votacao,
  VotosAno,
  VotoSenador,
} from './models';

type FirestoreModule = typeof import('firebase/firestore');

/** Lê do Firestore. O SDK é carregado sob demanda para não pesar no carregamento inicial. */
export class FirestoreDataSource extends DataSource {
  readonly exemplo = false;
  private conn?: Promise<{ db: Firestore; fs: FirestoreModule }>;
  private readonly atos = new Map<string, Promise<AtosMandato | null>>();

  constructor(
    private readonly config: FirebaseOptions,
    /** Chave do reCAPTCHA Enterprise para o App Check; sem ela, o App Check fica desligado. */
    private readonly appCheckSiteKey: string | null = null,
  ) {
    super();
  }

  private connect() {
    this.conn ??= (async () => {
      const [app, fs] = await Promise.all([import('firebase/app'), import('firebase/firestore')]);
      const firebase = app.initializeApp(this.config);
      // O App Check precisa estar ligado antes da primeira leitura: com a aplicação obrigatória
      // ativada no console, o Firestore recusa pedidos sem o token dele.
      if (this.appCheckSiteKey) {
        // reCAPTCHA Enterprise: o v3 clássico não é mais aceito no registro do App Check.
        const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await import('firebase/app-check');
        initializeAppCheck(firebase, { provider: new ReCaptchaEnterpriseProvider(this.appCheckSiteKey), isTokenAutoRefreshEnabled: true });
      }
      return { db: fs.getFirestore(firebase), fs };
    })();
    return this.conn;
  }

  private async getDoc<T>(path: string): Promise<T | null> {
    const { db, fs } = await this.connect();
    const snap = await fs.getDoc(fs.doc(db, path));
    return snap.exists() ? (snap.data() as T) : null;
  }

  private async getAll<T>(path: string): Promise<T[]> {
    const { db, fs } = await this.connect();
    const snap = await fs.getDocs(fs.collection(db, path));
    return snap.docs.map((d) => d.data() as T);
  }

  sincronizacao() {
    return this.getDoc<Sincronizacao>('meta/sincronizacao');
  }

  plenario() {
    return this.getDoc<Plenario>('plenario/senado');
  }

  senador(codigo: string) {
    return this.getDoc<Senador>(`senadores/${codigo}`);
  }

  async votos(codigo: string, limite: number): Promise<VotoSenador[]> {
    const anos = await this.getAll<VotosAno>(`senadores/${codigo}/votos`);
    return anos
      .sort((a, b) => b.ano - a.ano)
      .flatMap((a) => a.votos)
      .slice(0, limite);
  }

  async gastos(codigo: string): Promise<GastoAno[]> {
    return (await this.getAll<GastoAno>(`senadores/${codigo}/gastos`)).sort((a, b) => b.ano - a.ano);
  }

  async proposicoes(codigo: string) {
    return (await this.getDoc<ListaProposicoes>(`senadores/${codigo}/listas/proposicoes`))?.itens ?? [];
  }

  votacao(id: string) {
    return this.getDoc<Votacao>(`votacoes/${id}`);
  }

  async ranking(): Promise<RankingSenado | null> {
    const pronto = await this.getDoc<RankingSenado>('rankings/senado');
    if (pronto) return pronto;
    // Antes da primeira sincronização que grava o ranking: monta a partir dos perfis.
    const [p, senadores] = await Promise.all([this.plenario(), this.getAll<Senador>('senadores')]);
    if (!p) return null;
    const atuais = senadores.filter((s) => s.emExercicio);
    return {
      legislatura: p.legislatura,
      inicio: p.inicio,
      cotaAno: atuais[0]?.resumo.cotaAnoReferencia ?? new Date().getFullYear(),
      atualizadoEm: p.atualizadoEm,
      votacoes: Math.max(0, ...atuais.map((s) => s.resumo.votacoesLegislatura ?? s.resumo.votacoes)),
      linhas: atuais.map(linhaRanking),
    };
  }

  presidentes() {
    return this.getAll<Presidente>('presidentes');
  }

  private atosDoMandato(presidenteId: string, mandato: string) {
    const chave = `${presidenteId}/${mandato}`;
    if (!this.atos.has(chave)) this.atos.set(chave, this.getDoc<AtosMandato>(`presidentes/${presidenteId}/mandatos/${mandato}`));
    return this.atos.get(chave)!;
  }

  async medidas(presidenteId: string, mandato: string) {
    return (await this.atosDoMandato(presidenteId, mandato))?.medidas ?? [];
  }

  async vetos(presidenteId: string, mandato: string) {
    return (await this.atosDoMandato(presidenteId, mandato))?.vetos ?? [];
  }

  async projetos(presidenteId: string, mandato: string) {
    return (await this.atosDoMandato(presidenteId, mandato))?.projetos ?? [];
  }

  indicadores() {
    return this.getDoc<Indicadores>('indicadores/brasil');
  }
}

import type { FirebaseOptions } from 'firebase/app';
import type { Firestore } from 'firebase/firestore/lite';
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

type FirestoreModule = typeof import('firebase/firestore/lite');

/**
 * Dados que só mudam com a coleta diária ficam guardados no aparelho por algumas horas: ao
 * voltar a uma tela (ou reabrir o app), ela aparece na hora em vez de esperar o banco.
 */
// Troque a versão quando os documentos ganharem campos novos que a tela usa: senão o aparelho
// segue mostrando a cópia antiga (sem o campo) até a validade vencer.
const PREFIXO_CACHE = 'mt:cache:v2:';
const HORA = 3_600_000;

function lerGuardado<T>(chave: string, validade: number): T | undefined {
  try {
    const bruto = localStorage.getItem(PREFIXO_CACHE + chave);
    if (!bruto) return undefined;
    const { em, valor } = JSON.parse(bruto) as { em: number; valor: T };
    return Date.now() - em < validade ? valor : undefined;
  } catch {
    return undefined;
  }
}

function guardar(chave: string, valor: unknown) {
  try {
    localStorage.setItem(PREFIXO_CACHE + chave, JSON.stringify({ em: Date.now(), valor }));
  } catch {
    // Sem espaço ou sem acesso ao armazenamento: segue só com a memória.
  }
}

/**
 * Lê do Firestore com a versão Lite do SDK: o site só lê, e ela faz cada leitura com uma
 * chamada simples, sem a conexão de streaming nem o cache offline do SDK completo, com uma
 * fração do tamanho. Carregada sob demanda para não pesar no carregamento inicial.
 */
export class FirestoreDataSource extends DataSource {
  readonly exemplo = false;
  private conn?: Promise<{ db: Firestore; fs: FirestoreModule }>;
  private readonly atos = new Map<string, Promise<AtosMandato | null>>();
  private readonly memoria = new Map<string, Promise<unknown>>();

  constructor(
    private readonly config: FirebaseOptions,
    /** Chave do reCAPTCHA Enterprise para o App Check; sem ela, o App Check fica desligado. */
    private readonly appCheckSiteKey: string | null = null,
  ) {
    super();
  }

  private connect() {
    this.conn ??= (async () => {
      const [app, fs] = await Promise.all([import('firebase/app'), import('firebase/firestore/lite')]);
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

  /**
   * Uma leitura por sessão (na memória) e, com `noAparelho`, guardada no aparelho por
   * `horas`. Se a leitura falhar, nada fica guardado e a próxima tenta de novo.
   */
  private emCache<T>(chave: string, carregar: () => Promise<T>, noAparelho: { horas: number } | null): Promise<T> {
    let p = this.memoria.get(chave) as Promise<T> | undefined;
    if (!p) {
      p = (async () => {
        const salvo = noAparelho ? lerGuardado<T>(chave, noAparelho.horas * HORA) : undefined;
        if (salvo !== undefined) return salvo;
        const valor = await carregar();
        if (noAparelho && valor) guardar(chave, valor);
        return valor;
      })();
      p.catch(() => this.memoria.delete(chave));
      this.memoria.set(chave, p);
    }
    return p;
  }

  sincronizacao() {
    return this.emCache('sincronizacao', () => this.getDoc<Sincronizacao>('meta/sincronizacao'), { horas: 3 });
  }

  plenario() {
    return this.emCache('plenario', () => this.getDoc<Plenario>('plenario/senado'), { horas: 3 });
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

  ranking(): Promise<RankingSenado | null> {
    // Grande demais para guardar no aparelho; fica só na memória da sessão.
    return this.emCache('ranking', () => this.lerRanking(), null);
  }

  private async lerRanking(): Promise<RankingSenado | null> {
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
    return this.emCache('presidentes', () => this.getAll<Presidente>('presidentes'), { horas: 3 });
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
    return this.emCache('indicadores', () => this.getDoc<Indicadores>('indicadores/brasil'), { horas: 3 });
  }
}

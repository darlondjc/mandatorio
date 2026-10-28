// Sincronização diária do Mandatório: coleta as fontes oficiais e grava no Firestore.
//
//   npm run sync           grava no Firestore (precisa de FIREBASE_SERVICE_ACCOUNT)
//   npm run sync:dry       só coleta e salva em sync/out/ para conferência
//   --only=senado|presidente   roda uma parte só

import { mkdirSync, writeFileSync } from 'node:fs';
import type { Sincronizacao, VotoSenador } from '../../src/app/core/models.ts';
import { diagnostico } from './http.ts';
import { coletarPresidentes, deliberacoesVistas } from './presidente.ts';
import { coletarSenado, diagAutorias } from './senado.ts';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const only = args.find((a) => a.startsWith('--only='))?.split('=')[1];

type Gravacao = { caminho: string; dados: object };

async function gravar(itens: Gravacao[]) {
  if (dryRun) {
    const dir = new URL('../out/', import.meta.url);
    for (const { caminho, dados } of itens) {
      const arquivo = new URL(caminho.replaceAll('/', '__') + '.json', dir);
      mkdirSync(dir, { recursive: true });
      writeFileSync(arquivo, JSON.stringify(dados, null, 2));
    }
    console.log(`(dry-run) ${itens.length} documentos salvos em sync/out/`);
    return;
  }
  const credencial = process.env['FIREBASE_SERVICE_ACCOUNT'];
  if (!credencial) throw new Error('Defina FIREBASE_SERVICE_ACCOUNT com o JSON da conta de serviço, ou use --dry-run.');
  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const app = initializeApp({ credential: cert(JSON.parse(credencial)) });
  const db = getFirestore(app);
  db.settings({ ignoreUndefinedProperties: true });
  const writer = db.bulkWriter();
  for (const { caminho, dados } of itens) writer.set(db.doc(caminho), dados);
  await writer.close();
  console.log(`${itens.length} documentos gravados no Firestore.`);
}

/** Anotação do GitHub Actions (aparece no resumo da execução, mesmo sem acesso ao log). */
function anotar(tipo: 'error' | 'warning' | 'notice', titulo: string, msg: string) {
  const esc = (t: string) => t.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  console.log(`::${tipo} title=${esc(titulo).replace(/[:,]/g, ' ')}::${esc(msg)}`);
}

function publicarDiagnostico() {
  // O GitHub mostra até 10 anotações de cada tipo por etapa: agrupa em poucas mensagens.
  const formatos = [...diagnostico.formatos].map(([r, f]) => `${r} => ${f}`);
  for (let i = 0, parte = 1; i < formatos.length; parte++) {
    let msg = '';
    while (i < formatos.length && msg.length + formatos[i].length < 3500) msg += formatos[i++] + '\n';
    anotar('notice', `Formatos das APIs ${parte}`, msg || formatos[i++]);
  }
  const falhas = [...diagnostico.falhas].map(([r, f]) => `${r} (${f.vezes}x): ${f.ultima}`);
  if (falhas.length) anotar('warning', 'Endpoints com falha', falhas.join('\n').slice(0, 3500));
  console.log(`${diagnostico.chamadas} chamadas às APIs.`);
}

async function main() {
  const itens: Gravacao[] = [];
  const fontes: string[] = [];
  const erros: string[] = [];

  if (!only || only === 'senado') {
    try {
      const s = await coletarSenado();
      fontes.push('Senado Federal — Dados Abertos', 'Senado Federal — CEAPS');
      itens.push({ caminho: 'plenario/senado', dados: s.plenario });
      for (const sen of s.senadores) {
        itens.push({ caminho: `senadores/${sen.codigo}`, dados: sen });
        const porAno = new Map<number, VotoSenador[]>();
        for (const v of s.votosPorSenador.get(sen.codigo) ?? []) {
          const ano = Number(v.data.slice(0, 4));
          porAno.set(ano, [...(porAno.get(ano) ?? []), v]);
        }
        for (const [ano, votos] of porAno) itens.push({ caminho: `senadores/${sen.codigo}/votos/${ano}`, dados: { ano, votos } });
        for (const g of s.gastosPorSenador.get(sen.codigo) ?? []) itens.push({ caminho: `senadores/${sen.codigo}/gastos/${g.ano}`, dados: g });
        itens.push({ caminho: `senadores/${sen.codigo}/listas/proposicoes`, dados: { itens: s.proposicoesPorSenador.get(sen.codigo) ?? [] } });
      }
      for (const v of s.votacoes) itens.push({ caminho: `votacoes/${v.id}`, dados: v });
      const repetidas = new Map<string, number>();
      s.votacoes.forEach((v) => repetidas.set(v.materia, (repetidas.get(v.materia) ?? 0) + 1));
      anotar('notice', 'Senado — votações', `${s.votacoes.length} votações (${s.votacoes.filter((v) => v.secreta).length} secretas) · ${s.votacoes.filter((v) => v.descricao).length} com descrição · ${[...repetidas.values()].filter((n) => n > 1).length} matérias votadas mais de uma vez\nexemplos de descrição: ${[...new Set(s.votacoes.map((v) => v.descricao).filter(Boolean))].slice(0, 12).join(' | ').slice(0, 1800)}`);
      const votos = [...s.votosPorSenador.values()].reduce((a, v) => a + v.length, 0);
      const dist = { sim: 0, nao: 0, abstencao: 0, secreto: 0, ausente: 0, divergiu: 0 };
      for (const lista of s.votosPorSenador.values()) for (const v of lista) { dist[v.voto]++; if (v.divergiu) dist.divergiu++; }
      const originais = new Map<string, number>();
      for (const lista of s.votosPorSenador.values()) for (const v of lista) originais.set(v.votoOriginal, (originais.get(v.votoOriginal) ?? 0) + 1);
      const ex = s.senadores[0];
      anotar('notice', 'Senado — votos', `${JSON.stringify(dist)}\nsiglas originais: ${[...originais].map(([k, n]) => `${k}=${n}`).join(' ')}\nexemplo: ${JSON.stringify({ nome: ex.nome, partido: ex.partido, mandato: ex.mandato, nascimento: ex.nascimento, naturalidade: ex.naturalidade, comissoes: ex.comissoes.length, resumo: ex.resumo, voto: s.votosPorSenador.get(ex.codigo)?.[0] }).slice(0, 1500)}`);
      if (diagAutorias.semItens.length) anotar('warning', 'Senado — senadores sem proposições', diagAutorias.semItens.join('\n'));
      anotar('notice', 'Senado — autorias', `${diagAutorias.comItens} senadores com proposições · leis: ${s.senadores.reduce((a, x) => a + x.resumo.proposicoesLei, 0)} · exemplo: ${JSON.stringify(s.proposicoesPorSenador.get(ex.codigo)?.slice(0, 2)).slice(0, 700)}`);
      anotar('notice', 'Senado', `${s.senadores.length} senadores · ${s.plenario.partidos.length} partidos · ${votos} votos individuais · ${[...s.gastosPorSenador.values()].filter((g) => g.length).length} com gastos · ${[...s.proposicoesPorSenador.values()].reduce((a, p) => a + p.length, 0)} proposições`);
    } catch (e) {
      erros.push('Senado');
      console.error(e);
      anotar('error', 'Senado falhou', `${(e as Error).message}\n${(e as Error).stack?.split('\n').slice(1, 4).join('\n') ?? ''}`);
    }
  }

  if (!only || only === 'presidente') {
    try {
      const p = await coletarPresidentes();
      fontes.push('Câmara dos Deputados — Dados Abertos', 'Congresso Nacional — Vetos');
      for (const pres of p.presidentes) itens.push({ caminho: `presidentes/${pres.id}`, dados: pres });
      for (const a of p.atos) itens.push({ caminho: `presidentes/${a.presidenteId}/mandatos/${a.mandato}`, dados: a });
      const conta = <T,>(xs: T[], f: (x: T) => string) => JSON.stringify(xs.reduce<Record<string, number>>((o, x) => ((o[f(x)] = (o[f(x)] ?? 0) + 1), o), {}));
      anotar('notice', 'Presidente', p.atos.map((a) => {
        const nums = a.medidas.map((m) => Number(m.numero.replace(/\D/g, '').slice(0, -4)));
        return `${a.presidenteId} ${a.mandato}: ${a.medidas.length} MPs (nº ${Math.min(...nums)}–${Math.max(...nums)}) ${conta(a.medidas, (m) => m.situacao)}\n${a.vetos.length} vetos ${conta(a.vetos, (v) => v.situacao)} ${conta(a.vetos, (v) => v.tipo)} sem matéria: ${a.vetos.filter((v) => !v.materia).length}\n${a.projetos.length} projetos ${conta(a.projetos, (x) => x.etapa)}\nexemplos: ${JSON.stringify([a.medidas[0], a.vetos[0], a.projetos[0]]).slice(0, 1800)}`;
      }).join('\n'));
      anotar('notice', 'Presidente — fotos', p.presidentes.map((x) => `${x.nome}: ${x.foto ?? 'sem foto'}`).join('\n'));
      anotar('notice', 'Presidente — deliberações de veto', JSON.stringify(Object.fromEntries(deliberacoesVistas)));
    } catch (e) {
      erros.push('Presidente');
      console.error(e);
      anotar('error', 'Presidente falhou', `${(e as Error).message}\n${(e as Error).stack?.split('\n').slice(1, 4).join('\n') ?? ''}`);
    }
  }

  publicarDiagnostico();

  // Só registra a data da coleta se tudo deu certo; o que foi coletado é gravado mesmo assim.
  if (!erros.length) {
    const meta: Sincronizacao = { atualizadoEm: new Date().toISOString(), fontes };
    itens.push({ caminho: 'meta/sincronizacao', dados: meta });
  }
  if (itens.length) await gravar(itens);
  if (erros.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  anotar('error', 'Sincronização falhou', String((e as Error).message ?? e));
  process.exit(1);
});

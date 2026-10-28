// Sincronização diária do Mandatório: coleta as fontes oficiais e grava no Firestore.
//
//   npm run sync           grava no Firestore (precisa de FIREBASE_SERVICE_ACCOUNT)
//   npm run sync:dry       só coleta e salva em sync/out/ para conferência
//   --only=senado|presidente   roda uma parte só

import { mkdirSync, writeFileSync } from 'node:fs';
import type { Sincronizacao, VotoSenador } from '../../src/app/core/models.ts';
import { coletarPresidentes } from './presidente.ts';
import { coletarSenado } from './senado.ts';

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

async function main() {
  const itens: Gravacao[] = [];
  const fontes: string[] = [];

  if (!only || only === 'senado') {
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
  }

  if (!only || only === 'presidente') {
    const p = await coletarPresidentes();
    fontes.push('Câmara dos Deputados — Dados Abertos', 'Congresso Nacional — Vetos');
    for (const pres of p.presidentes) itens.push({ caminho: `presidentes/${pres.id}`, dados: pres });
    for (const a of p.atos) itens.push({ caminho: `presidentes/${a.presidenteId}/mandatos/${a.mandato}`, dados: a });
  }

  const meta: Sincronizacao = { atualizadoEm: new Date().toISOString(), fontes };
  itens.push({ caminho: 'meta/sincronizacao', dados: meta });
  await gravar(itens);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

# Mandatório

Acompanhe a atuação de quem governa e legisla: votos, presença, gastos, medidas provisórias e vetos, em linguagem simples, no computador e no celular.

**MVP:** Presidente da República (projetos, medidas provisórias e vetos) e os 81 senadores em exercício (plenário, perfil, como vota, projetos, gastos e comissões). **Depois:** comparação entre parlamentares, rankings (presença, gastos, fidelidade) e mandatos anteriores.

| Parte | Tecnologia |
|---|---|
| Site | Angular 21 (standalone, signals, zoneless), publicado no GitHub Pages |
| Dados | Cloud Firestore (somente leitura pelo site) |
| Coleta | Script Node/TypeScript em `sync/`, rodado diariamente pelo GitHub Actions |
| Visual | Design System "Mandatório" (direção Praça, paleta Mata): tokens em `design/tokens.json` |

## Rodando localmente

```bash
npm install
npm start            # http://localhost:4200
npm test -- --watch=false
```

Sem o Firebase configurado, o site usa **dados de exemplo** (nomes e números fictícios) e mostra um aviso no topo. Isso permite desenvolver as telas sem depender da coleta.

## Estrutura

```
src/app/
  core/            modelo de dados, fontes de dados (Firestore e exemplo), formatação
  shared/          componentes: plenário (SeatMap), foto/avatar, barra de votos, abas, ícones
  pages/           senado, senador, presidente
src/styles/        tokens.css (gerado) e components.css (classes mt-* do Design System)
design/            tokens.json (fonte única das cores, tipos e espaçamentos) e o gerador de tokens.css
sync/              coleta das fontes oficiais e gravação no Firestore
.github/workflows/ deploy.yml (Pages) e sync.yml (coleta diária)
```

Para mudar cores, tipografia ou espaçamentos, edite `design/tokens.json` e rode `node design/build-tokens.mjs`.

## Colocando no ar

### 1. GitHub Pages

Em **Settings → Pages**, escolha **Source: GitHub Actions**. Cada push na `main` publica o site em `https://<usuário>.github.io/mandatorio/`.

### 2. Firebase

1. Crie um projeto em <https://console.firebase.google.com> (o plano gratuito Spark basta) e ative o **Cloud Firestore** em modo de produção.
2. Publique as regras deste repositório (leitura pública, nenhuma escrita pelo navegador): copie `firestore.rules` no console, em **Firestore → Regras**, ou rode `firebase deploy --only firestore:rules`.
3. **Configuração web (pública).** Em **Configurações do projeto → Seus apps**, crie um app Web e copie o objeto `firebaseConfig`. No GitHub, crie a variável **`FIREBASE_WEB_CONFIG`** (Settings → Secrets and variables → Actions → **Variables**) com esse objeto em JSON:
   ```json
   {"apiKey":"…","authDomain":"…","projectId":"…","storageBucket":"…","messagingSenderId":"…","appId":"…"}
   ```
4. **Conta de serviço (secreta).** Em **Configurações do projeto → Contas de serviço**, gere uma chave privada. Crie o secret **`FIREBASE_SERVICE_ACCOUNT`** (Settings → Secrets and variables → Actions → **Secrets**) com o conteúdo do JSON. Essa chave nunca vai para o código.

### 3. Primeira coleta

Em **Actions → Sincronizar dados → Run workflow**, marque **dry_run** na primeira vez. A coleta roda sem gravar e deixa os JSON como artefato `coleta`, para você conferir se as APIs responderam como esperado. Depois rode sem `dry_run`. A partir daí, ela roda sozinha todo dia às 04:17 (horário de Brasília). Rode o workflow **Deploy** de novo para o site passar a ler o Firestore.

## Fontes de dados

| Dado | Fonte |
|---|---|
| Senadores, comissões, autorias, votações nominais | [Dados Abertos do Senado](https://legis.senado.leg.br/dadosabertos) |
| Cota parlamentar dos senadores (CEAPS) | [Transparência do Senado](https://adm.senado.gov.br/adm-dadosabertos) |
| Medidas provisórias e projetos do Executivo | [Dados Abertos da Câmara](https://dadosabertos.camara.leg.br) |
| Vetos | [Dados Abertos do Congresso Nacional](https://legis.senado.leg.br/dadosabertos) |
| Presidentes e mandatos | Cadastro manual em `sync/src/presidentes.json` |

Regras de cálculo:

- **Presença:** votações nominais da legislatura atual em que o senador não aparece como ausente. Licenças e missões contam como ausência.
- **Voto com o partido:** porcentagem de votos Sim/Não iguais aos da maioria da bancada naquela votação. As APIs não trazem a orientação oficial das lideranças.
- **Abstenção** inclui obstrução e "presente, não registrou voto". O código original fica no detalhe do voto.
- **Prazo de MP:** 120 dias a partir da edição, sem contar os recessos de 18–31/jul e 23/dez–1º/fev.

**Atenção:** os formatos das APIs foram escritos a partir da documentação pública e ainda não foram testados contra as respostas reais. Por isso a primeira coleta deve ser em `dry_run`. O código tolera campos ausentes, mas pode precisar de ajustes.

### Custo no Firestore

Listas ficam agrupadas em poucos documentos:

- um documento por senador por ano de votações;
- um documento por mandato presidencial com MPs, vetos e projetos.

Assim, cada coleta grava cerca de mil documentos, bem abaixo do limite gratuito de 20 mil gravações por dia. O formato está descrito em `src/app/core/models.ts`.

## Mandatos anteriores

Para incluir um presidente ou mandato anterior, acrescente-o em `sync/src/presidentes.json`. O seletor de mandato da tela do Presidente já lista todos os cadastrados.

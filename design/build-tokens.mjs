// Gera src/styles/tokens.css a partir de design/tokens.json (fonte única, a mesma do Design System).
// Uso: node design/build-tokens.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const t = JSON.parse(readFileSync(new URL('./tokens.json', import.meta.url), 'utf8'));
const themes = t.color.themes.map((th) => th.id);
const [first] = themes;

const resolve = (v) => (typeof v === 'string' && v.startsWith('{') ? `var(--${v.slice(1, -1)})` : v);
const valueFor = (token, theme) =>
  typeof token.value === 'string' ? (theme === first ? token.value : null) : (token.value[theme] ?? null);

const block = (theme) =>
  [...t.color.tokens, ...(t.shadow?.tokens ?? [])]
    .map((tok) => {
      const v = valueFor(tok, theme);
      return v == null ? null : `  --${tok.name}: ${resolve(v)};`;
    })
    .filter(Boolean)
    .join('\n');

const scalars = [...t.spacing.tokens, ...t.radius.tokens].map((tok) => `  --${tok.name}: ${tok.value};`);
const fonts = Object.entries(t.type.families).map(([k, v]) => `  --font-${k}: ${v};`);

const dark = block('dark');
const css = `/* Mandatório — gerado de design/tokens.json por design/build-tokens.mjs. Não edite à mão. */
:root {
${block(first)}
${scalars.join('\n')}
${fonts.join('\n')}
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
${dark.replace(/^/gm, '  ')}
    color-scheme: dark;
  }
}
:root[data-theme='dark'] {
${dark}
  color-scheme: dark;
}
`;
writeFileSync(new URL('../src/styles/tokens.css', import.meta.url), css);
console.log('src/styles/tokens.css gerado');

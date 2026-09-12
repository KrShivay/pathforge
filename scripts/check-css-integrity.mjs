import fs from 'node:fs';

const css = fs.readFileSync('src/index.css', 'utf8');
const declarations = new Map();

for (const match of css.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)[;}]/g)) {
  declarations.set(match[1], match[2]);
}

function references(value) {
  return [...value.matchAll(/var\((--[\w-]+)/g)].map((match) => match[1]);
}

function visit(token, trail = []) {
  if (trail.includes(token)) {
    throw new Error(`Cyclic custom property: ${[...trail, token].join(' -> ')}`);
  }
  for (const dependency of references(declarations.get(token) ?? '')) {
    if (declarations.has(dependency)) visit(dependency, [...trail, token]);
  }
}

for (const token of declarations.keys()) visit(token);

console.log('CSS custom properties are acyclic.');

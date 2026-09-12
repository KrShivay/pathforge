import fs from 'fs';

const css = fs.readFileSync('src/index.css', 'utf8');

// A very naive CSS parser that extracts top-level blocks
const blocks = [];
let currentBlock = '';
let braceDepth = 0;
let inComment = false;

for (let i = 0; i < css.length; i++) {
  const c = css[i];
  const next = css[i + 1];

  if (!inComment && c === '/' && next === '*') {
    inComment = true;
    currentBlock += c;
    continue;
  }
  if (inComment && c === '*' && next === '/') {
    inComment = false;
    currentBlock += c + next;
    i++;
    continue;
  }

  currentBlock += c;

  if (!inComment) {
    if (c === '{') braceDepth++;
    if (c === '}') {
      braceDepth--;
      if (braceDepth === 0) {
        blocks.push(currentBlock.trim());
        currentBlock = '';
      }
    }
  }
}

// Add the last block if any
if (currentBlock.trim()) {
  blocks.push(currentBlock.trim());
}

const uniqueBlocks = new Map();
const output = [];

for (const block of blocks) {
  // Extract the selector / block header
  let header = block.substring(0, block.indexOf('{')).trim();
  // Strip comments from header
  header = header.replace(/\/\*[\s\S]*?\*\//g, '').trim();

  // If it's a media query, we just store the whole block as is for now
  if (header.startsWith('@media') || header.startsWith('@keyframes') || header.startsWith(':root')) {
    output.push(block);
  } else if (header) {
    // If it's a normal selector, keep the latest one
    uniqueBlocks.set(header, block);
  } else {
    // Just a comment or something
    output.push(block);
  }
}

for (const [header, block] of uniqueBlocks.entries()) {
  output.push(block);
}

const consolidated = output.join('\n\n');
console.log('Original length:', css.length);
console.log('Consolidated length:', consolidated.length);

fs.writeFileSync('src/index.css', consolidated);

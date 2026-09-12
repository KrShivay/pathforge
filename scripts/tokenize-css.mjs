import fs from 'fs';

const cssPath = 'src/index.css';
let css = fs.readFileSync(cssPath, 'utf8');

const replacements = [
  // Fonts
  { regex: /font-family:\s*['"]?Inter['"]?,\s*sans-serif;/g, replace: 'font-family: var(--pf-font-stack);' },

  // Slate / Grays (Backgrounds/Borders)
  { regex: /#f4f6f8/gi, replace: 'var(--pf-bg-main)' },
  { regex: /#f8fafc/gi, replace: 'var(--pf-slate-50)' },
  { regex: /#f1f5f9/gi, replace: 'var(--pf-slate-100)' },
  { regex: /#e2e8f0/gi, replace: 'var(--pf-slate-200)' },
  { regex: /#cbd5e1/gi, replace: 'var(--pf-slate-300)' },
  { regex: /#94a3b8/gi, replace: 'var(--pf-slate-400)' },
  { regex: /#64748b/gi, replace: 'var(--pf-slate-500)' },
  { regex: /#475569/gi, replace: 'var(--pf-slate-600)' },
  { regex: /#334155/gi, replace: 'var(--pf-slate-700)' },
  { regex: /#1e293b/gi, replace: 'var(--pf-slate-800)' },
  { regex: /#0f172a/gi, replace: 'var(--pf-slate-900)' },

  // Navy (for dark themes / specific blocks)
  { regex: /#1d2b45/gi, replace: 'var(--pf-navy-700)' },
  { regex: /#172033/gi, replace: 'var(--pf-navy-800)' },

  // Primary Blues
  { regex: /#3b82f6/gi, replace: 'var(--pf-blue-500)' },
  { regex: /#2563eb/gi, replace: 'var(--pf-blue-600)' },
  { regex: /rgba\(37,\s*99,\s*235,\s*0\.1\)/g, replace: 'rgba(37, 99, 235, 0.1)' },

  // Reds
  { regex: /#ef4444/gi, replace: 'var(--pf-red-500)' },
  { regex: /#dc2626/gi, replace: 'var(--pf-red-600)' },

  // Greens/Ambers
  { regex: /#10b981/gi, replace: 'var(--pf-green-500)' },
  { regex: /#f59e0b/gi, replace: 'var(--pf-amber-500)' },

  // Focus ring
  { regex: /box-shadow:\s*0 0 0 2px white, 0 0 0 2px #2563eb/g, replace: 'box-shadow: var(--pf-focus-ring)' },

  // Shadows (basic replacements)
  { regex: /box-shadow:\s*0 1px 2px rgba\(0,\s*0,\s*0,\s*0\.05\)/g, replace: 'box-shadow: var(--pf-shadow-sm)' },
  {
    regex: /box-shadow:\s*0 4px 6px -1px rgba\(0,\s*0,\s*0,\s*0\.1\),\s*0 2px 4px -1px rgba\(0,\s*0,\s*0,\s*0\.06\)/g,
    replace: 'box-shadow: var(--pf-shadow-md)',
  },
];

for (const { regex, replace } of replacements) {
  css = css.replace(regex, replace);
}

fs.writeFileSync(cssPath, css);
console.log('Tokenization complete.');

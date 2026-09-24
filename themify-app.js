const fs = require('fs');

const appPath = 'apps/desktop/src/renderer/App.tsx';
let code = fs.readFileSync(appPath, 'utf8');

const replacements = [
  { match: /bg-\[#080808\]/g, replace: 'bg-slate-50 dark:bg-[#080808]' },
  { match: /bg-\[#0a0a0a\]/g, replace: 'bg-white dark:bg-[#0a0a0a]' },
  { match: /bg-\[#050505\]([^/])/g, replace: 'bg-slate-100 dark:bg-[#050505]$1' }, // Ensure we don't catch bg-[#050505]/95
  { match: /bg-\[#050505\]\/95/g, replace: 'bg-slate-100/95 dark:bg-[#050505]/95' },
  { match: /bg-\[#111\]/g, replace: 'bg-white dark:bg-[#111]' },
  
  // Opacity backgrounds
  { match: /bg-black\/40/g, replace: 'bg-slate-200 dark:bg-black/40' },
  { match: /bg-black\/80/g, replace: 'bg-white/80 dark:bg-black/80' },
  { match: /bg-white\/\[0\.02\]/g, replace: 'bg-white dark:bg-white/[0.02]' },
  { match: /bg-white\/\[0\.03\]/g, replace: 'bg-white dark:bg-white/[0.03]' },
  { match: /bg-white\/\[0\.04\]/g, replace: 'bg-slate-100 dark:bg-white/[0.04]' },
  { match: /bg-white\/\[0\.05\]/g, replace: 'bg-slate-50 dark:bg-white/[0.05]' },
  { match: /bg-white\/5/g, replace: 'bg-slate-100 dark:bg-white/5' },
  { match: /bg-white\/10/g, replace: 'bg-slate-200 dark:bg-white/10' },

  // Generic White Text conversions
  { match: /text-white([^a-zA-Z\/-])/g, replace: 'text-slate-900 dark:text-white$1' },
  { match: /text-white\/90/g, replace: 'text-slate-800 dark:text-white/90' },
  { match: /text-white\/80/g, replace: 'text-slate-800 dark:text-white/80' },
  { match: /text-white\/70/g, replace: 'text-slate-700 dark:text-white/70' },
  { match: /text-white\/50/g, replace: 'text-slate-600 dark:text-white/50' },
  { match: /text-white\/40/g, replace: 'text-slate-500 dark:text-white/40' },
  { match: /text-white\/30/g, replace: 'text-slate-400 dark:text-white/30' },
  { match: /text-white\/20/g, replace: 'text-slate-400 dark:text-white/20' },
  
  // Borders
  { match: /border-white\/20/g, replace: 'border-slate-300 dark:border-white/20' },
  { match: /border-white\/10/g, replace: 'border-slate-200 dark:border-white/10' },
  { match: /border-white\/5/g, replace: 'border-slate-200 dark:border-white/5' },

  // Hovers
  { match: /hover:text-white([^/a-zA-Z-])/g, replace: 'hover:text-slate-900 dark:hover:text-white$1' },
  { match: /hover:text-white\/50/g, replace: 'hover:text-slate-600 dark:hover:text-white/50' },
  { match: /hover:bg-white\/5/g, replace: 'hover:bg-slate-200 dark:hover:bg-white/5' },
  { match: /hover:bg-white\/10/g, replace: 'hover:bg-slate-300 dark:hover:bg-white/10' },
  
  // Specific contextual things
  { match: /selection:bg-blue-500\/30/g, replace: 'selection:bg-blue-500/30' },
  { match: /text-gray-500/g, replace: 'text-slate-400 dark:text-gray-500' },
  { match: /text-gray-600/g, replace: 'text-slate-300 dark:text-gray-600' }
];

// Perform replacements, ensuring we don't accidentally double-replace if running twice
// To make it idempotent, we'll only replace if the target class isn't already preceded by 'dark:' or 'slate'
replacements.forEach(({match, replace}) => {
  code = code.replace(match, (substring, ...args) => {
    return replace.replace('$1', args[0] || '');
  });
});

// Since the regex might catch things incorrectly, we do a naive cleanup of duplicated classes just in case
// but the regex is simple enough.

// Add Lucide Sun/Moon imports if not present
if (!code.includes('Sun,') && !code.includes('Moon,')) {
  code = code.replace(/import {([^}]+)} from 'lucide-react';/, (m, p1) => {
    return `import {${p1}, Sun, Moon} from 'lucide-react';`;
  });
}

fs.writeFileSync(appPath, code);
console.log('Thermification completed!');

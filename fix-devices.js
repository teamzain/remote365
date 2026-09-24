const fs = require('fs');
const path = 'apps/auth-service/src/routes/devices.ts';
let code = fs.readFileSync(path, 'utf8');

// The write_to_file tool literally inserted \` and \$ where it shouldn't have in template literals.
code = code.replace(/\\`/g, '`');
code = code.replace(/\\\$/g, '$');

fs.writeFileSync(path, code);
console.log('Fixed escaped backticks in devices.ts');

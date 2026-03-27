const fs = require('fs');
const content = fs.readFileSync('src/app/data/mockData.ts', 'utf8');

// We will use regex or simple string replacement to remove op2 - op6 and their courts.
// But wait, since it's TypeScript, we can't easily require it.
// We can use a script to rewrite mockData.ts with just op1 and Court 3, 3b.

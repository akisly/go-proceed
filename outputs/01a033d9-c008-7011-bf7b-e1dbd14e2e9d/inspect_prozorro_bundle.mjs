import fs from 'node:fs';

const source = fs.readFileSync('/tmp/goproceed_prozorro_main.js', 'utf8');
const values = new Set();
for (const match of source.matchAll(/(["'])(.*?)(?<!\\)\1/g)) {
  const value = match[2];
  if (/api|search|tender|procedure/i.test(value) && value.length < 320) {
    values.add(value);
  }
}
console.log([...values].sort().join('\n'));

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import JavaScriptObfuscator from 'javascript-obfuscator';

const assets = join(process.cwd(), 'build', 'assets');
const files = await readdir(assets);
const scripts = files.filter((file) => file.endsWith('.js'));

await Promise.all(scripts.map(async (file) => {
  const location = join(assets, file);
  const source = await readFile(location, 'utf8');
  const obfuscated = JavaScriptObfuscator.obfuscate(source, {
    compact: true,
    controlFlowFlattening: false,
    deadCodeInjection: false,
    identifierNamesGenerator: 'hexadecimal',
    renameGlobals: false,
    selfDefending: false,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.75,
    unicodeEscapeSequence: false
  }).getObfuscatedCode();
  await writeFile(location, obfuscated);
}));

console.log(`Obfuscated ${scripts.length} production JavaScript file(s).`);

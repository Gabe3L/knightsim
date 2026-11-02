import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const modules = new Map();
// Compile pure project modules without a second build tree or runtime dependency.
async function moduleUrl(url) {
  if (modules.has(url.href)) return modules.get(url.href);
  const source = await readFile(url, 'utf8');
  let output = url.pathname.endsWith('.json') ? `export default ${source};`
    : ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText;
  const imports = [...output.matchAll(/from\s+['"]([^'"]+)['"]/g)];
  for (const match of imports) {
    const specifier = match[1];
    let resolved;
    if (specifier.startsWith('.')) {
      const dependency = new URL(specifier, url);
      if (dependency.pathname.endsWith('.cjs')) dependency.pathname = dependency.pathname.replace(/\.cjs$/, '.cts');
      else if (!/\.(ts|json)$/.test(dependency.pathname)) dependency.pathname += '.ts';
      resolved = await moduleUrl(dependency);
    } else resolved = import.meta.resolve(specifier);
    output = output.replace(match[0], `from '${resolved}'`);
  }
  const result = `data:text/javascript;base64,${Buffer.from(output).toString('base64')}`;
  modules.set(url.href, result);
  return result;
}

export async function loadTypeScript(url) { return import(await moduleUrl(url)); }

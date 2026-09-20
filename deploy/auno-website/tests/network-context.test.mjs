import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';

mkdirSync('work/network-tests', { recursive: true });
const compile = (name, source) => writeFileSync(`work/network-tests/${name}.mjs`, ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText);
compile('model', readFileSync('lib/payments/model.ts', 'utf8'));
compile('browser', readFileSync('lib/browser-network.ts', 'utf8').replace("'./payments/model'", "'./model.mjs'"));
compile('server', readFileSync('lib/site-network.ts', 'utf8')
  .replace('import { headers } from "next/headers";', 'const headers = async () => new Headers({host: globalThis.testHost});')
  .replace("import { readRuntimeEnv } from './runtime-env';", 'const readRuntimeEnv = () => globalThis.testNetwork;'));
const { browserNetwork } = await import('../work/network-tests/browser.mjs');
const { isMainnetRequest } = await import('../work/network-tests/server.mjs');

for (const host of ['localhost:3002', 'auno.cash', 'mainnet.auno.cash']) {
  globalThis.testHost = host;
  for (const network of ['mainnet-beta', 'devnet']) {
    globalThis.testNetwork = network;
    globalThis.document = { documentElement: { dataset: { network } } };
    globalThis.window = { location: { origin: `http://${host}` } };
    assert.equal(await isMainnetRequest(), network === 'mainnet-beta');
    assert.equal(browserNetwork(), network);
  }
}
globalThis.testNetwork = undefined;
globalThis.document = { documentElement: { dataset: {} } };
for (const [host, mainnet] of [['auno.cash', true], ['mainnet.auno.cash', true], ['localhost:3002', false]]) {
  globalThis.testHost = host;
  globalThis.window = { location: { origin: `http://${host}` } };
  assert.equal(await isMainnetRequest(), mainnet);
  assert.equal(browserNetwork(), mainnet ? 'mainnet-beta' : 'devnet');
}
console.log('PASS configured network agrees across server rendering, browser labels and wallet signing; both AUNO mainnet hosts resolve correctly');

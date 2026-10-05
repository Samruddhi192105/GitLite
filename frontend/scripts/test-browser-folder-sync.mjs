import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const frontendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(frontendDirectory, "lib", "browser-folder-sync.ts");
const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "gitlite-browser-sync-test-"));
const require = createRequire(import.meta.url);

try {
  const source = await fs.readFile(sourcePath, "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics || []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error
  );
  assert.equal(errors.length, 0, "Could not compile browser folder sync helpers.");
  const compiledPath = path.join(temporaryDirectory, "browser-folder-sync.js");
  await fs.writeFile(compiledPath, result.outputText);

  const { batchFiles, decodeBundle } = require(compiledPath);
  console.log("Testing download batches and limits...");
  const batches = batchFiles([
    { path: "src/a.txt", size: 50 * 1024 * 1024 },
    { path: "src/b.txt", size: 51 * 1024 * 1024 },
    { path: "README.md", size: 1 },
  ]);
  assert.equal(batches.length, 2);
  assert.equal(batches[0].length, 1);
  assert.throws(() => batchFiles([{ path: "large.bin", size: 100 * 1024 * 1024 }]));

  console.log("Testing browser bundle decoding...");
  const name = Buffer.from("src/readme.txt");
  const content = Buffer.from("hello");
  const bundle = Buffer.alloc(8 + 2 + name.length + 8 + content.length);
  bundle.write("GLB1", 0);
  bundle.writeUInt32BE(1, 4);
  bundle.writeUInt16BE(name.length, 8);
  name.copy(bundle, 10);
  bundle.writeBigUInt64BE(BigInt(content.length), 10 + name.length);
  content.copy(bundle, 18 + name.length);
  const decoded = decodeBundle(bundle.buffer.slice(bundle.byteOffset, bundle.byteOffset + bundle.byteLength), [
    { path: "src/readme.txt", size: content.length },
  ]);
  assert.equal(Buffer.from(decoded[0].content).toString(), "hello");
  assert.throws(() => decodeBundle(bundle.buffer.slice(0, bundle.byteLength - 1), [
    { path: "src/readme.txt", size: content.length },
  ]));
  assert.throws(() => decodeBundle(bundle.buffer.slice(bundle.byteOffset, bundle.byteOffset + bundle.byteLength), [
    { path: "different.txt", size: content.length },
  ]));

  console.log("Browser folder sync helper tests passed.");
} finally {
  await fs.rm(temporaryDirectory, { recursive: true, force: true });
}

import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';
import JavaScriptObfuscator from 'javascript-obfuscator';
import bytenode from 'bytenode';

const DIST_DIR = 'dist';

function shouldObfuscateRenderer(filePath) {
  const name = path.basename(filePath);

  if (!name.endsWith('.js')) return false;

  if (name.startsWith('vendor-')) return false;
  if (name.startsWith('ui-')) return false;
  if (name.startsWith('charts-')) return false;

  return true;
}

async function createBuildPackageJson() {
  const rootPackageJson = await fs.readJson('package.json');

  const buildPackageJson = {
    name: rootPackageJson.name,
    version: rootPackageJson.version,
    main: 'electron.cjs',
    dependencies: {
      ...(rootPackageJson.dependencies || {}),
      bytenode: rootPackageJson.devDependencies?.bytenode || '^1.5.7'
    }
  };

  await fs.writeJson(path.join(DIST_DIR, 'package.json'), buildPackageJson, { spaces: 2 });
  console.log('dist/package.json создан');
}

async function obfuscateRenderer() {
  const files = await glob(`${DIST_DIR}/assets/**/*.js`);

  for (const file of files) {
    if (!shouldObfuscateRenderer(file)) continue;

    const code = await fs.readFile(file, 'utf8');

    const result = JavaScriptObfuscator.obfuscate(code, {
      compact: true,
      controlFlowFlattening: true,
      controlFlowFlatteningThreshold: 0.2,
      deadCodeInjection: false,
      debugProtection: false,
      disableConsoleOutput: true,
      identifierNamesGenerator: 'hexadecimal',
      renameGlobals: false,
      selfDefending: true,
      simplify: true,
      splitStrings: true,
      splitStringsChunkLength: 8,
      stringArray: true,
      stringArrayCallsTransform: true,
      stringArrayEncoding: ['base64'],
      stringArrayRotate: true,
      stringArrayShuffle: true,
      stringArrayWrappersCount: 1,
      transformObjectKeys: true,
      unicodeEscapeSequence: false
    });

    await fs.writeFile(file, result.getObfuscatedCode(), 'utf8');
    console.log(`Обфусцирован renderer chunk: ${file}`);
  }
}

async function compileElectronFiles() {
  const electronSrc = 'public/electron.cjs';
  const preloadSrc = 'public/preload.cjs';
  const dbSrc = 'public/db/sqlite-readonly.cjs';

  const electronBytecode = path.join(DIST_DIR, 'electron.jsc');

  await bytenode.compileFile({
    filename: electronSrc,
    output: electronBytecode,
    electron: true
  });

  await fs.writeFile(
    path.join(DIST_DIR, 'electron.cjs'),
    "require('bytenode'); module.exports = require('./electron.jsc');\n",
    'utf8'
  );
  await fs.copy(preloadSrc, path.join(DIST_DIR, 'preload.cjs'));

  await fs.ensureDir(path.join(DIST_DIR, 'db'));
  await fs.copy(dbSrc, path.join(DIST_DIR, 'db', 'sqlite-readonly.cjs'));

  console.log('Electron main в bytecode, preload и db скопированы');
}

async function postBuild() {
  try {
    console.log('--- post-build start ---');

    await createBuildPackageJson();
    await obfuscateRenderer();
    await compileElectronFiles();

    console.log('--- post-build done ---');
  } catch (err) {
    console.error('Ошибка post-build:', err);
    process.exit(1);
  }
}

postBuild();
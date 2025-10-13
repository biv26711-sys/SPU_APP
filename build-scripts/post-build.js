import fs from 'fs-extra';
import path from 'path';

async function postBuild() {
  console.log('--- Запуск пост-сборочного скрипта ---');

  try {
    console.log('Создание package.json для сборки...');
    const rootPackageJson = await fs.readJson('package.json');
    
    if (!rootPackageJson.dependencies) {
      console.warn('В корневом package.json не найдены зависимости. Сборка может завершиться с ошибкой.');
    }

    const buildPackageJson = {
      name: rootPackageJson.name,
      version: rootPackageJson.version,
      main: 'electron.cjs',
      dependencies: rootPackageJson.dependencies || {}
    };
    await fs.writeJson(path.join('dist', 'package.json'), buildPackageJson, { spaces: 2 });
    console.log('Файл package.json для сборки создан в папке dist/');

    console.log('Копирование главного файла Electron...');
    await fs.copy('public/electron.cjs', 'dist/electron.cjs');
    console.log('Главный файл Electron скопирован в dist/');

    console.log('Копирование preload-скрипта...');
    await fs.copy('public/preload.cjs', 'dist/preload.cjs');
    console.log('Preload-скрипт скопирован в dist/');

    console.log('--- Пост-сборочный скрипт успешно завершен! ---');

  } catch (err) {
    console.error('Ошибка во время выполнения пост-сборочного скрипта:', err);
    process.exit(1);
  }
}

postBuild();

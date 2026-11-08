const releaseConfig = require('./electron/releaseConfig.json');

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'ca.qkrt.knightsim',
  productName: 'KnightSim',
  directories: { output: 'release' },
  files: ['dist/**/*', 'dist-electron/**/*', 'src/assets/app-icon.png', 'package.json'],
  extraResources: [{ from: 'models', to: 'models', filter: ['*.glb'] }],
  publish: [{ ...releaseConfig, releaseType: 'draft' }],
  artifactName: '${productName}-${version}-${os}-${arch}.${ext}',
  mac: {
    category: 'public.app-category.developer-tools',
    target: ['dmg', 'zip'],
    icon: 'build/icon.png',
  },
  win: { target: ['nsis'], icon: 'build/icon.png' },
  nsis: { oneClick: false, allowToChangeInstallationDirectory: true },
  linux: { target: ['AppImage'], category: 'Development', icon: 'build/icon.png' },
};

const express = require('express');
const { workspace, window, ConfigurationTarget } = require('vscode');
const StatusBar = require('./StatusBar');
const Utils = require('./Utils');
const Proxy = require('./Proxy');

let app, server;

function start(restarting = false) {
  return new Promise((resolv, reject) => {
    if (checkWorkspace()) {
      StatusBar.startingText();

      let config = Utils.loadConfig(restarting);
      let { foldersRootMap, port, watch, baseDir, open } = config;

      app = express();

      app.use('/', express.static(baseDir));

      if (watch) {
        require('./LiveServer').watch(app, config);
      }

      Object.entries(foldersRootMap).forEach(([key, folderRoot]) => {
        app.use(key, express.static(folderRoot));
      });

      Proxy.setProxys(app)
        .then(() => {
          server = app.listen(port, () => {
            StatusBar.stopText();
            if (open && !restarting) {
              require('opn')(`http://localhost:${port}/`);
            }
            resolv();
          });
        })
        .catch(() => {
          reject();
        });
    } else {
      reject();
    }
  });
}

function stop() {
  StatusBar.stoppingText();
  return new Promise((resolv) => {
    server.close(() => {
      app = undefined;
      server = undefined;
      StatusBar.startText();
      resolv();
    });
  });
}

function get() {
  return server;
}

async function restart() {
  await stop();
  await start(true);
}

async function toggle() {
  if (!server || !server.listening) {
    await start();
  } else {
    await stop();
  }
  return;
}

function checkWorkspace() {
  if (!workspace.workspaceFolders) {
    this.showError(`Open a folder or workspace... (File -> Open Folder)`, true);
    return false;
  }
  if (!workspace.workspaceFolders.length) {
    this.showError(`You've not added any folder in the workspace`, true);
    return false;
  }
  return true;
}

async function configureOdataProvider() {
  let odataProviderValue = Utils.getConfigurationServer('gatewayProxy');
  let quickPickOdataProvider = await window.showQuickPick(
    [
      {
        description: 'Gateway url',
        label: 'Gateway',
        picked: odataProviderValue == 'Gateway',
      },
      {
        description: 'Without odata provider',
        label: 'None',
        picked: odataProviderValue == 'None',
      },
    ],
    {
      placeHolder: 'Select odata provider (proxy all /sap)',
      canPickMany: false,
    }
  );

  await Utils.getConfigurationServer().update(
    'gatewayProxy',
    quickPickOdataProvider.label,
    ConfigurationTarget.Workspace
  );

  if (quickPickOdataProvider.label == 'Gateway') {
    let inputBoxOdataUri = await window.showInputBox({
      placeHolder: 'Enter gateway url',
      value: Utils.getConfigurationServer('gatewayUri'),
    });
    await Utils.getConfigurationServer().update('gatewayUri', inputBoxOdataUri, ConfigurationTarget.Workspace);
  }
}

async function configureUI5Provider() {
  let ui5ProviderValue = Utils.getConfigurationServer('resourcesProxy');
  let quickPickUI5Provider = await window.showQuickPick(
    [
      {
        description: 'Use resources from gateway',
        label: 'Gateway',
        picked: ui5ProviderValue == 'Gateway',
      },
      {
        description: 'Use SAPUI5 CDN',
        label: 'CDN SAPUI5',
        picked: ui5ProviderValue == 'CDN SAPUI5',
      },
      {
        description: 'Use OpenUI5 CDN',
        label: 'CDN OpenUI5',
        picked: ui5ProviderValue == 'CDN OpenUI5',
      },
      {
        description: 'Without resources proxy',
        label: 'None',
        picked: ui5ProviderValue == 'None',
      },
    ],
    {
      placeHolder: 'Select odata provider (proxy all /sap)',
      canPickMany: false,
    }
  );

  await Utils.getConfigurationServer().update(
    'resourcesProxy',
    quickPickUI5Provider.label,
    ConfigurationTarget.Workspace
  );

  if (quickPickUI5Provider.label == 'Gateway') {
    let inputBoxGatewayUri = await window.showInputBox({
      placeHolder: 'Enter gateway url',
      value: Utils.getConfigurationServer('gatewayUri'),
    });
    await Utils.getConfigurationServer().update('gatewayUri', inputBoxGatewayUri, ConfigurationTarget.Workspace);
  } else if (quickPickUI5Provider.label != 'None') {
    let framework = quickPickUI5Provider.label.indexOf('SAPUI5') >= 0 ? 'SAPUI5' : 'OpenUI5';
    let inputBoxUI5VersionUri = await window.showInputBox({
      placeHolder: `Enter ${framework} version`,
      value: Utils.getConfigurationServer('ui5Version'),
    });
    await Utils.getConfigurationServer().update('ui5Version', inputBoxUI5VersionUri, ConfigurationTarget.Workspace);
  }
}
module.exports = {
  start,
  stop,
  restart,
  toggle,
  get,
  configureOdataProvider,
  configureUI5Provider,
};

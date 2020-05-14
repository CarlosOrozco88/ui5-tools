const { window, ConfigurationTarget } = require('vscode');
const Utils = require('./Utils');

async function odataProvider() {
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

async function ui5Provider() {
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
  }

  //if (quickPickUI5Provider.label != 'None') {
  let framework = quickPickUI5Provider.label.indexOf('SAPUI5') >= 0 ? 'SAPUI5' : 'OpenUI5';
  let inputBoxUI5VersionUri = await window.showInputBox({
    placeHolder: `Enter ${framework} version`,
    value: Utils.getConfigurationGeneral('ui5Version'),
  });
  await Utils.getConfigurationGeneral().update('ui5Version', inputBoxUI5VersionUri, ConfigurationTarget.Workspace);
  //}
}

module.exports = {
  odataProvider,
  ui5Provider,
};

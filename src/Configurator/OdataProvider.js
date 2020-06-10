import { window, ConfigurationTarget } from 'vscode';
import Utils from '../Utils/Utils';

async function wizard() {
  try {
    let odataProviderValue = Utils.getConfigurationServer('odataProxy');
    let quickPickOdataProvider = await window.showQuickPick(
      [
        {
          description: 'Gateway url. Proxy all requests starting with /sap',
          label: 'Gateway',
          picked: odataProviderValue === 'Gateway',
        },
        {
          description: 'Other destination url. Proxy all requests starting with odataMountPath',
          label: 'Other',
          picked: odataProviderValue === 'Other',
        },
        {
          description: 'Without odata provider',
          label: 'None',
          picked: odataProviderValue === 'None',
        },
      ],
      {
        placeHolder: `Select odata provider | Actual value: ${odataProviderValue}`,
        canPickMany: false,
      }
    );
    if (!quickPickOdataProvider.label) {
      throw new Error('No odata proxy configured');
    }

    await Utils.getConfigurationServer().update(
      'odataProxy',
      quickPickOdataProvider.label,
      ConfigurationTarget.Workspace
    );

    if (quickPickOdataProvider.label === 'Gateway') {
      let odataUri = Utils.getConfigurationServer('odataUri');
      let inputBoxOdataUri = await window.showInputBox({
        placeHolder: `Enter gateway url | Actual value: ${odataUri}`,
        value: odataUri,
      });
      if (!inputBoxOdataUri) {
        throw new Error('No gateway url configured');
      }
      await Utils.getConfigurationServer().update('odataUri', inputBoxOdataUri, ConfigurationTarget.Workspace);
    } else if (quickPickOdataProvider.label === 'Other') {
      let odataUri = Utils.getConfigurationServer('odataUri');
      let inputBoxOdataUri = await window.showInputBox({
        placeHolder: `Enter destination url/s separated by comma | Actual value: ${odataUri}`,
        value: odataUri,
      });
      if (!inputBoxOdataUri) {
        throw new Error('No destination url configured');
      }
      await Utils.getConfigurationServer().update('odataUri', inputBoxOdataUri, ConfigurationTarget.Workspace);
      let odataMountPath = Utils.getConfigurationServer('odataMountPath');
      let inputBoxodataMountPath = await window.showInputBox({
        placeHolder: `Enter mountpath/s separated by comma | Actual value: ${odataMountPath}`,
        value: odataMountPath,
      });
      if (!inputBoxodataMountPath) {
        throw new Error('No mountpath url configured');
      }
      await Utils.getConfigurationServer().update(
        'odataMountPath',
        inputBoxodataMountPath,
        ConfigurationTarget.Workspace
      );
    }
  } catch (err) {}
}

export default {
  wizard,
};

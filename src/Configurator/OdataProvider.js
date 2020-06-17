import { window, ConfigurationTarget } from 'vscode';
import Config from '../Utils/Config';

export default {
  async wizard() {
    try {
      let odataProxyValue = await this.quickPickOdataProxy();

      if (odataProxyValue === 'Gateway') {
        await this.inputBoxGatewayUri();
      } else if (odataProxyValue === 'Other') {
        await this.inputBoxOtherUri();
        await this.inputBoxOdataMountPath();
      }
    } catch (error) {
      throw new Error(error);
    }
    return true;
  },

  async quickPickOdataProxy() {
    return new Promise(async (resolv, reject) => {
      let odataProviderValue = Config.server('odataProxy');
      let quickpick = await window.createQuickPick();
      quickpick.title = 'ui5-tools > Configurator > oDataProvider: Select odata provider';
      quickpick.items = [
        {
          description: 'Gateway url. Proxy all requests starting with /sap',
          label: 'Gateway',
        },
        {
          description: 'Other destination url. Proxy all requests starting with odataMountPath',
          label: 'Other',
        },
        {
          description: 'Without odata provider',
          label: 'None',
        },
      ];
      quickpick.placeholder = odataProviderValue;
      quickpick.canSelectMany = false;
      quickpick.onDidAccept(async () => {
        if (quickpick.selectedItems.length) {
          let value = quickpick.selectedItems[0].label;
          await Config.server().update('odataProxy', value, ConfigurationTarget.Workspace);
          resolv(value);
        } else {
          reject('No odata proxy configured');
        }
        quickpick.hide();
      });
      quickpick.show();
    });
  },

  async inputBoxGatewayUri() {
    return new Promise(async (resolv, reject) => {
      let odataUri = Config.server('odataUri');
      let inputBox = await window.createInputBox();
      inputBox.title = 'ui5-tools > Configurator > oDataProvider: Enter gateway url';
      inputBox.step = 1;
      inputBox.totalSteps = 1;
      inputBox.placeholder = odataUri;
      inputBox.value = odataUri;
      inputBox.ignoreFocusOut = true;
      inputBox.onDidAccept(async () => {
        if (inputBox.value) {
          await Config.server().update('odataUri', inputBox.value, ConfigurationTarget.Workspace);
          resolv(inputBox.value);
        } else {
          reject('No gateway url configured');
        }
        inputBox.hide();
      });
      inputBox.show();
    });
  },

  async inputBoxOtherUri() {
    return new Promise(async (resolv, reject) => {
      let odataUri = Config.server('odataUri');
      let inputBox = await window.createInputBox();
      inputBox.title = 'ui5-tools > Configurator > oDataProvider: Enter destination url/s separated by comma';
      inputBox.step = 1;
      inputBox.totalSteps = 2;
      inputBox.placeholder = odataUri;
      inputBox.value = odataUri;
      inputBox.ignoreFocusOut = true;
      inputBox.onDidAccept(async () => {
        if (inputBox.value) {
          await Config.server().update('odataUri', inputBox.value, ConfigurationTarget.Workspace);
          resolv(inputBox.value);
        } else {
          reject('No destination url configured');
        }
        inputBox.hide();
      });
      inputBox.show();
    });
  },

  async inputBoxOdataMountPath() {
    return new Promise(async (resolv, reject) => {
      let odataMountPath = Config.server('odataMountPath');
      let inputBox = await window.createInputBox();
      inputBox.title = 'ui5-tools > Configurator > oDataProvider: Enter mountpath/s separated by comma';
      inputBox.step = 2;
      inputBox.totalSteps = 2;
      inputBox.placeholder = odataMountPath;
      inputBox.value = odataMountPath;
      inputBox.ignoreFocusOut = true;
      inputBox.onDidAccept(async () => {
        if (inputBox.value) {
          await Config.server().update('odataMountPath', inputBox.value, ConfigurationTarget.Workspace);
          resolv(inputBox.value);
        } else {
          reject('No mountpath url configured');
        }
        inputBox.hide();
      });
      inputBox.show();
    });
  },
};

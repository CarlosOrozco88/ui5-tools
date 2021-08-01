import { window, ConfigurationTarget, InputBox, QuickPick, QuickPickItem } from 'vscode';
import Config from '../Utils/Config';
import Log from '../Utils/Log';
import Server from '../Server/Server';

export default {
  async wizard(): Promise<void> {
    try {
      const odataProxyValue = await this.quickPickOdataProxy();

      if (odataProxyValue === 'Gateway') {
        await this.inputBoxGatewayUri();
      } else if (odataProxyValue === 'Other') {
        await this.inputBoxOtherUri();
        await this.inputBoxOdataMountPath();
      }
      Server.restart();
    } catch (error) {
      throw new Error(error);
    }
  },

  async quickPickOdataProxy(): Promise<string> {
    return new Promise(async (resolve, reject) => {
      const odataProviderValue = Config.server('odataProxy')?.toString() || '';
      const quickpick: QuickPick<QuickPickItem> = await window.createQuickPick();
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
          const value = quickpick.selectedItems[0].label;
          await Config.server().update('odataProxy', value, ConfigurationTarget.Workspace);

          Log.logConfigurator(`Set odataProxy value to ${value}`);
          resolve(value);
        } else {
          const sMessage = 'No odata proxy configured';
          Log.logConfigurator(sMessage);
          reject(sMessage);
        }
        quickpick.hide();
      });
      quickpick.show();
    });
  },

  async inputBoxGatewayUri(): Promise<string> {
    return new Promise(async (resolve, reject) => {
      const odataUri = Config.server('odataUri')?.toString() || '';
      const inputBox: InputBox = await window.createInputBox();
      inputBox.title = 'ui5-tools > Configurator > oDataProvider: Enter gateway url';
      inputBox.step = 1;
      inputBox.totalSteps = 1;
      inputBox.placeholder = odataUri;
      inputBox.value = odataUri;
      inputBox.ignoreFocusOut = true;
      inputBox.onDidAccept(async () => {
        if (inputBox.value) {
          await Config.server().update('odataUri', inputBox.value, ConfigurationTarget.Workspace);
          Log.logConfigurator(`Set odataUri value to ${inputBox.value}`);
          resolve(inputBox.value);
        } else {
          const sMessage = 'No gateway url configured';
          Log.logConfigurator(sMessage);
          reject(sMessage);
        }
        inputBox.hide();
      });
      inputBox.show();
    });
  },

  async inputBoxOtherUri(): Promise<string> {
    return new Promise(async (resolve, reject) => {
      const odataUri = Config.server('odataUri')?.toString() || '';
      const inputBox = await window.createInputBox();
      inputBox.title = 'ui5-tools > Configurator > oDataProvider: Enter destination url/s separated by comma';
      inputBox.step = 1;
      inputBox.totalSteps = 2;
      inputBox.placeholder = odataUri;
      inputBox.value = odataUri;
      inputBox.ignoreFocusOut = true;
      inputBox.onDidAccept(async () => {
        if (inputBox.value) {
          await Config.server().update('odataUri', inputBox.value, ConfigurationTarget.Workspace);
          Log.logConfigurator(`Set odataUri value to ${inputBox.value}`);
          resolve(inputBox.value);
        } else {
          const sMessage = 'No destination url configured';
          Log.logConfigurator(sMessage);
          reject(sMessage);
        }
        inputBox.hide();
      });
      inputBox.show();
    });
  },

  async inputBoxOdataMountPath() {
    return new Promise(async (resolve, reject) => {
      const odataMountPath = Config.server('odataMountPath')?.toString() || '';
      const inputBox: InputBox = await window.createInputBox();
      inputBox.title = 'ui5-tools > Configurator > oDataProvider: Enter mountpath/s separated by comma';
      inputBox.step = 2;
      inputBox.totalSteps = 2;
      inputBox.placeholder = odataMountPath;
      inputBox.value = odataMountPath;
      inputBox.ignoreFocusOut = true;
      inputBox.onDidAccept(async () => {
        if (inputBox.value) {
          await Config.server().update('odataMountPath', inputBox.value, ConfigurationTarget.Workspace);
          Log.logConfigurator(`Set odataMountPath to ${inputBox.value}`);
          resolve(inputBox.value);
        } else {
          const sMessage = 'No mountpath url configured';
          Log.logConfigurator(sMessage);
          reject(sMessage);
        }
        inputBox.hide();
      });
      inputBox.show();
    });
  },
};

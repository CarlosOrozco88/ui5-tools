import { window, ConfigurationTarget, InputBox, QuickPick, QuickPickItem } from 'vscode';
import Config from '../Utils/ConfigVscode';
import Log from '../Utils/LogVscode';
import Server from '../Server/Server';

export default {
  async wizard(): Promise<void> {
    try {
      const odataProxyValue = await this.quickPickOdataProxy();
      if (odataProxyValue === 'Gateway') {
        await this.inputBoxGatewayUri();
        //@ts-ignore
        await Config.server()?.update('odataProxy', odataProxyValue, ConfigurationTarget.Workspace);

        Log.configurator(`Set odataProxy value to ${odataProxyValue}`);
      } else if (odataProxyValue === 'Other') {
        await this.inputBoxOtherUri();
        await this.inputBoxOdataMountPath();
        //@ts-ignore
        await Config.server()?.update('odataProxy', odataProxyValue, ConfigurationTarget.Workspace);

        Log.configurator(`Set odataProxy value to ${odataProxyValue}`);
      } else if (odataProxyValue) {
        await this.setDestination(odataProxyValue);
      }
      Server.restart();
    } catch (error: any) {
      throw new Error(error);
    }
  },

  async quickPickOdataProxy(): Promise<string> {
    return new Promise(async (resolve, reject) => {
      const odataProviderValue = String(Config.server('odataProxy'));

      const quickpick: QuickPick<QuickPickItem> = await window.createQuickPick();
      const defaultItems = [
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
      const proxyDestinations: Array<any> | unknown = Config.server('proxyDestinations');
      let proxyDestinationsItems: Array<any> = [];
      if (Array.isArray(proxyDestinations)) {
        proxyDestinationsItems = proxyDestinations.map(({ url, name }) => {
          return {
            description: url,
            label: name,
          };
        });
      }
      const items = proxyDestinationsItems.concat(defaultItems);
      quickpick.title = 'ui5-tools > Configurator > oDataProvider: Select odata provider';
      quickpick.ignoreFocusOut = true;
      quickpick.items = items;
      quickpick.placeholder = odataProviderValue;
      quickpick.canSelectMany = false;
      quickpick.onDidAccept(async () => {
        if (quickpick.selectedItems.length) {
          const value = quickpick.selectedItems[0].label;
          resolve(value);
        } else {
          const sMessage = Log.configurator('No odata proxy configured');
          reject(sMessage);
        }
        quickpick.hide();
      });
      quickpick.show();
    });
  },

  async inputBoxGatewayUri(): Promise<string> {
    return new Promise(async (resolve, reject) => {
      const odataUri = String(Config.server('odataUri'));
      const inputBox: InputBox = window.createInputBox();
      inputBox.title = 'ui5-tools > Configurator > oDataProvider: Enter gateway url';
      inputBox.step = 1;
      inputBox.totalSteps = 1;
      inputBox.placeholder = odataUri;
      inputBox.value = odataUri;
      inputBox.ignoreFocusOut = true;
      inputBox.onDidAccept(async () => {
        if (inputBox.value) {
          //@ts-ignore
          await Config.server()?.update('odataUri', inputBox.value, ConfigurationTarget.Workspace);
          Log.configurator(`Set odataUri value to ${inputBox.value}`);
          resolve(inputBox.value);
        } else {
          const sMessage = Log.configurator('No gateway url configured');
          reject(sMessage);
        }
        inputBox.hide();
      });
      inputBox.show();
    });
  },

  async getDestination(destinationName: string): Promise<{ name: string; type: string; url: string }> {
    let proxyDestination;
    const proxyDestinations: Array<any> | unknown = Config.server('proxyDestinations');
    if (Array.isArray(proxyDestinations)) {
      proxyDestination = proxyDestinations.find((destination) => destination.name === destinationName);
    }
    return proxyDestination;
  },

  async setDestination(destinationName: string): Promise<void> {
    const proxyDestination = await this.getDestination(destinationName);
    if (proxyDestination) {
      //@ts-ignore
      await Config.server()?.update('odataProxy', proxyDestination.type ?? 'Gateway', ConfigurationTarget.Workspace);
      Log.configurator(`Set odataProxy value to ${proxyDestination.type ?? 'Gateway'}`);

      //@ts-ignore
      await Config.server()?.update('odataUri', proxyDestination.url ?? 'Gateway', ConfigurationTarget.Workspace);
      Log.configurator(`Set odataUri value to ${proxyDestination.url ?? 'Gateway'}`);
    }
  },

  async inputBoxOtherUri(): Promise<string> {
    return new Promise(async (resolve, reject) => {
      const odataUri = String(Config.server('odataUri'));
      const inputBox = window.createInputBox();
      inputBox.title = 'ui5-tools > Configurator > oDataProvider: Enter destination url/s separated by comma';
      inputBox.step = 1;
      inputBox.totalSteps = 2;
      inputBox.placeholder = odataUri;
      inputBox.value = odataUri;
      inputBox.ignoreFocusOut = true;
      inputBox.onDidAccept(async () => {
        if (inputBox.value) {
          //@ts-ignore
          await Config.server()?.update('odataUri', inputBox.value, ConfigurationTarget.Workspace);
          Log.configurator(`Set odataUri value to ${inputBox.value}`);
          resolve(inputBox.value);
        } else {
          const sMessage = Log.configurator('No destination url configured');
          reject(sMessage);
        }
        inputBox.hide();
      });
      inputBox.show();
    });
  },

  async inputBoxOdataMountPath() {
    return new Promise(async (resolve, reject) => {
      const odataMountPath = String(Config.server('odataMountPath'));
      const inputBox: InputBox = window.createInputBox();
      inputBox.title = 'ui5-tools > Configurator > oDataProvider: Enter mountpath/s separated by comma';
      inputBox.step = 2;
      inputBox.totalSteps = 2;
      inputBox.placeholder = odataMountPath;
      inputBox.value = odataMountPath;
      inputBox.ignoreFocusOut = true;
      inputBox.onDidAccept(async () => {
        if (inputBox.value) {
          //@ts-ignore
          await Config.server()?.update('odataMountPath', inputBox.value, ConfigurationTarget.Workspace);
          Log.configurator(`Set odataMountPath to ${inputBox.value}`);
          resolve(inputBox.value);
        } else {
          const sMessage = Log.configurator('No mountpath url configured');
          reject(sMessage);
        }
        inputBox.hide();
      });
      inputBox.show();
    });
  },
};

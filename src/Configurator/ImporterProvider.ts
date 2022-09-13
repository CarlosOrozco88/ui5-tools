import { window, ConfigurationTarget, InputBox, QuickPick, QuickPickItem } from 'vscode';
import Config from '../Utils/ConfigVscode';
import Log from '../Utils/LogVscode';

export default {
  async wizard(): Promise<void> {
    try {
      const odataProxyValue = await this.quickPickImportUri();
      if (odataProxyValue === 'Gateway') {
        await this.inputBoxImportUri();

        Log.configurator(`Set odataProxy value to ${odataProxyValue}`);
      } else if (odataProxyValue) {
        await this.setDestination(odataProxyValue);
      }
    } catch (error: any) {
      throw new Error(error);
    }
  },

  async quickPickImportUri(): Promise<string> {
    return new Promise(async (resolve, reject) => {
      const odataProviderValue = String(Config.server('odataProxy'));

      const quickpick: QuickPick<QuickPickItem> = await window.createQuickPick();
      const defaultItems = [
        {
          description: 'Enter gateway url',
          label: 'Gateway',
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
      quickpick.title = 'ui5-tools > Importer > importProvider: Select gateway provider';
      quickpick.ignoreFocusOut = true;
      quickpick.items = items;
      quickpick.placeholder = odataProviderValue;
      quickpick.canSelectMany = false;
      quickpick.onDidAccept(async () => {
        if (quickpick.selectedItems.length) {
          const value = quickpick.selectedItems[0].label;
          resolve(value);
        } else {
          const sMessage = Log.importer('No gateway url configured');
          reject(sMessage);
        }
        quickpick.hide();
      });
      quickpick.show();
    });
  },

  async inputBoxImportUri(): Promise<string> {
    return new Promise(async (resolve, reject) => {
      const importUri = String(Config.importer('importUri'));
      const inputBox: InputBox = window.createInputBox();
      inputBox.title = 'ui5-tools > Configurator > oDataProvider: Enter gateway url';
      inputBox.step = 1;
      inputBox.totalSteps = 1;
      inputBox.placeholder = importUri;
      inputBox.value = importUri;
      inputBox.ignoreFocusOut = true;
      inputBox.onDidAccept(async () => {
        if (inputBox.value) {
          //@ts-ignore
          await Config.importer()?.update('importUri', inputBox.value, ConfigurationTarget.Workspace);
          Log.configurator(`Set importUri value to ${inputBox.value}`);
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
      await Config.importer()?.update('importUri', proxyDestination.url ?? 'Gateway', ConfigurationTarget.Workspace);
      Log.importer(`Set importuri value to ${proxyDestination.url ?? 'Gateway'}`);
    }
  },
};

import { window, ConfigurationTarget, QuickPick, QuickPickItem } from 'vscode';
import Config from '../Utils/Config';

export default {
  async wizard(): Promise<void> {
    try {
      let askMore = true;
      while (askMore) {
        askMore = await this.quickPickAddRemoveStrings();
      }
    } catch (error: any) {
      throw new Error(error);
    }
  },

  async quickPickAddRemoveStrings(): Promise<boolean> {
    return new Promise((resolve) => {
      //@ts-ignore
      const replaceKeysValues: Array<{ key: string; value: string }> = Config.builder('replaceKeysValues');

      const options = replaceKeysValues.map((keyValue) => {
        return {
          description: keyValue.value,
          label: keyValue.key,
          picked: true,
        };
      });

      const quickPickValueKey: QuickPick<QuickPickItem> = window.createQuickPick();
      quickPickValueKey.title = `ui5-tools > Configurator > Replace Strings`;
      quickPickValueKey.items = options;
      quickPickValueKey.selectedItems = options;
      quickPickValueKey.canSelectMany = true;
      quickPickValueKey.ignoreFocusOut = true;
      quickPickValueKey.placeholder = `Write a pair (key=value) to add a replacement. Unselect to delete`;
      quickPickValueKey.show();
      quickPickValueKey.onDidChangeSelection(async (event) => {
        const actualKeysValues = Config.builder('replaceKeysValues');
        if (actualKeysValues instanceof Array && actualKeysValues.length !== event.length) {
          const newKeyValues = event.map((item) => {
            return {
              key: item.label,
              value: item.description,
            };
          });
          //@ts-ignore
          await Config.builder()?.update('replaceKeysValues', newKeyValues, ConfigurationTarget.Workspace);
          quickPickValueKey.hide();
          resolve(true);
        }
      });
      quickPickValueKey.onDidAccept(async () => {
        const introData = quickPickValueKey.value;
        if (introData) {
          const keyValue = /(?<key>\S+)\s*={1}\s*(?<value>.+)/g.exec(introData);
          if (keyValue) {
            // @ts-ignore
            const newReplaceKeysValues: Array<{ key: string; value: string }> = Config.builder('replaceKeysValues');
            const mapKeys = newReplaceKeysValues.map((keyValue) => keyValue.key);
            if (keyValue.groups?.key) {
              if (mapKeys.includes(keyValue.groups.key)) {
                window.showErrorMessage(`${keyValue.groups?.key} already exists`);
                quickPickValueKey.hide();
                resolve(true);
              } else if (keyValue.groups.key.indexOf('COMPUTED_') === 0) {
                window.showErrorMessage(`The key should not start with COMPUTED_`);
                quickPickValueKey.hide();
                resolve(true);
              } else {
                newReplaceKeysValues.push({
                  key: keyValue.groups.key,
                  value: keyValue.groups.value,
                });
                //@ts-ignore
                await Config.builder()?.update(
                  'replaceKeysValues',
                  newReplaceKeysValues,
                  ConfigurationTarget.Workspace
                );
                quickPickValueKey.hide();
                resolve(true);
              }
            }
          } else {
            quickPickValueKey.hide();
            resolve(false);
          }
        } else {
          quickPickValueKey.hide();
          resolve(false);
        }
      });
    });
  },
};

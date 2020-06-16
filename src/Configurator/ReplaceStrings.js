import { window, ConfigurationTarget, QuickInputButtons, workspace } from 'vscode';
import Config from '../Utils/Config';

export default async function wizard() {
  try {
    // let replaceStrings = Config.builder('replaceStrings');
    // let replaceExtensions = Config.builder('replaceExtensions');
    let askMore = true;
    while (askMore) {
      askMore = await quickPickAddRemoveStrings();
    }
  } catch (error) {
    throw new Error(error);
  }
  return true;
}

function quickPickAddRemoveStrings() {
  return new Promise((resolv, reject) => {
    let replaceKeysValues = Config.builder('replaceKeysValues');

    let options = replaceKeysValues.map((keyValue) => {
      return {
        description: keyValue.value,
        label: keyValue.key,
        picked: true,
      };
    });

    let quickPickValueKey;
    quickPickValueKey = window.createQuickPick();
    quickPickValueKey.title = `ui5-tools > Configurator > Replace Strings`;
    quickPickValueKey.items = options;
    quickPickValueKey.selectedItems = options;
    quickPickValueKey.canSelectMany = true;
    quickPickValueKey.ignoreFocusOut = true;
    quickPickValueKey.placeholder = `Write a pair (key=value) to add a replacement. Unselect to delete`;
    quickPickValueKey.show();
    quickPickValueKey.onDidChangeSelection(async (event) => {
      let actualKeysValues = Config.builder('replaceKeysValues');
      if (actualKeysValues.length !== event.length) {
        let newKeyValues = event.map((item) => {
          return {
            key: item.label,
            value: item.description,
          };
        });
        await Config.builder().update('replaceKeysValues', newKeyValues, ConfigurationTarget.Workspace);
        quickPickValueKey.hide();
        resolv(true);
      }
    });
    quickPickValueKey.onDidAccept(async () => {
      const introData = quickPickValueKey.value;
      if (introData) {
        let keyValue = /(?<key>\S+)\s*={1}\s*(?<value>.+)/g.exec(introData);
        if (keyValue) {
          let newReplaceKeysValues = Config.builder('replaceKeysValues');
          let mapKeys = newReplaceKeysValues.map((keyValue) => keyValue.key);
          if (mapKeys.indexOf(keyValue.groups.key) === -1) {
            newReplaceKeysValues.push({
              key: keyValue.groups.key,
              value: keyValue.groups.value,
            });
            await Config.builder().update('replaceKeysValues', newReplaceKeysValues, ConfigurationTarget.Workspace);
            quickPickValueKey.hide();
            resolv(true);
          } else {
            window.showErrorMessage(`${keyValue.groups.key} already exists`);
            quickPickValueKey.hide();
            resolv(true);
          }
        } else {
          quickPickValueKey.hide();
          resolv(false);
        }
      } else {
        quickPickValueKey.hide();
        resolv(false);
      }
    });
  });
}

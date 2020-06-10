import { window, ConfigurationTarget } from 'vscode';
import Utils from '../Utils/Utils';

async function wizard() {
  try {
    let replaceStrings = Utils.getConfigurationBuilder('replaceStrings');
    let replaceExtensions = Utils.getConfigurationBuilder('replaceExtensions');
    let replaceKeysValues = Utils.getConfigurationBuilder('replaceKeysValues');
  } catch (err) {}
}

export default {
  wizard,
};

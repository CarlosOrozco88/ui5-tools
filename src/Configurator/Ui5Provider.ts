import { window, ConfigurationTarget } from 'vscode';

import Config from '../Utils/Config';
import Utils from '../Utils/Utils';
import Log from '../Utils/Log';
import Server from '../Server/Server';
import { Level } from '../Types/Types';

export default {
  async wizard() {
    try {
      const ui5Provider = await this.quickPickUi5Provider();
      if (ui5Provider === 'Gateway') {
        const sGatewayUri = await this.inputBoxGatewayUri();
        try {
          await this.configureGWVersion(sGatewayUri);
        } catch (oError) {
          Log.configurator(oError, Level.ERROR);
          await this.setUi5Version();
        }
      }
      if (ui5Provider !== 'None' && ui5Provider !== 'Gateway') {
        await this.setUi5Version();
      }
      Server.restart();
    } catch (error: any) {
      throw new Error(error);
    }
  },

  async quickPickUi5Provider() {
    return new Promise(async (resolve, reject) => {
      const ui5ProviderValue = String(Config.server('resourcesProxy'));

      const quickpick = await window.createQuickPick();
      quickpick.title = 'ui5-tools > Configurator > Ui5Provider: Select UI5 provider';
      quickpick.items = [
        {
          description: 'Use resources from gateway',
          label: 'Gateway',
        },
        {
          description: 'Use SAPUI5 CDN',
          label: 'CDN SAPUI5',
        },
        {
          description: 'Use OpenUI5 CDN',
          label: 'CDN OpenUI5',
        },
        {
          description: 'Without resources proxy',
          label: 'None',
        },
      ];
      quickpick.placeholder = ui5ProviderValue;
      quickpick.canSelectMany = false;
      quickpick.onDidAccept(async () => {
        if (quickpick.selectedItems.length) {
          const value = quickpick.selectedItems[0].label;
          //@ts-ignore
          await Config.server().update('resourcesProxy', value, ConfigurationTarget.Workspace);
          Log.configurator(`Set resourcesProxy value to ${value}`);
          resolve(value);
        } else {
          const sMessage = Log.configurator('No ui5 provider configured');
          reject(sMessage);
        }
        quickpick.hide();
      });
      quickpick.show();
    });
  },

  async inputBoxGatewayUri(): Promise<string> {
    return new Promise(async (resolve, reject) => {
      const gatewayUri = String(Config.server('resourcesUri'));
      const inputBox = window.createInputBox();
      inputBox.title = 'ui5-tools > Configurator > Ui5Provider: Enter gateway url';
      inputBox.step = 1;
      inputBox.totalSteps = 1;
      inputBox.placeholder = gatewayUri;
      inputBox.value = gatewayUri;
      inputBox.ignoreFocusOut = true;
      inputBox.onDidAccept(async () => {
        if (inputBox.value) {
          //@ts-ignore
          await Config.server().update('resourcesUri', inputBox.value, ConfigurationTarget.Workspace);
          Log.configurator(`Set resourcesUri value to ${inputBox.value}`);
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

  async setUi5Version() {
    let versions: Array<any>;
    try {
      versions = await this.getUi5Versions();
    } catch (error: any) {
      throw new Error(error);
    }
    return new Promise(async (resolve, reject) => {
      let ui5Version;
      try {
        let ui5Version;
        if (versions) {
          ui5Version = await this.quickPickUi5Version(versions);
        } else {
          ui5Version = await this.inputBoxUi5Version();
        }
        //@ts-ignore
        await Config.general().update('ui5Version', ui5Version, ConfigurationTarget.Workspace);

        Log.configurator(`Set ui5Version value ${ui5Version}`);
        resolve(ui5Version);
      } catch (sError) {
        Log.configurator(sError, Level.ERROR);
        reject(sError);
      }
      resolve(ui5Version);
    });
  },

  async quickPickUi5Version(versionsMajor: Array<any>) {
    return new Promise(async (resolve, reject) => {
      try {
        const major = await this.quickPickUi5VersionMajor(versionsMajor);
        const versionsMinor = versionsMajor.find((versionData) => {
          return versionData.label === major;
        });
        const version = await this.quickPickUi5VersionMinor(versionsMinor.patches);

        resolve(version);
      } catch (error) {
        reject(error);
      }
    });
  },

  async quickPickUi5VersionMajor(versionsMajor: Array<any>) {
    return new Promise(async (resolve, reject) => {
      const ui5Version = String(Config.general('ui5Version'));

      const quickpick = await window.createQuickPick();
      quickpick.title = 'ui5-tools > Configurator > Ui5Provider: Select UI5 major version';
      quickpick.items = versionsMajor;
      quickpick.placeholder = ui5Version;
      quickpick.step = 1;
      quickpick.totalSteps = 2;
      quickpick.canSelectMany = false;
      quickpick.onDidAccept(async () => {
        if (quickpick.selectedItems.length) {
          const value = quickpick.selectedItems[0].label;
          resolve(value);
        } else {
          reject('No major version selected');
        }
        quickpick.hide();
      });
      quickpick.show();
    });
  },

  async quickPickUi5VersionMinor(versionsMinor: Array<any>) {
    return new Promise(async (resolve, reject) => {
      const ui5Version = String(Config.general('ui5Version'));

      const quickpick = await window.createQuickPick();
      quickpick.title = 'ui5-tools > Configurator > Ui5Provider: Select UI5 minor version';
      quickpick.items = versionsMinor;
      quickpick.placeholder = ui5Version;
      quickpick.step = 2;
      quickpick.totalSteps = 2;
      quickpick.canSelectMany = false;
      quickpick.onDidAccept(async () => {
        if (quickpick.selectedItems.length) {
          const value = quickpick.selectedItems[0].label;
          resolve(value);
        } else {
          reject('No minor version selected');
        }
        quickpick.hide();
      });
      quickpick.show();
    });
  },

  async inputBoxUi5Version() {
    return new Promise((resolve, reject) => {
      const framework = Utils.getFramework();
      const ui5Version = String(Config.general('ui5Version'));

      const inputBox = window.createInputBox();
      inputBox.title = `ui5-tools > Configurator > Ui5Provider: Enter ${framework} versions`;
      inputBox.step = 1;
      inputBox.totalSteps = 1;
      inputBox.placeholder = ui5Version;
      inputBox.value = ui5Version;
      inputBox.ignoreFocusOut = true;
      inputBox.onDidAccept(() => {
        if (inputBox.value) {
          resolve(inputBox.value);
        } else {
          reject('No version configured');
        }
        inputBox.hide();
      });
      inputBox.show();
    });
  },

  async getUi5Versions(framework = Utils.getFramework()) {
    const versions: Array<any> = [];
    try {
      if (framework !== 'None') {
        const versionsValues = await Promise.all([this.getVersionOverview(framework), this.getNeoApp(framework)]);
        const mapVersions: Record<string, any> = {};
        versionsValues[0].versions.forEach((versionData: Record<string, any>) => {
          if (versionData.version.length > 1) {
            const cleanVersion = versionData.version.replace('.*', '');
            let description = versionData.eom ? versionData.eom : versionData.support;
            if (versionData.lts !== undefined) {
              description = versionData.lts ? versionData.eom : versionData.support + ' ' + versionData.eom;
            }
            const cVersion = {
              label: cleanVersion,
              description: description,
              patches: [],
            };
            mapVersions[cleanVersion] = cVersion;
            versions.push(cVersion);
          }
        });
        versionsValues[1].routes.forEach((versionData: Record<string, any>) => {
          if (versionData.path.length > 1) {
            const cleanVersion = versionData.path.replace('/', '');
            const cleanVersionArray = cleanVersion.split('.');
            cleanVersionArray.pop();
            const cleanVersionMaster = cleanVersionArray.join('.');
            if (mapVersions[cleanVersionMaster]) {
              mapVersions[cleanVersionMaster].patches.push({
                label: cleanVersion,
                description: mapVersions[cleanVersionMaster].description,
              });
            } else {
              const cVersion = {
                label: cleanVersionMaster,
                description: 'Out of Maintenance',
                patches: [
                  {
                    label: cleanVersion,
                    description: 'Out of Maintenance',
                  },
                ],
              };
              mapVersions[cleanVersionMaster] = cVersion;
              versions.push(cVersion);
            }
          }
        });
      }
    } catch (err: any) {
      throw new Error(err);
    }

    return versions;
  },

  async getVersionOverview(framework = 'sapui5') {
    const url = `https://${framework}.hana.ondemand.com/versionoverview.json`;
    const fileBuffer = await Utils.fetchFile(url);
    return JSON.parse(fileBuffer.toString());
  },

  async getNeoApp(framework = 'sapui5') {
    const url = `https://${framework}.hana.ondemand.com/neo-app.json`;
    const fileBuffer = await Utils.fetchFile(url);
    return JSON.parse(fileBuffer.toString());
  },

  async configureGWVersion(sGatewayUri: string) {
    Log.configurator(`Fetching ui5Version from Gateway...`);
    const gatewayVersion = await this.getGatewayVersion(sGatewayUri);
    //@ts-ignore
    await Config.general().update('ui5Version', gatewayVersion.version, ConfigurationTarget.Workspace);
    Log.configurator(`Set ui5version value to ${gatewayVersion.version}`);
  },

  async getGatewayVersion(sGatewayUri: string): Promise<Record<string, any>> {
    const url = `${sGatewayUri}/sap/public/bc/ui5_ui5/1/resources/sap-ui-version.json`;
    const fileBuffer = await Utils.fetchFile(url);
    return JSON.parse(fileBuffer.toString());
  },
};

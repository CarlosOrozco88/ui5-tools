import { window, ConfigurationTarget } from 'vscode';
import https from 'https';
import http from 'http';

import Config from '../Utils/Config';
import Utils from '../Utils/Utils';

export default {
  async wizard() {
    try {
      let ui5Provider = await this.quickPickUi5Provider();
      if (ui5Provider === 'Gateway') {
        let sGatewayUri = await this.inputBoxGatewayUri();
        try {
          Utils.logOutputConfigurator(`Fetching ui5Version from Gateway...`);
          let gatewayVersion = await this.getGatewayVersion(sGatewayUri);
          await Config.general().update('ui5Version', gatewayVersion.version, ConfigurationTarget.Workspace);
          Utils.logOutputConfigurator(`Set ui5version value to ${gatewayVersion.version}`);
        } catch (oError) {
          Utils.logOutputConfigurator(oError, 'ERROR');
          await this.setUi5Version();
        }
      }
      if (ui5Provider !== 'None' && ui5Provider !== 'Gateway') {
        await this.setUi5Version();
      }
    } catch (error) {
      throw new Error(error);
    }
  },

  async quickPickUi5Provider() {
    return new Promise(async (resolve, reject) => {
      let ui5ProviderValue = Config.server('resourcesProxy');

      let quickpick = await window.createQuickPick();
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
          let value = quickpick.selectedItems[0].label;
          await Config.server().update('resourcesProxy', value, ConfigurationTarget.Workspace);
          Utils.logOutputConfigurator(`Set resourcesProxy value to ${value}`);
          resolve(value);
        } else {
          let sMessage = 'No ui5 provider configured';
          Utils.logOutputConfigurator(sMessage);
          reject(sMessage);
        }
        quickpick.hide();
      });
      quickpick.show();
    });
  },

  async inputBoxGatewayUri() {
    return new Promise(async (resolve, reject) => {
      let gatewayUri = Config.server('resourcesUri');
      let inputBox = await window.createInputBox();
      inputBox.title = 'ui5-tools > Configurator > Ui5Provider: Enter gateway url';
      inputBox.step = 1;
      inputBox.totalSteps = 1;
      inputBox.placeholder = gatewayUri;
      inputBox.value = gatewayUri;
      inputBox.ignoreFocusOut = true;
      inputBox.onDidAccept(async () => {
        if (inputBox.value) {
          await Config.server().update('resourcesUri', inputBox.value, ConfigurationTarget.Workspace);
          Utils.logOutputConfigurator(`Set resourcesUri value to ${inputBox.value}`);
          resolve(inputBox.value);
        } else {
          let sMessage = 'No gateway url configured';
          Utils.logOutputConfigurator(sMessage);
          reject(sMessage);
        }
        inputBox.hide();
      });
      inputBox.show();
    });
  },

  async setUi5Version() {
    let versions;
    try {
      versions = await this.getUi5Versions();
    } catch (error) {
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
        await Config.general().update('ui5Version', ui5Version, ConfigurationTarget.Workspace);

        Utils.logOutputConfigurator(`Set ui5Version value ${ui5Version}`);
        resolve(ui5Version);
      } catch (sError) {
        Utils.logOutputConfigurator(sError, 'ERROR');
        reject(sError);
      }
      resolve(ui5Version);
    });
  },

  async quickPickUi5Version(versionsMajor) {
    return new Promise(async (resolve, reject) => {
      try {
        let major = await this.quickPickUi5VersionMajor(versionsMajor);
        let versionsMinor = versionsMajor.find((versionData) => {
          return versionData.label === major;
        });
        let version = await this.quickPickUi5VersionMinor(versionsMinor.patches);

        resolve(version);
      } catch (error) {
        reject(error);
      }
    });
  },

  async quickPickUi5VersionMajor(versionsMajor) {
    return new Promise(async (resolve, reject) => {
      let ui5Version = Config.general('ui5Version');

      let quickpick = await window.createQuickPick();
      quickpick.title = 'ui5-tools > Configurator > Ui5Provider: Select UI5 major version';
      quickpick.items = versionsMajor;
      quickpick.placeholder = ui5Version;
      quickpick.step = 1;
      quickpick.totalSteps = 2;
      quickpick.canSelectMany = false;
      quickpick.onDidAccept(async () => {
        if (quickpick.selectedItems.length) {
          let value = quickpick.selectedItems[0].label;
          resolve(value);
        } else {
          reject('No major version selected');
        }
        quickpick.hide();
      });
      quickpick.show();
    });
  },

  async quickPickUi5VersionMinor(versionsMinor) {
    return new Promise(async (resolve, reject) => {
      let ui5Version = Config.general('ui5Version');

      let quickpick = await window.createQuickPick();
      quickpick.title = 'ui5-tools > Configurator > Ui5Provider: Select UI5 minor version';
      quickpick.items = versionsMinor;
      quickpick.placeholder = ui5Version;
      quickpick.step = 2;
      quickpick.totalSteps = 2;
      quickpick.canSelectMany = false;
      quickpick.onDidAccept(async () => {
        if (quickpick.selectedItems.length) {
          let value = quickpick.selectedItems[0].label;
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
    return new Promise(async (resolve, reject) => {
      let framework = Utils.getFramework();
      let ui5Version = Config.general('ui5Version');

      let inputBox = await window.createInputBox();
      inputBox.title = `ui5-tools > Configurator > Ui5Provider: Enter ${framework} versions`;
      inputBox.step = 1;
      inputBox.totalSteps = 1;
      inputBox.placeholder = ui5Version;
      inputBox.value = ui5Version;
      inputBox.ignoreFocusOut = true;
      inputBox.onDidAccept(async () => {
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
    let versions = [];
    try {
      if (framework !== 'None') {
        let versionsValues = await Promise.all([this.getVersionOverview(framework), this.getNeoApp(framework)]);
        let mapVersions = {};
        versionsValues[0].versions.forEach((versionData) => {
          if (versionData.version.length > 1) {
            let cleanVersion = versionData.version.replace('.*', '');
            let description = versionData.eom ? versionData.eom : versionData.support;
            if (versionData.lts !== undefined) {
              description = versionData.lts ? versionData.eom : versionData.support + ' ' + versionData.eom;
            }
            let cVersion = {
              label: cleanVersion,
              description: description,
              patches: [],
            };
            mapVersions[cleanVersion] = cVersion;
            versions.push(cVersion);
          }
        });
        versionsValues[1].routes.forEach((versionData) => {
          if (versionData.path.length > 1) {
            let cleanVersion = versionData.path.replace('/', '');
            let cleanVersionArray = cleanVersion.split('.');
            cleanVersionArray.pop();
            let cleanVersionMaster = cleanVersionArray.join('.');
            if (mapVersions[cleanVersionMaster]) {
              mapVersions[cleanVersionMaster].patches.push({
                label: cleanVersion,
                description: mapVersions[cleanVersionMaster].description,
              });
            } else {
              let cVersion = {
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
    } catch (err) {
      throw new Error(err);
    }

    return versions;
  },

  async getVersionOverview(framework = 'sapui5') {
    return new Promise((resolve, reject) => {
      let url = `https://${framework}.hana.ondemand.com/versionoverview.json`;
      let options = {
        timeout: 5000,
      };
      https
        .get(url, options, (res) => {
          if (res.statusCode !== 200) {
            reject();
          } else {
            let rawData = '';
            res.on('data', (chunk) => {
              rawData += chunk;
            });
            res.on('end', () => {
              try {
                resolve(JSON.parse(rawData));
              } catch (e) {
                reject(e.message);
              }
            });
          }
        })
        .on('error', (e) => {
          reject(e);
        });
    });
  },

  async getNeoApp(framework = 'sapui5') {
    return new Promise((resolve, reject) => {
      let url = `https://${framework}.hana.ondemand.com/neo-app.json`;
      let options = {
        timeout: 5000,
      };
      https
        .get(url, options, (res) => {
          if (res.statusCode !== 200) {
            reject();
          } else {
            let rawData = '';
            res.on('data', (chunk) => {
              rawData += chunk;
            });
            res.on('end', () => {
              try {
                resolve(JSON.parse(rawData));
              } catch (e) {
                reject(e.message);
              }
            });
          }
        })
        .on('error', (e) => {
          reject(e);
        });
    });
  },

  async getGatewayVersion(sGatewayUri) {
    return new Promise((resolve, reject) => {
      let url = `${sGatewayUri}/sap/public/bc/ui5_ui5/1/resources/sap-ui-version.json`;
      url = url.split('//').join('/');

      let options = {
        timeout: 5000,
      };

      let httpModule;
      if (url.indexOf('https') == 0) {
        httpModule = https;
      } else {
        httpModule = http;
      }
      httpModule
        .get(url, options, (res) => {
          if (res.statusCode !== 200) {
            reject();
          } else {
            let rawData = '';
            res.on('data', (chunk) => {
              rawData += chunk;
            });
            res.on('end', () => {
              try {
                resolve(JSON.parse(rawData));
              } catch (e) {
                reject(e.message);
              }
            });
          }
        })
        .on('error', (e) => {
          reject(e);
        });
    });
  },
};

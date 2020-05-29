import { window, ConfigurationTarget } from 'vscode';
import Utils from '../Utils/Utils';
import https from 'https';

async function odataProvider() {
  try {
    let odataProviderValue = Utils.getConfigurationServer('odataProxy');
    let quickPickOdataProvider = await window.showQuickPick(
      [
        {
          description: 'Gateway url',
          label: 'Gateway',
          picked: odataProviderValue === 'Gateway',
        },
        {
          description: 'Without odata provider',
          label: 'None',
          picked: odataProviderValue === 'None',
        },
      ],
      {
        placeHolder: `Select odata provider (proxy all /sap) | Actual value: ${odataProviderValue}`,
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
    }
  } catch (err) {}
}

async function ui5Provider() {
  try {
    let ui5ProviderValue = Utils.getConfigurationServer('resourcesProxy');
    let quickPickUI5Provider = await window.showQuickPick(
      [
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
      ],
      {
        placeHolder: `Select odata provider (proxy all /sap) | Actual value: ${ui5ProviderValue}`,
        canPickMany: false,
      }
    );
    if (!quickPickUI5Provider) {
      return;
    }

    await Utils.getConfigurationServer().update(
      'resourcesProxy',
      quickPickUI5Provider.label,
      ConfigurationTarget.Workspace
    );

    if (quickPickUI5Provider.label === 'Gateway') {
      let inputBoxOdataUri = await window.showInputBox({
        placeHolder: 'Enter gateway url',
        value: Utils.getConfigurationServer('odataUri'),
      });
      if (!inputBoxOdataUri) {
        throw new Error('No gateway url configured');
      }
      await Utils.getConfigurationServer().update('odataUri', inputBoxOdataUri, ConfigurationTarget.Workspace);
    }

    let ui5Version = Utils.getConfigurationGeneral('ui5Version');
    let error = false,
      versions,
      framework;
    try {
      let url = `https://openui5.hana.ondemand.com/`;
      framework = 'None';
      if (quickPickUI5Provider.label === 'Gateway' || quickPickUI5Provider.label === 'CDN SAPUI5') {
        url = `https://sapui5.hana.ondemand.com/`;
        framework = 'SAPUI5';
      } else if (quickPickUI5Provider.label === 'CDN OpenUI5') {
        framework = 'OpenUI5';
      } else {
        return;
      }
      versions = await getVersions(url);
    } catch (err) {
      error = true;
    }
    if (!error) {
      let quickPickUI5Version = await window.showQuickPick(versions, {
        placeHolder: `Select ${framework} version | Actual value: ${ui5Version}`,
        canPickMany: false,
      });
      if (!quickPickUI5Version) {
        throw new Error('No major version selected');
      }
      let versionPatch = versions.find((versionData) => {
        return versionData === quickPickUI5Version;
      });

      let quickPickUI5VersionPatch = await window.showQuickPick(versionPatch.patches, {
        placeHolder: `Select ${framework} patch | Actual value: ${ui5Version}`,
        canPickMany: false,
      });
      // @ts-ignore
      if (!quickPickUI5VersionPatch) {
        throw new Error('No ui5 version selected');
      }
      await Utils.getConfigurationGeneral().update(
        'ui5Version',
        // @ts-ignore
        quickPickUI5VersionPatch.label,
        ConfigurationTarget.Workspace
      );
    } else {
      let inputBoxUI5Version = await window.showInputBox({
        placeHolder: `Enter ${framework} version | Actual value: ${ui5Version}`,
        value: Utils.getConfigurationGeneral('ui5Version'),
      });
      if (!inputBoxUI5Version) {
        throw new Error('No version configured');
      }
      await Utils.getConfigurationGeneral().update('ui5Version', inputBoxUI5Version, ConfigurationTarget.Workspace);
    }
  } catch (err) {}
}

async function getVersions(url) {
  try {
    let versionsValues = await Promise.all([getVersionOverview(url), getNeoApp(url)]);
    let versions = [];
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
    return versions;
  } catch (err) {
    throw new Error(err);
  }
}

function getVersionOverview(url) {
  return new Promise((resolv, reject) => {
    https
      .get(
        `${url}versionoverview.json`,
        {
          timeout: 1000 * 5, // 5 seconds
        },
        (res) => {
          if (res.statusCode !== 200) {
            reject();
          } else {
            let rawData = '';
            res.on('data', (chunk) => {
              rawData += chunk;
            });
            res.on('end', () => {
              try {
                resolv(JSON.parse(rawData));
              } catch (e) {
                reject(e.message);
              }
            });
          }
        }
      )
      .on('error', (e) => {
        reject();
      });
  });
}

function getNeoApp(url) {
  return new Promise((resolv, reject) => {
    https
      .get(
        `${url}neo-app.json`,
        {
          timeout: 1000 * 5, // 5 seconds
        },
        (res) => {
          if (res.statusCode !== 200) {
            reject();
          } else {
            let rawData = '';
            res.on('data', (chunk) => {
              rawData += chunk;
            });
            res.on('end', () => {
              try {
                resolv(JSON.parse(rawData));
              } catch (e) {
                reject(e.message);
              }
            });
          }
        }
      )
      .on('error', (e) => {
        reject();
      });
  });
}

export default {
  odataProvider,
  ui5Provider,
};

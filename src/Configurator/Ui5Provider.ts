import {
  window,
  workspace,
  Uri,
  ConfigurationTarget,
  ProgressLocation,
  ViewColumn,
  WebviewPanel,
  FileType,
} from 'vscode';
import { HTMLElement, parse } from 'node-html-parser';
import AdmZip from 'adm-zip';
import ejs from 'ejs';
import fs from 'fs';

import Config from '../Utils/ConfigVscode';
import Utils from '../Utils/ExtensionVscode';
import Log from '../Utils/LogVscode';
import Server from '../Server/Server';
import { Level, VersionsItem, VersionsTree, VersionTree } from '../Types/Types';
import path from 'path';
import Fetch from '../Utils/Fetch';
import { getRuntimeUrl, getUi5Versions, parseUi5Version } from '../Utils/Ui5';

let panelLicence: WebviewPanel | undefined;

export default {
  async wizard() {
    try {
      const ui5Provider = await this.quickPickUi5Provider();
      if (ui5Provider === 'Gateway') {
        //@ts-ignore
        await Config.server().update('resourcesProxy', ui5Provider, ConfigurationTarget.Workspace);
        Log.configurator(`Set resourcesProxy value to ${ui5Provider}`);

        await this.inputBoxGatewayUri();
        await this.setGatewayUi5Version();
      } else if (ui5Provider === 'Runtime') {
        //@ts-ignore
        await Config.server().update('resourcesProxy', ui5Provider, ConfigurationTarget.Workspace);
        Log.configurator(`Set resourcesProxy value to ${ui5Provider}`);

        await this.quickPickUi5RuntimeVersion();
      } else if (ui5Provider === 'CDN SAPUI5' || ui5Provider === 'CDN OpenUI5') {
        //@ts-ignore
        await Config.server().update('resourcesProxy', ui5Provider, ConfigurationTarget.Workspace);
        Log.configurator(`Set resourcesProxy value to ${ui5Provider}`);

        await this.setUi5Version();
      } else if (ui5Provider) {
        await this.setDestination(ui5Provider);
        await this.setGatewayUi5Version();
      }
      Server.restart();
    } catch (error: any) {
      throw new Error(error);
    }
  },

  async setGatewayUi5Version() {
    const sGatewayUri = String(Config.server('resourcesUri'));
    try {
      await this.configureGWVersion(sGatewayUri);
    } catch (oError: any) {
      Log.configurator(oError.message, Level.ERROR);
      await this.setUi5Version();
    }
  },

  async quickPickUi5Provider(): Promise<string> {
    return new Promise(async (resolve, reject) => {
      const ui5ProviderValue = String(Config.server('resourcesProxy'));
      const defaultItems = [
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
          description: 'Use SAPUI5 Local Runtime (Download from tools.hana.ondemand.com)',
          label: 'Runtime',
        },
        {
          description: 'Without resources proxy',
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
      const quickpick = await window.createQuickPick();
      quickpick.ignoreFocusOut = true;
      quickpick.title = 'ui5-tools > Configurator > Ui5Provider: Select UI5 provider';
      quickpick.items = items;
      quickpick.placeholder = ui5ProviderValue;
      quickpick.canSelectMany = false;
      quickpick.onDidAccept(async () => {
        if (quickpick.selectedItems.length) {
          const value = quickpick.selectedItems[0].label;
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
      await Config.server()?.update(
        'resourcesProxy',
        proxyDestination.type ?? 'Gateway',
        ConfigurationTarget.Workspace
      );
      Log.configurator(`Set resourcesProxy value to ${proxyDestination.type ?? 'Gateway'}`);

      //@ts-ignore
      await Config.server()?.update('resourcesUri', proxyDestination.url ?? 'Gateway', ConfigurationTarget.Workspace);
      Log.configurator(`Set resourcesUri value to ${proxyDestination.url ?? 'Gateway'}`);
    }
  },

  async setUi5Version() {
    let versions: Array<any>;
    try {
      const framework = Utils.getFramework();
      versions = await getUi5Versions(framework);
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
      } catch (sError: any) {
        Log.configurator(sError.message, Level.ERROR);
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
      const ui5Version = Config.general('ui5Version') as string;

      const quickpick = await window.createQuickPick();
      quickpick.title = 'ui5-tools > Configurator > Ui5Provider: Select UI5 major version';
      quickpick.items = versionsMajor;
      quickpick.placeholder = ui5Version;
      quickpick.ignoreFocusOut = true;
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
      quickpick.ignoreFocusOut = true;
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

  async configureGWVersion(sGatewayUri: string) {
    Log.configurator(`Fetching ui5Version from Gateway...`);
    const gatewayVersion = await this.getGatewayVersion(sGatewayUri);
    //@ts-ignore
    await Config.general().update('ui5Version', gatewayVersion.version, ConfigurationTarget.Workspace);
    Log.configurator(`Set ui5version value to ${gatewayVersion.version}`);
  },

  async getGatewayVersion(sGatewayUri: string): Promise<Record<string, any>> {
    const url = `${sGatewayUri}/sap/public/bc/ui5_ui5/1/resources/sap-ui-version.json`;
    const fileString = await Fetch.file(url);
    return JSON.parse(fileString);
  },

  async quickPickUi5RuntimeVersion() {
    return new Promise(async (resolve, reject) => {
      try {
        const versions = await this.getRuntimeVersions();
        const major = await this.quickPickUi5RuntimeVersionMajor(versions);

        const version = await this.quickPickUi5RuntimeVersionMinor(major.patches);

        //@ts-ignore
        await Config.general().update('ui5Version', version.version, ConfigurationTarget.Workspace);
        Log.configurator(`Set ui5Version value ${version.version}`);

        if (!version.installed) {
          await this.downloadRuntime(version);
        }
        resolve(version);
      } catch (error) {
        reject(error);
      }
    });
  },

  async quickPickUi5RuntimeVersionMajor(versions: Array<any>): Promise<VersionTree> {
    return new Promise(async (resolve, reject) => {
      const ui5Version = String(Config.general('ui5Version'));

      const quickpick = await window.createQuickPick();
      quickpick.title = 'ui5-tools > Configurator > Ui5Provider: Select UI5 major version';
      quickpick.items = versions.map(({ version, installed }) => {
        return { label: version, description: installed ? 'Installed' : '' };
      });
      quickpick.placeholder = ui5Version;
      quickpick.ignoreFocusOut = true;
      quickpick.step = 1;
      quickpick.totalSteps = 2;
      quickpick.canSelectMany = false;
      quickpick.onDidAccept(async () => {
        if (quickpick.selectedItems.length) {
          const value = quickpick.selectedItems[0].label;
          const versionMajor = versions.find((version) => {
            return version.version === value;
          });
          resolve(versionMajor);
        } else {
          reject('No major version selected');
        }
        quickpick.hide();
      });
      quickpick.show();
    });
  },

  async quickPickUi5RuntimeVersionMinor(versions: Array<VersionsItem>): Promise<VersionsItem> {
    return new Promise(async (resolve, reject) => {
      const ui5Version = String(Config.general('ui5Version'));

      const quickpick = await window.createQuickPick();
      quickpick.title = 'ui5-tools > Configurator > Ui5Provider: Select UI5 minor version';
      quickpick.items = versions.map(({ version, size, installed }) => {
        return {
          label: version,
          description: `${size}${installed ? ': Installed' : ''}`,
        };
      });
      quickpick.placeholder = ui5Version;
      quickpick.ignoreFocusOut = true;
      quickpick.step = 2;
      quickpick.totalSteps = 2;
      quickpick.canSelectMany = false;
      quickpick.onDidAccept(async () => {
        if (quickpick.selectedItems.length) {
          const value = quickpick.selectedItems[0].label;
          const versionMinor = versions.find((v) => {
            return v.version === value;
          });
          if (versionMinor) {
            resolve(versionMinor);
          }
        } else {
          reject('No minor version selected');
        }
        quickpick.hide();
      });
      quickpick.show();
    });
  },

  async getRuntimeFile(): Promise<HTMLElement> {
    const url = getRuntimeUrl();

    const stringUrl = await Fetch.file(url);

    return parse(stringUrl);
  },

  async getRuntimeVersions() {
    Log.configurator(`Downloading runtime versions list`);

    const document = await this.getRuntimeFile();
    const tables = document.querySelectorAll('table.plain');
    const table = tables[9];
    const rows = table.querySelectorAll('tbody tr');

    const versionsTreeArray: Array<VersionTree> = [];
    const versionsTreeHash: VersionsTree = {};

    rows.forEach(async (row) => {
      const firstCol = row.querySelectorAll('td');
      if (firstCol?.[0]?.innerHTML === 'Runtime') {
        const ui5Version = firstCol?.[1]?.innerHTML;

        const { major, minor } = parseUi5Version(ui5Version);
        let parentVersion = '';
        if (major && minor) {
          parentVersion = `${major}.${minor}`;
        }
        if (parentVersion) {
          const url = firstCol?.[3]?.querySelector('a')?.getAttribute('href') || '';
          if (url) {
            const size = firstCol?.[2]?.innerHTML;
            if (!versionsTreeHash[parentVersion]) {
              versionsTreeHash[parentVersion] = {
                version: parentVersion,
                patches: [],
                installed: false,
              };
              versionsTreeArray.push(versionsTreeHash[parentVersion]);
            }

            const runtimeFsPath = Utils.getRuntimeFsPath(true, ui5Version);
            const bInstalled = fs.existsSync(runtimeFsPath);

            const runtimeUrl = getRuntimeUrl();

            versionsTreeHash[parentVersion].installed = versionsTreeHash[parentVersion].installed || bInstalled;
            versionsTreeHash[parentVersion].patches.push({
              version: ui5Version,
              size: size,
              installed: bInstalled,
              url: `${runtimeUrl}/${url}`,
              oldVersion: row.classList.contains('oldVersionSapui5'),
            });
          }
        }
      }
    });
    Log.configurator(`Runtime list downloaded successfully`, Level.SUCCESS);

    return versionsTreeArray;
  },

  async downloadRuntime(version: VersionsItem) {
    const sMessage = Log.configurator(`Installing SAPUI5 ${version.version} runtime`);
    await window.withProgress(
      {
        title: sMessage,
        cancellable: false,
        location: ProgressLocation.Window,
      },
      async (progress) => {
        progress.report({ increment: 10, message: 'Accept or reject EULA...' });
        try {
          await this.acceptLicence();

          progress.report({ increment: 10, message: 'Downloading...' });
          const zipBuffer = await Fetch.buffer(version.url, {
            headers: {
              Cookie: 'eula_3_1_agreed=tools.hana.ondemand.com/developer-license-3_1.txt',
            },
          });
          const zipFile = new AdmZip(zipBuffer);

          zipFile.extractEntryTo('resources/', Utils.getRuntimeFsPath(), true, true);
          Log.configurator(`Unziping SAPUI5 ${version.version} runtime`);

          progress.report({ increment: 100 });
          const sMessage = Log.configurator(
            `Runtime version ${version.version} downloaded successfully`,
            Level.SUCCESS
          );
          window.showInformationMessage(sMessage);
        } catch (oErrorLicense: any) {
          const sMessage = Log.configurator(oErrorLicense.message, Level.ERROR);
          window.showErrorMessage(sMessage);
        }
      }
    );
  },

  async acceptLicence(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const runtimeUrl = getRuntimeUrl();
      const document = await this.getRuntimeFile();
      const eulaHeader = document.querySelector('#eula-dialog-header');
      const eulaHeaderHtml = eulaHeader?.innerHTML.replace('src="./', `src="${runtimeUrl}`);

      const eula = document.querySelector('#eula-text');
      const eulaText = eula?.innerText?.replace(/\n/g, '<br/>') ?? '';

      panelLicence?.dispose();

      panelLicence = window.createWebviewPanel('sapui5Eula', 'SAPUI5 EULA', ViewColumn.One, {
        enableScripts: true,
      });
      const htmlRendered = await ejs.renderFile(
        path.join(Utils.getExtensionFsPath(), 'static', 'scripts', 'eula.ejs'),
        {
          eulaHeaderHtml,
          eulaText,
        }
      );
      panelLicence.webview.html = htmlRendered;

      let bClosed = false;
      panelLicence.webview.onDidReceiveMessage((message) => {
        bClosed = true;
        if (message.command === 'reject') {
          const sMessage = Log.configurator('SAPUI5 EULA NOT Accepted', Level.ERROR);
          reject(new Error(sMessage));
        } else {
          Log.configurator('SAPUI5 EULA Accepted', Level.INFO);
          resolve();
        }
        panelLicence?.dispose();
      });

      panelLicence.onDidDispose(() => {
        panelLicence = undefined;
        if (!bClosed) {
          const sMessage = Log.configurator('SAPUI5 EULA NOT Accepted', Level.ERROR);
          reject(new Error(sMessage));
        }
      });
    });

    // }
  },

  async uninstallRuntimeWizard() {
    const quickpick = await window.createQuickPick();
    quickpick.title = 'ui5-tools > Configurator: Uninstall SAPUI5 Runtime';
    Log.configurator(`Uninstall SAPUI5 Runtime`);
    const fsPathRuntimeBase = Utils.getRuntimeFsPathBase();
    const uriFsPathRuntimeBase = Uri.file(fsPathRuntimeBase);
    const aFoldersFiles = await workspace.fs.readDirectory(uriFsPathRuntimeBase);
    const aFolders = aFoldersFiles.filter(({ 1: fileType }) => {
      return fileType === FileType.Directory;
    });
    const aOptions = aFolders.map(([name]) => {
      return { label: name, description: '' };
    });
    if (quickpick.items.length > 1) {
      aOptions.push({
        label: 'ALL',
        description: 'Remove all SAPUI5 versions',
      });
    }
    quickpick.items = aOptions;
    quickpick.placeholder = 'Select SAPUI5 version to uninstall';
    quickpick.ignoreFocusOut = true;
    quickpick.step = 1;
    quickpick.totalSteps = 1;
    quickpick.canSelectMany = false;
    quickpick.onDidAccept(async () => {
      if (quickpick.selectedItems.length) {
        const value = quickpick.selectedItems[0].label;
        const folder = aFolders.find(([name]) => {
          return name === value;
        });
        if (folder) {
          const [name] = folder;
          await this.uninstallUi5Runtime(name);
        } else if (value === 'ALL') {
          Log.configurator(`Uninstall SAPUI5 Runtime: Uninstall all SAPUI5 versions`);
          try {
            for (let i = 0; i < aFolders.length; i++) {
              const [name] = aFolders[i];
              await this.uninstallUi5Runtime(name);
            }
            const sMessage = `Uninstall SAPUI5 Runtime: all SAPUI5 runtime versions uninstalled successfully`;
            Log.configurator(sMessage);
            window.showInformationMessage(sMessage);
          } catch (oError) {
            const sMessage = `Uninstall SAPUI5 Runtime: unable to uninstall SAPUI5 Runtime`;
            Log.configurator(sMessage, Level.ERROR);
            window.showErrorMessage(sMessage);
          }
        }
      }
      quickpick.hide();
    });
    quickpick.show();
  },

  async uninstallUi5Runtime(ui5Version: string) {
    Log.configurator(`Uninstall SAPUI5 Runtime: Selected ${ui5Version} version`);
    try {
      const fsVersionPath = Utils.getRuntimeFsPath(false, ui5Version);
      const fsVersionUri = Uri.file(fsVersionPath);
      await workspace.fs.delete(fsVersionUri, { recursive: true, useTrash: false });

      const sMessage = `Uninstall SAPUI5 Runtime: ${ui5Version} uninstalled successfully`;
      Log.configurator(sMessage);
      window.showInformationMessage(sMessage);
    } catch (oError) {
      const sMessage = `Uninstall SAPUI5 Runtime: unable to uninstall ${ui5Version} version`;
      Log.configurator(sMessage, Level.ERROR);
      window.showErrorMessage(sMessage);
      throw oError;
    }
  },
};

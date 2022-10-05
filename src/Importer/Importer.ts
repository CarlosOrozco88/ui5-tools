import { window, ProgressLocation, QuickPickItem, workspace, Uri } from 'vscode';
import Config from '../Utils/ConfigVscode';
import Log from '../Utils/LogVscode';
import { Headers } from 'node-fetch';
import Fetch from '../Utils/Fetch';
import https from 'https';
import Utils from '../Utils/ExtensionVscode';
import { BSPData, ImportOptions, Level, Ui5ToolsConfiguration } from '../Types/Types';
import { XMLParser } from 'fast-xml-parser';
import { URL } from 'url';
import path from 'path';
import ImporterProvider from '../Configurator/ImporterProvider';
import Finder from '../Project/Finder';

export default {
  async askBSPToImport(): Promise<void> {
    Log.importer(`Asking BSP to import`);
    try {
      const oImportOptions = await this.getImportOptions();
      const bspList = await this.getBSPList(oImportOptions);
      const qpOptions: Array<QuickPickItem> = [];
      bspList.forEach((bsp) => {
        qpOptions.push({
          label: bsp.title,
          description: bsp.summary,
        });
      });

      const aBspList: readonly QuickPickItem[] = await new Promise(async (resolve, reject) => {
        const bspQP = await window.createQuickPick();
        bspQP.title = 'ui5-tools > Importer > Select BSP';
        bspQP.items = qpOptions;
        bspQP.placeholder = 'Select BSP to import';
        bspQP.canSelectMany = true;
        bspQP.onDidAccept(async () => {
          if (bspQP.selectedItems.length) {
            resolve(bspQP.selectedItems);
          } else {
            reject('No BSP selected');
          }
          bspQP.hide();
        });
        bspQP.show();
      });

      if (!aBspList.length) {
        throw new Error('No BSP selected');
      }

      const aBSP = aBspList.map(({ label }) => {
        return bspList.find((oBsp) => oBsp.title === label) as BSPData;
      });
      await this.importProjects(aBSP, oImportOptions);
    } catch (oError: any) {
      throw new Error(oError.message);
    }
  },

  getBSPList(oImportOptions: ImportOptions): Promise<Array<BSPData>> {
    const uri = String(Config.importer('uri'));
    const client = String(Config.importer('client'));

    return new Promise((resolve) => {
      window.withProgress(
        {
          location: ProgressLocation.Window,
          title: `ui5-tools > Importing BSP List...`,
          cancellable: false,
        },
        async () => {
          const bspDataXML = await this.getXMLFile(
            `${uri}/sap/bc/adt/filestore/ui5-bsp/objects?sap-client=${client}`,
            oImportOptions
          );

          const bspData = bspDataXML['atom:feed']['atom:entry'].map((oEntry: Record<string, any>) => {
            const bspData: BSPData = {
              id: oEntry['atom:id'],
              title: oEntry['atom:title'] ?? '',
              author: oEntry['atom:author'] ?? '',
              contributor: oEntry['atom:contributor'] ?? '',
              summary: oEntry['atom:summary']['#text'] ?? '',
              contentUrl: new URL(`/sap/bc/adt/filestore/ui5-bsp/objects/?sap-client=${client}`, uri).toString(),
              url: new URL(path.join(oEntry['@_xml:base'], oEntry['atom:content']['@_src']), uri).toString(),
            };
            return bspData;
          });
          resolve(bspData);
        }
      );
    });
  },

  async getImportOptions() {
    let uri = String(Config.importer('uri'));
    let client = String(Config.importer('client'));
    if (!uri || !client) {
      await ImporterProvider.wizard();
      uri = String(Config.importer('uri'));
      client = String(Config.importer('client'));
    }

    const oEnv = Utils.loadEnv();

    const oImportOptions: ImportOptions = {
      auth: {
        user: oEnv.UI5TOOLS_IMPORT_USER || '',
        pwd: oEnv.UI5TOOLS_IMPORT_PASSWORD || '',
      },
      conn: {
        url: uri,
        useStrictSSL: !!Config.deployer('rejectUnauthorized'),
        client: client,
      },
      workspace: {
        root: Utils.getWorkspaceRootPath(),
      },
    };
    if (!oImportOptions.auth.user || !oImportOptions.auth.pwd) {
      await this.getUserPass(oImportOptions);
    }

    return oImportOptions;
  },

  async importProjects(aBSP: BSPData[], oImportOptions: ImportOptions) {
    if (!aBSP.length) {
      Log.importer(`No BSP selected to import`);
      return;
    }

    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: `ui5-tools > Importing BSP...`,
        cancellable: true,
      },
      async (progress, token) => {
        for (let i = 0; !token.isCancellationRequested && i < aBSP.length; i++) {
          const oBSP = aBSP[i];

          progress.report({
            increment: 100 / aBSP.length,
            message: `${oBSP.title} (${i + 1}/${aBSP.length})`,
          });
          await this.importProject(oBSP, oImportOptions);
        }
      }
    );
  },

  async importProject(oBSP: BSPData, oImportOptions: ImportOptions): Promise<void> {
    Log.importer(`Importing BSP ${oBSP.title}...`);
    const bspInfo = await this.getXMLFile(oBSP.url, oImportOptions);

    await this.processEntry(bspInfo['atom:feed']['atom:entry'], oBSP, oImportOptions);

    try {
      await this.generateConfigFile(oBSP, oImportOptions);
    } catch (error: any) {
      Log.importer(error.message, Level.ERROR);
    }

    const sMessage = Log.importer(`BSP ${oBSP.title} imported!`, Level.SUCCESS);
    window.showInformationMessage(sMessage);
  },

  async generateConfigFile(oBSP: BSPData, oImportOptions: ImportOptions): Promise<void> {
    const generateConfig = !!Config.importer('generateConfig');
    if (generateConfig) {
      Log.importer(`Generating 'ui5-tools.json' file for ${oBSP.title}...`);

      const ui5Project = await Finder.findUi5ProjectForFolderName(oBSP.title);
      if (!ui5Project) {
        throw new Error(`Ui5 project '${oBSP.title}' not found`);
      }

      const oConfigFile = await ui5Project.getUi5ToolsFile();
      if (!oConfigFile) {
        const oConfigFile: Ui5ToolsConfiguration = {
          deployer: {
            type: 'Gateway',
            options: {
              conn: {
                server: oImportOptions.conn.url,
                client: oImportOptions.conn.client,
              },
              auth: {},
              ui5: {
                language: 'EN',
                bspcontainer: oBSP.title,
                bspcontainer_text: oBSP.summary,
                package: '',
                calc_appindex: true,
              },
            },
          },
        };
        ui5Project.setUi5ToolsFile(oConfigFile);
        Log.importer(`File 'ui5-tools.json' for ${oBSP.title} generated!`, Level.SUCCESS);
      }
    }
  },

  async getXMLFile(url: string, oImportOptions: ImportOptions) {
    const data = await this.getFile(url, oImportOptions);
    const res = this.parseXML(data);
    return res;
  },

  async getFile(url: string, oImportOptions: ImportOptions) {
    const headers = new Headers();
    headers.set(
      'Authorization',
      'Basic ' + Buffer.from(oImportOptions.auth.user + ':' + oImportOptions.auth.pwd).toString('base64')
    );

    const httpsAgent = new https.Agent({
      rejectUnauthorized: false,
    });
    const unaut = Fetch.setUnautorized(oImportOptions.conn?.useStrictSSL, !!Config.deployer('rejectUnauthorized'));
    const data = await Fetch.file(url, {
      timeout: 0,
      headers: headers,
      agent: httpsAgent,
    });
    unaut.restore();
    return data;
  },

  async processEntry(aData: any, oBSP: BSPData, oImportOptions: ImportOptions) {
    if (Array.isArray(aData)) {
      for (let i = 0; i < aData.length; i++) {
        const oItem = aData[i];
        await this.processItem(oItem, oBSP, oImportOptions);
      }
    } else {
      await this.processItem(aData, oBSP, oImportOptions);
    }
    return true;
  },

  async processItem(item: any, oBSP: BSPData, oImportOptions: ImportOptions) {
    const title = item['atom:title'];
    const src = item['atom:content']['@_src'];
    const type = item['atom:category']['@_term'];

    const sPath = new URL(src, oBSP.contentUrl).toString();
    const sFsPath = path.join(oImportOptions.workspace.root, title);
    const uriFsPath = Uri.file(sFsPath);
    if (type === 'folder') {
      //go inside folder
      Log.importer(`Creating folder ${uriFsPath}...`);
      await workspace.fs.createDirectory(uriFsPath);

      const data = await this.getXMLFile(sPath, oImportOptions);

      await this.processEntry(data['atom:feed']['atom:entry'], oBSP, oImportOptions);
    } else {
      Log.importer(`Creating file ${uriFsPath}...`);
      const filedata = await this.getFile(sPath, oImportOptions);
      workspace.fs.writeFile(uriFsPath, Buffer.from(filedata));
    }
  },

  async getUserPass(oImportOptions: ImportOptions): Promise<void> {
    if (!oImportOptions?.auth?.user || !oImportOptions?.auth?.pwd) {
      const sUser: string = await new Promise((resolve) => {
        const inputBox = window.createInputBox();
        inputBox.title = 'ui5-tools > Importer > Server username';
        inputBox.step = 1;
        inputBox.totalSteps = 2;
        inputBox.placeholder = `Username`;
        inputBox.ignoreFocusOut = true;
        inputBox.onDidAccept(() => {
          resolve(inputBox.value);
          inputBox.hide();
        });
        inputBox.show();
      });
      if (!sUser) {
        throw new Error(`No user configured`);
      }
      oImportOptions.auth.user = sUser;

      const sPwd: string = await new Promise((resolve) => {
        const inputBox = window.createInputBox();
        inputBox.title = `ui5-tools > Importer > Server password for ${sUser}`;
        inputBox.step = 2;
        inputBox.totalSteps = 2;
        inputBox.placeholder = `Password`;
        inputBox.password = true;
        inputBox.ignoreFocusOut = true;
        inputBox.onDidAccept(() => {
          resolve(inputBox.value);
          inputBox.hide();
        });
        inputBox.show();
      });
      if (!sPwd) {
        throw new Error(`No password configured`);
      }
      oImportOptions.auth.pwd = sPwd;
    }
  },

  parseXML(XMLdata: string) {
    const parser = new XMLParser({ ignoreAttributes: false });
    const jsonData = parser.parse(XMLdata);
    return jsonData;
  },
};

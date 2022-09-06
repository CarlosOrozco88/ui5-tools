import { workspace, window, ProgressLocation, Progress } from 'vscode';
import fs from 'fs';
import Config from '../Utils/ConfigVscode';
import Log from '../Utils/LogVscode';
import fetch, { Headers } from 'node-fetch';
import deepmerge from 'deepmerge';
import https from 'https';
import Utils from '../Utils/ExtensionVscode';
import { ImportOptions } from '../Types/Types';
import { XMLParser } from 'fast-xml-parser';

let oImportOptions: ImportOptions;

export default {
  async askProjectToImport(): Promise<void> {
    Log.importer(`Asking project to import`);
    try {
      const bsp_name: string = await new Promise((resolve) => {
        const inputBox = window.createInputBox();
        inputBox.title = 'ui5-tools > Importer > Enter bsp name';
        inputBox.placeholder = 'Enter BSP text';
        inputBox.ignoreFocusOut = true;
        inputBox.onDidAccept(() => {
          resolve(inputBox.value);
          inputBox.hide();
        });
        inputBox.show();
      });

      this.importProject(bsp_name);
    } catch (error) {
      throw new Error('Import BSP canceled');
    }
  },

  async getDeployOptions(bsp_name: string) {
    const oConfig = Config.getConfig();
    Log.importer(`trying to import ${bsp_name} with conf: ${JSON.stringify(oConfig)}`);

    const oEnv = Utils.loadEnv();
    const oUserPassword = {
      auth: {
        user: oEnv.UI5TOOLS_DEPLOY_USER || '',
        pwd: oEnv.UI5TOOLS_DEPLOY_PASSWORD || '',
      },
    };
    const oConf = {
      conn: {
        url: oConfig.server.odataUri + '/sap/bc/adt/filestore/ui5-bsp/objects/' + bsp_name + '/content',
        baseurl: oConfig.server.odataUri,
        useStrictSSL: oConfig.deployer.rejectUnauthorized,
      },
      ui5: {
        bsp_name: bsp_name,
      },
      workspace: {
        root: workspace.workspaceFolders ? workspace.workspaceFolders[0].uri.path : '',
      },
    };

    const oImportOptions = deepmerge.all<ImportOptions>([oUserPassword, oConf]);
    return oImportOptions;
  },

  async call(url: string) {
    const headers = new Headers();

    if (!oImportOptions.auth.user || !oImportOptions.auth.pwd) {
      // @ts-ignore
      await this.getUserPass(oImportOptions);
    }

    headers.set(
      'Authorization',
      'Basic ' + Buffer.from(oImportOptions.auth.user + ':' + oImportOptions.auth.pwd).toString('base64')
    );

    const httpsAgent = new https.Agent({
      rejectUnauthorized: oImportOptions.conn.useStrictSSL,
    });
    const unaut = this.setUnautorized();
    return fetch(url, {
      headers: headers,
      agent: httpsAgent,
    }).then((data) => {
      unaut.restore();
      return data.text();
    });
  },

  async importProject(bsp_name: string): Promise<void> {
    Log.importer(`importing project `);
    oImportOptions = await this.getDeployOptions(bsp_name);
    const xml = await this.call(oImportOptions.conn.url);
    const res = this.parse(xml);
    //@ts-ignore
    await this.processEntry(res['atom:feed']['atom:entry']);
    console.log(res);
  },

  parse(XMLdata: string) {
    const options = { ignoreAttributes: false };
    const parser = new XMLParser(options);
    const jObj = parser.parse(XMLdata);
    return jObj;
  },

  async processEntry(aData: any) {
    return new Promise(async (resolve) => {
      if (Array.isArray(aData)) {
        aData.forEach(
          async function (item: any) {
            Log.importer('reading...');
            //@ts-ignore
            await this.processItem(item);
            resolve(true);
          }.bind(this)
        );
      } else {
        await this.processItem(aData);
        resolve(true);
      }
    });
  },

  async processItem(item: any) {
    return new Promise(async (resolve) => {
      const title = item['atom:title'];
      const src = item['atom:content']['@_src'];
      const type = item['atom:category']['@_term'];
      if (type == 'folder') {
        //go inside folder
        await fs.promises.mkdir(oImportOptions.workspace.root + '/' + title, { recursive: true }).catch(console.error);
        const xml = await this.call(this.getInnerUrl(src));
        const res = this.parse(xml);
        //@ts-ignore
        await this.processEntry(res['atom:feed']['atom:entry']);
      } else {
        //download file
        await window.withProgress(
          {
            location: ProgressLocation.Notification,
            title: `ui5-tools > Downloading ${title}`,
            cancellable: true,
          },
          async function (
            progress: Progress<{
              message?: string | undefined;
              increment?: number | undefined;
            }>
          ) {
            progress.report({ increment: 0 });
            //@ts-ignore
            const filedata = await this.call(this.getInnerUrl(src));
            fs.writeFileSync(oImportOptions.workspace.root + '/' + title, filedata);
            progress.report({ increment: 100 });
          }.bind(this)
        );
      }
      resolve(true);
    });
  },

  getInnerUrl(sPath: string) {
    return `${oImportOptions.conn.baseurl}/sap/bc/adt/filestore/ui5-bsp/objects/${sPath}`;
  },

  async getUserPass(oImportOptions: ImportOptions): Promise<void> {
    if (!oImportOptions?.auth?.user || !oImportOptions?.auth?.pwd) {
      const sUser: string = await new Promise((resolve) => {
        const inputBox = window.createInputBox();
        inputBox.title = 'ui5-tools > Deployer > Server username';
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
        inputBox.title = `ui5-tools > Deployer > Server password for ${sUser}`;
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

  setUnautorized() {
    const originalReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    if (oImportOptions.conn?.useStrictSSL === false && !Config.deployer('rejectUnauthorized')) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }
    return {
      restore: () => {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalReject;
      },
    };
  },
};

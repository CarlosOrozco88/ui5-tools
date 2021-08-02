import {
  workspace,
  window,
  RelativePattern,
  ProgressLocation,
  Progress,
  Uri,
  TextDocument,
  QuickPickItem,
  QuickPickOptions,
} from 'vscode';
//@ts-ignore
import ui5DeployerCore from 'ui5-nwabap-deployer-core';
//@ts-ignore
import TransportManager from 'ui5-nwabap-deployer-core/lib/TransportManager';
import deepmerge from 'deepmerge';
import fs from 'fs';

import Builder from '../Builder/Builder';
import Log from '../Utils/Log';
import Utils from '../Utils/Utils';
import Config from '../Utils/Config';
import { DeployMassive, DeployOptions, Level, Ui5App, DeployStatus, Ui5ToolsConfiguration } from '../Types/Types';

const oLogger = Log.newLogProviderDeployer();

export default {
  async askProjectToDeploy(): Promise<void> {
    let ui5App: Ui5App | undefined;
    try {
      Log.logDeployer(`Asking project to deploy`);
      const ui5Apps = await Utils.getAllUI5Apps();
      if (ui5Apps.length > 1) {
        const qpOptions: Array<QuickPickItem> = [];
        ui5Apps.forEach((app) => {
          qpOptions.push({
            label: app.folderName,
            description: app.namespace,
          });
        });
        // ask for a project

        const ui5ProjectToDeploy: QuickPickItem = await new Promise(async (resolve, reject) => {
          const ui5ProjectToDeployQp = await window.createQuickPick();
          ui5ProjectToDeployQp.title = 'ui5-tools > Deployer > Select UI5 project';
          ui5ProjectToDeployQp.items = qpOptions;
          ui5ProjectToDeployQp.placeholder = 'Select UI5 project to deploy';
          ui5ProjectToDeployQp.canSelectMany = false;
          ui5ProjectToDeployQp.onDidAccept(async () => {
            if (ui5ProjectToDeployQp.selectedItems.length) {
              resolve(ui5ProjectToDeployQp.selectedItems[0]);
            } else {
              reject('No UI5 project selected');
            }
            ui5ProjectToDeployQp.hide();
          });
          ui5ProjectToDeployQp.show();
        });

        // fspath from selected project
        ui5App = ui5Apps.find((app) => {
          return app.namespace == ui5ProjectToDeploy.description;
        });
      } else if (ui5Apps.length == 1) {
        // only one project
        ui5App = ui5Apps[0];
      }
    } catch (e) {
      ui5App = undefined;
    }
    try {
      if (ui5App) {
        await this.askCreateReuseTransport(ui5App);
      }
    } catch (oError) {
      Log.logDeployer(oError.message, Level.ERROR);
    }
  },

  async deployAllProjects(): Promise<void> {
    Log.logDeployer(`Deploy all ui5 projects`);
    const ui5Apps = await Utils.getAllUI5Apps();
    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: `ui5-tools > Deploying all`,
        cancellable: true,
      },
      async (progress, token) => {
        let oMassiveOptions: DeployMassive = {
          deployWorkspace: true,
          transportno: '',
        };
        const oResults = {
          [DeployStatus.Success]: 0,
          [DeployStatus.Error]: 0,
          [DeployStatus.Skipped]: 0,
        };
        progress.report({ increment: 0 });
        for (let i = 0; i < ui5Apps.length; i++) {
          if (token.isCancellationRequested) {
            return;
          }
          progress.report({
            increment: 100 / ui5Apps.length,
            message: `${ui5Apps[i].folderName} (${i + 1}/${ui5Apps.length})`,
          });
          try {
            let deployed = await this.askCreateReuseTransport(ui5Apps[i], oMassiveOptions);
            oResults[deployed]++;
          } catch (oError) {
            oResults[DeployStatus.Error]++;
            const sMessage = `Project ${ui5Apps[i].folderName} not deployed`;
            Log.logDeployer(sMessage, Level.ERROR);
            window.showErrorMessage(sMessage);
          }
        }
        const sMessage = `Deploy finished with ${oResults[DeployStatus.Success]} projects deployed,
        ${oResults[DeployStatus.Skipped]} skipped and
        ${oResults[DeployStatus.Error]} not deployed`;
        Log.logDeployer(sMessage, Level.SUCCESS);
        window.showInformationMessage(sMessage);
      }
    );
  },

  async askCreateReuseTransport(ui5App: Ui5App, oMassiveOptions?: DeployMassive): Promise<DeployStatus> {
    let oDeployOptions: DeployOptions;
    try {
      if (ui5App) {
        let ui5AppConfig = await Utils.getUi5ToolsFile(ui5App);

        if (oMassiveOptions?.deployWorkspace && ui5AppConfig?.deployer?.globalDeploy === false) {
          return DeployStatus.Skipped;
        }

        if (!ui5AppConfig) {
          ui5AppConfig = await this.createConfigFile(ui5App);
        }

        const oDeployOptionsFs = await this.getDeployOptions(ui5AppConfig);
        let sOption;

        if (oMassiveOptions?.transportno) {
          Log.logDeployer(`Using transportno ${oMassiveOptions.transportno}...`);
          oDeployOptions = deepmerge({}, oDeployOptionsFs);
          sOption = oMassiveOptions.transportno;
        } else {
          Log.logDeployer(`Asking create or update transportno...`);

          const qpOptions = [
            {
              label: `Update existing transport`,
              description: 'Update',
            },
            {
              label: `Create new transport`,
              description: 'Create',
            },
            {
              label: `Use ui5tools.json config file`,
              description: 'Read',
            },
          ];

          if (oDeployOptionsFs?.ui5?.transportno) {
            qpOptions.unshift({
              label: `Update transportno ${oDeployOptionsFs.ui5.transportno}`,
              description: oDeployOptionsFs.ui5.transportno,
            });
          }

          const selTransportOption: QuickPickItem = await new Promise(async (resolve, reject) => {
            const selTransportOptionQp = await window.createQuickPick();
            selTransportOptionQp.title = 'ui5-tools > Deployer > Update or create transport';
            selTransportOptionQp.items = qpOptions;
            selTransportOptionQp.placeholder = `Create or update transport for ${ui5App.folderName} project`;
            selTransportOptionQp.canSelectMany = false;
            selTransportOptionQp.onDidAccept(async () => {
              if (selTransportOptionQp.selectedItems.length) {
                resolve(selTransportOptionQp.selectedItems[0]);
              } else {
                reject('No UI5 project selected');
              }
              selTransportOptionQp.hide();
            });
            selTransportOptionQp.show();
          });
          sOption = selTransportOption.description;
          oDeployOptions = deepmerge({}, oDeployOptionsFs);

          await this.getUserPass(oDeployOptions);
        }
        switch (sOption) {
          case undefined:
          case '':
            throw new Error('Deploy canceled');
          case 'Create':
            await this.createTransport(ui5App, oDeployOptions, oMassiveOptions);
            break;
          case 'Update':
            await this.updateTransport(ui5App, oDeployOptions);
            break;
          case 'Read':
            Log.logDeployer(`Using ui5tools.json file`);
            break;
          default:
            await this.updateTransport(ui5App, oDeployOptions, sOption);
            break;
        }
        if (oMassiveOptions) {
          oMassiveOptions.transportno = String(oDeployOptions.ui5.transportno);
        }
        await this.deployProject(ui5App, oDeployOptions, oMassiveOptions);
      }
    } catch (oError) {
      Log.logDeployer(oError.message, Level.ERROR);
      window.showErrorMessage(oError.message);
      throw oError;
    }
    return DeployStatus.Success;
  },

  async createTransport(ui5App: Ui5App, oDeployOptions: DeployOptions, oMassiveOptions?: DeployMassive) {
    const sDate = new Date().toLocaleString();
    const sDefaultText = `${ui5App.folderName}: ${sDate}`;

    let transport_text: string;
    try {
      transport_text = await new Promise((resolve, reject) => {
        const inputBox = window.createInputBox();
        inputBox.title = 'ui5-tools > Deployer > Create transport > Enter transport text';
        inputBox.placeholder = 'Enter transport text';
        inputBox.ignoreFocusOut = true;
        inputBox.onDidAccept(() => {
          resolve(inputBox.value);
          inputBox.hide();
        });
        inputBox.show();
      });
    } catch (oError) {
      throw new Error('Create transport canceled');
    }

    if (!transport_text) {
      transport_text = sDefaultText;
    } else if (Config.deployer('autoPrefixBSP') && !oMassiveOptions?.deployWorkspace) {
      transport_text = `${oDeployOptions.ui5.bspcontainer}: ${transport_text}`;
    }
    oDeployOptions.ui5.transport_text = transport_text;
    oDeployOptions.ui5.create_transport = false;
    oDeployOptions.ui5.transportno = '';
    oDeployOptions.ui5.transport_use_user_match = false;

    const oTransportManager = this.getTransportManager(oDeployOptions);
    try {
      const transportno: string = await new Promise((resolve, reject) => {
        oTransportManager.createTransport(
          oDeployOptions.ui5.package,
          oDeployOptions.ui5.transport_text,
          async function (oError: Error, sTransportNo: string) {
            if (oError) {
              reject(oError);
            }
            resolve(sTransportNo);
          }
        );
      });
      oDeployOptions.ui5.transportno = transportno;
    } catch (oError) {
      throw oError;
    }
  },

  async updateTransport(ui5App: Ui5App, oDeployOptions: DeployOptions, transportno?: string) {
    if (!transportno) {
      try {
        transportno = await new Promise((resolve, reject) => {
          const inputBox = window.createInputBox();
          inputBox.title = 'ui5-tools > Deployer > Update transport > Enter transport number';
          inputBox.placeholder = 'Enter the transport number';
          inputBox.ignoreFocusOut = true;
          inputBox.onDidAccept(() => {
            resolve(inputBox.value);
            inputBox.hide();
          });
          inputBox.show();
        });
      } catch (oError) {
        transportno = undefined;
      }
    }

    if (!transportno) {
      throw new Error('No transport selected');
    }

    oDeployOptions.ui5.transportno = transportno;
    oDeployOptions.ui5.create_transport = false;
    oDeployOptions.ui5.transport_text = '';
    oDeployOptions.ui5.transport_use_user_match = false;
  },

  getTransportManager(oDeployOptions: DeployOptions) {
    return new TransportManager(oDeployOptions, oLogger);
  },

  async deployProject(ui5App: Ui5App, oDeployOptions: DeployOptions, oMassiveOptions?: DeployMassive): Promise<void> {
    if (ui5App) {
      const folderName = ui5App.folderName;
      Log.logDeployer(`Deploying ${folderName}`);
      await window.withProgress(
        {
          location: ProgressLocation.Notification,
          title: `ui5-tools > Deploying app ${folderName}`,
          cancellable: true,
        },
        async (progress, token) => {
          token.onCancellationRequested(() => {
            throw new Error('Deploy canceled');
          });
          try {
            await Builder.build({ ui5App, progress, multiplier: 0.5 });
            await this.deploy({ ui5App, oDeployOptions, progress, multiplier: 0.5 });

            const sMessage = `Project ${ui5App.folderName} deployed!`;
            Log.logDeployer(sMessage);

            if (!oMassiveOptions?.deployWorkspace) {
              window.showInformationMessage(sMessage);
            }
          } catch (oError) {
            throw oError;
          }
        }
      );
    }
  },

  async deploy({
    ui5App,
    oDeployOptions,
    progress,
    multiplier = 1,
  }: {
    ui5App: Ui5App;
    oDeployOptions: DeployOptions;
    progress?: Progress<any>;
    multiplier: number;
  }) {
    let sMessage = '';

    const ui5AppConfig = await Utils.getUi5ToolsFile(ui5App);
    const sType = ui5AppConfig?.deployer?.type || '';

    if (sType === 'Gateway') {
      // Authentication
      sMessage = 'Gateway destination found';
      progress?.report({ increment: 20 * multiplier, message: sMessage });
      Log.logDeployer(sMessage);

      this.autoSaveOrder(ui5App, oDeployOptions);

      const processReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      try {
        const patternFiles = new RelativePattern(ui5App.deployFsPath, `**/*`);
        const aProjectFiles = await workspace.findFiles(patternFiles);
        const aProjectResources = await Promise.all(
          aProjectFiles.map(async (file) => {
            return {
              path: file.fsPath.replace(ui5App.deployFsPath, '').split('\\').join('/'),
              content: fs.readFileSync(file.fsPath, { encoding: null }),
            };
          })
        );
        const iIncrement = 80;
        const iStep = iIncrement / aProjectResources.length;

        const oLoggerProgress = deepmerge(oLogger, {
          log: (sText) => {
            if (sText.indexOf('file ') === 0) {
              progress?.report({ increment: iStep * multiplier, message: 'Deploy in process...' });
            }
            oLogger.log(sText);
          },
        });

        if (oDeployOptions.conn?.useStrictSSL === false && !Config.deployer('rejectUnauthorized')) {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
        }

        await ui5DeployerCore.deployUI5toNWABAP(oDeployOptions, aProjectResources, oLoggerProgress);
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = processReject;
      } catch (oError) {
        progress?.report({ increment: 100 * multiplier, message: oError.message });
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = processReject;
        throw new Error(oError);
      }
    } else {
      const sError = 'No configuration file found';
      progress?.report({ increment: 100 * multiplier, message: sError });
      throw new Error(sError);
    }
  },

  async autoSaveOrder(ui5App: Ui5App, oDeployOptions: DeployOptions) {
    const bAutoSaveOrder = Config.deployer('autoSaveOrder');
    if (bAutoSaveOrder) {
      const ui5AppConfig = await Utils.getUi5ToolsFile(ui5App);
      if (ui5AppConfig.deployer?.type == 'Gateway' && typeof ui5AppConfig.deployer?.options?.ui5 === 'object') {
        ui5AppConfig.deployer.options.ui5.transportno = oDeployOptions.ui5.transportno;
      }
      await Utils.setUi5ToolsFile(ui5App, ui5AppConfig);
    }
  },

  async createConfigFile(ui5App: Ui5App) {
    Log.logDeployer(`Create ui5-tools.json file?`);
    const qpOptions = [
      {
        label: `Yes`,
      },
      {
        label: `No`,
      },
    ];

    const selTransportOption: QuickPickItem = await new Promise(async (resolve, reject) => {
      const selTransportOptionQp = await window.createQuickPick();
      selTransportOptionQp.title = 'ui5-tools > Deployer > Create ui5-tools.json file?';
      selTransportOptionQp.items = qpOptions;
      selTransportOptionQp.placeholder = `Project ${ui5App.folderName} does not have a ui5-tools.json file, create it now?`;
      selTransportOptionQp.canSelectMany = false;
      selTransportOptionQp.onDidAccept(async () => {
        if (selTransportOptionQp.selectedItems.length) {
          resolve(selTransportOptionQp.selectedItems[0]);
        } else {
          reject('No UI5 project selected');
        }
        selTransportOptionQp.hide();
      });
      selTransportOptionQp.show();
    });
    if (!selTransportOption || selTransportOption.label !== 'Yes') {
      Log.logDeployer(`Abort creation`);
      throw new Error(`File ui5tools.json not found for project ${ui5App.folderName}`);
    }
    Log.logDeployer(`Collecting data...`);

    const oConfigFile: Ui5ToolsConfiguration = {
      deployer: {
        type: 'Gateway',
        options: {
          conn: {
            server: '',
            client: 0,
          },
          auth: {},
          ui5: {
            language: 'EN',
            bspcontainer: '',
            bspcontainer_text: '',
            package: '',
            calc_appindex: true,
          },
        },
      },
    };

    const sServer: string = await new Promise((resolve, reject) => {
      const inputBox = window.createInputBox();
      inputBox.title = 'ui5-tools > Deployer > Create ui5-tools.json file > Server Url';
      inputBox.step = 1;
      inputBox.totalSteps = 6;
      inputBox.placeholder = `protocol://host:port`;
      inputBox.ignoreFocusOut = true;
      inputBox.onDidAccept(() => {
        resolve(inputBox.value);
        inputBox.hide();
      });
      inputBox.show();
    });
    if (!sServer) {
      throw new Error(`No server url found`);
    }
    Log.logDeployer(`ui5-tools.json: Server ${sServer}`);
    oConfigFile.deployer.options.conn.server = sServer;

    let sClient;
    try {
      sClient = await new Promise((resolve, reject) => {
        const inputBox = window.createInputBox();
        inputBox.title = 'ui5-tools > Deployer > Create ui5-tools.json file > Client';
        inputBox.step = 2;
        inputBox.totalSteps = 6;
        inputBox.placeholder = 'Enter client number';
        inputBox.ignoreFocusOut = true;
        inputBox.onDidAccept(() => {
          resolve(inputBox.value);
          inputBox.hide();
        });
        inputBox.show();
      });
    } catch (oError) {
      sClient = undefined;
    }
    if (sClient && !isNaN(Number(sClient))) {
      Log.logDeployer(`ui5-tools.json: Client ${sClient}`);
      oConfigFile.deployer.options.conn.client = Number(sClient);
    }

    const sLanguage: string = await new Promise((resolve, reject) => {
      const inputBox = window.createInputBox();
      inputBox.title = 'ui5-tools > Deployer > Create ui5-tools.json file > Language';
      inputBox.step = 3;
      inputBox.totalSteps = 6;
      inputBox.placeholder = `EN`;
      inputBox.ignoreFocusOut = true;
      inputBox.onDidAccept(() => {
        resolve(inputBox.value);
        inputBox.hide();
      });
      inputBox.show();
    });
    if (!sLanguage) {
      throw new Error(`No language configured`);
    }
    Log.logDeployer(`ui5-tools.json: Language ${sLanguage}`);
    oConfigFile.deployer.options.ui5.language = sLanguage;

    const sPackage: string = await new Promise((resolve, reject) => {
      const inputBox = window.createInputBox();
      inputBox.title = 'ui5-tools > Deployer > Create ui5-tools.json file > Package for the BSP';
      inputBox.step = 4;
      inputBox.totalSteps = 6;
      inputBox.placeholder = `ZPACKAGE`;
      inputBox.ignoreFocusOut = true;
      inputBox.onDidAccept(() => {
        resolve(inputBox.value);
        inputBox.hide();
      });
      inputBox.show();
    });
    if (!sPackage) {
      throw new Error(`No package configured`);
    }
    Log.logDeployer(`ui5-tools.json: Package ${sPackage}`);
    oConfigFile.deployer.options.ui5.package = sPackage;

    const sBspContainer: string = await new Promise((resolve, reject) => {
      const inputBox = window.createInputBox();
      inputBox.title = 'ui5-tools > Deployer > Create ui5-tools.json file > Package for the BSP (max 15 chars)';
      inputBox.step = 5;
      inputBox.totalSteps = 6;
      inputBox.placeholder = `ZBSPCONTAINER`;
      inputBox.ignoreFocusOut = true;
      inputBox.onDidChangeValue(() => {
        if (inputBox.value && inputBox.value.length > 15) {
          inputBox.value = inputBox.value.slice(0, 15);
        }
      });
      inputBox.onDidAccept(() => {
        resolve(inputBox.value);
        inputBox.hide();
      });
      inputBox.show();
    });
    if (!sBspContainer) {
      throw new Error(`No BSP container configured`);
    }
    Log.logDeployer(`ui5-tools.json: BSP Container ${sBspContainer}`);
    oConfigFile.deployer.options.ui5.bspcontainer = sBspContainer;

    const sBspContainerText: string = await new Promise((resolve, reject) => {
      const inputBox = window.createInputBox();
      inputBox.title = 'ui5-tools > Deployer > Create ui5-tools.json file > BSP Description';
      inputBox.step = 6;
      inputBox.totalSteps = 6;
      inputBox.placeholder = `The description of the BSP container`;
      inputBox.ignoreFocusOut = true;
      inputBox.onDidAccept(() => {
        resolve(inputBox.value);
        inputBox.hide();
      });
      inputBox.show();
    });
    if (!sBspContainerText) {
      throw new Error(`No BSP container text configured`);
    }
    Log.logDeployer(`ui5-tools.json: BSP Container Text ${sBspContainerText}`);
    oConfigFile.deployer.options.ui5.bspcontainer_text = sBspContainerText;

    oConfigFile.deployer.options.ui5.calc_appindex = true;

    await Utils.setUi5ToolsFile(ui5App, oConfigFile);
    Log.logDeployer(`ui5-tools.json: File created!`);

    return oConfigFile;
  },

  async getDeployOptions(ui5AppConfig: Ui5ToolsConfiguration): Promise<DeployOptions> {
    // const oDeployOptionsDefault = {
    //   conn: {
    //     server: undefined,
    //     client: undefined,
    //     useStrictSSL: undefined,
    //     proxy: '',
    //     customQueryParams: {},
    //   },
    //   auth: {
    //     user: '',
    //     pwd: '',
    //   },
    //   ui5: {
    //     language: '',
    //     transportno: '',
    //     package: '',
    //     bspcontainer: '',
    //     bspcontainer_text: '',
    //     create_transport: undefined,
    //     transport_text: '',
    //     transport_use_user_match: undefined,
    //     transport_use_locked: undefined,
    //     calc_appindex: undefined,
    //   },
    // };

    const oEnv = Utils.loadEnv();
    const oUserPassword = {
      auth: {
        user: oEnv.UI5TOOLS_DEPLOY_USER || '',
        pwd: oEnv.UI5TOOLS_DEPLOY_PASSWORD || '',
      },
    };

    const oDeployOptions = deepmerge.all<DeployOptions>([oUserPassword, ui5AppConfig?.deployer?.options]);
    return oDeployOptions;
  },

  async getUserPass(oDeployOptions: DeployOptions): Promise<void> {
    if (!oDeployOptions?.auth?.user || !oDeployOptions?.auth?.pwd) {
      const sUser: string = await new Promise((resolve, reject) => {
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
      oDeployOptions.auth.user = sUser;

      const sPwd: string = await new Promise((resolve, reject) => {
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
      oDeployOptions.auth.pwd = sPwd;
    }
  },
};

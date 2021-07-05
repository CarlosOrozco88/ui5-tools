import { workspace, window, RelativePattern, ProgressLocation, Progress, Uri, TextDocument } from 'vscode';
import ui5DeployerCore from 'ui5-nwabap-deployer-core';
import TransportManager from 'ui5-nwabap-deployer-core/lib/TransportManager';
import deepmerge from 'deepmerge';
import fs from 'fs';

import Builder from '../Builder/Builder';
import Utils from '../Utils/Utils';
import Config from '../Utils/Config';

const oLogger = Utils.newLogProviderDeployer();
const ODEPLOYSTATUS = {
  ERROR: 0,
  SKIPPED: 1,
  SUCCES: 2,
};

export default {
  async askProjectToDeploy() {
    let ui5App = undefined;
    try {
      Utils.logOutputDeployer(`Asking project to deploy`);
      let ui5Apps = await Utils.getAllUI5Apps();
      if (ui5Apps.length > 1) {
        let qpOptions = [];
        ui5Apps.forEach((app) => {
          qpOptions.push({
            label: app.folderName,
            description: app.namespace,
          });
        });
        // ask for a project

        let ui5ProjectToDeploy = await new Promise(async (resolve, reject) => {
          let ui5ProjectToDeployQp = await window.createQuickPick();
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
      await this.askCreateReuseTransport(ui5App);
    } catch (oError) {
      Utils.logOutputDeployer(oError.message, 'ERROR');
    }
  },

  async deployAllProjects() {
    Utils.logOutputDeployer(`Deploy all ui5 projects`);
    let ui5Apps = await Utils.getAllUI5Apps();
    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: `ui5-tools > Deploying all`,
        cancellable: true,
      },
      async (progress, token) => {
        let oOptions = {};
        let oResults = {
          [ODEPLOYSTATUS.SUCCESS]: 0,
          [ODEPLOYSTATUS.ERROR]: 0,
          [ODEPLOYSTATUS.SKIPPED]: 0,
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
            oOptions = await this.askCreateReuseTransport(ui5Apps[i], {
              deployWorkspace: true,
              transportno: oOptions?.transportno,
              globalDeploy: true,
            });
            oResults[oOptions.deployed]++;
          } catch (oError) {
            oResults[ODEPLOYSTATUS.ERROR]++;
            let sMessage = `Project ${ui5Apps[i].folderName} not deployed`;
            Utils.logOutputDeployer(sMessage, 'ERROR');
            window.showErrorMessage(sMessage);
          }
        }
        let sMessage = `Deploy finished with ${oResults[ODEPLOYSTATUS.SUCCESS]} projects deployed,
        ${oResults[ODEPLOYSTATUS.SKIPPED]} skipped and
        ${oResults[ODEPLOYSTATUS.ERROR]} not deployed`;
        Utils.logOutputDeployer(sMessage, 'SUCCESS');
        window.showInformationMessage(sMessage);
        return;
      }
    );
    return;
  },

  async askCreateReuseTransport(ui5App, oOptions = {}) {
    let oDeployOptions = {};
    try {
      oOptions.deployed = ODEPLOYSTATUS.ERROR;

      if (ui5App) {
        let ui5AppConfig = await Utils.getUi5ToolsFile(ui5App);

        if (oOptions.globalDeploy && ui5AppConfig?.deployer?.globalDeploy === false) {
          oOptions.deployed = ODEPLOYSTATUS.SKIPPED;
          return oOptions;
        }

        if (!ui5AppConfig) {
          ui5AppConfig = await this.createConfigFile(ui5App);
        }

        let oDeployOptionsFs = await this.getDeployOptions(ui5AppConfig);
        let sOption;

        if (oOptions.transportno) {
          Utils.logOutputDeployer(`Using transportno ${oOptions.transportno}...`);
          oDeployOptions = deepmerge(oDeployOptions, oDeployOptionsFs);
          sOption = oOptions.transportno;
        } else {
          Utils.logOutputDeployer(`Asking create or update transportno...`);

          let qpOptions = [
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

          let selTransportOption = await new Promise(async (resolve, reject) => {
            let selTransportOptionQp = await window.createQuickPick();
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

          oDeployOptions = deepmerge(oDeployOptions, oDeployOptionsFs);

          await this.getUserPass(oDeployOptions);
        }
        switch (sOption) {
          case undefined:
          case '':
            throw new Error('Deploy canceled');
            break;
          case 'Create':
            await this.createTransport(ui5App, oDeployOptions, oOptions);
            break;
          case 'Update':
            await this.updateTransport(ui5App, oDeployOptions);
            break;
          case 'Read':
            Utils.logOutputDeployer(`Using ui5tools.json file`);
            break;
          default:
            await this.updateTransport(ui5App, oDeployOptions, sOption);
            break;
        }
        oOptions.transportno = oDeployOptions.ui5.transportno;
        await this.deployProject(ui5App, oDeployOptions, oOptions);
        oOptions.deployed = ODEPLOYSTATUS.SUCCESS;
      }
    } catch (oError) {
      Utils.logOutputDeployer(oError.message, 'ERROR');
      window.showErrorMessage(oError.message);
      oOptions.deployed = ODEPLOYSTATUS.ERROR;
      throw oError;
    }
    return oOptions;
  },

  async createTransport(ui5App, oDeployOptions, oOptions = {}) {
    let sDate = new Date().toLocaleString();
    let sDefaultText = `${ui5App.folderName}: ${sDate}`;

    let transport_text = undefined;
    try {
      transport_text = await new Promise(async (resolve, reject) => {
        let inputBox = await window.createInputBox();
        inputBox.title = 'ui5-tools > Deployer > Create transport > Enter transport text';
        inputBox.placeholder = 'Enter transport text';
        inputBox.ignoreFocusOut = true;
        inputBox.onDidAccept(async () => {
          resolve(inputBox.value);
          inputBox.hide();
        });
        inputBox.show();
      });
    } catch (oError) {
      transport_text = undefined;
    }
    if (transport_text === undefined) {
      throw new Error('Create transport canceled');
    }
    if (!transport_text) {
      transport_text = sDefaultText;
    } else if (Config.deployer('autoPrefixBSP') && !oOptions.deployWorkspace) {
      transport_text = `${oDeployOptions.ui5.bspcontainer}: ${transport_text}`;
    }
    oDeployOptions.ui5.transport_text = transport_text;
    oDeployOptions.ui5.create_transport = false;
    oDeployOptions.ui5.transportno = '';
    oDeployOptions.ui5.transport_use_user_match = false;

    const oTransportManager = this.getTransportManager(oDeployOptions);
    try {
      let transportno = await new Promise((resolve, reject) => {
        oTransportManager.createTransport(
          oDeployOptions.ui5.package,
          oDeployOptions.ui5.transport_text,
          async function (oError, sTransportNo) {
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

  async updateTransport(ui5App, oDeployOptions, transportno) {
    if (!transportno) {
      try {
        transportno = await new Promise(async (resolve, reject) => {
          let inputBox = await window.createInputBox();
          inputBox.title = 'ui5-tools > Deployer > Update transport > Enter transport number';
          inputBox.placeholder = 'Enter the transport number';
          inputBox.ignoreFocusOut = true;
          inputBox.onDidAccept(async () => {
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

  getTransportManager(oDeployOptions) {
    return new TransportManager(oDeployOptions, oLogger);
  },

  async deployProject(ui5App, oParamOptions, oOptions = {}) {
    if (ui5App) {
      let folderName = ui5App.folderName;
      Utils.logOutputDeployer(`Deploying ${folderName}`);
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
            await Builder.build(ui5App, progress, 0.5);
            await this.deploy(ui5App, oParamOptions, progress, 0.5);

            let sMessage = `Project ${ui5App.folderName} deployed!`;
            Utils.logOutputDeployer(sMessage);

            if (!oOptions.globalDeploy) {
              window.showInformationMessage(sMessage);
            }
          } catch (oError) {
            throw oError;
          }
        }
      );
    }
  },

  async deploy(ui5App, oDeployOptions = {}, progress = undefined, multiplier = 1) {
    let sMessage = '';

    let ui5AppConfig = await Utils.getUi5ToolsFile(ui5App);
    let sType = ui5AppConfig?.deployer?.type || '';

    if (sType === 'Gateway') {
      // Authentication
      sMessage = 'Gateway destination found';
      progress?.report({ increment: 20 * multiplier, message: sMessage });
      Utils.logOutputDeployer(sMessage);

      this.autoSaveOrder(ui5App, oDeployOptions);

      let processReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      try {
        let patternFiles = new RelativePattern(ui5App.deployFsPath, `**/*`);
        let aProjectFiles = await workspace.findFiles(patternFiles);
        let aProjectResources = await Promise.all(
          aProjectFiles.map(async (file) => {
            return {
              path: file.fsPath.replace(ui5App.deployFsPath, '').split('\\').join('/'),
              content: fs.readFileSync(file.fsPath, { encoding: null }),
            };
          })
        );
        let iIncrement = 80;
        let iStep = iIncrement / aProjectResources.length;

        let oLoggerProgress = deepmerge(oLogger, {
          log: (sText) => {
            if (sText.indexOf('file ') === 0) {
              progress?.report({ increment: iStep * multiplier, message: sText });
            }
            oLogger.log(sText);
          },
        });

        if (oDeployOptions.conn.useStrictSSL === false && !Config.deployer('rejectUnauthorized')) {
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
      let sError = 'No configuration file found';
      progress?.report({ increment: 100 * multiplier, message: sError });
      throw new Error(sError);
    }
  },

  async autoSaveOrder(ui5App, oDeployOptions) {
    let bAutoSaveOrder = Config.deployer('autoSaveOrder');
    if (bAutoSaveOrder) {
      let ui5AppConfig = await Utils.getUi5ToolsFile(ui5App);
      if (ui5AppConfig.deployer?.type == 'Gateway' && typeof ui5AppConfig.deployer?.options?.ui5 === 'object') {
        ui5AppConfig.deployer.options.ui5.transportno = oDeployOptions.ui5.transportno;
      }
      await Utils.setUi5ToolsFile(ui5App, ui5AppConfig);
    }
  },

  async createConfigFile(ui5App) {
    Utils.logOutputDeployer(`Create ui5-tools.json file?`);
    let qpOptions = [
      {
        label: `Yes`,
      },
      {
        label: `No`,
      },
    ];

    let selTransportOption = await new Promise(async (resolve, reject) => {
      let selTransportOptionQp = await window.createQuickPick();
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
      Utils.logOutputDeployer(`Abort creation`);
      throw new Error(`File ui5tools.json not found for project ${ui5App.folderName}`);
    }
    Utils.logOutputDeployer(`Collecting data...`);

    let oConfigFile = {
      deployer: {
        type: 'Gateway',
        options: {
          conn: {},
          ui5: {},
        },
      },
    };

    let sServer = await new Promise(async (resolve, reject) => {
      let inputBox = await window.createInputBox();
      inputBox.title = 'ui5-tools > Deployer > Create ui5-tools.json file > Server Url';
      inputBox.step = 1;
      inputBox.totalSteps = 6;
      inputBox.placeholder = `protocol://host:port`;
      inputBox.ignoreFocusOut = true;
      inputBox.onDidAccept(async () => {
        resolve(inputBox.value);
        inputBox.hide();
      });
      inputBox.show();
    });
    if (!sServer) {
      throw new Error(`No server url found`);
    }
    Utils.logOutputDeployer(`ui5-tools.json: Server ${sServer}`);
    oConfigFile.deployer.options.conn.server = sServer;

    let sClient;
    try {
      sClient = await new Promise(async (resolve, reject) => {
        let inputBox = await window.createInputBox();
        inputBox.title = 'ui5-tools > Deployer > Create ui5-tools.json file > Client';
        inputBox.step = 2;
        inputBox.totalSteps = 6;
        inputBox.placeholder = 'Enter client number';
        inputBox.ignoreFocusOut = true;
        inputBox.onDidAccept(async () => {
          resolve(inputBox.value);
          inputBox.hide();
        });
        inputBox.show();
      });
    } catch (oError) {
      sClient = undefined;
    }
    if (sClient && !isNaN(Number(sClient))) {
      Utils.logOutputDeployer(`ui5-tools.json: Client ${sClient}`);
      oConfigFile.deployer.options.conn.client = Number(sClient);
    }

    let sLanguage = await new Promise(async (resolve, reject) => {
      let inputBox = await window.createInputBox();
      inputBox.title = 'ui5-tools > Deployer > Create ui5-tools.json file > Language';
      inputBox.step = 3;
      inputBox.totalSteps = 6;
      inputBox.placeholder = `EN`;
      inputBox.ignoreFocusOut = true;
      inputBox.onDidAccept(async () => {
        resolve(inputBox.value);
        inputBox.hide();
      });
      inputBox.show();
    });
    if (!sLanguage) {
      throw new Error(`No language configured`);
    }
    Utils.logOutputDeployer(`ui5-tools.json: Language ${sLanguage}`);
    oConfigFile.deployer.options.ui5.language = sLanguage;

    let sPackage = await new Promise(async (resolve, reject) => {
      let inputBox = await window.createInputBox();
      inputBox.title = 'ui5-tools > Deployer > Create ui5-tools.json file > Package for the BSP';
      inputBox.step = 4;
      inputBox.totalSteps = 6;
      inputBox.placeholder = `ZPACKAGE`;
      inputBox.ignoreFocusOut = true;
      inputBox.onDidAccept(async () => {
        resolve(inputBox.value);
        inputBox.hide();
      });
      inputBox.show();
    });
    if (!sPackage) {
      throw new Error(`No package configured`);
    }
    Utils.logOutputDeployer(`ui5-tools.json: Package ${sPackage}`);
    oConfigFile.deployer.options.ui5.package = sPackage;

    let sBspContainer = await new Promise(async (resolve, reject) => {
      let inputBox = await window.createInputBox();
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
      inputBox.onDidAccept(async () => {
        resolve(inputBox.value);
        inputBox.hide();
      });
      inputBox.show();
    });
    if (!sBspContainer) {
      throw new Error(`No BSP container configured`);
    }
    Utils.logOutputDeployer(`ui5-tools.json: BSP Container ${sBspContainer}`);
    oConfigFile.deployer.options.ui5.bspcontainer = sBspContainer;

    let sBspContainerText = await new Promise(async (resolve, reject) => {
      let inputBox = await window.createInputBox();
      inputBox.title = 'ui5-tools > Deployer > Create ui5-tools.json file > BSP Description';
      inputBox.step = 6;
      inputBox.totalSteps = 6;
      inputBox.placeholder = `The description of the BSP container`;
      inputBox.ignoreFocusOut = true;
      inputBox.onDidAccept(async () => {
        resolve(inputBox.value);
        inputBox.hide();
      });
      inputBox.show();
    });
    if (!sBspContainerText) {
      throw new Error(`No BSP container text configured`);
    }
    Utils.logOutputDeployer(`ui5-tools.json: BSP Container Text ${sBspContainerText}`);
    oConfigFile.deployer.options.ui5.bspcontainer_text = sBspContainerText;

    oConfigFile.deployer.options.ui5.calc_appindex = true;

    await Utils.setUi5ToolsFile(ui5App, oConfigFile);
    Utils.logOutputDeployer(`ui5-tools.json: File created!`);

    return oConfigFile;
  },

  async getDeployOptions(ui5AppConfig = {}) {
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

    let oDeployOptions = deepmerge.all([oUserPassword, ui5AppConfig?.deployer?.options]);
    return oDeployOptions;
  },

  async getUserPass(oDeployOptions) {
    if (!oDeployOptions?.auth?.user || !oDeployOptions?.auth?.pwd) {
      let sUser = await new Promise(async (resolve, reject) => {
        let inputBox = await window.createInputBox();
        inputBox.title = 'ui5-tools > Deployer > Server username';
        inputBox.step = 1;
        inputBox.totalSteps = 2;
        inputBox.placeholder = `Username`;
        inputBox.ignoreFocusOut = true;
        inputBox.onDidAccept(async () => {
          resolve(inputBox.value);
          inputBox.hide();
        });
        inputBox.show();
      });
      if (!sUser) {
        throw new Error(`No user configured`);
      }
      oDeployOptions.auth.user = sUser;

      let sPwd = await new Promise(async (resolve, reject) => {
        let inputBox = await window.createInputBox();
        inputBox.title = `ui5-tools > Deployer > Server password for ${sUser}`;
        inputBox.step = 2;
        inputBox.totalSteps = 2;
        inputBox.placeholder = `Password`;
        inputBox.password = true;
        inputBox.ignoreFocusOut = true;
        inputBox.onDidAccept(async () => {
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

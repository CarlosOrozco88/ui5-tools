import { workspace, window, RelativePattern, ProgressLocation, Progress, Uri, TextDocument } from 'vscode';
import ui5DeployerCore from 'ui5-nwabap-deployer-core';
import TransportManager from 'ui5-nwabap-deployer-core/lib/TransportManager';
import { ADTClient } from 'abap-adt-api';
import deepmerge from 'deepmerge';

import Builder from '../Builder/Builder';
import Utils from '../Utils/Utils';
import Config from '../Utils/Config';

const oLogger = Utils.newLogProviderDeployer();

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
        let ui5ProjectToDeploy = await window.showQuickPick(qpOptions, {
          placeHolder: 'Select UI5 project to deploy',
          canPickMany: false,
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
      Utils.logOutputDeployer(oError.message);
    }
  },

  async askCreateReuseTransport(ui5App) {
    let oDeployOptions = {};
    try {
      if (ui5App) {
        let ui5AppConfig = await Utils.getUi5ToolsFile(ui5App);
        if (!ui5AppConfig) {
          ui5AppConfig = await this.createConfigFile(ui5App);
        }
        let oDeployOptionsFs = await this.getDeployOptions(ui5AppConfig);
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

        if (oDeployOptionsFs.ui5.transportno) {
          qpOptions.unshift({
            label: `Update transportno ${oDeployOptionsFs.ui5.transportno}`,
            description: oDeployOptionsFs.ui5.transportno,
          });
        }

        let selTransportOption = await window.showQuickPick(qpOptions, {
          placeHolder: `Create or ${ui5AppConfig.folderName} project`,
          canPickMany: false,
        });

        oDeployOptions = deepmerge(oDeployOptions, oDeployOptionsFs);

        await this.getUserPass(oDeployOptions);

        switch (selTransportOption.description) {
          case '':
            throw new Error('Deploy canceled');
            break;
          case 'Create':
            await this.createTransport(ui5App, oDeployOptions);
            break;
          case 'Update':
            await this.updateTransport(ui5App, oDeployOptions);
            break;
          case 'Read':
            Utils.logOutputDeployer(`Using ui5tools.json file`);
            break;
          default:
            await this.updateTransport(ui5App, oDeployOptions, selTransportOption.description);
            break;
        }
        await this.deployProject(ui5App, oDeployOptions);
      }
    } catch (oError) {
      throw oError;
    }
  },

  async createTransport(ui5App, oDeployOptions) {
    let sDate = new Date().toLocaleString();
    let sDefaultText = `${ui5App.folderName}: ${sDate}`;

    let transport_text = await window.showInputBox({
      value: '',
      placeHolder: sDefaultText,
      prompt: `Enter transport text`,
      ignoreFocusOut: true,
    });
    if (transport_text === undefined) {
      throw new Error('Create transport canceled');
    }
    if (!transport_text) {
      transport_text = sDefaultText;
    } else if (Config.deployer('autoPrefixBSP')) {
      transport_text = `${ui5App.folderName}: ${transport_text}`;
    }
    oDeployOptions.ui5.transport_text = transport_text;
    oDeployOptions.ui5.create_transport = true;
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
      transportno = await window.showInputBox({
        value: '',
        placeHolder: '',
        prompt: 'Enter the transport number',
        ignoreFocusOut: true,
      });
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

  getAdtClient(oDeployOptions) {
    return new ADTClient(
      oDeployOptions.conn.server,
      oDeployOptions.auth.user,
      oDeployOptions.auth.pwd,
      oDeployOptions.conn.client,
      oDeployOptions.ui5.language
    );
  },

  async deployProject(ui5App, oParamOptions) {
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
            window.showInformationMessage(`Project ${ui5App.folderName} deployed!`);
          } catch (oError) {
            window.showErrorMessage(oError.message);
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

      try {
        let patternFiles = new RelativePattern(ui5App.distFsPath, `**/*`);
        let aProjectFiles = await workspace.findFiles(patternFiles);
        let aProjectResources = await Promise.all(
          aProjectFiles.map(async (file) => {
            return {
              path: file.fsPath.replace(ui5App.distFsPath, ''),
              content: await workspace.fs.readFile(Uri.file(file.fsPath)),
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

        await ui5DeployerCore.deployUI5toNWABAP(oDeployOptions, aProjectResources, oLoggerProgress);
      } catch (oError) {
        progress?.report({ increment: 100 * multiplier, message: oError.message });
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
    let selTransportOption = await window.showQuickPick(qpOptions, {
      placeHolder: `Project ${ui5App.folderName} does not have a ui5-tools.json file, create it now?`,
      canPickMany: false,
    });
    if (!selTransportOption || selTransportOption.label !== 'Yes') {
      Utils.logOutputDeployer(`Abort creation`);
      let oError = new Error(`File ui5tools.json not found for project ${ui5App.folderName}`);
      window.showErrorMessage(oError.message);
      throw oError;
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

    let sServer = await window.showInputBox({
      value: '',
      placeHolder: 'protocol://host:port',
      prompt: `Enter server url (Gateway)`,
      ignoreFocusOut: true,
    });
    if (!sServer) {
      let oError = new Error(`No server url found`);
      window.showErrorMessage(oError.message);
      throw oError;
    }
    Utils.logOutputDeployer(`ui5-tools.json: Server ${sServer}`);
    oConfigFile.deployer.options.conn.server = sServer;

    let sClient = await window.showInputBox({
      value: '',
      placeHolder: '',
      prompt: `Enter client (optional)`,
      ignoreFocusOut: true,
    });
    if (sClient && !isNaN(Number(sClient))) {
      Utils.logOutputDeployer(`ui5-tools.json: Client ${sClient}`);
      oConfigFile.deployer.options.conn.client = Number(sClient);
    }

    let sLanguage = await window.showInputBox({
      value: '',
      placeHolder: 'EN',
      prompt: `Language for deployment`,
      ignoreFocusOut: true,
    });
    if (!sLanguage) {
      let oError = new Error(`No language configured`);
      window.showErrorMessage(oError.message);
      throw oError;
    }
    Utils.logOutputDeployer(`ui5-tools.json: Language ${sLanguage}`);
    oConfigFile.deployer.options.ui5.language = sLanguage;

    let sPackage = await window.showInputBox({
      value: '',
      placeHolder: 'ZPACKAGE',
      prompt: `Development package for de BSP`,
      ignoreFocusOut: true,
    });
    if (!sPackage) {
      let oError = new Error(`No package configured`);
      window.showErrorMessage(oError.message);
      throw oError;
    }
    Utils.logOutputDeployer(`ui5-tools.json: Package ${sPackage}`);
    oConfigFile.deployer.options.ui5.package = sPackage;

    let sBspContainer = await window.showInputBox({
      value: '',
      placeHolder: 'ZBSPCONTAINER',
      prompt: `The name of the BSP container (restricted to 15 chars)`,
      ignoreFocusOut: true,
    });
    if (!sBspContainer) {
      let oError = new Error(`No BSP container configured`);
      window.showErrorMessage(oError.message);
      throw oError;
    }
    Utils.logOutputDeployer(`ui5-tools.json: BSP Container ${sBspContainer}`);
    oConfigFile.deployer.options.ui5.bspcontainer = sBspContainer;

    let sBspContainerText = await window.showInputBox({
      value: '',
      placeHolder: '',
      prompt: `The description of the BSP container`,
      ignoreFocusOut: true,
    });
    if (!sBspContainerText) {
      let oError = new Error(`No BSP container text configured`);
      window.showErrorMessage(oError.message);
      throw oError;
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

    Utils.loadEnv();
    const oUserPassword = {
      auth: {
        user: process.env.UI5TOOLS_DEPLOY_USER || '',
        pwd: process.env.UI5TOOLS_DEPLOY_PASSWORD || '',
      },
    };

    let oDeployOptions = deepmerge.all([oUserPassword, ui5AppConfig?.deployer?.options]);
    return oDeployOptions;
  },

  async getUserPass(oDeployOptions) {
    if (!oDeployOptions?.auth?.user) {
      let sUser = await window.showInputBox({
        value: '',
        placeHolder: 'Username',
        prompt: `Enter username`,
        ignoreFocusOut: true,
      });
      if (!sUser) {
        let oError = new Error(`No user configured`);
        window.showErrorMessage(oError.message);
        throw oError;
      }
      oDeployOptions.auth.user = sUser;
    }

    if (!oDeployOptions?.auth?.pwd) {
      let sPwd = await window.showInputBox({
        value: '',
        placeHolder: 'Password',
        prompt: `Enter password`,
        ignoreFocusOut: true,
        password: true,
      });
      if (!sPwd) {
        let oError = new Error(`No password configured`);
        window.showErrorMessage(oError.message);
        throw oError;
      }
      oDeployOptions.auth.pwd = sPwd;
    }
  },
};

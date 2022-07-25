import { workspace, window, RelativePattern, ProgressLocation, Progress, QuickPickItem } from 'vscode';
//@ts-ignore
import ui5DeployerCore from 'ui5-nwabap-deployer-core';
//@ts-ignore
import TransportManager from 'ui5-nwabap-deployer-core/lib/TransportManager';
import deepmerge from 'deepmerge';
import fs from 'fs';

import Log from '../Utils/LogVscode';
import Utils from '../Utils/ExtensionVscode';
import Config from '../Utils/ConfigVscode';
import { DeployMassive, DeployOptions, Level, DeployStatus, Ui5ToolsConfiguration } from '../Types/Types';
import Ui5Project from '../Project/Ui5Project';
import Finder from '../Project/Finder';

const oLogger = Log.newLogProviderDeployer();

export default {
  async askProjectToDeploy(): Promise<void> {
    let ui5Project: Ui5Project | undefined;
    try {
      Log.deployer(`Asking project to deploy`);
      const ui5Projects = await Finder.getAllUI5ProjectsArray();
      if (ui5Projects.length > 1) {
        const qpOptions: Array<QuickPickItem> = [];
        ui5Projects.forEach((app) => {
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
        ui5Project = ui5Projects.find((app) => {
          return app.namespace == ui5ProjectToDeploy.description;
        });
      } else if (ui5Projects.length == 1) {
        // only one project
        ui5Project = ui5Projects[0];
      }
    } catch (e) {
      ui5Project = undefined;
    }
    try {
      if (ui5Project) {
        await this.askCreateReuseTransport(ui5Project);
      }
    } catch (oError: any) {
      Log.deployer(oError.message, Level.ERROR);
    }
  },

  async deployAllProjects(): Promise<void> {
    Log.deployer(`Deploy all ui5 projects`);
    const ui5Projects = await Finder.getAllUI5ProjectsArray();
    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: `ui5-tools > Deploying all`,
        cancellable: true,
      },
      async (progress, token) => {
        const oMassiveOptions: DeployMassive = {
          deployWorkspace: true,
          transportno: '',
        };
        const oResults = {
          [DeployStatus.Success]: 0,
          [DeployStatus.Error]: 0,
          [DeployStatus.Skipped]: 0,
        };
        progress.report({ increment: 0 });
        for (let i = 0; i < ui5Projects.length; i++) {
          if (token.isCancellationRequested) {
            return;
          }
          progress.report({
            increment: 100 / ui5Projects.length,
            message: `${ui5Projects[i].folderName} (${i + 1}/${ui5Projects.length})`,
          });
          try {
            const deployed = await this.askCreateReuseTransport(ui5Projects[i], oMassiveOptions);
            oResults[deployed]++;
          } catch (oError) {
            oResults[DeployStatus.Error]++;
            const sMessage = Log.deployer(`Project ${ui5Projects[i].folderName} not deployed`, Level.ERROR);
            window.showErrorMessage(sMessage);
          }
        }
        const sMessage = Log.deployer(
          `Deploy finished with ${oResults[DeployStatus.Success]} projects deployed,
        ${oResults[DeployStatus.Skipped]} skipped and
        ${oResults[DeployStatus.Error]} not deployed`,
          Level.SUCCESS
        );
        window.showInformationMessage(sMessage);
      }
    );
  },

  async askCreateReuseTransport(ui5Project: Ui5Project, oMassiveOptions?: DeployMassive): Promise<DeployStatus> {
    let oDeployOptions: DeployOptions;
    try {
      if (ui5Project) {
        let ui5ProjectConfig = await ui5Project.getUi5ToolsFile();

        if (oMassiveOptions?.deployWorkspace && ui5ProjectConfig?.deployer?.globalDeploy === false) {
          return DeployStatus.Skipped;
        }

        if (!ui5ProjectConfig) {
          ui5ProjectConfig = await this.createConfigFile(ui5Project);
        }

        const oDeployOptionsFs = await this.getDeployOptions(ui5ProjectConfig);
        let sOption;

        if (oMassiveOptions?.transportno) {
          Log.deployer(`Using transportno ${oMassiveOptions.transportno}...`);
          oDeployOptions = deepmerge({}, oDeployOptionsFs);
          sOption = oMassiveOptions.transportno;
        } else {
          Log.deployer(`Asking create or update transportno...`);

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
            selTransportOptionQp.placeholder = `Create or update transport for ${ui5Project.folderName} project`;
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
            await this.createTransport(ui5Project, oDeployOptions, oMassiveOptions);
            break;
          case 'Update':
            await this.updateTransport(ui5Project, oDeployOptions);
            break;
          case 'Read':
            Log.deployer(`Using ui5tools.json file`);
            break;
          default:
            await this.updateTransport(ui5Project, oDeployOptions, sOption);
            break;
        }
        if (oMassiveOptions) {
          oMassiveOptions.transportno = String(oDeployOptions.ui5.transportno);
        }
        await this.deployProject(ui5Project, oDeployOptions, oMassiveOptions);
      }
    } catch (oError: any) {
      Log.deployer(oError.message, Level.ERROR);
      window.showErrorMessage(oError.message);
      throw oError;
    }
    return DeployStatus.Success;
  },

  async createTransport(ui5Project: Ui5Project, oDeployOptions: DeployOptions, oMassiveOptions?: DeployMassive) {
    const sDate = new Date().toLocaleString();
    const sDefaultText = `${ui5Project.folderName}: ${sDate}`;

    let transport_text: string;
    try {
      transport_text = await new Promise((resolve) => {
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

    const processReject = this.setUnautorized(oDeployOptions);
    const oTransportManager = this.getTransportManager(oDeployOptions);

    const transportno: string = await new Promise((resolve, reject) => {
      oTransportManager.createTransport(
        oDeployOptions.ui5.package,
        oDeployOptions.ui5.transport_text,
        async function (oError: Error, sTransportNo: string) {
          processReject.restore();
          if (oError) {
            reject(oError);
          }
          resolve(sTransportNo);
        }
      );
    });
    oDeployOptions.ui5.transportno = transportno;
  },

  async updateTransport(ui5Project: Ui5Project, oDeployOptions: DeployOptions, transportno?: string) {
    if (!transportno) {
      try {
        transportno = await new Promise((resolve) => {
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

  async deployProject(
    ui5Project: Ui5Project,
    oDeployOptions: DeployOptions,
    oMassiveOptions?: DeployMassive
  ): Promise<void> {
    if (ui5Project) {
      const folderName = ui5Project.folderName;
      Log.deployer(`Deploying ${folderName}`);
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

          await ui5Project.build({ progress, multiplier: 0.5 });
          await this.deploy({ ui5Project, oDeployOptions, progress, multiplier: 0.5 });

          const sMessage = Log.deployer(`Project ${ui5Project.folderName} deployed!`);

          if (!oMassiveOptions?.deployWorkspace) {
            window.showInformationMessage(sMessage);
          }
        }
      );
    }
  },

  async deploy({
    ui5Project,
    oDeployOptions,
    progress,
    multiplier = 1,
  }: {
    ui5Project: Ui5Project;
    oDeployOptions: DeployOptions;
    progress?: Progress<any>;
    multiplier: number;
  }) {
    let message = '';

    const ui5ProjectConfig = await ui5Project.getUi5ToolsFile();
    const sType = ui5ProjectConfig?.deployer?.type || '';

    if (sType === 'Gateway') {
      // Authentication
      message = Log.deployer('Gateway destination found');
      progress?.report({ increment: 20 * multiplier, message });

      this.autoSaveOrder(ui5Project, oDeployOptions);

      const processReject = this.setUnautorized(oDeployOptions);
      try {
        const patternFiles = new RelativePattern(ui5Project.fsPathDeploy, `**/*`);
        const aProjectFiles = await workspace.findFiles(patternFiles);
        const aProjectResources = await Promise.all(
          aProjectFiles.map(async (file) => {
            return {
              path: file.fsPath.replace(ui5Project.fsPathDeploy, '').split('\\').join('/'),
              content: fs.readFileSync(file.fsPath, { encoding: null }),
            };
          })
        );
        const iIncrement = 80;
        const iStep = iIncrement / aProjectResources.length;

        const oLoggerProgress = deepmerge(oLogger, {
          log: (sText: string) => {
            if (sText.indexOf('file ') === 0) {
              progress?.report({ increment: iStep * multiplier, message: 'Deploy in process...' });
            }
            oLogger.log(sText);
          },
        });

        await ui5DeployerCore.deployUI5toNWABAP(oDeployOptions, aProjectResources, oLoggerProgress);

        processReject.restore();
      } catch (oError: any) {
        progress?.report({ increment: 100 * multiplier, message: oError.message });
        processReject.restore();

        throw new Error(oError);
      }
    } else {
      const sError = 'No configuration file found';
      progress?.report({ increment: 100 * multiplier, message: sError });
      throw new Error(sError);
    }
  },

  async autoSaveOrder(ui5Project: Ui5Project, oDeployOptions: DeployOptions) {
    const bAutoSaveOrder = Config.deployer('autoSaveOrder');
    if (bAutoSaveOrder) {
      const ui5ProjectConfig = await ui5Project.getUi5ToolsFile();
      if (ui5ProjectConfig.deployer?.type == 'Gateway' && typeof ui5ProjectConfig.deployer?.options?.ui5 === 'object') {
        ui5ProjectConfig.deployer.options.ui5.transportno = oDeployOptions.ui5.transportno;
      }
      await ui5Project.setUi5ToolsFile(ui5ProjectConfig);
    }
  },

  async createConfigFile(ui5Project: Ui5Project) {
    Log.deployer(`Create ui5-tools.json file?`);
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
      selTransportOptionQp.placeholder = `Project ${ui5Project.folderName} does not have a ui5-tools.json file, create it now?`;
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
      Log.deployer(`Abort creation`);
      throw new Error(`File ui5tools.json not found for project ${ui5Project.folderName}`);
    }
    Log.deployer(`Collecting data...`);

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

    const sServer: string = await new Promise((resolve) => {
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
    Log.deployer(`ui5-tools.json: Server ${sServer}`);
    oConfigFile.deployer.options.conn.server = sServer;

    let sClient;
    try {
      sClient = await new Promise((resolve) => {
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
      Log.deployer(`ui5-tools.json: Client ${sClient}`);
      oConfigFile.deployer.options.conn.client = Number(sClient);
    }

    const sLanguage: string = await new Promise((resolve) => {
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
    Log.deployer(`ui5-tools.json: Language ${sLanguage}`);
    oConfigFile.deployer.options.ui5.language = sLanguage;

    const sPackage: string = await new Promise((resolve) => {
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
    Log.deployer(`ui5-tools.json: Package ${sPackage}`);
    oConfigFile.deployer.options.ui5.package = sPackage;

    const sBspContainer: string = await new Promise((resolve) => {
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
    Log.deployer(`ui5-tools.json: BSP Container ${sBspContainer}`);
    oConfigFile.deployer.options.ui5.bspcontainer = sBspContainer;

    const sBspContainerText: string = await new Promise((resolve) => {
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
    Log.deployer(`ui5-tools.json: BSP Container Text ${sBspContainerText}`);
    oConfigFile.deployer.options.ui5.bspcontainer_text = sBspContainerText;

    oConfigFile.deployer.options.ui5.calc_appindex = true;

    await ui5Project.setUi5ToolsFile(oConfigFile);
    Log.deployer(`ui5-tools.json: File created!`);

    return oConfigFile;
  },

  async getDeployOptions(ui5ProjectConfig: Ui5ToolsConfiguration): Promise<DeployOptions> {
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

    const oDeployOptions = deepmerge.all<DeployOptions>([oUserPassword, ui5ProjectConfig?.deployer?.options]);
    return oDeployOptions;
  },

  async getUserPass(oDeployOptions: DeployOptions): Promise<void> {
    if (!oDeployOptions?.auth?.user || !oDeployOptions?.auth?.pwd) {
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
      oDeployOptions.auth.user = sUser;

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
      oDeployOptions.auth.pwd = sPwd;
    }
  },

  setUnautorized(oDeployOptions: DeployOptions) {
    const originalReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    if (oDeployOptions.conn?.useStrictSSL === false && !Config.deployer('rejectUnauthorized')) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }
    return {
      restore: () => {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalReject;
      },
    };
  },
};

import { window, ProgressLocation, QuickPickItem } from 'vscode';

import Log from '../Utils/Log';
import Ui5Project from '../Project/Ui5Project';
import Finder from '../Project/Finder';

export default {
  async askProjectToGenerate(): Promise<void> {
    let ui5Project: Ui5Project | undefined;
    try {
      Log.builder(`Asking project to generate`);
      const allUi5Projects = await Finder.getAllUI5ProjectsArray();
      const ui5Projects = allUi5Projects.filter((ui5Project) => ui5Project.isGenerated());

      if (ui5Projects.length > 1) {
        const qpOptions: Array<QuickPickItem> = [];
        ui5Projects.forEach((app) => {
          qpOptions.push({
            label: app.folderName,
            description: app.namespace,
          });
        });
        // ask for a project
        const ui5ProjectToBuild: QuickPickItem = await new Promise(async (resolve, reject) => {
          const ui5ProjectToBuildQp = await window.createQuickPick();
          ui5ProjectToBuildQp.title = 'ui5-tools > Builder > Select UI5 project';
          ui5ProjectToBuildQp.items = qpOptions;
          ui5ProjectToBuildQp.placeholder = 'Select UI5 project to generate';
          ui5ProjectToBuildQp.canSelectMany = false;
          ui5ProjectToBuildQp.onDidAccept(async () => {
            if (ui5ProjectToBuildQp.selectedItems.length) {
              resolve(ui5ProjectToBuildQp.selectedItems[0]);
            } else {
              reject('No UI5 project selected');
            }
            ui5ProjectToBuildQp.hide();
          });
          ui5ProjectToBuildQp.show();
        });

        // fspath from selected project
        ui5Project = ui5Projects.find((app) => {
          return app.namespace == ui5ProjectToBuild.description;
        });
      } else if (ui5Projects.length == 1) {
        // only one project
        ui5Project = ui5Projects[0];
      }
    } catch (oError) {
      ui5Project = undefined;
      throw oError;
    }
    if (ui5Project) {
      await this.generateProject(ui5Project);
    }
  },

  async askProjectToBuild(): Promise<void> {
    let ui5Project: Ui5Project | undefined;
    try {
      Log.builder(`Asking project to build`);
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
        const ui5ProjectToBuild: QuickPickItem = await new Promise(async (resolve, reject) => {
          const ui5ProjectToBuildQp = await window.createQuickPick();
          ui5ProjectToBuildQp.title = 'ui5-tools > Builder > Select UI5 project';
          ui5ProjectToBuildQp.items = qpOptions;
          ui5ProjectToBuildQp.placeholder = 'Select UI5 project to build';
          ui5ProjectToBuildQp.canSelectMany = false;
          ui5ProjectToBuildQp.onDidAccept(async () => {
            if (ui5ProjectToBuildQp.selectedItems.length) {
              resolve(ui5ProjectToBuildQp.selectedItems[0]);
            } else {
              reject('No UI5 project selected');
            }
            ui5ProjectToBuildQp.hide();
          });
          ui5ProjectToBuildQp.show();
        });

        // fspath from selected project
        ui5Project = ui5Projects.find((app) => {
          return app.namespace == ui5ProjectToBuild.description;
        });
      } else if (ui5Projects.length == 1) {
        // only one project
        ui5Project = ui5Projects[0];
      }
    } catch (oError) {
      ui5Project = undefined;
      throw oError;
    }
    if (ui5Project) {
      await this.buildProject(ui5Project);
    }
  },

  /**
   * Build all workspace projects
   */
  async buildAllProjects(): Promise<void> {
    Log.builder(`Build all ui5 projects`);
    const ui5Projects = await Finder.getAllUI5ProjectsArray();
    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: `ui5-tools > Build all`,
        cancellable: true,
      },
      async (progress, token) => {
        progress.report({ increment: 0 });
        for (let i = 0; i < ui5Projects.length; i++) {
          const ui5Project = ui5Projects[i];
          if (token.isCancellationRequested) {
            return;
          }
          progress.report({
            increment: 100 / ui5Projects.length,
            message: `${ui5Project.folderName} (${i + 1}/${ui5Projects.length})`,
          });
          await ui5Project.build({ progress, multiplier: 0 });
          Log.builder(`Project ${ui5Project.folderName} builded!`);
        }

        const sMessage = Log.builder(`All projects builded!`);
        window.showInformationMessage(sMessage);
      }
    );
  },

  async buildProject(ui5Project: Ui5Project, bShowMessage = true): Promise<void> {
    const folderName = ui5Project.folderName;
    Log.builder(`Building project ${folderName}`);
    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: `ui5-tools > Build project ${folderName}`,
        cancellable: true,
      },
      async (progress, token) => {
        token.onCancellationRequested(() => {
          throw new Error('Build canceled');
        });

        try {
          await ui5Project.build({ progress });

          const sMessage = Log.builder(`Project ${ui5Project.folderName} builded!`);
          if (bShowMessage) {
            window.showInformationMessage(sMessage);
          }
        } catch (error: any) {
          throw new Error(error);
        }
      }
    );
  },

  async generateProject(ui5Project: Ui5Project, bShowMessage = true): Promise<void> {
    const folderName = ui5Project.folderName;
    Log.builder(`Generating project ${folderName}`);
    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: `ui5-tools > Generate project ${folderName}`,
        cancellable: true,
      },
      async (progress, token) => {
        token.onCancellationRequested(() => {
          throw new Error('Generate canceled');
        });

        try {
          await ui5Project.generate();

          const sMessage = Log.builder(`Project ${ui5Project.folderName} generated!`);
          if (bShowMessage) {
            window.showInformationMessage(sMessage);
          }
        } catch (error: any) {
          throw new Error(error);
        }
      }
    );
  },
};

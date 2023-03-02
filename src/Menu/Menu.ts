import { commands, Uri } from 'vscode';
import Finder from '../Project/Finder';
import Builder from '../Builder/Builder';
import Deployer from '../Deployer/Deployer';
import { Level } from '../Types/Types';
import Log from '../Utils/LogVscode';

export default {
  async build(oResource: Uri): Promise<void> {
    const ui5Projects = await Finder.getAllUI5ProjectsArray();
    const ui5Project = ui5Projects.find((app) => app.fsPathBase === oResource.fsPath);

    if (ui5Project) {
      try {
        await Builder.buildProject(ui5Project);
      } catch (oError: any) {
        Log.builder(oError.message, Level.ERROR);
      }
    }
  },

  async deploy(oResource: Uri, oOptions?: { skipBuild?: boolean }): Promise<void> {
    const ui5Projects = await Finder.getAllUI5ProjectsArray();
    const ui5Project = ui5Projects.find((app) => app.fsPathBase === oResource.fsPath);

    if (ui5Project) {
      try {
        await Deployer.askCreateReuseTransport(ui5Project, oOptions);
      } catch (oError: any) {
        Log.deployer(oError.message, Level.ERROR);
      }
    }
  },

  async generate(oResource: Uri): Promise<void> {
    const ui5Projects = await Finder.getAllUI5ProjectsArray();
    const ui5Project = ui5Projects.find((app) => app.fsPathBase === oResource.fsPath);

    if (ui5Project) {
      try {
        await Builder.generateProject(ui5Project);
      } catch (oError: any) {
        Log.builder(oError.message, Level.ERROR);
      }
    }
  },

  setContexts() {
    const ui5Projects = Array.from(Finder.ui5Projects.values());

    const aResourcesDirname = ui5Projects.map((app) => app.fsPathBase);
    commands.executeCommand('setContext', 'ui5-tools:resourcesPath', aResourcesDirname);

    const aGeneratedDirname = ui5Projects.filter((project) => project.isGenerated()).map((app) => app.fsPathBase);
    commands.executeCommand('setContext', 'ui5-tools:generatorPath', aGeneratedDirname);
  },
};

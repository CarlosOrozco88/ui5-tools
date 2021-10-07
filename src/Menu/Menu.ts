import { Uri } from 'vscode';
import Builder from '../Builder/Builder';
import Deployer from '../Deployer/Deployer';
import { Level } from '../Types/Types';
import Log from '../Utils/Log';
import Utils from '../Utils/Utils';

export default {
  async build(oResource: Uri): Promise<void> {
    const ui5Apps = await Utils.getAllUI5Apps();
    // fspath from selected project
    const ui5App = ui5Apps.find((app) => {
      return app.appResourceDirname == oResource.fsPath;
    });
    try {
      await Builder.buildProject(ui5App);
    } catch (oError: any) {
      Log.builder(oError.message, Level.ERROR);
    }
  },

  async deploy(oResource: Uri): Promise<void> {
    const ui5Apps = await Utils.getAllUI5Apps();
    // fspath from selected project
    const ui5App = ui5Apps.find((app) => {
      return app.appResourceDirname == oResource.fsPath;
    });
    if (ui5App) {
      try {
        await Deployer.askCreateReuseTransport(ui5App);
      } catch (oError: any) {
        Log.deployer(oError.message, Level.ERROR);
      }
    }
  },
};

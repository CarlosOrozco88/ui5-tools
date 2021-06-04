import Builder from '../Builder/Builder';
import Deployer from '../Deployer/Deployer';
import Utils from '../Utils/Utils';

export default {
  async build(oResource) {
    let ui5Apps = await Utils.getAllUI5Apps();
    // fspath from selected project
    let ui5App = ui5Apps.find((app) => {
      return app.appResourceDirname == oResource.fsPath;
    });
    try {
      await Builder.buildProject(ui5App);
    } catch (oError) {
      Utils.logOutputBuilder(oError.message, 'ERROR');
    }
  },

  async deploy(oResource) {
    let ui5Apps = await Utils.getAllUI5Apps();
    // fspath from selected project
    let ui5App = ui5Apps.find((app) => {
      return app.appResourceDirname == oResource.fsPath;
    });
    if (ui5App) {
      try {
        await Deployer.askCreateReuseTransport(ui5App);
      } catch (oError) {
        Utils.logOutputDeployer(oError.message, 'ERROR');
      }
    }
  },
};

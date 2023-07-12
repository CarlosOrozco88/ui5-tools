import { commands, ExtensionContext } from 'vscode';

// import { ProjectsView } from './ActivityBar/ProjectsView';

// Server
import Server from './Server/Server';
// Configurator
import OdataProvider from './Configurator/OdataProvider';
import Ui5Provider from './Configurator/Ui5Provider';
import ReplaceStrings from './Configurator/ReplaceStrings';
// Builder
import Builder from './Builder/Builder';
import Watcher from './Builder/Watcher';
// Deployer
import Deployer from './Deployer/Deployer';
// Importer
import Importer from './Importer/Importer';
// Menu
import Menu from './Menu/Menu';
// StatusBar
import StatusBar from './StatusBar/StatusBar';
// Utils
import Config from './Utils/ConfigVscode';
import Log from './Utils/LogVscode';
import Extension from './Utils/ExtensionVscode';
import Finder from './Project/Finder';

export async function activate(context: ExtensionContext): Promise<void> {
  Extension.setWorkspaceContext(context);

  // window.registerTreeDataProvider('ui5toolsprojects', ProjectsView);

  const { registerCommand } = commands;
  const { subscriptions } = context;

  subscriptions.push(
    registerCommand('ui5-tools.general.refreshProjects', async () => {
      const isServerStarted = Server.isStarted();
      await Server.stop();
      await Finder.getAllUI5Projects(true);
      if (isServerStarted) {
        await Server.start({ restarting: true });
      }
    })
  );

  // Configure commands
  subscriptions.push(registerCommand('ui5-tools.server.startDevelopment', () => Server.startDevelopment()));
  subscriptions.push(registerCommand('ui5-tools.server.startProduction', () => Server.startProduction()));
  subscriptions.push(
    registerCommand('ui5-tools.server.startBuildProduction', async () => {
      await Builder.buildAllProjects();
      Server.startProduction();
    })
  );
  subscriptions.push(registerCommand('ui5-tools.server.stop', () => Server.stopAll()));
  subscriptions.push(registerCommand('ui5-tools.server.restart', () => Server.restart()));
  subscriptions.push(registerCommand('ui5-tools.server.toggle', () => Server.toggle()));

  subscriptions.push(registerCommand('ui5-tools.builder.build', () => Builder.askProjectToBuild()));
  subscriptions.push(registerCommand('ui5-tools.builder.buildAll', () => Builder.buildAllProjects()));

  subscriptions.push(registerCommand('ui5-tools.deployer.deploy', () => Deployer.askProjectToDeploy()));
  subscriptions.push(
    registerCommand('ui5-tools.deployer.deployOnly', () => Deployer.askProjectToDeploy({ skipBuild: true }))
  );
  subscriptions.push(registerCommand('ui5-tools.deployer.deployMultiple', () => Deployer.deployMultipleProjects()));

  subscriptions.push(registerCommand('ui5-tools.menu.importer.import', () => Importer.askBSPToImport()));

  subscriptions.push(registerCommand('ui5-tools.configurator.odataProvider', () => OdataProvider.wizard()));
  subscriptions.push(registerCommand('ui5-tools.configurator.ui5Provider', () => Ui5Provider.wizard()));
  subscriptions.push(registerCommand('ui5-tools.configurator.replaceStrings', () => ReplaceStrings.wizard()));
  subscriptions.push(
    registerCommand('ui5-tools.configurator.uninstallRuntime', () => Ui5Provider.uninstallRuntimeWizard())
  );

  subscriptions.push(registerCommand('ui5-tools.menu.builder.build', (oResource) => Menu.build(oResource)));
  subscriptions.push(registerCommand('ui5-tools.menu.deployer.deploy', (oResource) => Menu.deploy(oResource)));
  subscriptions.push(
    registerCommand('ui5-tools.menu.deployer.deployOnly', (oResource) => Menu.deploy(oResource, { skipBuild: true }))
  );

  subscriptions.push(registerCommand('ui5-tools.general.showOutput', () => Log.showOutput()));

  await StatusBar.init(subscriptions);

  Watcher.start();

  if (Config.server('startOnLaunch')) {
    Log.general(`Start on launch`);
    Server.start();
  }
}

export function deactivate(): void {
  // deactivate
}

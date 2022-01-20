import { commands, ExtensionContext, window } from 'vscode';

// import { ProjectsView } from './ActivityBar/ProjectsView';

// Server
import Server from './Server/Server';
// Configurator
import OdataProvider from './Configurator/OdataProvider';
import Ui5Provider from './Configurator/Ui5Provider';
import ReplaceStrings from './Configurator/ReplaceStrings';
// Builder
import Builder from './Builder/Builder';
import LiveBuilder from './Builder/LiveBuilder';
// Deployer
import Deployer from './Deployer/Deployer';
// Menu
import Menu from './Menu/Menu';
// StatusBar
import StatusBar from './StatusBar/StatusBar';
// Utils
import Config from './Utils/Config';
import Log from './Utils/Log';
import Utils from './Utils/Utils';

export async function activate(context: ExtensionContext): Promise<void> {
  Utils.setWorkspaceContext(context);

  // window.registerTreeDataProvider('ui5toolsprojects', ProjectsView);

  const { registerCommand } = commands;
  const { subscriptions } = context;

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
  subscriptions.push(registerCommand('ui5-tools.deployer.deployAll', () => Deployer.deployAllProjects()));

  subscriptions.push(registerCommand('ui5-tools.configurator.odataProvider', () => OdataProvider.wizard()));
  subscriptions.push(registerCommand('ui5-tools.configurator.ui5Provider', () => Ui5Provider.wizard()));
  subscriptions.push(registerCommand('ui5-tools.configurator.replaceStrings', () => ReplaceStrings.wizard()));

  subscriptions.push(registerCommand('ui5-tools.menu.builder.build', (oResource) => Menu.build(oResource)));
  subscriptions.push(registerCommand('ui5-tools.menu.deployer.deploy', (oResource) => Menu.deploy(oResource)));

  subscriptions.push(registerCommand('ui5-tools.showOutput', () => Log.showOutput()));

  await StatusBar.init(subscriptions);

  LiveBuilder.attachWatch();

  if (Config.server('startOnLaunch')) {
    Log.general(`Start on launch`);
    Server.start();
  }
}

export function deactivate(): void {
  // deactivate
}

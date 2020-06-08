import { commands, workspace } from 'vscode';
import Server from './Server/Server';
import Configurator from './Configurator/Configurator';
import Builder from './Builder/Builder';
import StatusBar from './StatusBar/StatusBar';
import Utils from './Utils/Utils';

export function activate(context) {
  startExtension();

  StatusBar.init(context);
  if (Utils.getConfigurationServer('startOnLaunch')) {
    Server.start();
  }

  const { registerCommand } = commands;
  const { subscriptions } = context;

  subscriptions.push(registerCommand('ui5-tools.server.start', () => Server.start()));
  subscriptions.push(registerCommand('ui5-tools.server.stop', () => Server.stop()));
  subscriptions.push(registerCommand('ui5-tools.server.restart', () => Server.restart()));
  subscriptions.push(registerCommand('ui5-tools.server.toggle', () => Server.toggle()));

  subscriptions.push(registerCommand('ui5-tools.builder.build', () => Builder.build()));

  subscriptions.push(registerCommand('ui5-tools.configurator.odataProvider', () => Configurator.odataProvider()));
  subscriptions.push(registerCommand('ui5-tools.configurator.ui5Provider', () => Configurator.ui5Provider()));

  workspace.onDidSaveTextDocument((event) => Builder.compileLessAuto(event));

  workspace.onDidChangeConfiguration(() => startExtension());
  workspace.onDidChangeWorkspaceFolders(() => startExtension());
  workspace.onDidSaveTextDocument(({ fileName }) => {
    if (fileName.slice(-4) === '.env' || fileName.slice(-13) === 'manifest.json') {
      startExtension();
    }
  });
}

async function startExtension() {
  Server.restart();
}

export function deactivate() {}

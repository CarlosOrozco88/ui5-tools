import { commands, workspace } from 'vscode';
import Server from './Server/Server';
import Configurator from './Configurator/Configurator';
import Builder from './Builder/Builder';
import StatusBar from './StatusBar/StatusBar';
import Utils from './Utils/Utils';

import path from 'path';

export function activate(context) {
  StatusBar.init(context);
  if (Utils.getConfigurationServer('startOnLaunch')) {
    Server.start();
  }

  const { registerCommand } = commands;
  const { subscriptions } = context;

  // Configure commands
  subscriptions.push(registerCommand('ui5-tools.server.start', () => Server.start()));
  subscriptions.push(registerCommand('ui5-tools.server.stop', () => Server.stop()));
  subscriptions.push(registerCommand('ui5-tools.server.restart', () => Server.restart()));
  subscriptions.push(registerCommand('ui5-tools.server.toggle', () => Server.toggle()));

  subscriptions.push(registerCommand('ui5-tools.builder.build', () => Builder.askProjectToBuild()));

  subscriptions.push(registerCommand('ui5-tools.configurator.odataProvider', () => Configurator.odataProvider()));
  subscriptions.push(registerCommand('ui5-tools.configurator.ui5Provider', () => Configurator.ui5Provider()));

  // Configure listeners
  workspace.onDidChangeConfiguration((event) => onDidChangeConfiguration(event));
  workspace.onDidChangeWorkspaceFolders((event) => onDidChangeWorkspaceFolders(event));
  workspace.onDidSaveTextDocument((event) => onDidSaveTextDocument(event));
}

async function onDidChangeConfiguration(event) {
  Server.restart();
}
async function onDidChangeWorkspaceFolders(event) {
  Server.restart();
}

async function onDidSaveTextDocument(event) {
  let { fileName, languageId } = event;

  // Configure auto build less
  switch (languageId) {
    case 'less':
      Builder.compileLessAuto(event);
      break;
  }

  // Configure restart server
  let baseName = path.basename(fileName);
  switch (baseName) {
    case '.env':
    case 'manifest.json':
      Server.restart();
      break;
  }
}

export function deactivate() {}

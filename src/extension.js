import { commands } from 'vscode';
import Server from './Server';
import Configurator from './Configurator';
import Builder from './Builder';
import StatusBar from './StatusBar';
import Utils from './Utils';

export function activate(context) {
  const { registerCommand } = commands;
  const { subscriptions } = context;
  StatusBar.init(context);
  if (Utils.getConfigurationServer('startOnLaunch')) {
    Server.start();
  }

  subscriptions.push(registerCommand('ui5-tools.server.start', () => Server.start()));
  subscriptions.push(registerCommand('ui5-tools.server.stop', () => Server.stop()));
  subscriptions.push(registerCommand('ui5-tools.server.restart', () => Server.restart()));
  subscriptions.push(registerCommand('ui5-tools.server.toggle', () => Server.toggle()));

  subscriptions.push(registerCommand('ui5-tools.builder.build', () => Builder.build()));

  subscriptions.push(registerCommand('ui5-tools.configurator.odataProvider', () => Configurator.odataProvider()));
  subscriptions.push(registerCommand('ui5-tools.configurator.ui5Provider', () => Configurator.ui5Provider()));
}

export function deactivate() {}

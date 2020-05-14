const { commands } = require('vscode');
const { registerCommand } = commands;
const Server = require('./Server');
const Configurator = require('./Configurator');
const Builder = require('./Builder');
const StatusBar = require('./StatusBar');
const Utils = require('./Utils');

function activate(context) {
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
exports.activate = activate;

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};

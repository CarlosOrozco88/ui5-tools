const { commands } = require('vscode');
const Server = require('./Server');
const Builder = require('./Builder');
const StatusBar = require('./StatusBar');
const Utils = require('./Utils');

function activate(context) {
  StatusBar.init(context);
  if (Utils.getConfigurationServer('startOnLaunch')) {
    Server.start();
  }

  context.subscriptions.push(commands.registerCommand('ui5-tools.server.start', () => Server.start()));
  context.subscriptions.push(commands.registerCommand('ui5-tools.server.stop', () => Server.stop()));
  context.subscriptions.push(commands.registerCommand('ui5-tools.server.restart', () => Server.restart()));

  context.subscriptions.push(commands.registerCommand('ui5-tools.server.toggle', () => Server.toggle()));

  context.subscriptions.push(
    commands.registerCommand('ui5-tools.server.configureOdataProvider', () => Server.configureOdataProvider())
  );

  context.subscriptions.push(
    commands.registerCommand('ui5-tools.server.configureUI5Provider', () => Server.configureUI5Provider())
  );

  context.subscriptions.push(commands.registerCommand('ui5-tools.builder.build', () => Builder.build()));
}
exports.activate = activate;

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};

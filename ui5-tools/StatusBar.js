const { window, StatusBarAlignment } = require('vscode');
const Utils = require('./Utils');

let serverNavBar;
let errors = [];
let lastText = '';

function init({ subscriptions }) {
  serverNavBar = window.createStatusBarItem(StatusBarAlignment.Left, 100);
  serverNavBar.command = 'ui5-tools.server.toggle';
  subscriptions.push(serverNavBar);
  startText();
  serverNavBar.show();
}

function startText() {
  lastText = 'startText';
  let { serverName } = Utils.loadConfig();
  serverNavBar.text = `$(debug-start) Start ${serverName}`;
}

function stopText() {
  lastText = 'stopText';
  let errorText = getErrors();
  let { serverName, port } = Utils.loadConfig();
  serverNavBar.text = `$(broadcast)${errorText} ${serverName} live at port ${port}`;
}

function startingText() {
  lastText = 'startingText';
  let { serverName } = Utils.loadConfig();
  serverNavBar.text = `$(loading) Starting ${serverName}...`;
}

function stoppingText() {
  lastText = 'stoppingText';
  errors = [];
  let { serverName } = Utils.loadConfig();
  serverNavBar.text = `$(loading) Stopping ${serverName}...`;
}

function pushError(error) {
  if (error) {
    errors.push(error);
    if (this && this[lastText]) {
      this[lastText]();
    }
  }
}

function getErrors() {
  let errorText = ' ';
  if (errors.length) {
    errorText = ' $(alert)'; // + errors.join(', ');
  }
  return errorText;
}

module.exports = {
  init,
  startText,
  stopText,
  startingText,
  stoppingText,
  pushError,
};

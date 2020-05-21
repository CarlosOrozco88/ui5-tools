import { window, StatusBarAlignment } from 'vscode';
import Utils from './Utils';

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
  let { serverName } = Utils.getConfig();
  serverNavBar.text = `$(debug-start) Start ${serverName}`;
}

function stopText() {
  lastText = 'stopText';
  let errorText = getErrors();
  let { serverName, port } = Utils.getConfig();
  serverNavBar.text = `$(broadcast)${errorText} ${serverName} live at port ${port}`;
}

function startingText() {
  lastText = 'startingText';
  let { serverName } = Utils.getConfig();
  serverNavBar.text = `$(loading~spin) Starting ${serverName}...`;
}

function stoppingText() {
  lastText = 'stoppingText';
  errors = [];
  let { serverName } = Utils.getConfig();
  serverNavBar.text = `$(loading~spin) Stopping ${serverName}...`;
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

export default {
  init,
  startText,
  stopText,
  startingText,
  stoppingText,
  pushError,
};

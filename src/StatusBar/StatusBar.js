import { window, StatusBarAlignment } from 'vscode';
import Config from '../Utils/Config';
import Utils from '../Utils/Utils';
import Server from '../Server/Server';

export default {
  serverNavBar: undefined,

  init({ subscriptions }) {
    if (!this.serverNavBar) {
      this.serverNavBar = window.createStatusBarItem(StatusBarAlignment.Left, 100);
      this.serverNavBar.command = 'ui5-tools.server.toggle';
      subscriptions.push(this.serverNavBar);
      this.startText();
    }
    this.checkVisibility();
  },

  async checkVisibility() {
    let ui5Apps = await Utils.getAllUI5Apps();
    if (ui5Apps.length) {
      this.show();
    } else {
      this.hide();
    }
    return ui5Apps.length > 0;
  },

  show() {
    this.serverNavBar.show();
  },

  hide() {
    this.serverNavBar.hide();
  },

  setText(text) {
    this.serverNavBar.text = text
      .replace('<serverName>', Config.server('name'))
      .replace('<serverMode>', Server.serverMode);
  },

  startingText() {
    this.show();
    this.setText(`$(loading~spin) Starting <serverName>...`);
  },

  startText() {
    this.setText(`$(debug-start) Start <serverName> | <serverMode>`);
  },

  stoppingText() {
    this.setText(`$(loading~spin) Stopping <serverName>...`);
  },

  stopText(port) {
    this.setText(`$(broadcast) <serverName> live at port ${port} | <serverMode>`);
  },
};

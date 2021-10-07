import { window, StatusBarAlignment, StatusBarItem } from 'vscode';
import Config from '../Utils/Config';
import Utils from '../Utils/Utils';
import Log from '../Utils/Log';
import Server from '../Server/Server';

let serverNavBar: StatusBarItem;
export default {
  serverNavBar: undefined,

  async init(subscriptions: Array<any>) {
    if (!serverNavBar && subscriptions) {
      serverNavBar = window.createStatusBarItem(StatusBarAlignment.Left, 100);
      serverNavBar.command = 'ui5-tools.server.toggle';
      subscriptions.push(serverNavBar);
      this.startText();
      await this.checkVisibility();
    }
  },

  async checkVisibility(bRefresh = true) {
    const sOriginalText = serverNavBar.text;
    serverNavBar.text = `$(loading~spin) Exploring ui5 projects...`;
    this.show();
    const ui5Apps = await Utils.getAllUI5Apps(bRefresh);
    serverNavBar.text = sOriginalText;

    if (!ui5Apps.length) {
      this.hide();
    }
    return ui5Apps.length > 0;
  },

  show() {
    serverNavBar.show();
  },

  hide() {
    serverNavBar.hide();
  },

  setText(text: string) {
    const serverName = String(Config.server('name'));
    const serverMode = Server.getServerMode();
    serverNavBar.text = text.replace('<serverName>', serverName).replace('<serverMode>', serverMode);
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

  stopText(port: number) {
    this.setText(`$(broadcast) <serverName> live at port ${port} | <serverMode>`);
  },
};

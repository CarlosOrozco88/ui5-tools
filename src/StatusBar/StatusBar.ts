import { window, StatusBarAlignment, StatusBarItem } from 'vscode';
import Config from '../Utils/Config';
import Server from '../Server/Server';
import Finder from '../Project/Finder';
import Log from '../Utils/Log';

let serverNavBar: StatusBarItem;
export default {
  serverNavBar: undefined,

  async init(subscriptions: Array<any>) {
    if (!serverNavBar && subscriptions) {
      serverNavBar = window.createStatusBarItem(StatusBarAlignment.Left, 100);
      serverNavBar.command = 'ui5-tools.server.toggle';
      subscriptions.push(serverNavBar);
      this.startText();
      await this.checkVisibility(true);
    }
  },

  async checkVisibility(bRefresh: boolean) {
    const sOriginalText = serverNavBar.text;
    serverNavBar.text = `$(loading~spin) Exploring ui5 projects...`;
    this.show();
    const ui5Projects = await Finder.getAllUI5Projects(bRefresh);
    serverNavBar.text = sOriginalText;

    if (!ui5Projects.size) {
      this.hide();
    }
    return ui5Projects.size > 0;
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
    const textReplaced = text.replace('<serverName>', serverName).replace('<serverMode>', serverMode);
    serverNavBar.text = textReplaced;
    Log.server(textReplaced);
    return textReplaced;
  },

  startingText(message = '...') {
    this.show();
    return this.setText(`$(loading~spin) Starting <serverName>${message}`);
  },

  startText() {
    return this.setText(`$(debug-start) Start <serverName> | <serverMode>`);
  },

  stoppingText() {
    return this.setText(`$(loading~spin) Stopping <serverName>...`);
  },

  stopText(port: number) {
    return this.setText(`$(broadcast) <serverName> live at port ${port} | <serverMode>`);
  },
};

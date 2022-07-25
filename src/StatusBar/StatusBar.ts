import { window, StatusBarAlignment, StatusBarItem } from 'vscode';
import Config from '../Utils/ConfigVscode';
import Server from '../Server/Server';
import Finder from '../Project/Finder';

const serverNavBar = window.createStatusBarItem(StatusBarAlignment.Left, 100) as StatusBarItem;
serverNavBar.command = 'ui5-tools.server.toggle';

const StatusBar = {
  serverNavBar,
  text: '',

  async init(subscriptions: Array<any>) {
    if (subscriptions) {
      subscriptions.push(StatusBar.serverNavBar);
      StatusBar.startText();
      await StatusBar.checkVisibility(true);
    }
  },

  async checkVisibility(bRefresh: boolean) {
    const sOriginalText = StatusBar.serverNavBar.text;
    StatusBar.serverNavBar.text = `$(loading~spin) Exploring ui5 projects...`;
    StatusBar.show();
    const ui5Projects = await Finder.getAllUI5Projects(bRefresh);
    StatusBar.serverNavBar.text = sOriginalText;

    if (!ui5Projects.size) {
      StatusBar.hide();
    }
    return ui5Projects.size > 0;
  },

  show() {
    StatusBar.serverNavBar.show();
  },

  hide() {
    StatusBar.serverNavBar.hide();
  },

  setText(text: string, extraText = '') {
    const serverName = Config.server('name') as string;
    const serverMode = Server.getServerMode();
    const textReplaced = text.replace('<serverName>', serverName).replace('<serverMode>', serverMode);
    StatusBar.text = textReplaced;
    const textAdditional = extraText ? `: ${extraText}` : '';
    StatusBar.serverNavBar.text = textReplaced + textAdditional;
    return textReplaced;
  },

  setExtraText(extraText = '') {
    const textReplaced = StatusBar.setText(StatusBar.text, extraText);
    return textReplaced;
  },

  startingText(message = '...') {
    StatusBar.show();
    return StatusBar.setText(`$(loading~spin) Starting <serverName>${message}`);
  },

  startText() {
    return StatusBar.setText(`$(debug-start) Start <serverName> | <serverMode>`);
  },

  stoppingText() {
    return StatusBar.setText(`$(loading~spin) Stopping <serverName>...`);
  },

  stopText(port: number) {
    return StatusBar.setText(`$(broadcast) <serverName> live at port ${port} | <serverMode>`);
  },
};
export default StatusBar;

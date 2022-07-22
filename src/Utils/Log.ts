import { window } from 'vscode';

import { Log as LogType, Level, LogTools } from '../Types/Types';
import Utils from './Extension';

const ui5toolsOutput = window.createOutputChannel(`ui5-tools`);
const Log: LogTools = {
  showOutput(): void {
    ui5toolsOutput.show();
  },

  log(sPrev: string, sText: string, sLevel: Level = Level.LOG): string {
    const oDate = new Date();
    const sDate = oDate.toLocaleTimeString();
    const sLevelExpanded = sLevel + '       '.slice(0, 7 - sLevel.length);
    const rootPath = Utils.getWorkspaceRootPath();
    const sNewLine = `[${sLevelExpanded} - ${sDate}] ${sPrev}: ${sText}`.replace(rootPath, '');
    ui5toolsOutput.appendLine(sNewLine);
    console.log(sNewLine);
    return sText;
  },

  general(sText: string, sLevel?: Level): string {
    return Log.log(`General`, sText, sLevel);
  },

  configurator(sText: string, sLevel?: Level): string {
    return Log.log(`Configurator`, sText, sLevel);
  },

  builder(sText: string, sLevel?: Level): string {
    return Log.log(`Builder`, sText, sLevel);
  },

  deployer(sText: string, sLevel?: Level): string {
    return Log.log(`Deployer`, sText, sLevel);
  },

  server(sText: string, sLevel?: Level): string {
    return Log.log(`Server`, sText, sLevel);
  },

  proxy(sText: string, sLevel?: Level): string {
    return Log.log(`Server > Proxy`, sText, sLevel);
  },

  newLogProviderProxy(): LogType {
    return Log.newLogProvider(Log.proxy);
  },

  newLogProviderDeployer(): LogType {
    return Log.newLogProvider(Log.deployer);
  },

  newLogProvider(fnLogger = Log.general): LogType {
    return {
      log: (sMessage: string) => {
        return fnLogger(sMessage, Level.LOG);
      },
      logVerbose: () => {
        // console.log(oParam)
        return '';
      },
      debug: (sMessage: string) => {
        return fnLogger(sMessage, Level.DEBUG);
      },
      info: (sMessage: string) => {
        return fnLogger(sMessage, Level.INFO);
      },
      warn: (sMessage: string) => {
        return fnLogger(sMessage, Level.WARNING);
      },
      error: (sMessage: string) => {
        return fnLogger(sMessage, Level.ERROR);
      },
    };
  },
};

export default Log;

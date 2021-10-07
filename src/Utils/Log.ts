import { window } from 'vscode';

import { Log as LogType, Level } from '../Types/Types';

const ui5toolsOutput = window.createOutputChannel(`ui5-tools`);
const Log: Record<string, any> = {
  showOutput(): void {
    ui5toolsOutput.show();
  },

  log(sPrev: string, sText: string, sLevel: Level = Level.LOG): string {
    const oDate = new Date();
    const sDate = oDate.toLocaleTimeString();
    const sLevelExpanded = sLevel + '       '.slice(0, 7 - sLevel.length);
    const sNewLine = `[${sLevelExpanded} - ${sDate}] ${sPrev}: ${sText}`;
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
        fnLogger(sMessage, Level.LOG);
      },
      logVerbose: (sMessage: string) => {
        // console.log(oParam)
      },
      debug: (sMessage: string) => {
        fnLogger(sMessage, Level.DEBUG);
      },
      info: (sMessage: string) => {
        fnLogger(sMessage, Level.INFO);
      },
      warn: (sMessage: string) => {
        fnLogger(sMessage, Level.WARNING);
      },
      error: (sMessage: string) => {
        fnLogger(sMessage, Level.ERROR);
      },
    };
  },
};

export default Log;

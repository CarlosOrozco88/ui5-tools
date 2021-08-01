import { window } from 'vscode';

import { Log as LogType, Level } from '../Types/Types';

const ui5toolsOutput = window.createOutputChannel(`ui5-tools`);
class Log {
  showOutput(): void {
    ui5toolsOutput.show();
  }

  log(sText: string, sLevel: Level = Level.LOG): void {
    const oDate = new Date();
    const sDate = oDate.toLocaleTimeString();
    const sNewLine = `[${sLevel} ${sDate}] ${sText}`;
    ui5toolsOutput.appendLine(sNewLine);
    return console.log(sNewLine);
  }

  logGeneral(sText: string, sLevel?: Level): void {
    return this.log(`General: ${sText}`, sLevel);
  }

  logConfigurator(sText: string, sLevel?: Level): void {
    return this.log(`Configurator: ${sText}`, sLevel);
  }

  logBuilder(sText: string, sLevel?: Level): void {
    return this.log(`Builder: ${sText}`, sLevel);
  }

  logDeployer(sText: string, sLevel?: Level): void {
    return this.log(`Deployer: ${sText}`, sLevel);
  }

  logServer(sText: string, sLevel?: Level): void {
    return this.log(`Server: ${sText}`, sLevel);
  }

  logProxy(sText: string, sLevel?: Level): void {
    return this.log(`Server > Proxy: ${sText}`, sLevel);
  }

  logFont(sText: string, sLevel?: Level): void {
    return this.log(`Server > Font: ${sText}`, sLevel);
  }

  newLogProviderProxy(): LogType {
    return this.newLogProvider(this.logProxy);
  }

  newLogProviderDeployer(): LogType {
    return this.newLogProvider(this.logDeployer);
  }

  newLogProvider(fnLogger = this.logGeneral): LogType {
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
  }
}

export default new Log();

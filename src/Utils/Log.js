import { window } from 'vscode';

let ui5toolsOutput = window.createOutputChannel(`ui5-tools`);

const Log = {
  showOutput() {
    ui5toolsOutput.show();
  },

  log(sText, sLevel = 'LOG') {
    let oDate = new Date();
    let sDate = oDate.toLocaleTimeString();
    let sNewLine = `[${sLevel} ${sDate}] ${sText}`;
    ui5toolsOutput.appendLine(sNewLine);
    return console.log(sNewLine);
  },

  logGeneral(sText, sLevel) {
    return Log.log(`General: ${sText}`, sLevel);
  },

  logConfigurator(sText, sLevel) {
    return Log.log(`Configurator: ${sText}`, sLevel);
  },

  logBuilder(sText, sLevel) {
    return Log.log(`Builder: ${sText}`, sLevel);
  },

  logDeployer(sText, sLevel) {
    return Log.log(`Deployer: ${sText}`, sLevel);
  },

  logServer(sText, sLevel) {
    return Log.log(`Server: ${sText}`, sLevel);
  },

  logProxy(sText, sLevel) {
    return Log.log(`Server > Proxy: ${sText}`, sLevel);
  },

  logFont(sText, sLevel) {
    return Log.log(`Server > Font: ${sText}`, sLevel);
  },

  newLogProviderProxy() {
    return Log.newLogProvider(Log.logProxy);
  },

  newLogProviderDeployer() {
    return Log.newLogProvider(Log.logDeployer);
  },

  newLogProvider(fnLogger = Log.logGeneral) {
    return {
      log: (sMessage) => {
        fnLogger(sMessage, 'LOG');
      },
      logVerbose: (oParam) => {
        // console.log(oParam)
      },
      debug: (sMessage) => {
        fnLogger(sMessage, 'DEBUG');
      },
      info: (sMessage) => {
        fnLogger(sMessage, 'INFO');
      },
      warn: (sMessage) => {
        fnLogger(sMessage, 'WARNING');
      },
      error: (sMessage) => {
        fnLogger(sMessage, 'ERROR');
      },
    };
  },
};

export default Log;

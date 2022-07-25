import express from 'express';
import { Uri, workspace } from 'vscode';
import Ui5Provider from '../../../Configurator/Ui5Provider';
import { Level, ServerOptions } from '../../../Types/Types';
import Config from '../../../Utils/ConfigVscode';
import Log from '../../../Utils/LogVscode';
import Utils from '../../../Utils/ExtensionVscode';
import { noCache, removeCacheBusterString } from './Middlewares';

const Runtime = {
  async set({ serverApp }: ServerOptions) {
    const ui5Version = Config.general('ui5Version') as string;
    Log.server(`Loading SAPUI5 ${ui5Version} Runtime`);

    const runtimeFsPath = Utils.getRuntimeFsPath(true);

    try {
      const uri = Uri.file(runtimeFsPath);
      await workspace.fs.stat(uri);
    } catch (oError) {
      Log.server(`SAPUI5 ${ui5Version} Runtime not found. Starting download...`, Level.WARNING);
      await Runtime.downloadRuntime(ui5Version);
    }

    serverApp.use(
      ['/resources', '/**/resources'],
      removeCacheBusterString,
      noCache,
      express.static(runtimeFsPath, {
        maxAge: '0',
      })
    );
  },

  async downloadRuntime(ui5Version: string) {
    const versions = await Ui5Provider.getRuntimeVersions();
    const major = versions.find((v) => ui5Version.indexOf(v.version) === 0);
    if (!major) {
      const sMessage = Log.server(`Selected SAPUI5 version ${ui5Version} is not available`, Level.ERROR);
      throw new Error(sMessage);
    }
    const minor = major.patches.find((v) => ui5Version === v.version);
    if (!minor) {
      const sMessage = Log.server(`Selected SAPUI5 version ${ui5Version} is not available`, Level.ERROR);
      throw new Error(sMessage);
    }
    await Ui5Provider.downloadRuntime(minor);
  },
};
export default Runtime;

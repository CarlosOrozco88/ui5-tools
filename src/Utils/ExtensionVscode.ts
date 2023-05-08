import { workspace, Uri, extensions, ExtensionContext } from 'vscode';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

import Config from './ConfigVscode';
import { minimatch } from 'minimatch';

let extensionContext: ExtensionContext;
// import { ProjectsView } from '../ActivityBar/ProjectsView';

const Extension = {
  getWorkspaceRootPath(): string {
    let baseDirWorkspace = '';
    const workspaceFileUri = workspace.workspaceFile;
    if (workspaceFileUri) {
      baseDirWorkspace = path.dirname(workspaceFileUri.fsPath);
    } else {
      // only 1 workspace folder
      const workspaceFolders = workspace.workspaceFolders || [];
      baseDirWorkspace = workspaceFolders[0]?.uri?.fsPath || '';
    }
    return baseDirWorkspace;
  },

  getExtensionFsPath(): string {
    return extensions.getExtension('carlosorozcojimenez.ui5-tools')?.extensionUri?.fsPath || '';
  },

  getRuntimeFsPathBase(framework = 'sapui5') {
    const fsPath = path.join(this.getGlobalStorageFsPath(), framework, 'runtime');
    return fsPath;
  },

  getRuntimeFsPath(bAddResources = false, ui5Version?: string, framework = 'sapui5') {
    if (!ui5Version) {
      ui5Version = String(Config.general('ui5Version'));
    }
    const fsPathBase = Extension.getRuntimeFsPathBase(framework);
    const fsPath = path.join(fsPathBase, ui5Version || 'unknown', bAddResources ? 'resources' : '');
    return fsPath;
  },

  getSandboxFsPath(): string {
    return path.join(Extension.getExtensionFsPath(), 'static', 'scripts', 'sandbox.json');
  },

  loadEnv() {
    const baseDir = Extension.getWorkspaceRootPath();
    const oDotEnv = dotenv.config({
      path: path.join(baseDir, '.env'),
    });
    return oDotEnv.parsed || {};
  },

  getHttpsCert() {
    const ui5ToolsPath = Extension.getExtensionFsPath() || '';
    return {
      key: fs.readFileSync(path.join(ui5ToolsPath, 'static', 'cert', 'server.key')),
      cert: fs.readFileSync(path.join(ui5ToolsPath, 'static', 'cert', 'server.cert')),
    };
  },

  getFramework() {
    const resourcesProxy = String(Config.server('resourcesProxy'));
    let framework = '';
    if (resourcesProxy.indexOf('OpenUI5') >= 0) {
      framework = 'openui5';
    } else if (resourcesProxy.indexOf('SAPUI5') >= 0 || resourcesProxy === 'Gateway' || resourcesProxy === 'Runtime') {
      framework = 'sapui5';
    }
    return framework;
  },

  getUi5ToolsIndexFolder() {
    return 'ui5tools';
  },

  isLaunchpadMounted() {
    const resourcesProxy = String(Config.server('resourcesProxy'));
    return ['CDN SAPUI5', 'Gateway', 'Runtime'].includes(resourcesProxy);
  },

  setWorkspaceContext(context: ExtensionContext) {
    extensionContext = context;
  },

  getWorkspaceContext(): ExtensionContext {
    return extensionContext;
  },

  getGlobalStorageUri(): Uri {
    return this.getWorkspaceContext().globalStorageUri;
  },

  getGlobalStorageFsPath(): string {
    return this.getGlobalStorageUri().fsPath;
  },

  excluder(path: string, patterns: string[]) {
    let bFound = false;
    for (let i = 0; !bFound && i < patterns.length; i++) {
      const sExclude = patterns[i];
      bFound = minimatch(path, sExclude);
    }
    return bFound;
  },
};

export default Extension;

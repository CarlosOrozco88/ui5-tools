import express from 'express';
import { WorkspaceConfiguration } from 'vscode';

export interface ServerParameter {
  restarting?: boolean;
}

export interface ServerOptions {
  serverApp: express.Express;
  ui5Apps: Ui5Apps;
  bServeProduction: boolean;
  sServerMode: ServerMode;
  watch: boolean;
  protocol: Protocols;
  port: number;
  portLiveReload: number;
  timeout: number;
  baseDir: string;
  ui5ToolsPath: string;
  ui5ToolsIndex: string;
  isLaunchpadMounted: boolean;
  bCacheBuster: boolean;
  restarting: boolean;
  bBabelSourcesLive: boolean;
  sBabelSourcesExclude: string;
}

export type Ui5Apps = Array<Ui5App>;

export interface Ui5App {
  appFsPath: string;
  appConfigPath: string;
  appResourceDirname: string;
  appServerPath: string;
  type: string;
  isLibrary: boolean;
  srcFsPath: string;
  distFsPath: string;
  deployFsPath: string;
  manifest: Record<string, any>;
  folderName: string;
  namespace: string;
}

export interface AppOptions {
  ui5App: Ui5App;
  title: string;
  icon?: string;
}

export interface Log {
  log(sMessage: string): void;
  logVerbose(sMessage: string): void;
  debug(sMessage: string): void;
  info(sMessage: string): void;
  warn(sMessage: string): void;
  error(sMessage: string): void;
}

export enum ServerMode {
  PROD = 'PROD',
  DEV = 'DEV',
}
export enum Protocols {
  http = 'http',
  https = 'https',
}
export enum ServerStatus {
  STOPPED = 0,
  STARTING = 1,
  STARTED = 2,
  STOPPING = 3,
}
export enum Level {
  LOG = 'LOG',
  ERROR = 'ERROR',
  SUCCESS = 'SUCCESS',
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARNING = 'WARNING',
}
export interface BuildTasks {
  cleanFolder: boolean;
  copyFolder: boolean;
  replaceStrings: boolean;
  compileLess: boolean;
  babelifyJSFiles: boolean;
  compressFiles: boolean;
  createDebugFiles: boolean;
  cleanFiles: boolean;
  createPreload: boolean;
}

export interface DeployOptions {
  conn: {
    server: string;
    client: number;
    useStrictSSL?: boolean;
    proxy?: string;
    customQueryParams?: Record<string, string>;
  };
  auth: {
    user?: string;
    pwd?: string;
  };
  ui5: {
    language: string;
    transportno?: string;
    package: string;
    bspcontainer: string;
    bspcontainer_text?: string;
    create_transport?: boolean;
    transport_text?: string;
    transport_use_user_match?: boolean;
    transport_use_locked?: boolean;
    calc_appindex?: boolean;
  };
}

export interface DeployMassive {
  transportno?: string;
  deployWorkspace?: boolean;
}

export enum DeployStatus {
  Error = 0,
  Skipped = 1,
  Success = 2,
}

export interface Ui5ToolsConfiguration {
  deployer: {
    type: 'Gateway';
    globalDeploy?: boolean;
    options: DeployOptions;
  };
}

export interface Ui5ToolsData {
  readme: string;
  about: string;
  changelog: string;
  launchpad: boolean;
  links: Array<any>;
  contributors: Array<any>;
  docs: { aTree: Array<any>; oHashes: Record<string, any> };
  ui5Apps: {
    application: Array<any>;
    component: Array<any>;
    library: Array<any>;
    card: Array<any>;
  };
  config: WorkspaceConfiguration;
  compatVersion: string;
  showTree: boolean;
  theme: string;
}

export interface KeysValuesConfig {
  key: string;
  value: string;
  param?: string;
}

export type VersionsTree = Record<string, VersionTree>;

export interface VersionTree {
  version: string;
  patches: Array<VersionsItem>;
  installed: boolean;
}

export interface VersionsItem {
  version: string;
  size: string;
  url: string;
  oldVersion: boolean;
  installed: boolean;
}

export interface SandboxFile {
  files: Record<string, string>;
  versions: Record<string, string>;
  default: string;
}

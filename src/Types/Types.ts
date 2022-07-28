import express from 'express';
import { WorkspaceConfiguration } from 'vscode';
import Ui5Project from '../Project/Ui5Project';

export interface ServerParameter {
  restarting?: boolean;
}

export interface ServerOptions {
  serverApp: express.Express;
  ui5Projects: Ui5ProjectsArray;
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
  restarting: boolean;
}

export type Ui5Projects = Map<string, Ui5Project>;
export type Ui5ProjectsArray = Array<Ui5Project>;

export interface Ui5Properties {
  /** The manifest json */
  manifest: Record<string, any>;
  namespace: string;
  type: string;
  isLibrary: boolean;
  /** In order to get the correct project folder, to avoid getting the generated instead of src */
  priority: number;
  /** The actual path of the working folder that contains the manifest file */
  fsPathWorking: string;
  /** Actual folder name that contains the manifest.json (webapp, src, ...) */
  workingFolder: string;
  /**
   * Path that contains working folder. Here is where the code is modified by the user.
   * It is used in order to get proper menu in the project folder (build-deploy)
   */
  fsPathBase: string;
  /** Folder name of the project path base */
  folderName: string;
  /** Path where the ui5-tools.json config file should exsists */
  fsPathConfig: string;
  /** Path where the server serves the project */
  serverPath: string;
  /** Path that should contain the sources of the project */
  fsPathSource: string;
  /** Path that contains the auto-generated project (served content) */
  fsPathGenerated: string;
  /** Path that contains the build of the project */
  fsPathDist: string;
  /** Path that contains the deploy files */
  fsPathDeploy: string;
}

export interface AppOptions {
  ui5Project: Ui5Project;
  title: string;
  icon?: string;
}

export interface Log {
  log(sMessage: string): string;
  logVerbose(sMessage: string): string;
  debug(sMessage: string): string;
  info(sMessage: string): string;
  warn(sMessage: string): string;
  error(sMessage: string): string;
}
export interface LogTools {
  showOutput(): void;
  log(sPrev: string, sText: string, sLevel?: Level): string;
  general(sText: string, sLevel?: Level): string;
  configurator(sText: string, sLevel?: Level): string;
  builder(sText: string, sLevel?: Level): string;
  deployer(sText: string, sLevel?: Level): string;
  server(sText: string, sLevel?: Level): string;
  proxy(sText: string, sLevel?: Level): string;
  newLogProviderProxy(): Log;
  newLogProviderDeployer(): Log;
  newLogProvider(fnLogger?: (sText: string, sLevel?: Level) => string): Log;
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
  transpileTSFiles: boolean;
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
  method: string;
}

export enum DeployStatus {
  Error = 0,
  Success = 1,
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
  ui5Projects: {
    all: Array<Ui5Project>;
    application: Array<Ui5Project>;
    component: Array<Ui5Project>;
    library: Array<Ui5Project>;
    card: Array<Ui5Project>;
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

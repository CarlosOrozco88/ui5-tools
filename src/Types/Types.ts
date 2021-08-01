import express from 'express';

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
  manifest: Record<string, string>;
  folderName: string;
  namespace: string;
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

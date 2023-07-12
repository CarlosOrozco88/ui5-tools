import { workspace, RelativePattern, Uri } from 'vscode';
import path from 'path';

import Config from '../Utils/ConfigVscode';
import { Ui5Projects, Ui5ProjectsArray } from '../Types/Types';
import Ui5Project from './Ui5Project';
import Utils from '../Utils/ExtensionVscode';
import Projects from '../Server/Projects';
import Log from '../Utils/LogVscode';
import Menu from '../Menu/Menu';

const ui5Projects: Ui5Projects = new Map();
let getUi5ProjectssPromise: Promise<Ui5Projects>;

const Finder = {
  ui5Projects,

  async getAllUI5ProjectsArray(bRefresh?: boolean): Promise<Ui5ProjectsArray> {
    const ui5ProjectsMap = await this.getAllUI5Projects(bRefresh);
    return Array.from(ui5ProjectsMap.values());
  },

  async clearUi5Projects() {
    for (const ui5Project of ui5Projects.values()) {
      await ui5Project.close();
    }
    ui5Projects.clear();
  },

  async getAllUI5Projects(bRefresh = false): Promise<Ui5Projects> {
    if (!getUi5ProjectssPromise || bRefresh) {
      getUi5ProjectssPromise = new Promise(async (resolve) => {
        Log.general(`Exploring ui5 projects...`);
        await Finder.clearUi5Projects();

        const appFolder = Config.general('appFolder') as string;
        const libraryFolder = Config.general('libraryFolder') as string;

        let pathToLook = `**/{${appFolder},${libraryFolder}}`;
        const aExclude = ['node_modules', '.git'];
        if (!appFolder || !libraryFolder) {
          pathToLook = '**';
          const distFolder = Config.general('distFolder') as string;
          if (distFolder) {
            aExclude.push(`${distFolder}`);
          }
        }
        const pathToExclude = aExclude.join(',');

        const aWorkspacesResults = [];
        const workspaceFolders = workspace.workspaceFolders || [];
        for (const wsUri of workspaceFolders) {
          const aManifestList = await workspace.findFiles(
            new RelativePattern(wsUri, `${pathToLook}/manifest.json`),
            new RelativePattern(wsUri, `**/{${pathToExclude}}/`)
          );
          aWorkspacesResults.push(aManifestList);
        }
        const aWorkspacesList = await Promise.all(aWorkspacesResults);
        const aManifestsUri = await Finder.getManifestsUri(aWorkspacesList);
        await Finder.addManifests(aManifestsUri);

        Log.general(`${ui5Projects.size} ui5 projects found!`);

        Menu.setContexts();

        // ProjectsView.refresh();

        resolve(ui5Projects);
      });
    }
    return getUi5ProjectssPromise;
  },

  async getManifestsUri(aWorkspacesList: Uri[][]) {
    const mapUris: Map<string, Uri> = new Map();

    const libraryGenFolder = Config.general('libraryFolder') as string;
    const appGenFolder = Config.general('appFolder') as string;
    const distFolder = Config.general('distFolder') as string;

    const workspaceRoot = Utils.getWorkspaceRootPath();

    for (const aUris of aWorkspacesList) {
      for (const oUri of aUris) {
        const pathFromRoot = oUri.fsPath.replace(workspaceRoot, '');

        const appHash = pathFromRoot
          .split(`${path.sep}${libraryGenFolder}${path.sep}`)
          .join(path.sep)
          .split(`${path.sep}${appGenFolder}${path.sep}`)
          .join(path.sep)
          .split(`${path.sep}${distFolder}${path.sep}`)
          .join(path.sep);
        const existingUri = mapUris.get(appHash);

        if (!existingUri) {
          mapUris.set(appHash, oUri);
        }
      }
    }
    const aManifestsUris = Array.from(mapUris.values());

    return aManifestsUris;
  },

  async addManifests(aManifestsUri: Uri[] = []) {
    for (const oUri of aManifestsUri) {
      await Finder.addUi5Project(oUri.fsPath);
    }
  },

  async addUi5Project(manifestFsPath: string) {
    try {
      const manifest = await Ui5Project.readManifest(manifestFsPath);
      const isValidManifest = Ui5Project.isValidManifest(manifest);

      if (isValidManifest) {
        const ui5Project = new Ui5Project(manifestFsPath, manifest);

        const sameProject = ui5Projects.get(ui5Project.serverPath);
        if (sameProject) {
          await sameProject?.close();
          Projects.unserveProject(ui5Project);
        }
        ui5Projects.set(ui5Project.serverPath, ui5Project);
        return ui5Project;
      }
    } catch (error: any) {
      Log.general(error.message);
    }
  },

  async removeUi5ProjectManifest(manifestFsPath: string) {
    const ui5Project = await Finder.findUi5ProjectForWorkingFsPath(manifestFsPath);
    if (ui5Project) {
      await Finder.removeUi5Project(ui5Project);
      return true;
    }
    return false;
  },

  async removeUi5Project(ui5Project: Ui5Project) {
    Finder.ui5Projects.delete(ui5Project.serverPath);
    await ui5Project.close();
    Projects.unserveProject(ui5Project);
    Menu.setContexts();
  },

  fsPathToServerPath(fsPathBase: string) {
    const workspaceRootPath = Utils.getWorkspaceRootPath();
    const libraryFolder = Config.general('libraryFolder') as string;
    const distFolder = Config.general('distFolder') as string;
    const appFolder = Config.general('appFolder') as string;

    let serverPath = fsPathBase.replace(workspaceRootPath, '').split(path.sep).join('/');
    serverPath = serverPath
      .replace(`/${libraryFolder}/`, '/')
      .replace(`/${appFolder}/`, '/')
      .replace(`/${distFolder}/`, '/');
    return serverPath || '/';
  },

  async findUi5ProjectForWorkingFsPath(sFsFilePath: string) {
    const ui5Projects = await Finder.getAllUI5ProjectsArray();
    const oUi5Project = ui5Projects.find((ui5Project) => ui5Project.isFileInFsPathWorking(sFsFilePath));

    return oUi5Project;
  },

  async findUi5ProjectForFsPath(sFsFilePath: string) {
    const ui5Projects = await Finder.getAllUI5ProjectsArray();
    const oUi5Project = ui5Projects.find((ui5Project) => ui5Project.isFileInFsPath(sFsFilePath));

    return oUi5Project;
  },

  async findUi5ProjectForFolderName(folderName: string) {
    const ui5Projects = await Finder.getAllUI5ProjectsArray();
    const oUi5Project = ui5Projects.find((ui5Project) => ui5Project.isFolderName(folderName));

    return oUi5Project;
  },
};

export default Finder;

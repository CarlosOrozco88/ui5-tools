import { workspace, RelativePattern, Uri, commands } from 'vscode';
import path from 'path';

import Config from '../Utils/Config';
import { Ui5Projects, Ui5ProjectsArray } from '../Types/Types';
import Ui5Project from './Ui5Project';
import Utils from '../Utils/Extension';
import Projects from '../Server/Projects';
import Log from '../Utils/Log';
import Menu from '../Menu/Menu';

const ui5Projects: Ui5Projects = new Map();
let getUi5ProjectssPromise: Promise<Ui5Projects>;

const Finder = {
  ui5Projects,

  async getAllUI5ProjectsArray(bRefresh?: boolean): Promise<Ui5ProjectsArray> {
    const ui5ProjectsMap = await this.getAllUI5Projects(bRefresh);
    return Array.from(ui5ProjectsMap.values());
  },

  clearUi5Projects() {
    for (const ui5Project of ui5Projects.values()) {
      ui5Project.close();
    }
    ui5Projects.clear();
  },

  async getAllUI5Projects(bRefresh = false): Promise<Ui5Projects> {
    if (!getUi5ProjectssPromise || bRefresh) {
      getUi5ProjectssPromise = new Promise(async (resolve) => {
        Log.general(`Exploring ui5 projects...`);
        Finder.clearUi5Projects();

        const appFolder = Config.general('appFolder') as string;
        const libraryFolder = Config.general('libraryFolder') as string;
        const appSrcFolder = Config.general('appSrcFolder') as string;
        const librarySrcFolder = Config.general('librarySrcFolder') as string;
        const distFolder = Config.general('distFolder') as string;

        let pathToLook = `**/{${appFolder},${libraryFolder},${appSrcFolder},${librarySrcFolder}}`;
        const aExclude = ['node_modules', '.git'];
        if (!appFolder || !libraryFolder || !appSrcFolder || !librarySrcFolder) {
          pathToLook = '**';
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

        await Finder.addManifests(aWorkspacesList);

        for (const ui5Project of this.ui5Projects.values()) {
          await ui5Project.watch();
        }

        Log.general(`${ui5Projects.size} ui5 projects found!`);

        await Menu.setContexts();

        // ProjectsView.refresh();

        resolve(ui5Projects);
      });
    }
    return getUi5ProjectssPromise;
  },

  async addManifests(aWorkspacesList: Uri[][]) {
    for (const aManifests of aWorkspacesList) {
      for (const oManifest of aManifests) {
        const { fsPath } = oManifest;
        await Finder.addUi5Project(fsPath);
      }
    }
  },

  async addUi5Project(manifestFsPath: string) {
    try {
      const manifest = await Ui5Project.readManifest(manifestFsPath);
      const isValidManifest = Ui5Project.isValidManifest(manifest);

      if (isValidManifest) {
        const ui5Project = new Ui5Project(manifestFsPath, manifest);

        const sameProject = ui5Projects.get(ui5Project.serverPath);
        if (!sameProject || sameProject.priority < ui5Project.priority) {
          sameProject?.close();
          ui5Projects.set(ui5Project.serverPath, ui5Project);
          return ui5Project;
        }
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
    ui5Project.close();
    Projects.unserveProject(ui5Project);
    await Menu.setContexts();
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
};

export default Finder;

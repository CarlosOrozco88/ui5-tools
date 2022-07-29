import chokidar from 'chokidar';
import path from 'path';
import Menu from '../Menu/Menu';
import Finder from '../Project/Finder';
import LiveServer from '../Server/LiveServer';
import Projects from '../Server/Projects';
import StatusBar from '../StatusBar/StatusBar';
import Utils from '../Utils/ExtensionVscode';

let watchApps: chokidar.FSWatcher | undefined;
const awaiter: Record<string, ReturnType<typeof setTimeout>> = {};

export default {
  awaiter,
  watchApps,

  async close() {
    if (this.watchApps) {
      await this.watchApps.close();
      this.watchApps = undefined;
    }
  },

  async start(): Promise<void> {
    await this.close();

    const sWorkspaceRootPath = path.join(Utils.getWorkspaceRootPath());

    this.watchApps = chokidar.watch([sWorkspaceRootPath], {
      ignoreInitial: true,
      ignored: (sPath: string) => {
        const filename = path.basename(sPath);

        let bIgnore = filename.startsWith('.') || filename === 'node_modules';

        if (!bIgnore) {
          const ui5Projects = Array.from(Finder.ui5Projects.values());
          const ui5Project = ui5Projects.find(
            (ui5Project) => ui5Project.fsPathBase !== sPath && sPath.startsWith(ui5Project.fsPathBase)
          );
          bIgnore = !!ui5Project;
        }
        return bIgnore;
      },
      usePolling: false,
    });

    this.watchApps.on('add', (sFilePath) => this.fileAdded(sFilePath));
    this.watchApps.on('change', (sFilePath) => this.fileChanged(sFilePath));
    this.watchApps.on('unlink', (sFilePath) => this.fileDeleted(sFilePath));

    this.watchApps.on('unlinkDir', (sFilePath) => this.folderDeleted(sFilePath));
  },

  async fileAdded(sFilePath: string) {
    if (this.isManifest(sFilePath)) {
      const ui5Project = await Finder.addUi5Project(sFilePath);
      if (ui5Project) {
        await Projects.serveProject(ui5Project);
        await Menu.setContexts();

        await StatusBar.checkVisibility(false);
        LiveServer.refresh(sFilePath);
      }
    }
  },

  async fileChanged(sFilePath: string) {
    if (this.isManifest(sFilePath)) {
      const ui5Project = await Finder.findUi5ProjectForWorkingFsPath(sFilePath);
      if (!ui5Project) {
        this.fileAdded(sFilePath);
      }
    }
  },

  async fileDeleted(sFilePath: string) {
    if (this.isManifest(sFilePath)) {
      await Finder.removeUi5ProjectManifest(sFilePath);
      await StatusBar.checkVisibility(false);
      LiveServer.refresh(sFilePath);
    }
  },

  async folderDeleted(sFilePath: string) {
    const ui5Project = await Finder.findUi5ProjectForFsPath(sFilePath);
    if (ui5Project && ui5Project.fsPathBase === sFilePath) {
      await Finder.removeUi5Project(ui5Project);

      LiveServer.refresh(sFilePath);
    }
  },

  isManifest(sFilePath: string) {
    const filename = path.basename(sFilePath);
    return filename === 'manifest.json';
  },
};

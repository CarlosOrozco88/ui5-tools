import path from 'path';
import less from 'less';
//@ts-ignore
import lessOpenUI5 from 'less-openui5';

import { RelativePattern, Uri, workspace } from 'vscode';
import Log from '../../Utils/Log';
import Ui5Project from '../Ui5Project';

const lessOpenUI5Builder = new lessOpenUI5.Builder({});

/**
 * Cleans unneeded uri files
 */
const Less = {
  /**
   * Compile less from destPath
   */
  async build(ui5Project: Ui5Project, srcPath: string, destPath: string): Promise<void> {
    await Less.buildLibrary(ui5Project, srcPath, destPath);
    await Less.buildComponent(ui5Project, srcPath, destPath);
  },

  /**
   * Generate css for library
   */
  async buildLibrary(ui5Project: Ui5Project, srcPath: string, destPath: string) {
    const patternLessLibrary = new RelativePattern(srcPath, `**/library.source.less`);
    const lessFilesLibrary = await workspace.findFiles(patternLessLibrary);

    for (const lessfile of lessFilesLibrary) {
      Log.builder(`Compiling less theme from ${lessfile.fsPath}`);
      const output = await lessOpenUI5Builder.build({
        lessInputPath: lessfile.fsPath,
        library: {
          name: ui5Project.namespace,
        },
      });
      lessOpenUI5Builder.clearCache();

      const cFSPath = lessfile.fsPath.replace('library.source.less', '');

      const cFSPathLibrary = path.join(cFSPath, 'library.css').replace(srcPath, destPath);
      await workspace.fs.writeFile(Uri.file(cFSPathLibrary), Buffer.from(output.css));

      const cFSPathLibraryRTL = path.join(cFSPath, 'library-RTL.css').replace(srcPath, destPath);
      await workspace.fs.writeFile(Uri.file(cFSPathLibraryRTL), Buffer.from(output.cssRtl));

      const cFSPathLibraryParameters = path.join(cFSPath, 'library-parameters.json').replace(srcPath, destPath);
      await workspace.fs.writeFile(Uri.file(cFSPathLibraryParameters), Buffer.from(JSON.stringify(output.variables)));
    }
  },

  /**
   * Generate css for components
   */
  async buildComponent(ui5Project: Ui5Project, srcPath: string, destPath: string) {
    const patternLessComponent = new RelativePattern(srcPath, `**/{styles,${ui5Project.folderName}}.less`);
    const lessFilesComponent = await workspace.findFiles(patternLessComponent);

    for (const lessfile of lessFilesComponent) {
      Log.builder(`Compiling less file from ${lessfile.fsPath}`);
      const lessFile = await workspace.fs.readFile(Uri.file(lessfile.fsPath));
      const output = await less.render(lessFile.toString(), {
        filename: lessfile.fsPath,
      });

      const cFSPath = lessfile.fsPath.replace('.less', '.css').replace(srcPath, destPath);
      await workspace.fs.writeFile(Uri.file(cFSPath), Buffer.from(output.css));
    }
  },
};
export default Less;

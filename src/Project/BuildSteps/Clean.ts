import { RelativePattern, Uri, workspace } from 'vscode';
import Log from '../../Utils/LogVscode';

export default {
  /**
   * Deletes folder or file
   */
  async folder(fsPath: string): Promise<void> {
    if (fsPath) {
      const uriToDelete = Uri.file(fsPath);
      Log.builder(`Deleting folder ${fsPath}`);
      try {
        await workspace.fs.delete(uriToDelete, {
          recursive: true,
          useTrash: false,
        });
      } catch (error: any) {
        if (error.code !== 'FileNotFound') {
          throw new Error(error);
        }
      }
    }
  },

  async removeLess(folderPath: string): Promise<void> {
    try {
      Log.builder(`Clean files from ${folderPath}`);
      // delete .less
      const patternLess = new RelativePattern(folderPath, `**/*.less`);
      const lessFiles = await workspace.findFiles(patternLess);

      for (let i = 0; i < lessFiles.length; i++) {
        const uriLess = Uri.file(lessFiles[i].fsPath);
        await workspace.fs.delete(uriLess);
      }
    } catch (error: any) {
      throw new Error(error);
    }
  },
};

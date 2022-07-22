import { Uri, workspace } from 'vscode';
import Log from '../../Utils/Log';

export default {
  /**
   * Copies srcPath to destPath
   */
  async folder(srcPath: string, destPath: string): Promise<void> {
    const uriSrc = Uri.file(srcPath);
    const uriDest = Uri.file(destPath);
    Log.builder(`Copying folder from ${srcPath} to ${destPath}`);
    try {
      await workspace.fs.copy(uriSrc, uriDest, {
        overwrite: true,
      });
    } catch (error: any) {
      throw new Error(error);
    }
  },

  async file(srcPath: string, destPath: string): Promise<void> {
    const uriSrc = Uri.file(srcPath);
    const uriDest = Uri.file(destPath);
    Log.builder(`Copying file from ${srcPath} to ${destPath}`);
    try {
      await workspace.fs.copy(uriSrc, uriDest, {
        overwrite: true,
      });
    } catch (error: any) {
      throw new Error(error);
    }
  },
};

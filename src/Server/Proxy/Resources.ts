import { Uri, workspace } from 'vscode';

import Config from '../../Utils/ConfigVscode';
import Utils from '../../Utils/ExtensionVscode';
import { SandboxFile, ServerOptions } from '../../Types/Types';
import Gateway from './Resources/Gateway';
import CDN from './Resources/CDN';
import Runtime from './Resources/Runtime';

export default {
  async set(serverOptions: ServerOptions): Promise<void> {
    const resourcesProxy = String(Config.server('resourcesProxy'));

    const OPTIONS: Record<string, () => void> = {
      Gateway: () => {
        Gateway.set(serverOptions);
      },
      'CDN SAPUI5': () => {
        CDN.set(serverOptions);
      },
      'CDN OpenUI5': () => {
        CDN.set(serverOptions);
      },
      Runtime: async () => {
        await Runtime.set(serverOptions);
      },
    };

    await OPTIONS[resourcesProxy]?.();
  },

  async setTest({ serverApp }: ServerOptions): Promise<void> {
    const resourcesProxy = Config.server('resourcesProxy');

    const sandboxFsPath = Utils.getSandboxFsPath();
    const sandboxUri = Uri.file(sandboxFsPath);
    const sandboxFile = await workspace.fs.readFile(sandboxUri);
    const sandboxData: SandboxFile = JSON.parse(sandboxFile.toString());

    switch (resourcesProxy) {
      case 'Gateway':
      case 'CDN SAPUI5':
      case 'Runtime':
        serverApp.get('/flp/test-resources/sap/ushell/bootstrap/sandbox.js', async (req, res) => {
          const ui5Version = '' + Config.general('ui5Version');
          const hash = sandboxData.versions[ui5Version] || sandboxData.versions[sandboxData.default];
          const file = sandboxData.files[hash];
          res.send(file);
        });
        break;
      default:
        break;
    }
  },
};

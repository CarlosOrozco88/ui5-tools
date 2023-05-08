import { workspace, WorkspaceConfiguration } from 'vscode';

export default {
  getConfig(tool = ''): WorkspaceConfiguration {
    if (tool) {
      tool = '.' + tool;
    }
    return workspace.getConfiguration('ui5-tools' + tool);
  },

  property(property?: string, tool = ''): WorkspaceConfiguration | unknown {
    if (typeof property === 'string') {
      return this.getConfig(tool).get(property);
    } else {
      return this.getConfig(tool);
    }
  },

  general(property?: string): WorkspaceConfiguration | unknown {
    return this.property(property);
  },

  server(property?: string): WorkspaceConfiguration | unknown {
    return this.property(property, 'server');
  },

  importer(property?: string): WorkspaceConfiguration | unknown {
    return this.property(property, 'importer');
  },

  builder(property?: string): WorkspaceConfiguration | unknown {
    return this.property(property, 'builder');
  },

  deployer(property?: string): WorkspaceConfiguration | unknown {
    return this.property(property, 'deployer');
  },

  async getExcludedFiles() {
    const exclude = [
      ...Object.keys((await workspace.getConfiguration('search', null).get('exclude')) || {}),
      ...Object.keys((await workspace.getConfiguration('files', null).get('exclude')) || {}),
    ];
    return exclude;
  },
};

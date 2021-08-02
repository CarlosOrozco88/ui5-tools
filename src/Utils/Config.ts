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
      let value = this.getConfig(tool).get(property);
      return value;
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

  builder(property?: string): WorkspaceConfiguration | unknown {
    return this.property(property, 'builder');
  },

  deployer(property?: string): WorkspaceConfiguration | unknown {
    return this.property(property, 'deployer');
  },
};

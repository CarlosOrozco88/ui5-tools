import { workspace, WorkspaceConfiguration } from 'vscode';

export default {
  get(tool = ''): WorkspaceConfiguration {
    if (tool) {
      tool = '.' + tool;
    }
    return workspace.getConfiguration('ui5-tools' + tool);
  },

  property(property?: string, tool = ''): string | number | undefined | Array<any> | WorkspaceConfiguration {
    if (property) {
      return this.get(tool).get(property);
    }
    return this.get(tool);
  },

  general(property?: string): string | number | undefined | Array<any> | WorkspaceConfiguration {
    return this.property(property);
  },

  server(property?: string): string | number | undefined | Array<any> | WorkspaceConfiguration {
    return this.property(property, 'server');
  },

  builder(property?: string): string | number | undefined | Array<any> | WorkspaceConfiguration {
    return this.property(property, 'builder');
  },

  deployer(property?: string): string | number | undefined | Array<any> | WorkspaceConfiguration {
    return this.property(property, 'deployer');
  },
};

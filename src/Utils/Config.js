import { workspace } from 'vscode';

export default {
  get(tool = '') {
    if (tool) {
      tool = '.' + tool;
    }
    return workspace.getConfiguration('ui5-tools' + tool);
  },

  property(property, tool = '') {
    if (property) {
      return this.get(tool).get(property);
    }
    return this.get(tool);
  },

  general(property) {
    return this.property(property);
  },

  server(property) {
    return this.property(property, 'server');
  },

  builder(property) {
    return this.property(property, 'builder');
  },

  deployer(property) {
    return this.property(property, 'deployer');
  },
};

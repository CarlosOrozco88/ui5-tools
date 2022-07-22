import Config from './Config';

const Ui5 = {
  parseVersion(ui5Version: string) {
    let major = 0;
    let minor = 0;
    let patch = 0;
    const aVersionMatch = String(ui5Version).match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (aVersionMatch) {
      major = parseInt(aVersionMatch[1], 10);
      minor = parseInt(aVersionMatch[2], 10);
      patch = parseInt(aVersionMatch[3], 10);
    }
    return { major, minor, patch };
  },

  getOptionsVersion() {
    const ui5Version = '' + Config.general('ui5Version');
    const ui5toolsData = {
      compatVersion: 'edge', // for building
      showTree: false, // shows list or tree in docs folder
      theme: 'sap_bluecrystal', // theme to use in index server and flp
    };

    const { major, minor } = this.parseVersion(ui5Version);
    if (major && minor) {
      ui5toolsData.compatVersion = `${major}.${minor}`;
    }

    if (major === 1) {
      // sap.m.tree
      if (minor >= 42) {
        ui5toolsData.showTree = true;
      }

      // theme
      if (minor >= 96) {
        ui5toolsData.theme = 'sap_horizon';
      } else if (minor >= 65) {
        ui5toolsData.theme = 'sap_fiori_3';
      } else if (minor >= 44) {
        ui5toolsData.theme = 'sap_belize';
      }
    }
    return ui5toolsData;
  },
};

export default Ui5;

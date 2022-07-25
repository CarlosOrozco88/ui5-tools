import { parseUi5Version } from '../Utils/Ui5';
import Config from './ConfigVscode';

const Ui5 = {
  getOptionsVersion() {
    const ui5Version = '' + Config.general('ui5Version');
    const ui5toolsData = {
      compatVersion: 'edge', // for building
      showTree: false, // shows list or tree in docs folder
      theme: 'sap_bluecrystal', // theme to use in index server and flp
    };

    const { major, minor } = parseUi5Version(ui5Version);
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

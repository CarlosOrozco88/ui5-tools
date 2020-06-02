import { workspace, window, ConfigurationTarget } from 'vscode';
import path from 'path';
import fs from 'fs';
import Utils from '../Utils/Utils';
import rimraf from 'rimraf';
import preload from 'openui5-preload';
import terser from 'terser';
import { pd as prettyData } from 'pretty-data';
import less from 'less';
const xmlHtmlPrePattern = /<(?:\w+:)?pre>/;

async function build(projectPath = undefined) {
  if (!projectPath) {
    projectPath = await askProjectToBuild();
  }
  if (projectPath) {
    let config = Utils.getConfig();
    let { srcFolder, distFolder, debugSources, uglifySources } = config;
    if (!srcFolder || !distFolder || srcFolder == distFolder) {
      throw 'Invalid srcFolder or distFolder';
    }
    let { compatVersion } = Utils.getOptionsVersion();

    // clean folder
    rimraf.sync(path.join(projectPath, distFolder));

    copyRecursiveSync(
      path.join(projectPath, srcFolder),
      path.join(projectPath, distFolder),
      debugSources,
      uglifySources
    );

    let component = JSON.parse(fs.readFileSync(path.join(projectPath, srcFolder, 'manifest.json'), 'utf-8'));
    let namespace = component['sap.app'].id;
    let library = component['sap.app'].type == 'library';

    let ns = namespace.split('.').join('/');
    let cwd = path.join(projectPath, srcFolder);
    let dest = path.join(projectPath, distFolder);
    // preload
    preload({
      resources: {
        cwd,
        prefix: ns,
      },
      dest,
      compatVersion: compatVersion,
      compress: true,
      verbose: false,
      components: !library ? ns : false,
      libraries: library ? ns : false,
    });
  }
}

async function askProjectToBuild() {
  let project = undefined;
  try {
    let { foldersWithName } = Utils.getConfig();
    let qpOptions = [];
    foldersWithName.forEach((folder) => {
      qpOptions.push({
        description: folder.uri.fsPath != folder.name ? path.sep + folder.uri.fsPath.split(path.sep).pop() : '',
        label: folder.name,
      });
    });
    if (qpOptions.length > 1) {
      let ui5ProjectToBuild = await window.showQuickPick(qpOptions, {
        placeHolder: 'Select UI5 project to build',
        canPickMany: false,
      });
      project = foldersWithName.filter((folder) => {
        return folder.name == ui5ProjectToBuild.label;
      })[0].uri.fsPath;
    } else if (qpOptions.length == 1) {
      project = qpOptions[0].uri.fsPath;
    }
  } catch (e) {
    project = undefined;
  }
  return project;
}

function copyRecursiveSync(src, dest, debugSources = true, uglifySources = true) {
  let existsSrc = fs.existsSync(src);
  let stats = existsSrc && fs.statSync(src);
  let isDirectory = existsSrc && stats.isDirectory();
  if (isDirectory) {
    fs.mkdirSync(dest);
    fs.readdirSync(src).forEach(function (childItemName) {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName), debugSources, uglifySources);
    });
  } else {
    switch (path.extname(src)) {
      case '.js':
        let copyOriginal = true;
        if (uglifySources) {
          let code = fs.readFileSync(src, 'utf8');
          let minifiedFile = terser.minify(code);
          if (!minifiedFile.error) {
            copyOriginal = false;
            fs.writeFileSync(dest, minifiedFile.code);
          }
        }
        if (copyOriginal) {
          fs.copyFileSync(src, dest);
        }

        if (debugSources) {
          fs.copyFileSync(src, dest.replace('.js', '-dbg.js'));
        }
        break;
      case '.json':
        let json = fs.readFileSync(src, 'utf8');
        let jsonStringified = JSON.stringify(JSON.parse(json));
        fs.writeFileSync(dest, jsonStringified);
        break;
      case '.xml':
        let xml = fs.readFileSync(src, 'utf8');
        if (!xmlHtmlPrePattern.test(xml)) {
          xml = prettyData.xmlmin(xml, false);
        }
        fs.writeFileSync(dest, xml);
        break;
      case '.less':
        // do not copy
        break;
      default:
        fs.copyFileSync(src, dest);
        break;
    }
  }
}

function compileLess({ fileName }) {
  if (fileName && path.extname(fileName) === '.less') {
    let filename = path.basename(fileName).replace('.less', '');
    let { folders } = Utils.getConfig();
    if (filename === 'styles' || folders.includes(filename)) {
      console.log(fileName);
      less
        .render(fs.readFileSync(fileName, 'utf-8'), {
          filename: fileName,
        })
        .then(
          function (output) {
            fs.writeFileSync(fileName.replace('.less', '.css'), output.css);
          },
          function (error) {
            console.error(error);
            throw new Error(error);
          }
        );
    }
  }
}

export default {
  build,
  compileLess,
};

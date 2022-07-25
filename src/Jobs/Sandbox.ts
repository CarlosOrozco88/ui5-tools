import { createHash } from 'crypto';
import { minify, MinifyOutput } from 'terser';
import { SandboxFile } from '../Types/Types';
import Fetch from '../Utils/Fetch';
import { promises as fs } from 'fs';
import path from 'path';
import { getUi5Versions, getUrlForFramework, parseUi5Version } from '../Utils/Ui5';

async function downloadSandbox() {
  const baseUrl = getUrlForFramework('sapui5');
  const versions = await getUi5Versions('sapui5');
  const sandboxComplete: SandboxFile = {
    files: {},
    versions: {},
    default: '',
  };
  const sandboxFsPath = path.resolve(__dirname, '..', '..', 'static', 'scripts', 'sandbox.json');
  try {
    console.error('Reading actual sandbox file...');
    const sOldSandboxFile = await fs.readFile(sandboxFsPath, 'utf-8');
    const oldSandboxFile: SandboxFile = JSON.parse(sOldSandboxFile);
    console.log('Actual sandbox file found!');
    sandboxComplete.files = oldSandboxFile.files;
    sandboxComplete.versions = oldSandboxFile.versions;
  } catch (error) {
    console.error('No actual sandbox file found!');
  }

  for (let i = 0; i < versions.length; i++) {
    const majorV = versions[i];
    const lastMinor = majorV.patches[majorV.patches.length - 1];

    for (let j = 0; j < majorV.patches.length; j++) {
      const minorV = majorV.patches[j];

      if (!sandboxComplete.versions[minorV.label]) {
        const urlSandbox = `${baseUrl}/${minorV.label}/test-resources/sap/ushell/bootstrap/sandbox.js`;
        console.log(`Fetching sandbox file for ${minorV.label}...`);
        const fileString = await Fetch.file(urlSandbox);
        console.log(`Sandbox file fetched!`);
        const fileMinified: MinifyOutput = await minify(fileString, {
          compress: false,
        });
        const fileMinifiedString = fileMinified.code ?? '';
        const hash = createHash('sha256');
        hash.update(fileMinifiedString);
        const hex = hash.digest('hex');
        if (!sandboxComplete.files[hex]) {
          sandboxComplete.files[hex] = fileMinifiedString;
        }
        sandboxComplete.versions[minorV.label] = hex;
        if (!sandboxComplete.default) {
          sandboxComplete.default = minorV.label;
        }
      }
    }

    const oVersion = parseUi5Version(lastMinor?.label);
    const { major, minor, patch } = oVersion;
    let emptyVersions = [];
    for (let i = patch; i >= 0; i--) {
      const cVersion = `${major}.${minor}.${patch}`;
      if (!sandboxComplete.versions[cVersion]) {
        emptyVersions.push(cVersion);
      } else {
        emptyVersions.forEach((version) => {
          sandboxComplete.versions[version] = sandboxComplete.versions[cVersion];
        });
        emptyVersions = [];
      }
    }
  }
  console.log(`Saving sandbox file...`);
  const fileStringified = JSON.stringify(sandboxComplete, null, 2);

  await fs.writeFile(sandboxFsPath, Buffer.from(fileStringified), { encoding: 'utf8', flag: 'w' });
  console.log(`Sandbox file saved!`);
}

(async () => {
  await downloadSandbox();
})();

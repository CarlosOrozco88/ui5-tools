import { createHash } from 'crypto';
import { minify, MinifyOutput } from 'terser';
import { SandboxFile } from '../Types/Types';
import Fetch from '../Utils/Fetch';
import { promises as fs } from 'fs';
import path from 'path';
import { getUi5Versions, getUrlForFramework, parseUi5Version } from '../Utils/Ui5';

function versionToNum(version: string) {
  const { major, minor, patch } = parseUi5Version(version);
  return major * 1000000 + minor * 1000 + patch;
}

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
  let aVersionMap: Array<{ version: string; hex: string; versionN: number }> = [];

  for (const version in sandboxComplete.versions) {
    aVersionMap.push({
      version: version,
      hex: sandboxComplete.versions[version],
      versionN: versionToNum(version),
    });
  }
  for (let i = 0; i < versions.length; i++) {
    const majorV = versions[i];

    for (let j = 0; j < majorV.patches.length; j++) {
      const minorV = majorV.patches[j];

      if (!sandboxComplete.versions[minorV.label]) {
        const urlSandbox = `${baseUrl}/${minorV.label}/test-resources/sap/ushell/bootstrap/sandbox.js`;
        console.log(`Fetching sandbox file for ${minorV.label}...`);
        const fileString = await Fetch.file(urlSandbox);
        console.log(`Sandbox file fetched!`);
        const fileMinified: MinifyOutput = await minify(fileString, {
          compress: false,
          format: {
            comments: false,
          },
        });
        const fileMinifiedString = fileMinified.code ?? '';
        const hash = createHash('sha256');
        hash.update(fileMinifiedString);
        const hex = hash.digest('hex');
        if (!sandboxComplete.files[hex]) {
          sandboxComplete.files[hex] = fileMinifiedString;
        }
        sandboxComplete.versions[minorV.label] = hex;
        aVersionMap.push({
          version: minorV.label,
          hex: sandboxComplete.versions[minorV.label],
          versionN: versionToNum(minorV.label),
        });
      }
    }
    aVersionMap = aVersionMap.sort((v1, v2) => {
      if (v1.versionN > v2.versionN) return -1;
      if (v1.versionN < v2.versionN) return 1;
      return 0;
    });
    const allMinorVersion = aVersionMap.filter((version) => version.version.startsWith(majorV.label));
    const lastMinor = allMinorVersion.shift();

    if (lastMinor) {
      // const oVersion = parseUi5Version(lastMinor?.version);
      // const { major, minor, patch } = oVersion;
      // let emptyVersions = [];
      // for (let i = patch; i >= 0; i--) {
      //   const cVersion = `${major}.${minor}.${patch}`;
      //   if (!sandboxComplete.versions[cVersion]) {
      //     emptyVersions.push(cVersion);
      //   } else {
      //     emptyVersions.forEach((version) => {
      //       sandboxComplete.versions[version] = sandboxComplete.versions[cVersion];
      //       aVersionMap.push({
      //         version: version,
      //         hex: sandboxComplete.versions[cVersion],
      //         versionN: versionToNum(version),
      //       });
      //     });
      //     emptyVersions = [];
      //   }
      // }
      const { major, minor, patch } = parseUi5Version(lastMinor.version);
      let emptyVersions = [];
      for (let i = patch; i >= 0; i--) {
        const cVersion = `${major}.${minor}.${i}`;
        if (!sandboxComplete.versions[cVersion]) {
          emptyVersions.push(cVersion);
        } else {
          emptyVersions.forEach((version) => {
            sandboxComplete.versions[version] = sandboxComplete.versions[cVersion];

            aVersionMap.push({
              version: version,
              hex: sandboxComplete.versions[cVersion],
              versionN: versionToNum(version),
            });
          });
          emptyVersions = [];
        }
      }
    }
  }
  aVersionMap = aVersionMap.sort((v1, v2) => {
    if (v1.versionN > v2.versionN) return -1;
    if (v1.versionN < v2.versionN) return 1;
    return 0;
  });
  const oVersions = aVersionMap.reduce((acc: Record<string, string>, { version, hex }) => {
    acc[version] = hex;
    return acc;
  }, {});
  sandboxComplete.versions = oVersions;

  const [oLastVersion] = aVersionMap;
  sandboxComplete.default = oLastVersion.version;

  console.log(`Saving sandbox file...`);
  const fileStringified = JSON.stringify(sandboxComplete, null, 2);

  await fs.writeFile(sandboxFsPath, Buffer.from(fileStringified), { encoding: 'utf8', flag: 'w' });
  console.log(`Sandbox file saved!`);
}

(async () => {
  await downloadSandbox();
})();

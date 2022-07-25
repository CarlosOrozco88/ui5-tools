import Fetch from './Fetch';

export async function getUi5Versions(framework: string) {
  const versions: Array<any> = [];
  try {
    if (framework !== 'None') {
      const versionsValues = await Promise.all([getVersionOverview(framework), getNeoApp(framework)]);
      const mapVersions: Record<string, any> = {};
      versionsValues[0].versions.forEach((versionData: Record<string, any>) => {
        if (versionData.version.length > 1) {
          const cleanVersion = versionData.version.replace('.*', '');
          let description = versionData.eom ? versionData.eom : versionData.support;
          if (versionData.lts !== undefined) {
            description = versionData.lts ? versionData.eom : versionData.support + ' ' + versionData.eom;
          }
          const cVersion = {
            label: cleanVersion,
            description: description,
            patches: [],
          };
          mapVersions[cleanVersion] = cVersion;
          versions.push(cVersion);
        }
      });
      versionsValues[1].routes.forEach((versionData: Record<string, any>) => {
        if (versionData.path.length > 1) {
          const cleanVersion = versionData.path.replace('/', '');
          const cleanVersionArray = cleanVersion.split('.');
          cleanVersionArray.pop();
          const cleanVersionMaster = cleanVersionArray.join('.');
          if (mapVersions[cleanVersionMaster]) {
            mapVersions[cleanVersionMaster].patches.push({
              label: cleanVersion,
              description: mapVersions[cleanVersionMaster].description,
            });
          } else {
            const cVersion = {
              label: cleanVersionMaster,
              description: 'Out of Maintenance',
              patches: [
                {
                  label: cleanVersion,
                  description: 'Out of Maintenance',
                },
              ],
            };
            mapVersions[cleanVersionMaster] = cVersion;
            versions.push(cVersion);
          }
        }
      });
    }
  } catch (err: any) {
    throw new Error(err);
  }

  return versions;
}

export async function getVersionOverview(framework: string) {
  const baseUrl = getUrlForFramework(framework);

  const url = `${baseUrl}/versionoverview.json`;
  const fileString = await Fetch.file(url);
  return JSON.parse(fileString);
}

export async function getNeoApp(framework: string) {
  const baseUrl = getUrlForFramework(framework);

  const url = `${baseUrl}/neo-app.json`;
  const fileString = await Fetch.file(url);
  return JSON.parse(fileString);
}

export function parseUi5Version(ui5Version: string) {
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
}

export function getUrlForFramework(framework = 'openui5') {
  const URLS: Record<string, string> = {
    sapui5: 'https://ui5.sap.com',
    openui5: 'https://sdk.openui5.org',
  };
  return URLS[framework] ?? '';
}

export function getRuntimeUrl() {
  return 'https://tools.hana.ondemand.com/';
}

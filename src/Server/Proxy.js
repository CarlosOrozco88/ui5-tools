import { window } from 'vscode';
import { createProxyMiddleware } from 'http-proxy-middleware';
import http from 'http';
import https from 'https';
import apicache from 'apicache';

const onlyStatus200 = (req, res) => res.statusCode === 200;
const cacheResources = apicache.middleware('1 day', onlyStatus200);

import StatusBar from '../StatusBar/StatusBar';
import Utils from '../Utils/Utils';

// async function askUserPassword(gatewayUri, config, { resolv, reject }) {
//   try {
//     let inputUser = await window.showInputBox({
//       placeHolder: `Enter username for ${gatewayUri}`,
//       value: config.auth.gatewayUser,
//     });
//     let inputPassword = await window.showInputBox({
//       placeHolder: `Enter password for username ${inputUser} @ ${gatewayUri}`,
//       password: true,
//       value: config.auth.gatewayPassword,
//     });
//     if (inputUser && inputPassword) {
//       config.auth = {
//         gatewayUser: inputUser,
//         gatewayPassword: inputPassword,
//         authGateway: `${inputUser}:${inputPassword}`,
//       };
//       resolv(config.auth.authGateway);
//     } else {
//       resolv();
//     }
//   } catch (error) {
//     reject(error);
//   }
// }

// function checkGatewayProxy(config) {
//   return new Promise((resolv, reject) => {
//     let gatewayProxy = Utils.getConfigurationServer('gatewayProxy');
//     let resourcesProxy = Utils.getConfigurationServer('resourcesProxy');
//     let gatewayUri = Utils.getConfigurationServer('gatewayUri');
//     if ((gatewayProxy === 'Gateway' || resourcesProxy === 'Gateway') && gatewayUri) {
//       let httpModule;
//       if (gatewayUri.indexOf('https') >= 0) {
//         httpModule = https;
//       } else {
//         httpModule = http;
//       }
//       httpModule
//         .get(
//           `${gatewayUri}resources/sap-ui-core.js`,
//           {
//             timeout: 1000 * 5,
//           },
//           ({ statusCode }) => {
//             if (statusCode === 503) {
//               askUserPassword(gatewayUri, config, { resolv, reject });
//             } else if (statusCode === 404) {
//               reject(`sap-ui-core.js not found in ${gatewayUri}`);
//             } else {
//               resolv();
//             }
//           }
//         )
//         .on('error', (error) => {
//           reject(error);
//         });
//     } else {
//       resolv();
//     }
//   });
// }

function resetCache() {
  if (cacheResources.clear) {
    cacheResources.clear();
  }
}

async function setGatewayProxy(expressApp, { auth }) {
  let proxy, targetUri;
  let gatewayProxy = Utils.getConfigurationServer('gatewayProxy');
  // Options: Gateway, None
  switch (gatewayProxy) {
    case 'Gateway':
      targetUri = Utils.getConfigurationServer('gatewayUri');

      proxy = createProxyMiddleware({
        pathRewrite: {},
        target: targetUri,
        secure: targetUri.indexOf('https') == 0,
        changeOrigin: true,
        logLevel: 'debug',
      });
      expressApp.use('/sap', proxy);
      break;

    default:
      break;
  }
  return;
}

async function setResourcesProxy(expressApp, config) {
  let { folders = [], auth } = config;
  let targetUri, pathRewrite, pathRoute, proxy;
  let resourcesProxy = Utils.getConfigurationServer('resourcesProxy');

  // Options: Gateway, CDN SAPUI5, CDN OpenUI5, None
  switch (resourcesProxy) {
    case 'Gateway':
      targetUri = Utils.getConfigurationServer('gatewayUri');

      if (targetUri) {
        pathRoute = '/sap/bc/ui5_ui5/sap';

        pathRewrite = {};
        folders.forEach((folder) => {
          pathRewrite[`^/${folder}/`] = `${pathRoute}/${folder}/`;
        });
        pathRewrite[`^/`] = `/sap/public/bc/ui5_ui5/1/`;

        proxy = createProxyMiddleware({
          pathRewrite,
          target: targetUri,
          secure: targetUri.indexOf('https') == 0,
          changeOrigin: true,
          logLevel: 'debug',
        });

        expressApp.use('/**/resources/**', cacheResources, proxy);
        expressApp.use('/resources/**', cacheResources, proxy);
      }
      break;

    case 'CDN SAPUI5':
    case 'CDN OpenUI5':
      let framework = resourcesProxy.indexOf('SAPUI5') >= 0 ? 'sapui5' : 'openui5';
      let ui5Version = Utils.getConfigurationGeneral('ui5Version');

      targetUri = `https://${framework}.hana.ondemand.com/${ui5Version}/`;

      if (ui5Version) {
        pathRoute = '/';

        pathRewrite = {};
        folders.forEach((folder) => {
          pathRewrite[`^/${folder}/`] = pathRoute;
        });

        proxy = createProxyMiddleware({
          pathRewrite,
          target: targetUri,
          secure: targetUri.indexOf('https') == 0,
          changeOrigin: true,
          logLevel: 'debug',
        });

        expressApp.use('/**/resources/**', cacheResources, proxy);
        expressApp.use('/resources/**', cacheResources, proxy);
      }

      https
        .get(
          `${targetUri}resources/sap-ui-core.js`,
          {
            timeout: 1000 * 5, // 3 seconds to check if ui5 is available
          },
          ({ statusCode }) => {
            if (statusCode !== 200) {
              let error = `Error: Unable to get sap-ui-core.js, framework ${framework} does not have ${ui5Version} available at CDN.`;
              StatusBar.pushError(error);
              window.showErrorMessage(error);
            }
          }
        )
        .on('error', (e) => {
          let error = `Error: Unable to get sap-ui-core.js, framework ${framework} does not have ${ui5Version} available at CDN.`;
          StatusBar.pushError(error);
          window.showErrorMessage(error);
        });

    default:
      break;
  }
  return;
}

export default {
  setGatewayProxy,
  setResourcesProxy,
  // checkGatewayProxy,
  resetCache,
};

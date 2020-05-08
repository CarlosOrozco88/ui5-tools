const { window } = require('vscode');
const express = require('express');
const httpsModule = require('https');
const path = require('path');
const fs = require('fs');
const { createProxyMiddleware } = require('http-proxy-middleware');
const Utils = require('./Utils');
const StatusBar = require('./StatusBar');

async function setProxys(app) {
  await getGatewayProxy(app);
  await getResourcesProxy(app);
  await getErrorsMiddleware(app);
}

async function getGatewayProxy(app) {
  let proxyArr = [],
    proxy;
  let gatewayProxy = Utils.getConfigurationServer('gatewayProxy');
  // Options: Gateway, None
  switch (gatewayProxy) {
    case 'Gateway':
      proxy = createProxyMiddleware('/sap', {
        pathRewrite: {},
        target: Utils.getConfigurationServer('gatewayUri'),
        secure: true,
        changeOrigin: true,
        logLevel: 'silent',
      });
      app.use(proxy);
      proxyArr = [proxy];
      break;

    default:
      proxyArr = [];
      break;
  }
  return proxyArr;
}

function getResourcesProxy(app) {
  return new Promise((resolv, reject) => {
    let proxy, targetUri, pathRoute, pathRewrite, error;
    let resourcesProxy = Utils.getConfigurationServer('resourcesProxy');
    let { folders } = Utils.loadConfig();

    // Options: Gateway, CDN SAPUI5, CDN OpenUI5, None
    switch (resourcesProxy) {
      case 'Gateway':
        targetUri = Utils.getConfigurationServer('gatewayUri');
        pathRoute = '/sap/bc/ui5_ui5/sap';

        pathRewrite = {
          '^/': `${pathRoute}/`,
        };

        proxy = createProxyMiddleware('/**/resources/**', {
          pathRewrite,
          target: targetUri,
          secure: false,
          changeOrigin: true,
          logLevel: 'silent',
        });

        app.use(proxy);
        break;

      case 'CDN SAPUI5':
      case 'CDN OpenUI5':
        let framework = resourcesProxy.indexOf('SAPUI5') >= 0 ? 'sapui5' : 'openui5';
        let ui5Version = Utils.getConfigurationServer('ui5Version');

        targetUri = `https://${framework}.hana.ondemand.com/${ui5Version}/`;
        pathRoute = '/';

        httpsModule
          .get(`${targetUri}resources/sap-ui-core.js`, ({ statusCode }) => {
            if (statusCode !== 200) {
              error = `Error: Unable to get sap-ui-core.js, framework ${framework} does not have ${ui5Version} available at CDN.`;
              StatusBar.pushError(error);
              window.showErrorMessage(error);
            }
          })
          .on('error', (e) => {
            error = `Error: Unable to get sap-ui-core.js, framework ${framework} does not have ${ui5Version} available at CDN.`;
            StatusBar.pushError(error);
            window.showErrorMessage(error);
          });

        pathRewrite = {};
        folders.forEach((folder) => {
          pathRewrite[`^/${folder}/`] = pathRoute;
        });

        proxy = createProxyMiddleware('/**/resources/**', {
          pathRewrite,
          target: targetUri,
          secure: true,
          changeOrigin: true,
          logLevel: 'silent',
        });

        app.use(proxy);

      default:
        break;
    }
    resolv(proxy);
  });
}

async function getErrorsMiddleware(app) {
  app.use(function (req, res) {
    res.status(404).send(Utils.get404());
  });
}

module.exports = {
  setProxys,
};

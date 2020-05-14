# ui5-tools Extension

VSCode extension for ui5 developers.

## Features

#### Server

For local development, with configurable proxy to odata service (Gateway) and proxy to resources (Gateway, CDN SAPUI5, CDN OpenUI5), ui5 version is configurable also.

#### Build

Component-preload.js, checking ui5 version configured for correct build. Also creates dbg files, uglify, etc.

#### Deployer

TBD

#### Tester tools

TBD

## Settings

#### General Settings

- `ui5-tools.srcFolder`: source folder in your app | default: `webapp`
- `ui5-tools.distFolder`: source folder in your app | default: `webapp`
- `ui5-tools.ui5Version`: SAPUI5 Library version for CDN proxy in server and build correct preload files | default: `1.71.16`

#### Server Settings

- `ui5-tools.server.name`: server name | default: `UI5 Server`
- `ui5-tools.server.serveFolder`: folder to serve, references to general settings `ui5-tools.srcFolder` and `ui5-tools.distFolder` | default: `Source Folder`
- `ui5-tools.server.port`: set custom port number of UI5 Server | default: `3000`
- `ui5-tools.server.startOnLaunch`: start server at launch vscode | default: `false`
- `ui5-tools.server.openBrowser`: open browser al launch server | default: `true`
- `ui5-tools.server.watch`: activate live reload | default: `true`
- `ui5-tools.server.watchExtensions`: extensions to listen for live reload | default: `css,js,json,xml,html,properties`
- `ui5-tools.server.protocol`: dhould use http or https | default: `http`
- `ui5-tools.server.gatewayProxy`: proxy all odata calls to a gateway (proxy all url begining with /sap) | default: `None`
- `ui5-tools.server.gatewayUri`: your gateway or web dispatcher url (example: http://srvaspgwd.com:8080/)
- `ui5-tools.server.resourcesProxy`: proxy all odata calls to a gateway, cdn or local folder (proxy all url begining with /resources) | default: `CDN OpenUI5`

#### Builder Settings

- `ui5-tools.builder.debugSources`: create debug js files when building | default: `true`
- `ui5-tools.builder.uglifySources`: uglify Component-preload.js and all js files when building | default: `true`

#### Deployer Settings

- TBD

#### Tester Settings

- TBD

## Commands

#### Server Commands

- `ui5-tools.server.start`: start server
- `ui5-tools.server.stop`: stop server
- `ui5-tools.server.restart`: restart server

#### Configurator Commands

- `ui5-tools.configurator.odataProvider`: configure odata provider
- `ui5-tools.configurator.ui5Provider`: configure ui5 provider

#### Builder Commands

- `ui5-tools.builder.build`: build ui5 project

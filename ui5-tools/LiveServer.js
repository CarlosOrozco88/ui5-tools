const liveReload = require('livereload');
const connectLiveReload = require('connect-livereload');

let liveServer;

function watch(app, { foldersRoot, foldersRootMap, portLiveReload }) {
  liveServer = liveReload.createServer({
    extraExts: 'xml,json,properties',
    watchDirs: foldersRoot,
    app: app,
    port: portLiveReload,
  });
  liveServer.watch(foldersRoot);

  app.use(
    connectLiveReload({
      ignore: [],
      port: portLiveReload,
    })
  );
}

function get() {
  return liveServer;
}

module.exports = {
  watch,
  get,
};

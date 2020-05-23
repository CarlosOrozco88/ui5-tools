function getHTML(config) {
  let indexPage = `
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        <link
          rel="stylesheet"
          href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.0/css/bootstrap.min.css"
          integrity="sha384-9aIt2nRpC12Uk9gS9baDl411NQApFmC26EwAOH8WgZl5MYYxFfc+NcPb1dKGj7Sk"
          crossorigin="anonymous"
        />
        <title>${config.serverName}</title>
        <style>
          li {
            padding: 0.5rem;
            background-color: antiquewhite;
            margin: 0.25rem;
          }
          li a {
          }
        </style>
      </head>
      <body class="d-flex flex-column h-100">
        <header>
          <nav class="navbar navbar-light bg-light">
            <a class="navbar-brand mb-0 h1" href="#">${config.serverName} | Workspace</a>
          </nav>
        </header>
        <main role="main" class="flex-shrink-0">
          <div class="container">
            ${getReadme(config)}
            ${getApps(config)}
            ${getDocs(config)}
            ${getLinks(config)}
          </div>
        </main>
        <footer class="footer mt-auto py-3">
          <div class="container">
            <span class="text-muted">
              ui5-tools | <a href="https://github.com/CarlosOrozco88/ui5-tools">GitHub</a> |
              <a href="https://github.com/CarlosOrozco88/ui5-tools/issues">Issues</a>
            </span>
          </div>
        </footer>
      </body>
    </html>
  `;

  return indexPage;
}

function getApps({ foldersRootMap }) {
  let apps = '',
    appName;

  Object.entries(foldersRootMap).forEach(([key, folderRoot]) => {
    appName = key.replace('/', '');
    apps += `
      <div class="col-sm-6 col-md-4 col-lg-3">
        <div class="card bg-light mb-3">
          <div class="card-body"><a href="${key}">${appName}</a></div>
        </div>
      </div>
    `;
  });

  return `<h1 class="mt-3">Apps List</h1>

  <div class="row">
    ${apps}
  </div>`;
}

function getLinks(config) {
  return `<h1 class="mt-3">Links</h1>

  <div class="row">
    <div class="col-sm-6 col-md-4 col-lg-3">
      <div class="card bg-light mb-3">
        <div class="card-body"><a href="#">Link</a></div>
      </div>
    </div>
  </div>`;
}

function getDocs(config) {
  return `<h1 class="mt-3">Documentation</h1>`;
}

function getReadme(config) {
  return `<h1 class="mt-3">Readme</h1>`;
}

export default {
  getHTML,
};

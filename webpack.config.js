'use strict';

const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

/**@type {import('webpack').Configuration}*/
module.exports = {
  target: 'node',

  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]',
  },
  devtool: 'source-map',
  externals: {
    vscode: 'commonjs vscode',
    bufferutil: 'commonjs bufferutil',
    'utf-8-validate': 'commonjs utf-8-validate',
    'clean-css': 'commonjs clean-css',
    babylon: 'commonjs babylon',
  },
  resolve: {
    alias: {
      handlebars: 'handlebars/dist/handlebars',
    },
    extensions: ['.ts', '.js', '.json', '.hbs'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /(node_modules)/,
        use: 'ts-loader',
      },
      {
        test: /\.js$/,
        exclude: /(node_modules)/,
        use: 'babel-loader',
        // options: {
        //   presets: ['@babel/preset-env'],
        // },
      },
      {
        test: /\.node$/,
        use: 'node-loader',
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [path.resolve(__dirname, 'node_modules', 'ttf2woff2', 'jssrc', 'ttf2woff2.wasm')],
    }),
  ],
};

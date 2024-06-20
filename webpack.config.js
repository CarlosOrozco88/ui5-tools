//@ts-check

'use strict';

const path = require('path');
const webpack = require('webpack');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

/**@type {import('webpack').Configuration}*/
module.exports = {
  target: 'node',
  // mode: 'none',

  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'out'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]',
  },
  devtool: process.env.NODE_ENV === 'production' ? undefined : 'eval-source-map',
  externals: {
    vscode: 'commonjs vscode',
    bufferutil: 'commonjs bufferutil',
    'utf-8-validate': 'commonjs utf-8-validate',
    'clean-css': 'commonjs clean-css',
    babylon: 'commonjs babylon',
    'source-map': 'commonjs source-map',
  },
  resolve: {
    alias: {},
    extensions: ['.ts', '.js', '.json'],
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
      },
      {
        test: /\.node$/,
        use: 'node-loader',
      },
    ],
  },
  // infrastructureLogging: {
  //   level: 'log', // enables logging required for problem matchers
  // },
  plugins: [new webpack.ProgressPlugin(), new CleanWebpackPlugin()],
};

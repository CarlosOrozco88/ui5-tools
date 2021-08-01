module.exports = {
  root: true,
  ignorePatterns: ['scripts', 'dist'],
  env: {
    browser: false,
    commonjs: true,
    node: true,
    mocha: true,
    es2020: true,
  },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'prettier'],
  extends: ['plugin:@typescript-eslint/recommended', 'plugin:prettier/recommended', 'prettier'],
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  rules: {},
};

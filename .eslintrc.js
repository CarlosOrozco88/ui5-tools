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
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:prettier/recommended', 'prettier'],
  rules: {
    'no-async-promise-executor': 0,
    '@typescript-eslint/ban-ts-comment': 0,
    '@typescript-eslint/no-explicit-any': 0,
    '@typescript-eslint/explicit-module-boundary-types': 0,
    '@typescript-eslint/no-non-null-assertion': 0,
  },
};

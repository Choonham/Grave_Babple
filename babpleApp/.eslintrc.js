module.exports = {
  root: true,
  extends: ['@react-native'],
  env: {
    'react-native/react-native': true,
  },
  rules: {
    semi: ['error', 'always'],
    quotes: ['error', 'single'],
    eqeqeq: ['error', 'always'],
    'no-console': 'warn',
    'no-trailing-spaces': ['error', {skipBlankLines: true}],
    'max-len': ['error', {code: 120}],
    'prettier/prettier': ['error', {endOfLine: 'auto'}],
    'space-in-parens': ['error', 'never'],
    'object-curly-spacing': ['error', 'never'],
    'react/no-unstable-nested-components': 'warn',
  },
};

export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-case': [2, 'always', 'lower-case'],
    'subject-case': [2, 'always', ['lower-case', 'camel-case', 'kebab-case', 'pascal-case']],
    'type-case': [2, 'always', 'lower-case'],
  },
};

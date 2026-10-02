module.exports = {
  testEnvironment: 'node',
  modulePathIgnorePatterns: ['<rootDir>/.aws-sam/', '<rootDir>/.claude/', '<rootDir>/dist/'],
  testPathIgnorePatterns: ['/node_modules/', '/.aws-sam/', '/.claude/', '/dist/'],
};

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/**/*.unit.test.ts'],
  rootDir: '.',
  verbose: true,
  forceExit: true,
  detectOpenHandles: false
};

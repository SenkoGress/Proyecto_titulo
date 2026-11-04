module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/**/*.unit.test.ts'],
  rootDir: '.',
  setupFiles: ['<rootDir>/../jest.setup.ts'],
  verbose: true,
  forceExit: true,
  detectOpenHandles: false
};

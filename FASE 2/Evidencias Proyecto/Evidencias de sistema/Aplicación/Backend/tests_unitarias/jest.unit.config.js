// zona de Chile: las fechas locales (vencimientos, dia de la caja) se prueban igual en cualquier equipo
process.env.TZ = 'America/Santiago';

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

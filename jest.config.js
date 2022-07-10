module.exports = {
  globals: {
    'ts-jest': {
      compiler: 'ttypescript',
    },
  },
  automock: false,
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
  // Mirror the tsconfig `baseUrl: ./src` so bare imports like `events/dog`
  // and `src/chunks` resolve under Jest the same way they do under tsc.
  modulePaths: ['<rootDir>/src'],
  moduleNameMapper: {
    'src/(.*)': '<rootDir>/src/$1',
  },
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['jest-extended'],
};

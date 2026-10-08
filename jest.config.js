/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest', // Simplified preset
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts', '.tsx'], // Treat .ts and .tsx as ESM
  moduleNameMapper: {
    '^~/(.*)$': '<rootDir>/src/$1',
    // If superjson still causes issues, map it to its CJS version if available, or mock it.
    // For now, let's assume ts-jest with ESM support should handle it.
  },
  testPathIgnorePatterns: [
    "<rootDir>/.next/",
    "<rootDir>/node_modules/"
  ],
  clearMocks: true,
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true, // Key for ESM
        tsconfig: 'tsconfig.json',
      },
    ],
  },
  // Adjust transformIgnorePatterns:
  // Jest's default is /node_modules/, so we need to ensure problematic ESM modules ARE transformed.
  // The pattern means: "transform files in node_modules IF they are NOT superjson OR other-esm-module"
  // This is often counter-intuitive. We want to transform superjson.
  // So, we need to negate the modules we *don't* want to ignore (i.e., we *do* want to transform them)
  transformIgnorePatterns: [
    '/node_modules/(?!superjson|@trpc|zod|dice-coefficient|other-esm-dependencies-here)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'mjs', 'jsx', 'json', 'node'], // Added mjs
};

import * as migration_20260419_183021_init from './20260419_183021_init';

export const migrations = [
  {
    up: migration_20260419_183021_init.up,
    down: migration_20260419_183021_init.down,
    name: '20260419_183021_init'
  },
];

import * as migration_20260419_183021_init from './20260419_183021_init';
import * as migration_20260419_195457 from './20260419_195457';
import * as migration_20260419_201312 from './20260419_201312';

export const migrations = [
  {
    up: migration_20260419_183021_init.up,
    down: migration_20260419_183021_init.down,
    name: '20260419_183021_init',
  },
  {
    up: migration_20260419_195457.up,
    down: migration_20260419_195457.down,
    name: '20260419_195457',
  },
  {
    up: migration_20260419_201312.up,
    down: migration_20260419_201312.down,
    name: '20260419_201312',
  },
];

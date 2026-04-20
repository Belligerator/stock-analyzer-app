import * as migration_20260419_183021_init from './20260419_183021_init';
import * as migration_20260419_195457 from './20260419_195457';
import * as migration_20260419_201312 from './20260419_201312';
import * as migration_20260420_183204 from './20260420_183204';
import * as migration_20260420_203318 from './20260420_203318';

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
  {
    up: migration_20260420_183204.up,
    down: migration_20260420_183204.down,
    name: '20260420_183204',
  },
  {
    up: migration_20260420_203318.up,
    down: migration_20260420_203318.down,
    name: '20260420_203318'
  },
];

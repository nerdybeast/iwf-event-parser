import { bootstrap } from './index';
import { version } from '../package.json';
(async () => await bootstrap(version))();
import debug from 'debug';
import { Injectable } from '@nestjs/common';
import { DebugService } from './DebugService';

@Injectable()
export class DebugFactory {

	create(debuggerName: string) : DebugService {
		const debugModule = debug(`iwf-event-parser:${debuggerName}`);
		return new DebugService(debugModule);
	}
}
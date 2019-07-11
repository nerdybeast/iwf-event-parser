import { Debugger } from 'debug';

export class DebugService {

	private debugger: Debugger;

	constructor(debugModule: Debugger) {
		this.debugger = debugModule;
	}

	debug(message: string, obj?: any) : void {

		if(obj === undefined) {
			this.debugger(message);
			return;
		}

		this.debugger(`${message} ==> %o`, obj);
	}
}
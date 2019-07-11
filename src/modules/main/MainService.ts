import { Injectable } from '@nestjs/common';
import { DebugService } from '../debug/DebugService';
import { DebugFactory } from '../debug/DebugFactory';
import { PageService } from '../page/PageService';

@Injectable()
export class MainService {

	private debugService: DebugService;
	private pageService: PageService;

	constructor(debugFactory: DebugFactory, pageService: PageService) {
		this.debugService = debugFactory.create('Main');
		this.pageService = pageService;
	}

	public async init(version: string) {
		this.debugService.debug('version', version);
		await this.pageService.getCompetitionsDetails();
	}

}
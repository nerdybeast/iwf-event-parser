import { Test } from '@nestjs/testing';
import { MainService } from './MainService';
import { DebugModule } from '../debug/DebugModule';

describe('MainService - commander native', () => {

	let mainService: MainService;

	beforeEach(async () => {

		const mainModule = await Test.createTestingModule({
			imports: [
				DebugModule
			],
			providers: [
				MainService
			]
		}).compile();

		mainService = mainModule.get<MainService>(MainService);
	});

	test('init', async () => {
		await mainService.init('1.2.3');
	});
});
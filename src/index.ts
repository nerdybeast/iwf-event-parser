import { NestFactory } from '@nestjs/core';
import { MainModule } from './modules/main/MainModule';
import { MainService } from './modules/main/MainService';

export async function bootstrap(version: string) {

	const application = await NestFactory.createApplicationContext(MainModule);
	const mainService = application.get(MainService);

	await mainService.init(version);
}

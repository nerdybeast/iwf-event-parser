import { NestFactory } from '@nestjs/core';
import { NestApplicationContextOptions } from '@nestjs/common/interfaces/nest-application-context-options.interface';
import { MainModule } from './modules/main/MainModule';
import { MainService } from './modules/main/MainService';

export async function bootstrap(version: string, isDevelopment: boolean) {

	const applicationContextOptions: NestApplicationContextOptions = { };

	if(!isDevelopment) {
		//Will prevent default nest js logging (not user friendly) during the app creation process.
		applicationContextOptions.logger = false;
	}

	const application = await NestFactory.createApplicationContext(MainModule, applicationContextOptions);
	const mainService = application.get(MainService);

	await mainService.init(version);
}

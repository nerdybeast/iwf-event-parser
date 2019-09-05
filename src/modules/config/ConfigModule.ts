import { Module } from '@nestjs/common';
import { EnvModule } from './EnvModule';
import { ConfigService } from './ConfigService';

@Module({
	imports: [
		EnvModule
	],
	providers: [
		ConfigService
	],
	exports: [
		ConfigService
	]
})
export class ConfigModule {

}
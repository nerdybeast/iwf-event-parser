import { Module } from '@nestjs/common';
import { MainService } from './MainService';
import { DebugModule } from '../debug/DebugModule';
import { PageModule } from '../page/PageModule';

@Module({
	imports: [
		DebugModule,
		PageModule
	],
	providers: [
		MainService
	]
})
export class MainModule { }
import { Module } from '@nestjs/common';
import { PageService } from './PageService';
import { DebugModule } from '../debug/DebugModule';
import { FirestoreModule } from '../db/FirestoreModule';
import { MomentModule } from '../MomentModule';
import { DomParser } from './DomParser';
import { PuppeteerModule } from '../PuppeteerModule';
import { ConfigModule } from '../config/ConfigModule';

@Module({
	imports: [
		DebugModule,
		FirestoreModule,
		MomentModule,
		PuppeteerModule,
		ConfigModule
	],
	providers: [
		PageService,
		DomParser
	],
	exports: [
		PageService
	]
})
export class PageModule { }
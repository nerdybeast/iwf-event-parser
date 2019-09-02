import { Module } from '@nestjs/common';
import puppeteer from 'puppeteer';
import { PageService } from './PageService';
import { DebugModule } from '../debug/DebugModule';
import { FirestoreModule } from '../db/FirestoreModule';
import { MomentModule } from '../MomentModule';

@Module({
	imports: [
		DebugModule,
		FirestoreModule,
		MomentModule
	],
	providers: [
		PageService,
		{
			provide: 'puppeteer',
			useValue: puppeteer
		}
	],
	exports: [
		PageService
	]
})
export class PageModule { }
import { Module } from '@nestjs/common';
import puppeteer from 'puppeteer';
import { PageService } from './PageService';
import { DebugModule } from '../debug/DebugModule';

@Module({
	imports: [
		DebugModule
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
import { Module, Provider } from '@nestjs/common';
import puppeteer from 'puppeteer';

const provider: Provider = {
	provide: 'puppeteer',
	useValue: puppeteer
};

@Module({
	providers: [
		provider
	],
	exports: [
		provider
	]
})
export class PuppeteerModule { }
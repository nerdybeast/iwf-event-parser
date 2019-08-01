import { Injectable, Inject } from '@nestjs/common';
import puppeteerModule, { ElementHandle, Browser, Page } from 'puppeteer';
import { Competition } from '../../models/Competition';
import { DebugFactory } from '../debug/DebugFactory';
import { DebugService } from '../debug/DebugService';
import { WeightCategoryResult } from '../../models/WeightCategoryResult';

@Injectable()
export class PageService {

	private puppeteer: typeof puppeteerModule;
	private debugService: DebugService;
	private baseUrl: string = 'https://www.iwf.net';

	constructor(@Inject('puppeteer') puppeteer: typeof puppeteerModule, debugFactory: DebugFactory) {
		this.puppeteer = puppeteer;
		this.debugService = debugFactory.create('PageService');
	}

	public async getCompetitionsDetails() : Promise<Competition[]> {

		const browser = await this.puppeteer.launch({
			headless: false,
			slowMo: 50
		});

		const page = await browser.newPage();

		await page.goto(`${this.baseUrl}/new_bw/results_by_events`, {
			waitUntil: 'domcontentloaded'
		});

		const eventsTable: ElementHandle<Element> = await page.waitForSelector('#events_table');

		const competitions: Competition[] = await this.parseEventsTable(eventsTable);
		this.debugService.debug('competitions', competitions);

		const resultsPromises = competitions.map((competition: Competition) => {
			return this.parseEventResultsPage(browser, competition);
		});

		const results = await Promise.all(resultsPromises);

		await browser.close();

		return results;
	}

	public async parseEventsTable(eventsTable: ElementHandle<Element>) : Promise<Competition[]> {

		//NOTE: You cannot add any node js/typescript inside of this "eval" function, this code is technically
		//being executed on the puppeteer page and has the plain vanilla browser compatible javascript.
		let competitions: Competition[] = await eventsTable.$$eval('tbody tr', (rows: Element[]) => {

			return rows.map(tr => {

				/**
				 * Row in this context will look like:
				<tr>
					<td>
						<a href="/new_bw/results_by_events/?event=456">
							27.04.2019
						</a>
					</td>
					<td>
						<a href="/new_bw/results_by_events/?event=456">
							<b>
								Arafura Games
							</b>
						</a>
					</td>
					<td>
						<a href="/new_bw/results_by_events/?event=456">
							AUS - Darwin
						</a>
					</td>
				</tr>
				 */

				const tds = [...tr.getElementsByTagName('td')];
	
				return {
					id: undefined,
					eventLink: tds[0].getElementsByTagName('a')[0].getAttribute('href') || undefined,
					date: tds[0].textContent || undefined,
					name: tds[1].textContent || undefined,
					location: tds[2].textContent || undefined
				};
			});
		});

		competitions = competitions.map(competition => {

			if(competition.eventLink) {
				competition.id = new URL(competition.eventLink, this.baseUrl).searchParams.get('event') || undefined;
			}

			return competition;
		});

		return competitions;
	}

	public async parseEventResultsPage(browser: Browser, competition: Competition) {

		if(!competition.eventLink) {
			throw new Error(`Event ${competition.name} has no event link...`);
		}

		const eventPage = await browser.newPage();
		const eventUrl = this.baseUrl + competition.eventLink;

		await eventPage.goto(eventUrl, {
			timeout: 0, //Disabling timeout
			waitUntil: 'domcontentloaded' //Don't wait for external resources, we just need the dom
		});

		this.debugService.debug('Parsing event results for', eventUrl)

		const [mensResults, womensResults] = await Promise.all([
			this.parseTotalsTables(eventPage, '#men_total', 'male'),
			this.parseTotalsTables(eventPage, '#women_total', 'female')
		]);

		competition.results = [...mensResults, ...womensResults];

		await eventPage.close();

		return competition;
	}

	private async parseTotalsTables(page: Page, selector: string, gender: string) {

		const totalsDiv = await page.waitForSelector(selector);

		const results: WeightCategoryResult[] = await totalsDiv.$$eval('.results_totals', resultsTotalsDivs => {

			//NOTE: You are in the browser context in this call back function so no node.js things in here...
			//Meaning "this.xxxxx" will refer to the browser context, NOT this node.js process.

			return resultsTotalsDivs.map(resultTotal => {

				const resultsTable = resultTotal.getElementsByTagName('table')[0];
				const resultsTableTbody = resultsTable.getElementsByTagName('tbody')[0];
				const trs = Array.from(resultsTableTbody.getElementsByTagName('tr'));
	
				const results = trs.map(tr => {
	
					const tds = Array.from(tr.getElementsByTagName('td'));
	
					const athlete = {
						name: tds[1].textContent,
						bioLink: tds[1].getElementsByTagName('a')[0].getAttribute('href'),
						birthDate: tds[2].textContent,
						nationAbbreviation: tds[3].textContent
					};
	
					const competitionResult = {
						athlete,
						rank: Number(tds[0].textContent) || 0,
						bodyWeight: Number(tds[4].textContent) || 0,
						snatch: Number(tds[6].textContent) || 0,
						cj: Number(tds[7].textContent) || 0,
						total: Number(tds[8].textContent) || 0
					};
					
					return competitionResult;
				});
	
				return {
					weightClass: (resultTotal.getElementsByTagName('h1')[0].textContent || '').split(' ')[0],
					results,
					gender: undefined
				};
			});

		});

		return results.map(result => {
			result.gender = gender;
			return result;
		});
	}
}
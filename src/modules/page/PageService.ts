import { Injectable, Inject } from '@nestjs/common';
import puppeteerModule, { ElementHandle, Browser, Page } from 'puppeteer';
import { Competition } from '../../models/Competition';
import { DebugFactory } from '../debug/DebugFactory';
import { DebugService } from '../debug/DebugService';
import { WeightCategoryResult } from '../../models/WeightCategoryResult';
import { EventDetails } from '../../models/EventDetails';
import { Firestore } from '@google-cloud/firestore';
import Moment from 'moment';

@Injectable()
export class PageService {

	private puppeteer: typeof puppeteerModule;
	private debugService: DebugService;
	private db: Firestore;
	private moment: typeof Moment;
	private baseUrl: string = 'https://www.iwf.net';

	constructor(@Inject('puppeteer') puppeteer: typeof puppeteerModule, debugFactory: DebugFactory, @Inject('db') db: Firestore, @Inject('moment') moment: typeof Moment) {
		this.puppeteer = puppeteer;
		this.debugService = debugFactory.create('PageService');
		this.db = db;
		this.moment = moment;
	}

	public async getCompetitionsDetails() : Promise<Competition[]> {

		const [qualificationPeriodsSnapshot, competitionEventsSnapshot] = await Promise.all([
			this.db.collection('qualification-periods').get(),
			this.db.collection('competition-events').get()
		]);


		const qualificationPeriods = qualificationPeriodsSnapshot.docs.map(y => {
			return {
				period: y.get('period'),
				startDate: this.moment(y.get('startDate')),
				endDate: this.moment(y.get('endDate'))
			};
		});

		const browser = await this.puppeteer.launch({
			headless: false,
			slowMo: 50
		});

		const page = await browser.newPage();

		await page.goto(`${this.baseUrl}/new_bw/results_by_events`, {
			waitUntil: 'domcontentloaded'
		});

		const eventsTable: ElementHandle<Element> = await page.waitForSelector('#events_table');

		const eventDetails: EventDetails[] = await this.parseEventsTable(eventsTable);
		eventDetails.forEach(eventDetail => {
			if(eventDetail.date) {
				const eventDate = this.moment(eventDetail.date);
				qualificationPeriods.forEach(qualificationPeriod => {
					if(eventDate.isBetween(qualificationPeriod.startDate, qualificationPeriod.endDate)) {
						eventDetail.qualificationPeriod = qualificationPeriod.period;
					}
				});
			}
		});

		this.debugService.debug('eventDetails', eventDetails);

		const resultsPromises = eventDetails.map((eventDetail: EventDetails) => {
			return this.parseEventResultsPage(browser, eventDetail);
		});

		const results = await Promise.all(resultsPromises);

		await browser.close();

		const batch = this.db.batch();

		results.forEach(result => {

			if(result.id !== undefined) {
				const docRef = this.db.collection('eventResults').doc(result.id);
				batch.set(docRef, result);
			}

		});

		const result = await batch.commit();

		this.debugService.debug('db write result', result);

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

	public async parseEventResultsPage(browser: Browser, eventDetails: EventDetails) : Promise<Competition> {

		if(!eventDetails.eventLink) {
			throw new Error(`Event ${eventDetails.name} has no event link...`);
		}

		const eventPage = await browser.newPage();
		const eventUrl = this.baseUrl + eventDetails.eventLink;

		await eventPage.goto(eventUrl, {
			timeout: 0, //Disabling timeout
			waitUntil: 'domcontentloaded' //Don't wait for external resources, we just need the dom
		});

		this.debugService.debug('Parsing event results for', eventUrl)

		const [mensResults, womensResults] = await Promise.all([
			this.parseTotalsTables(eventPage, '#men_total', 'male'),
			this.parseTotalsTables(eventPage, '#women_total', 'female')
		]);

		const competition = new Competition(eventDetails);
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
				/*
				<div class="results_totals">
					<h1>55 kg Men</h1>
					<table class="results">
						<thead>
							<tr>
								<th class="w35" width="35"><em>Rank</em></th>
								<th><em>Name</em></th>
								<th class="w80" width="80"><em>Born</em></th>
								<th class="w40" width="40"><em>Nation</em></th>
								<th class="w50 ar" width="50"><em>B.weight</em></th>
								<th class="w35 ac" width="35"><em>Group</em></th>
								<th class="w40 ar" width="40"><em>Snatch</em></th>
								<th class="w45 ar" width="45"><em>CI&amp;Jerk</em></th>
								<th class="w40 ar" width="40"><em>Total</em></th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<td class="r_dark">1</td>
								<td><a href="/new_bw/athletes_newbw/?athlete=singh-ch-rishikanta-1998-07-05&amp;id=16397" class="e_l">SINGH CH Rishikanta</a></td>
								<td>05.07.1998</td>
								<td><b>IND</b></td>
								<td class="ar">55.00</td>
								<td class="ac">A</td>
								<td class="r_dark ar">105</td>
								<td class="r_dark ar">130</td>
								<td class="r_dark ar"><b>235</b></td>
							</tr>
							<tr class="even">
								<td class="r_dark">2</td>
								<td><a href="/new_bw/athletes_newbw/?athlete=brechtefeld-elson-edward-1994-03-02&amp;id=9607" class="e_l">BRECHTEFELD Elson Edward</a></td>
								<td>02.03.1994</td>
								<td><b>NRU</b></td>
								<td class="ar">54.70</td>
								<td class="ac">A</td>
								<td class="r_dark ar">93</td>
								<td class="r_dark ar">122</td>
								<td class="r_dark ar"><b>215</b></td>
							</tr>
							<tr>
								<td class="r_dark">3</td>
								<td><a href="/new_bw/athletes_newbw/?athlete=nauari-gahuna-ian-2002-08-05&amp;id=16375" class="e_l">NAUARI Gahuna Ian</a></td>
								<td>05.08.2002</td>
								<td><b>PNG</b></td>
								<td class="ar">54.65</td>
								<td class="ac">A</td>
								<td class="r_dark ar">80</td>
								<td class="r_dark ar">108</td>
								<td class="r_dark ar"><b>188</b></td>
							</tr>
							<tr class="even">
								<td class="r_dark">4</td>
								<td><a href="/new_bw/athletes_newbw/?athlete=shadrack-walter-2000-10-06&amp;id=16166" class="e_l">SHADRACK Walter</a></td>
								<td>06.10.2000</td>
								<td><b>SOL</b></td>
								<td class="ar">54.75</td>
								<td class="ac">A</td>
								<td class="r_dark ar">80</td>
								<td class="r_dark ar">105</td>
								<td class="r_dark ar"><b>185</b></td>
							</tr>
							<tr>
								<td class="r_dark">5</td>
								<td><a href="/new_bw/athletes_newbw/?athlete=sinaka-scofield-goava-1998-01-21&amp;id=16374" class="e_l">SINAKA Scofield Goava</a></td>
								<td>21.01.1998</td>
								<td><b>PNG</b></td>
								<td class="ar">53.90</td>
								<td class="ac">A</td>
								<td class="r_dark ar">75</td>
								<td class="r_dark ar">108</td>
								<td class="r_dark ar"><b>183</b></td>
							</tr>
							<tr class="even">
								<td class="r_dark">---</td>
								<td><a href="/new_bw/athletes_newbw/?athlete=erati-kaimauri-2004-06-13&amp;id=16373" class="e_l">ERATI Kaimauri</a></td>
								<td>13.06.2004</td>
								<td><b>KIR</b></td>
								<td class="ar">53.80</td>
								<td class="ac">A</td>
								<td class="r_dark ar">---</td>
								<td class="r_dark ar">75</td>
								<td class="r_dark ar">---</td>
							</tr>
						</tbody>
					</table>
				</div>
				*/

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
import { Injectable, Inject } from '@nestjs/common';
import puppeteerModule, { ElementHandle, Browser, Page } from 'puppeteer';
import { DebugFactory } from '../debug/DebugFactory';
import { DebugService } from '../debug/DebugService';
import Moment from 'moment';
import { CompetitionEventDomain } from '../db/CompetitionEventDomain';
import { IEventDetails } from '../../models/IEventDetails';
import { firestore } from 'firebase';
import { IWeightCategoryResult } from '../../models/IWeightCategoryResult';
import { IPageWeightCategoryResult } from '../../models/IPageWeightCategoryResult';
import { IPageAthleteResult } from '../../models/IPageAthleteResult';
import { IPageAthlete } from '../../models/IPageAthlete';
import { IAthleteResult } from '../../models/IAthleteResult';
import { ICompetition } from '../../models/ICompetition';
import { AthleteDomain } from '../db/AthleteDomain';
import { AthleteResultDomain } from '../db/AthleteResultDomain';

@Injectable()
export class PageService {

	private puppeteer: typeof puppeteerModule;
	private debugService: DebugService;
	private db: firestore.Firestore;
	private moment: typeof Moment;
	private competitionEventDomain: CompetitionEventDomain;
	private athleteDomain: AthleteDomain;
	private athleteResultDomain: AthleteResultDomain;
	private baseUrl: string = 'https://www.iwf.net';

	constructor(
		@Inject('puppeteer') puppeteer: typeof puppeteerModule, 
		debugFactory: DebugFactory, 
		@Inject('db') db: firestore.Firestore, 
		@Inject('moment') moment: typeof Moment, 
		competitionEventDomain: CompetitionEventDomain,
		athleteDomain: AthleteDomain,
		athleteResultDomain: AthleteResultDomain
	) {
		this.puppeteer = puppeteer;
		this.debugService = debugFactory.create('PageService');
		this.db = db;
		this.moment = moment;
		this.competitionEventDomain = competitionEventDomain;
		this.athleteDomain = athleteDomain;
		this.athleteResultDomain = athleteResultDomain
	}

	public async getCompetitionsDetails() : Promise<void> {

		const [qualificationPeriodsSnapshot, allEventsDetails, allAthletes, allAthleteResults] = await Promise.all([
			this.db.collection('qualification-periods').get(),
			this.competitionEventDomain.getAll(),
			this.athleteDomain.getAll(),
			this.athleteResultDomain.getAll()
		]);

		const qualificationPeriods = qualificationPeriodsSnapshot.docs.map(y => {
			return {
				period: y.get('period'),
				startDate: this.moment(y.get('startDate')),
				endDate: this.moment(y.get('endDate'))
			};
		});

		const browser = await this.puppeteer.launch({
			headless: true,
			slowMo: 50
		});

		const page = await browser.newPage();

		await page.goto(`${this.baseUrl}/new_bw/results_by_events`, {
			waitUntil: 'domcontentloaded'
		});

		const eventsTable: ElementHandle<Element> = await page.waitForSelector('#events_table');
		const eventDetails: IEventDetails[] = await this.parseEventsTable(eventsTable);

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

		const eventDetailsToSave = eventDetails.reduce((prev: IEventDetails[], curr: IEventDetails) => {

			if(!allEventsDetails.find(x => x.id === curr.id)) {
				prev.push(curr);
			}

			return prev;

		}, []);

		this.debugService.debug('dfdf', eventDetailsToSave);

		let competitionEventBatch = this.db.batch();

		eventDetailsToSave.forEach(result => {
			if(result.id !== undefined) {
				const docRef = this.competitionEventDomain.nativeCollection.doc(result.id);
				competitionEventBatch.set(docRef, result);
			}
		});

		await competitionEventBatch.commit();

		const resultsPromises : Promise<ICompetition>[] = eventDetails.map((eventDetail: IEventDetails) => {
			return this.parseEventResultsPage(browser, eventDetail);
		});
		
		const results: ICompetition[] = await Promise.all(resultsPromises);
		
		await browser.close();

		const athletesToSave: IPageAthlete[] = [];
		const athleteResultsToSave: IAthleteResult[] = [];

		//Here we are looping over all competitions.
		for (const competition of results) {

			//Here we are looping over the weight catgories for a specific competition
			for(const weightCategoryResult of competition.weightCategoryResults) {

				weightCategoryResult.athletes.forEach((athlete: IPageAthlete) => {
					if(!athletesToSave.find(x => x.id === athlete.id) && !allAthletes.find(x => x.id === athlete.id)) {
						athletesToSave.push(athlete);
					}
				});

				weightCategoryResult.results.forEach((athleteResult: IAthleteResult) => {

					const alreadyInList = athleteResultsToSave.some(x => x.athleteId === athleteResult.athleteId && x.competitionId === athleteResult.competitionId);
					const alreadyInDatabase = allAthleteResults.some(x => x.athleteId === athleteResult.athleteId && x.competitionId === athleteResult.competitionId);

					if(!alreadyInList && !alreadyInDatabase) {
						athleteResultsToSave.push(athleteResult);
					}
				});
			}
		}

		const dbPromises: Promise<void>[] = [];

		while(athletesToSave.length > 0) {

			const batch = this.db.batch();
			const athletes = athletesToSave.splice(0, 500);

			athletes.forEach((athlete: IPageAthlete) => {
				const docRef = this.athleteDomain.nativeCollection.doc(athlete.id.toString());
				batch.set(docRef, athlete);
			});

			this.debugService.debug(`Commiting ${athletes.length} athletes to the database...`);

			dbPromises.push(batch.commit());
		}

		while(athleteResultsToSave.length > 0) {

			const batch = this.db.batch();
			const athleteResults = athleteResultsToSave.splice(0, 500);

			athleteResults.forEach((athleteResult: IAthleteResult) => {
				const docRef = this.athleteResultDomain.nativeCollection.doc();
				batch.set(docRef, athleteResult);
			});

			this.debugService.debug(`Commiting ${athleteResults.length} athlete-results to the database...`);

			dbPromises.push(batch.commit());
		}

		this.debugService.debug(`Waiting for database saves...`);
		await Promise.all(dbPromises);
		this.debugService.debug('db write complete');
	}

	public async parseEventsTable(eventsTable: ElementHandle<Element>) : Promise<IEventDetails[]> {

		//NOTE: You cannot add any node js/typescript inside of this "eval" function, this code is technically
		//being executed on the puppeteer page and has the plain vanilla browser compatible javascript.
		let eventDetails: IEventDetails[] = await eventsTable.$$eval('tbody tr', (rows: Element[]) => {

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
					id: '',
					eventLink: tds[0].getElementsByTagName('a')[0].getAttribute('href') || '',
					date: tds[0].textContent || '',
					name: tds[1].textContent || '',
					location: tds[2].textContent || ''
				};
			});
		});

		eventDetails = eventDetails.map(eventDetail => {

			if(eventDetail.eventLink) {
				eventDetail.id = new URL(eventDetail.eventLink, this.baseUrl).searchParams.get('event') || '';
			}

			return eventDetail;
		});

		return eventDetails as IEventDetails[];
	}

	public async parseEventResultsPage(browser: Browser, eventDetails: IEventDetails) : Promise<ICompetition> {

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
			this.parseTotalsTables(eventDetails, eventPage, '#men_total', 'male'),
			this.parseTotalsTables(eventDetails, eventPage, '#women_total', 'female')
		]);

		await eventPage.close();

		return {
			date: eventDetails.date,
			eventLink: eventDetails.eventLink,
			id: eventDetails.id,
			location: eventDetails.location,
			name: eventDetails.name,
			qualificationPeriod: eventDetails.qualificationPeriod,
			weightCategoryResults: [...mensResults, ...womensResults]
		};
	}

	private async parseTotalsTables(eventDetails: IEventDetails, page: Page, selector: string, gender: string) : Promise<IWeightCategoryResult[]> {

		const totalsDiv = await page.waitForSelector(selector);
		const pageWeightCategoryResults: IPageWeightCategoryResult[] = await this.getResultsTotals(totalsDiv);

		//We are in the context of a single competition, looping through each weight category here.
		return pageWeightCategoryResults.map((pageWeightCategoryResult: IPageWeightCategoryResult) : IWeightCategoryResult => {

			const athletes: IPageAthlete[] = [];
			const { weightClass } = pageWeightCategoryResult;

			const results: IAthleteResult[] = pageWeightCategoryResult.results.map((pageAthleteResult: IPageAthleteResult) : IAthleteResult => {

				const { athlete, bodyWeight, cj, rank, snatch, total } = pageAthleteResult;
				athletes.push(athlete);

				return {
					athleteId: athlete.id,
					competitionId: eventDetails.id,
					bodyWeight,
					cj,
					rank,
					snatch,
					total
				};
			});

			return {
				weightClass,
				gender,
				athletes,
				results
			};
		});
	}

	private async getResultsTotals(totalsDiv: ElementHandle<Element>) : Promise<IPageWeightCategoryResult[]> {

		const weightCategoryResults: IPageWeightCategoryResult[] = await totalsDiv.$$eval('.results_totals', resultsTotalsDivs => {

			//NOTE: You are in the browser context in this call back function so no node.js things in here...
			//Meaning "this.xxxxx" will refer to the browser context, NOT this node.js process.

			return resultsTotalsDivs.map(resultTotal => {
				/*
				<div class="results_totals">
					<h1>45 kg Women</h1>
					<table class="results">
						<thead>
							<tr>
								<th class="w35" width="35"><em>Rank</em></th>
								<th><em>Name</em></th>
								<th class="w35 ac" width="30"><em></em></th>
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
								<td><a href="/new_bw/athletes_newbw/?athlete=sukcharoen-thunya-1997-04-21&amp;id=9257" class="e_l">SUKCHAROEN Thunya</a></td>
								<td></td>
								<td>21.04.1997</td>
								<td><b>THA</b></td>
								<td class="ar">44.77</td>
								<td class="ac">A</td>
								<td class="r_dark ar">80</td>
								<td class="r_dark ar">106</td>
								<td class="r_dark ar"><b>186</b></td>
							</tr>
							<tr class="even">
								<td class="r_dark">2</td>
								<td><a href="/new_bw/athletes_newbw/?athlete=dzhumabayeva-yulduz-1998-04-22&amp;id=9211" class="e_l">DZHUMABAYEVA Yulduz</a></td>
								<td></td>
								<td>22.04.1998</td>
								<td><b>TKM</b></td>
								<td class="ar">44.90</td>
								<td class="ac">A</td>
								<td class="r_dark ar">75</td>
								<td class="r_dark ar">104</td>
								<td class="r_dark ar"><b>179</b></td>
							</tr>
							<tr>
								<td class="r_dark">3</td>
								<td><a href="/new_bw/athletes_newbw/?athlete=nanthawong-chiraphan-1999-08-17&amp;id=13290" class="e_l">NANTHAWONG Chiraphan</a></td>
								<td></td>
								<td>17.08.1999</td>
								<td><b>THA</b></td>
								<td class="ar">44.47</td>
								<td class="ac">A</td>
								<td class="r_dark ar">76</td>
								<td class="r_dark ar">95</td>
								<td class="r_dark ar"><b>171</b></td>
							</tr>
							<tr class="even">
								<td class="r_dark">4</td>
								<td><a href="/new_bw/athletes_newbw/?athlete=echandia-zarate-katherin-oriana-2001-08-14&amp;id=14953" class="e_l">ECHANDIA ZARATE Katherin Oriana</a></td>
								<td></td>
								<td>14.08.2001</td>
								<td><b>VEN</b></td>
								<td class="ar">44.97</td>
								<td class="ac">A</td>
								<td class="r_dark ar">67</td>
								<td class="r_dark ar">90</td>
								<td class="r_dark ar"><b>157</b></td>
							</tr>
							<tr>
								<td class="r_dark">5</td>
								<td><a href="/new_bw/athletes_newbw/?athlete=pagliaro-alessandra-1997-07-16&amp;id=6497" class="e_l">PAGLIARO Alessandra</a></td>
								<td></td>
								<td>16.07.1997</td>
								<td><b>ITA</b></td>
								<td class="ar">43.22</td>
								<td class="ac">A</td>
								<td class="r_dark ar">70</td>
								<td class="r_dark ar">86</td>
								<td class="r_dark ar"><b>156</b></td>
							</tr>
							<tr class="even">
								<td class="r_dark">6</td>
								<td><a href="/new_bw/athletes_newbw/?athlete=nguyen-thi-thu-trang-2003-06-03&amp;id=14004" class="e_l">NGUYEN Thi Thu Trang</a></td>
								<td></td>
								<td>03.06.2003</td>
								<td><b>VIE</b></td>
								<td class="ar">44.93</td>
								<td class="ac">A</td>
								<td class="r_dark ar">70</td>
								<td class="r_dark ar">81</td>
								<td class="r_dark ar"><b>151</b></td>
							</tr>
							<tr>
								<td class="r_dark">7</td>
								<td><a href="/new_bw/athletes_newbw/?athlete=pandova-daniela-ivanova-1994-09-16&amp;id=14815" class="e_l">PANDOVA Daniela Ivanova</a></td>
								<td></td>
								<td>16.09.1994</td>
								<td><b>BUL</b></td>
								<td class="ar">45.00</td>
								<td class="ac">A</td>
								<td class="r_dark ar">60</td>
								<td class="r_dark ar">81</td>
								<td class="r_dark ar"><b>141</b></td>
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
					const bioLink = tds[1].getElementsByTagName('a')[0].getAttribute('href') || 'unknown';

					let id = '0';

					if(bioLink !== 'unknown') {
						const url = new URL(bioLink, 'http://test.com');
						id = url.searchParams.get('id') || '0';
					}

					const athlete = {
						id,
						name: tds[1].textContent || 'unknown',
						bioLink,
						birthDate: tds[3].textContent || 'unknown',
						nationAbbreviation: tds[4].textContent || 'unknown'
					};
	
					const competitionResult = {
						athlete,
						rank: Number(tds[0].textContent) || 0,
						bodyWeight: Number(tds[5].textContent) || 0,
						snatch: Number(tds[7].textContent) || 0,
						cj: Number(tds[8].textContent) || 0,
						total: Number(tds[9].textContent) || 0
					};
					
					return competitionResult;
				});
	
				return {
					weightClass: (resultTotal.getElementsByTagName('h1')[0].textContent || '').split(' ')[0],
					results
				};
			});

		});

		return weightCategoryResults;
	}
}
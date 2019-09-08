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

@Injectable()
export class PageService {

	private puppeteer: typeof puppeteerModule;
	private debugService: DebugService;
	private db: firestore.Firestore;
	private moment: typeof Moment;
	private competitionEventDomain: CompetitionEventDomain;
	private athleteDomain: AthleteDomain;
	private baseUrl: string = 'https://www.iwf.net';

	constructor(
		@Inject('puppeteer') puppeteer: typeof puppeteerModule, 
		debugFactory: DebugFactory, 
		@Inject('db') db: firestore.Firestore, 
		@Inject('moment') moment: typeof Moment, 
		competitionEventDomain: CompetitionEventDomain,
		athleteDomain: AthleteDomain
	) {
		this.puppeteer = puppeteer;
		this.debugService = debugFactory.create('PageService');
		this.db = db;
		this.moment = moment;
		this.competitionEventDomain = competitionEventDomain;
		this.athleteDomain = athleteDomain;
	}

	public async getCompetitionsDetails() : Promise<void> {

		const [qualificationPeriodsSnapshot, allEventsDetails] = await Promise.all([
			this.db.collection('qualification-periods').get(),
			this.competitionEventDomain.getAll()
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

		let batch = this.db.batch();

		eventDetailsToSave.forEach(result => {
			if(result.id !== undefined) {
				const docRef = this.competitionEventDomain.nativeCollection.doc(result.id);
				batch.set(docRef, result);
			}
		});

		await batch.commit();

		const resultsPromises : Promise<ICompetition>[] = eventDetails.map((eventDetail: IEventDetails) => {
			return this.parseEventResultsPage(browser, eventDetail);
		});
		
		const results: ICompetition[] = await Promise.all(resultsPromises);
		
		await browser.close();

		//Here we are looping over all competitions.
		for (const competition of results) {

			//Here we are looping over the weight catgories for a specific competition
			for(const weightCategoryResult of competition.weightCategoryResults) {
	
				const athletes: IPageAthlete[] = [];
	
				weightCategoryResult.athletes.forEach((athlete: IPageAthlete) => {
					if(!athletes.find(x => x.id === athlete.id)) {
						athletes.push(athlete);
					}
				});
	
				let batch = this.db.batch();
	
				athletes.forEach((athlete: IPageAthlete) => {
					const docRef = this.athleteDomain.nativeCollection.doc(athlete.id.toString());
					batch.set(docRef, athlete);
				});
	
				await batch.commit();
			}
		}

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
						birthDate: tds[2].textContent || 'unknown',
						nationAbbreviation: tds[3].textContent || 'unknown'
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
					results
				};
			});

		});

		return weightCategoryResults;
	}
}
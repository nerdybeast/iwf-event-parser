import { Injectable, Inject } from '@nestjs/common';
import puppeteerModule, { Browser } from 'puppeteer';
import { DebugFactory } from '../debug/DebugFactory';
import { DebugService } from '../debug/DebugService';
import Moment from 'moment';
import { CompetitionEventDomain } from '../db/CompetitionEventDomain';
import { IEventDetails } from '../../models/IEventDetails';
import { firestore } from 'firebase';
import { IPageAthlete } from '../../models/IPageAthlete';
import { IAthleteResult } from '../../models/IAthleteResult';
import { ICompetition } from '../../models/ICompetition';
import { AthleteDomain } from '../db/AthleteDomain';
import { AthleteResultDomain } from '../db/AthleteResultDomain';
import { DomParser } from './DomParser';
import { convertEventsDetails } from '../../utils/EventsFunctions';
import { QualificationPeriodDomain } from '../db/QualificationPeriodDomain';
import { QualificationPeriod } from '../../models/QualificationPeriod';
import { ConfigService } from '../config/ConfigService';

@Injectable()
export class PageService {

	private puppeteer: typeof puppeteerModule;
	private debugService: DebugService;
	private db: firestore.Firestore;
	private moment: typeof Moment;
	private competitionEventDomain: CompetitionEventDomain;
	private athleteDomain: AthleteDomain;
	private athleteResultDomain: AthleteResultDomain;
	private domParser: DomParser;
	private qualificationPeriodDomain: QualificationPeriodDomain;
	private config: ConfigService;
	private baseUrl: string = 'https://www.iwf.net';

	constructor(
		@Inject('puppeteer') puppeteer: typeof puppeteerModule, 
		debugFactory: DebugFactory, 
		@Inject('db') db: firestore.Firestore, 
		@Inject('moment') moment: typeof Moment, 
		competitionEventDomain: CompetitionEventDomain,
		athleteDomain: AthleteDomain,
		athleteResultDomain: AthleteResultDomain,
		domParser: DomParser,
		qualificationPeriodDomain: QualificationPeriodDomain,
		configService: ConfigService
	) {
		this.puppeteer = puppeteer;
		this.debugService = debugFactory.create('PageService');
		this.db = db;
		this.moment = moment;
		this.competitionEventDomain = competitionEventDomain;
		this.athleteDomain = athleteDomain;
		this.athleteResultDomain = athleteResultDomain;
		this.domParser = domParser;
		this.qualificationPeriodDomain = qualificationPeriodDomain;
		this.config = configService;
	}

	public async getCompetitionsDetails() : Promise<void> {

		const browser = await this.puppeteer.launch({
			headless: this.config.IsHeadless,
			slowMo: 50
		});

		const qualificationPeriodsPromise = this.qualificationPeriodDomain.getAll();
		const eventDetails = await this.getEventsTableData(browser);

		const qualificationPeriods = await qualificationPeriodsPromise;
		this.setQualificationPeriodOnEvent(eventDetails, qualificationPeriods);

		eventDetails.forEach(x => this.debugService.debug(`Event: ${x.name}`, x));

		const resultsPromises: Promise<ICompetition>[] = eventDetails.map((eventDetail: IEventDetails) => {
			return this.getResultsFromEvent(browser, eventDetail);
		});
		
		const results: ICompetition[] = await Promise.all(resultsPromises);
		
		await browser.close();

		const [allAthletes, allAthleteResults] = await Promise.all([
			this.athleteDomain.getAll(),
			this.athleteResultDomain.getAll()
		]);

		const allEventsDetailsPromise = this.competitionEventDomain.getAll();

		const allEventsDetails = await allEventsDetailsPromise;

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

	/**
	 * Launches the events page, scrapes it, and returns the data for all events.
	 * @param browser Puppeteer browser instance
	 */
	private async getEventsTableData(browser: Browser) : Promise<IEventDetails[]> {

		const page = await browser.newPage();

		await page.goto(`${this.baseUrl}/new_bw/results_by_events`, {
			waitUntil: 'domcontentloaded'
		});

		const rawEventsTableData = await this.domParser.parseEventsTableData(page);
		const eventDetails = rawEventsTableData.map(pageEventDetails => convertEventsDetails(pageEventDetails));

		return eventDetails;
	}

	public async getResultsFromEvent(browser: Browser, eventDetails: IEventDetails) : Promise<ICompetition> {

		const eventPage = await browser.newPage();
		const eventUrl = this.baseUrl + eventDetails.eventLink;

		await eventPage.goto(eventUrl, {
			timeout: 0, //Disabling timeout
			waitUntil: 'domcontentloaded' //Don't wait for external resources, we just need the dom
		});

		const competitionResults = await this.domParser.parseEventResultsPage(eventPage, eventDetails);

		await eventPage.close();

		return competitionResults;
	}

	private setQualificationPeriodOnEvent(eventDetails: IEventDetails[], qualificationPeriods: QualificationPeriod[]) : void {

		eventDetails.forEach(eventDetail => {

			if(eventDetail.date) {

				const eventDate = this.moment(eventDetail.date);

				qualificationPeriods.forEach(qualificationPeriod => {

					const startDate = this.moment(qualificationPeriod.startDate);
					const endDate = this.moment(qualificationPeriod.endDate);

					//The square brackets tell moment to include the start/end date meaning if the event date IS one
					//of those dates, it will count as being "in between", default behavior excludes the start/end date
					//See: https://momentjs.com/docs/#/query/is-between/
					if(eventDate.isBetween(startDate, endDate, undefined, '[]')) {
						eventDetail.qualificationPeriod = qualificationPeriod.period;
					}
				});
			}
		});
	}
}
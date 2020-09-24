import { ElementHandle, Page } from 'puppeteer';
import { ICompetition } from '../../models/ICompetition';
import { Selectors } from '../../constants';
import { IPageEventDetails } from '../../models/IPageEventDetails';
import { IPageWeightCategoryResult } from '../../models/IPageWeightCategoryResult';
import { IEventDetails } from '../../models/IEventDetails';
import { IWeightCategoryResult } from '../../models/IWeightCategoryResult';
import { IPageAthlete } from '../../models/IPageAthlete';
import { IAthleteResult } from '../../models/IAthleteResult';
import { IPageAthleteResult } from '../../models/IPageAthleteResult';

export class DomParser {

	public async parseEventsTableData(page: Page) : Promise<IPageEventDetails[]> {

		const eventsTable = await page.waitForSelector(Selectors.ALL_EVENTS_TABLE);
		
		const allEventsDetails = await eventsTable.$$eval('tbody tr', rows => {

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
					eventLink: tds[0].getElementsByTagName('a')[0].getAttribute('href') || '',
					date: tds[0].textContent || '',
					name: tds[1].textContent || '',
					location: tds[2].textContent || ''
				};
			});

		});

		return allEventsDetails;
	}

	public async parseEventResultsPage(page: Page, eventDetails: IEventDetails) : Promise<ICompetition> {

		const [mensResults, womensResults] = await Promise.all([
			this.parseTotalsTables(eventDetails, page, '#men_total', 'male'),
			this.parseTotalsTables(eventDetails, page, '#women_total', 'female')
		]);

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
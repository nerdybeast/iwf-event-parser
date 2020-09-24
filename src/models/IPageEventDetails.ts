/**
 * Used to map the data that is pulled from:
 * https://www.iwf.net/new_bw/results_by_events/
 */
export interface IPageEventDetails {
	eventLink: string;
	date: string;
	name: string;
	location: string;
	qualificationPeriod?: number;
}
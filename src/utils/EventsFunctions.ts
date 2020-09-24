import { IEventDetails } from '../models/IEventDetails';
import { IPageEventDetails } from '../models/IPageEventDetails';
import moment from 'moment';

export function convertEventsDetails(pageEventDetails: IPageEventDetails) : IEventDetails {

	//These are raw data points exactly as they came off the page.
	let { date, eventLink, location, name, qualificationPeriod } = pageEventDetails;

	//Sometimes the IWF website uses periods for the delimiter in dates and they do day.month.year which moment
	//says is an invalid date, let's normalize that here.
	//NOTE: "D.M.Y" tells moment what format the date is currently in
	date = moment(date, 'D.M.Y').format('L');

	let id = '';

	if(eventLink) {
		//We don't need to know the domain here, this is just a quick hack to get the query parameters values
		id = new URL(eventLink, 'http://fake.com').searchParams.get('event') || '';
	}

	return { id, date, eventLink, location, name, qualificationPeriod };
}
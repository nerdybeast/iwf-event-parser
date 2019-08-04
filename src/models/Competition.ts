import { WeightCategoryResult } from './WeightCategoryResult';
import { EventDetails } from './EventDetails';

export class Competition extends EventDetails {
	public results?: WeightCategoryResult[];

	constructor(eventDetails: EventDetails) {
		super();
		this.date = eventDetails.date;
		this.eventLink = eventDetails.eventLink;
		this.id = eventDetails.id;
		this.location = eventDetails.location;
		this.name = eventDetails.name;
	}
}
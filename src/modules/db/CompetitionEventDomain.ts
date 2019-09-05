import { BaseDomain } from './BaseDomain';
import { firestore } from 'firebase';
import { Inject, Injectable } from '@nestjs/common';
import { EventDetails } from '../../models/EventDetails';

@Injectable()
export class CompetitionEventDomain extends BaseDomain {

	constructor(@Inject('db') db: firestore.Firestore) {
		super(db, 'competition-events')
	}

	public async getAll() : Promise<EventDetails[]> {

		const snapshot: firestore.QuerySnapshot = await super.getAllSnapshot();

		const eventDetails: EventDetails[] = snapshot.docs.map(doc => {

			const eventDetail = new EventDetails();
			eventDetail.date = doc.get('date');
			eventDetail.eventLink = doc.get('eventLink');
			eventDetail.id = doc.get('id');
			eventDetail.location = doc.get('location');
			eventDetail.name = doc.get('name');
			eventDetail.qualificationPeriod = doc.get('qualificationPeriod');

			return eventDetail;
		});

		return eventDetails;
	}
}
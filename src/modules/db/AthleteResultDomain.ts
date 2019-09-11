import { Injectable, Inject } from '@nestjs/common';
import { BaseDomain } from './BaseDomain';
import { firestore } from 'firebase';
import { IAthleteResult } from '../../models/IAthleteResult';

@Injectable()
export class AthleteResultDomain extends BaseDomain {

	constructor(@Inject('db') db: firestore.Firestore) {
		super(db, 'athlete-results');
	}

	public async getAll() : Promise<IAthleteResult[]> {

		const snapshot = await super.getAllSnapshot();

		const athleteResults = snapshot.docs.map<IAthleteResult>(doc => {
			return {
				athleteId: doc.get('athleteId'),
				competitionId: doc.get('competitionId'),
				rank: doc.get('rank'),
				snatch: doc.get('snatch'),
				cj: doc.get('cj'),
				total: doc.get('total'),
				bodyWeight: doc.get('bodyWeight')
			};
		});

		return athleteResults;
	}
}
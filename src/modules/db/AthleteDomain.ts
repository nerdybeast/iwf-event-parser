import { Injectable, Inject } from '@nestjs/common';
import { BaseDomain } from './BaseDomain';
import { firestore } from 'firebase';
import { IPageAthlete } from '../../models/IPageAthlete';

@Injectable()
export class AthleteDomain extends BaseDomain {

	constructor(@Inject('db') db: firestore.Firestore) {
		super(db, 'athletes');
	}

	public async getAll() : Promise<IPageAthlete[]> {

		const snapshot = await super.getAllSnapshot();

		const athletes = snapshot.docs.map<IPageAthlete>(doc => {
			return {
				bioLink: doc.get('bioLink'),
				birthDate: doc.get('birthDate'),
				id: doc.get('id'),
				name: doc.get('name'),
				nationAbbreviation: doc.get('nationAbbreviation')
			};
		});

		return athletes;
	}
}
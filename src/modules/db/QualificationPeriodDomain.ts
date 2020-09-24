import { Inject, Injectable } from "@nestjs/common";
import { BaseDomain } from './BaseDomain';
import { firestore } from 'firebase';
import { QualificationPeriod } from '../../models/QualificationPeriod';

@Injectable()
export class QualificationPeriodDomain extends BaseDomain {

	constructor(@Inject('db') db: firestore.Firestore) {
		super(db, 'qualification-periods');
	}

	public async getAll() : Promise<QualificationPeriod[]> {

		const snapshot = await super.getAllSnapshot();
		const qualificationPeriods = snapshot.docs.map<QualificationPeriod>(doc => new QualificationPeriod(doc.get('period'), doc.get('startDate'), doc.get('endDate')));

		return qualificationPeriods;
	}
}
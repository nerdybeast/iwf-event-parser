import { Injectable, Inject } from '@nestjs/common';
import { BaseDomain } from './BaseDomain';
import { firestore } from 'firebase';

@Injectable()
export class AthleteDomain extends BaseDomain {

	constructor(@Inject('db') db: firestore.Firestore) {
		super(db, 'athletes');
	}
}
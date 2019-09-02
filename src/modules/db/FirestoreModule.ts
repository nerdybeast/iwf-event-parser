import { Module, Provider } from '@nestjs/common';
import admin from 'firebase-admin';

export const dbProvider: Provider = {
	provide: 'db',
	useFactory: () => {

		//Reads from the "FIREBASE_CONFIG" env variable.
		admin.initializeApp();

		const db = admin.firestore();
		return db;
	}
}

@Module({
	providers: [dbProvider],
	exports: [dbProvider]
})
export class FirestoreModule {

}
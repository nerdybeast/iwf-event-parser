import { Module, Provider } from '@nestjs/common';
import firebase, { firestore } from 'firebase';
import { CompetitionEventDomain } from './CompetitionEventDomain';
import { ConfigModule } from '../config/ConfigModule';
import { ConfigService } from '../config/ConfigService';
import { AthleteDomain } from './AthleteDomain';
import { AthleteResultDomain } from './AthleteResultDomain';

//Needed for side effects
import 'firebase/firestore';
import { QualificationPeriodDomain } from './QualificationPeriodDomain';

export const dbProvider: Provider = {
	provide: 'db',
	inject: [
		//This provider is only available in this context because the module below imports the ConfigModule
		ConfigService
	],
	useFactory: (configService: ConfigService) => {

		//https://firebase.google.com/docs/admin/setup/
		firebase.initializeApp(configService.FirebaseOptions())

		const db: firestore.Firestore = firebase.firestore();
		return db;
	}
}

@Module({
	imports: [
		ConfigModule
	],
	providers: [
		dbProvider,
		CompetitionEventDomain,
		AthleteDomain,
		AthleteResultDomain,
		QualificationPeriodDomain
	],
	exports: [
		dbProvider,
		CompetitionEventDomain,
		AthleteDomain,
		AthleteResultDomain,
		QualificationPeriodDomain
	]
})
export class FirestoreModule {

}
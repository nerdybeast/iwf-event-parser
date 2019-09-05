import { Injectable, Inject } from '@nestjs/common';
import Joi, { ObjectSchema } from '@hapi/joi';
import { IEnvConfig } from './IEnvConfig';
import { IFirebaseOptions } from './IFirebaseOptions';

@Injectable()
export class ConfigService {

	private envConfig: IEnvConfig;

	constructor(@Inject('env') env: IEnvConfig) {
		this.envConfig = this.validate(env);
	}

	public FirebaseOptions() : IFirebaseOptions {
		return {
			apiKey: this.envConfig.GOOGLE_API_KEY,
			authDomain: this.envConfig.GOOGLE_AUTH_DOMAIN,
			databaseURL: this.envConfig.GOOGLE_DATABASE_URL,
			projectId: this.envConfig.GOOGLE_PROJECT_ID,
			storageBucket: this.envConfig.GOOGLE_STORAGE_BUCKET,
			messagingSenderId: this.envConfig.GOOGLE_MESSAGING_SENDER_ID,
			appId: this.envConfig.GOOGLE_APP_ID
		};
	}

	private validate(env: IEnvConfig) : IEnvConfig {

		const schema: ObjectSchema = Joi.object({
			GOOGLE_API_KEY: Joi.string().required(),
			GOOGLE_AUTH_DOMAIN: Joi.string().required(),
			GOOGLE_DATABASE_URL: Joi.string().required(),
			GOOGLE_PROJECT_ID: Joi.string().required(),
			GOOGLE_STORAGE_BUCKET: Joi.string().required(),
			GOOGLE_MESSAGING_SENDER_ID: Joi.string().required(),
			GOOGLE_APP_ID: Joi.string().required()
		});

		const { error, value: validatedEnvConfig } = Joi.validate(env, schema, {
			//We're essentially validating process.env here which includes way more key/value pairs than we've defined
			//above. Joi will throw an error unless we state these "extra" keys are okay to be there.
			allowUnknown: true
		});

		if (error) {
			throw new Error(`Config validation error: ${error.message}`);
		}

		return validatedEnvConfig;
	}
}
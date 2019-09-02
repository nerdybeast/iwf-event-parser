import { Module, Provider } from '@nestjs/common';
import moment from 'moment';

export const momentProvider: Provider = {
	provide: 'moment',
	useValue: moment
}

@Module({
	providers: [momentProvider],
	exports: [momentProvider]
})
export class MomentModule {

}
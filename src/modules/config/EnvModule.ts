import { Module, Provider } from '@nestjs/common';

export const envProvider: Provider = {
	provide: 'env',
	useValue: process.env
}

@Module({
	providers: [envProvider],
	exports: [envProvider]
})
export class EnvModule {

}
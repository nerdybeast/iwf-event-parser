import { Athlete } from './Athlete';

export class CompetitionResult {
	public competitionId?: string;
	public rank: number = 0;
	public snatch: number = 0;
	public cj: number = 0;
	public total: number = 0;
	public bodyWeight: number = 0;
	public athlete?: Athlete;
}
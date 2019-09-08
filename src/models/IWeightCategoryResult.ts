import { IPageAthlete } from './IPageAthlete';
import { IAthleteResult } from './IAthleteResult';

export interface IWeightCategoryResult {
	gender: string;
	weightClass: string;
	athletes: IPageAthlete[];
	results: IAthleteResult[];
}
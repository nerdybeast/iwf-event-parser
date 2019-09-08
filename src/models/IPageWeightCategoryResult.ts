import { IPageAthleteResult } from './IPageAthleteResult';

export interface IPageWeightCategoryResult {
	weightClass: string;
	results: IPageAthleteResult[];
}
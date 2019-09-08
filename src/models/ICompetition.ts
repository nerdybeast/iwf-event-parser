import { IWeightCategoryResult } from './IWeightCategoryResult';

export interface ICompetition {
	id: string;
	weightCategoryResults: IWeightCategoryResult[];
	date: string;
	eventLink: string;
	location: string;
	name: string;
	qualificationPeriod?: number;
}
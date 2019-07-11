import { CompetitionResult } from './CompetitionResult';

export class WeightCategoryResult {
	public weightClass?: string;
	public results: CompetitionResult[] = [];
	public gender?: string;
}
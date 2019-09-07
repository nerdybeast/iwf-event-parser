export interface IWeightCategoryResult {
	gender: string;
	weightClass: string;
	athletes: IAthlete[];
	results: ICompetitionResult[];
}

export interface ICompetitionResult extends IPageCompetitionResult {
	competitionId: string;
	athleteId: number;
}

export interface IPageWeightCategoryResult {
	weightClass: string;
	results: IPageCompetitionResult[];
}

export interface IPageCompetitionResult {
	athlete: IPageAthlete;
	rank: number;
	snatch: number;
	cj: number;
	total: number;
	bodyWeight: number;
}

export interface IAthlete extends IPageAthlete {
	id: number;
}

export interface IPageAthlete {
	name: string;
	bioLink: string;
	birthDate: string;
	nationAbbreviation: string;
}
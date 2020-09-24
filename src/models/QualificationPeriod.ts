export class QualificationPeriod {
	public period: number;
	public startDate: string;
	public endDate: string;

	constructor(period: number, startDate: string, endDate: string) {
		this.period = period;
		this.startDate = startDate;
		this.endDate = endDate;
	}
}
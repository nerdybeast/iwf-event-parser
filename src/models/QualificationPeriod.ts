export class QualificationPeriod {
	public period: number;
	public startDate: Date;
	public endDate: Date;

	constructor(period: number, startDate: Date, endDate: Date) {
		this.period = period;
		this.startDate = startDate;
		this.endDate = endDate;
	}
}
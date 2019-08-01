import { EventCategoryEnum } from '../../constants';

export class CalculationService {

	private progressivityConstant: number = 3.3219281;
	private worldRecordPoints: number = 1000;
	private goldEventBonus: number = 1.1;
	private silverEventBonus: number = 1.05;

	public bodyWeightConstant(worldStandard: number) : number {
		return this.worldRecordPoints / Math.pow(worldStandard, this.progressivityConstant);
	}

	public robiPoints(bodyWeightConstant: number, total: number, eventCategory: EventCategoryEnum) : number {

		let points = bodyWeightConstant * Math.pow(total, this.progressivityConstant);

		switch(eventCategory) {
			case EventCategoryEnum.GOLD: {
				points = points * this.goldEventBonus;
				break;
			}
			case EventCategoryEnum.SILVER: {
				points = points * this.silverEventBonus;
			}
		}

		return points;
	}
}
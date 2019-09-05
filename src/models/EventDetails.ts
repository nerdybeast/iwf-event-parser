import { IEventDetails } from './IEventDetails';

export class EventDetails implements IEventDetails {
	public id: string = '';
	public eventLink: string = '';
	public date: string = '';
	public name: string = '';
	public location: string = '';
	public qualificationPeriod?: number;
}
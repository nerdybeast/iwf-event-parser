export enum WeightClassEnum {
	M55 = 'M55',
	M61 = 'M61',
	M67 = 'M67',
	M73 = 'M73',
	M81 = 'M81',
	M89 = 'M89',
	M96 = 'M96',
	M102 = 'M102',
	M109 = 'M109',
	M109PLUS = 'M109+',
	W45 = 'W45',
	W49 = 'W49',
	W55 = 'W55',
	W59 = 'W59',
	W64 = 'W64',
	W71 = 'W71',
	W76 = 'W76',
	W81 = 'W81',
	W87 = 'W87',
	W87PLUS = 'W87+',
}

export const WorldStandardsMap = new Map<WeightClassEnum, number>([
	[WeightClassEnum.M55, 293],
	[WeightClassEnum.M61, 213],
	[WeightClassEnum.M67, 331],
	[WeightClassEnum.M73, 348],
	[WeightClassEnum.M81, 368],
	[WeightClassEnum.M89, 387],
	[WeightClassEnum.M96, 401],
	[WeightClassEnum.M102, 412],
	[WeightClassEnum.M109, 424],
	[WeightClassEnum.M109PLUS, 453],
	[WeightClassEnum.W45, 191],
	[WeightClassEnum.W49, 203],
	[WeightClassEnum.W55, 221],
	[WeightClassEnum.W59, 232],
	[WeightClassEnum.W64, 245],
	[WeightClassEnum.W71, 261],
	[WeightClassEnum.W76, 272],
	[WeightClassEnum.W81, 283],
	[WeightClassEnum.W87, 294],
	[WeightClassEnum.W87PLUS, 320]
]);

export enum EventCategoryEnum {
	GOLD,
	SILVER,
	BRONZE
};
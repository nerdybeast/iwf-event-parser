import { Module } from '@nestjs/common';
import { DebugFactory } from './DebugFactory';

@Module({
	providers: [DebugFactory],
	exports: [DebugFactory]
})
export class DebugModule { }
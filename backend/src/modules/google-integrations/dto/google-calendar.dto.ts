import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const GOOGLE_ATTENDEE_RESPONSE_STATUSES = [
  'needsAction',
  'declined',
  'tentative',
  'accepted',
] as const;

export const GOOGLE_SYNC_CONFLICT_STRATEGIES = [
  'mark',
  'prefer_google',
  'prefer_task',
] as const;

export class GoogleCalendarAttendeeDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsBoolean()
  optional?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(GOOGLE_ATTENDEE_RESPONSE_STATUSES)
  responseStatus?: (typeof GOOGLE_ATTENDEE_RESPONSE_STATUSES)[number];
}

export class CreateGoogleCalendarEventDto {
  @IsOptional()
  @IsString()
  taskId?: string;

  @IsOptional()
  @IsString()
  workspaceId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  summary?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  @IsOptional()
  @IsString()
  calendarId?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  createMeetLink?: boolean;

  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => GoogleCalendarAttendeeDto)
  attendees?: GoogleCalendarAttendeeDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  recurrence?: string[];
}

export class UpdateGoogleCalendarEventDto extends CreateGoogleCalendarEventDto {
  @IsOptional()
  @IsString()
  expectedEtag?: string;
}

export class UpdateGoogleCalendarEventRsvpDto {
  @IsEmail()
  attendeeEmail!: string;

  @IsString()
  @IsIn(GOOGLE_ATTENDEE_RESPONSE_STATUSES)
  responseStatus!: (typeof GOOGLE_ATTENDEE_RESPONSE_STATUSES)[number];

  @IsOptional()
  @IsString()
  calendarId?: string;

  @IsOptional()
  @IsString()
  expectedEtag?: string;
}

export class GoogleCalendarEventDetailQueryDto {
  @IsOptional()
  @IsString()
  calendarId?: string;
}

export class EnqueueTaskSyncJobDto {
  @IsOptional()
  @IsBoolean()
  createMeetLink?: boolean;

  @IsOptional()
  @IsString()
  calendarId?: string;
}

export class RunGoogleSyncJobsQueryDto {
  @IsOptional()
  @IsString()
  workspaceId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class RunBidirectionalSyncQueryDto {
  @IsOptional()
  @IsString()
  workspaceId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsString()
  @IsIn(GOOGLE_SYNC_CONFLICT_STRATEGIES)
  conflictStrategy?: (typeof GOOGLE_SYNC_CONFLICT_STRATEGIES)[number];
}

export class ListGoogleCalendarEventsQueryDto {
  @IsOptional()
  @IsString()
  workspaceId?: string;

  @IsOptional()
  @IsString()
  calendarId?: string;

  @IsOptional()
  @IsDateString()
  timeMin?: string;

  @IsOptional()
  @IsDateString()
  timeMax?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxResults?: number;
}

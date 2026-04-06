import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
  MaxLength,
  IsIn,
} from 'class-validator';

const BLOCK_TYPES = [
  'paragraph',
  'heading1',
  'heading2',
  'heading3',
  'bulletList',
  'orderedList',
  'taskList',
  'codeBlock',
  'image',
  'divider',
  'quote',
  'table',
] as const;

export class CreateBlockDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(BLOCK_TYPES, { message: 'Block type không hợp lệ' })
  type: string;

  @IsOptional()
  @IsString()
  content?: string; // Tiptap JSON string

  @IsOptional()
  sortOrder?: number;
}

export class UpdateBlockDto {
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  @IsIn(BLOCK_TYPES, { message: 'Block type không hợp lệ' })
  type?: string;
}

export class ReorderBlocksDto {
  @IsArray()
  @IsString({ each: true })
  blockIds: string[];
}

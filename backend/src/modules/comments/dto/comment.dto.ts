import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty({ message: 'Nội dung comment không được để trống' })
  content: string;
}

export class UpdateCommentDto {
  @IsString()
  @IsNotEmpty({ message: 'Nội dung comment không được để trống' })
  content: string;
}

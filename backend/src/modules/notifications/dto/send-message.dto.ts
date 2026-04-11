import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsUUID('4', { message: 'recipientId không hợp lệ' })
  recipientId: string;

  @IsString({ message: 'Nội dung tin nhắn không hợp lệ' })
  @MaxLength(2000, { message: 'Nội dung tối đa 2000 ký tự' })
  content: string;

  @IsOptional()
  @IsUUID('4', { message: 'workspaceId không hợp lệ' })
  workspaceId?: string;
}

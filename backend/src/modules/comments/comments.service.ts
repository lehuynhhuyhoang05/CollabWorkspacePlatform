import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from './entities/comment.entity';
import { CreateCommentDto, UpdateCommentDto } from './dto/comment.dto';

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    @InjectRepository(Comment)
    private readonly commentsRepository: Repository<Comment>,
  ) {}

  async findAllForBlock(blockId: string): Promise<Comment[]> {
    return this.commentsRepository.find({
      where: { blockId },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
  }

  async create(
    blockId: string,
    dto: CreateCommentDto,
    userId: string,
  ): Promise<Comment> {
    const comment = this.commentsRepository.create({
      blockId,
      userId,
      content: dto.content,
    });

    return this.commentsRepository.save(comment);
  }

  async update(
    commentId: string,
    dto: UpdateCommentDto,
    userId: string,
  ): Promise<Comment> {
    const comment = await this.findOneRaw(commentId);

    // Only comment author can edit
    if (comment.userId !== userId) {
      throw new ForbiddenException('Chỉ tác giả mới có thể sửa comment');
    }

    comment.content = dto.content;
    return this.commentsRepository.save(comment);
  }

  async remove(commentId: string, userId: string): Promise<void> {
    const comment = await this.findOneRaw(commentId);

    // Only comment author can delete
    if (comment.userId !== userId) {
      throw new ForbiddenException('Chỉ tác giả mới có thể xoá comment');
    }

    await this.commentsRepository.delete(commentId);
  }

  private async findOneRaw(id: string): Promise<Comment> {
    const comment = await this.commentsRepository.findOne({ where: { id } });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    return comment;
  }
}

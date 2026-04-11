import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Block } from '../../blocks/entities/block.entity';
import { User } from '../../users/entities/user.entity';

@Entity('comments')
export class Comment {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36, name: 'block_id' })
  blockId: string;

  @Column({ type: 'varchar', length: 36, name: 'user_id' })
  userId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'boolean', name: 'is_resolved', default: false })
  isResolved: boolean;

  @Column({
    type: 'varchar',
    length: 36,
    name: 'resolved_by_user_id',
    nullable: true,
  })
  resolvedByUserId: string | null;

  @Column({ type: 'timestamp', name: 'resolved_at', nullable: true })
  resolvedAt: Date | null;

  @Column({
    type: 'varchar',
    length: 36,
    name: 'reopened_by_user_id',
    nullable: true,
  })
  reopenedByUserId: string | null;

  @Column({ type: 'timestamp', name: 'reopened_at', nullable: true })
  reopenedAt: Date | null;

  @ManyToOne(() => Block, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'block_id' })
  block: Block;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'resolved_by_user_id' })
  resolvedByUser?: User | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reopened_by_user_id' })
  reopenedByUser?: User | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = uuidv4();
    }
  }
}

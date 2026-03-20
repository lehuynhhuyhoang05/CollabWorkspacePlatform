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
import { Page } from '../../pages/entities/page.entity';
import { User } from '../../users/entities/user.entity';

@Entity('blocks')
export class Block {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36, name: 'page_id' })
  pageId: string;

  @Column({ type: 'varchar', length: 50 })
  type: string; // paragraph, heading1, heading2, heading3, bulletList, orderedList, taskList, codeBlock, image, divider

  @Column({ type: 'text', nullable: true })
  content: string | null; // Tiptap JSON string

  @Column({ type: 'int', default: 0, name: 'sort_order' })
  sortOrder: number;

  @Column({ type: 'varchar', length: 36, name: 'created_by' })
  createdBy: string;

  @ManyToOne(() => Page, (page) => page.blocks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'page_id' })
  page: Page;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator: User;

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

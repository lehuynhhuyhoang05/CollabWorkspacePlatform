import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  BeforeInsert,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Page } from '../../pages/entities/page.entity';
import { User } from '../../users/entities/user.entity';
import { SharePermission } from '../dto/create-share.dto';

@Entity('page_shares')
export class PageShare {
  @PrimaryColumn('varchar', { length: 36 })
  id: string;

  @Column({ name: 'page_id', type: 'varchar', length: 36 })
  pageId: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36, nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 96, unique: true })
  token: string;

  @Column({ type: 'varchar', length: 10, default: SharePermission.VIEW })
  permission: SharePermission;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Page, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'page_id' })
  page: Page;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @BeforeInsert()
  generateId() {
    this.id = uuidv4();
  }
}

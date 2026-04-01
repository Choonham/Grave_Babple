import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * 앱 정보 엔티티
 */
@Entity('app')
export class App {
  @PrimaryGeneratedColumn('uuid')
  app_id: string;

  @Column({type: 'varchar', length: 10})
  app_version: string;
}

/**
 * 공지사항 엔티티
 */
@Entity('announcement')
export class Announcement {
  @PrimaryGeneratedColumn()
  announce_code: number;

  @Column({type: 'varchar', length: 255})
  title: string;

  @Column({type: 'text'})
  content: string;

  @CreateDateColumn({type: 'timestamptz'})
  created_at: Date;

  @UpdateDateColumn({type: 'timestamptz'})
  updated_at: Date;

  @Column({type: 'boolean', default: false})
  important: boolean;

  @Column({type: 'int', default: 0})
  view_count: number;

  @Column({type: 'boolean', default: false})
  del_yn: boolean;
}

/**
 * 테스트 신청 엔티티
 */
@Entity('test_applications')
export class TestApplication {
  @PrimaryGeneratedColumn('uuid')
  application_id: string;

  @Column({type: 'varchar', length: 100})
  name: string;

  @Column({type: 'varchar', length: 255})
  email: string;

  @Column({type: 'varchar', length: 20})
  platform: 'android' | 'ios';

  @Column({type: 'text', nullable: true})
  test_link?: string;

  @Column({type: 'boolean', default: false})
  link_sent: boolean;

  @Column({type: 'timestamptz', nullable: true})
  link_sent_at?: Date;

  @CreateDateColumn({type: 'timestamptz'})
  created_at: Date;

  @UpdateDateColumn({type: 'timestamptz'})
  updated_at: Date;
}
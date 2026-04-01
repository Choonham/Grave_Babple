import {Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index} from 'typeorm';

@Entity('search_logs')
export class SearchLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_search_logs_keyword')
  @Column({type: 'varchar', length: 100})
  keyword: string;

  @Column({type: 'varchar', length: 20, nullable: true})
  search_type?: string | null;

  @CreateDateColumn({type: 'timestamptz'})
  created_at: Date;
}

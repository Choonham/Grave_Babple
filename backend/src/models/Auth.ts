import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * 이메일 인증 엔티티
 * 일반 회원가입 사용자의 이메일 인증 상태를 관리합니다.
 */
@Entity('email_verification')
export class EmailVerification {
  @PrimaryGeneratedColumn('uuid')
  verification_id: string;

  @Column({type: 'varchar', length: 255, unique: true})
  email: string;

  @Column({type: 'varchar', length: 6})
  code: string;

@Column({type: 'varchar', length: 50, default: 'GENERAL'})
purpose: string;

  @Column({type: 'timestamptz'})
  expires_at: Date;

  @Column({type: 'int', default: 0})
  attempt_count: number;

  @Column({type: 'int', default: 0})
  send_count: number;

  @Column({type: 'timestamptz'})
  last_sent_at: Date;

  @Column({type: 'boolean', default: false})
  is_verified: boolean;

  @Column({type: 'timestamptz', nullable: true})
  verified_at?: Date;

  @CreateDateColumn({type: 'timestamptz'})
  created_at: Date;

  @UpdateDateColumn({type: 'timestamptz'})
  updated_at: Date;
}

/**
 * 회원 탈퇴 토큰 엔티티
 * 웹에서 회원 탈퇴 링크를 통한 탈퇴 처리를 위한 토큰
 */
@Entity('account_deletion_tokens')
export class AccountDeletionToken {
  @PrimaryGeneratedColumn('uuid')
  token_id: string;

  @Column({type: 'uuid'})
  user_id: string;

  @Column({type: 'varchar', length: 255, unique: true})
  token: string;

  @Column({type: 'varchar', length: 255})
  email: string;

  @Column({type: 'timestamptz'})
  expires_at: Date;

  @Column({type: 'boolean', default: false})
  is_used: boolean;

  @Column({type: 'timestamptz', nullable: true})
  used_at?: Date;

  @CreateDateColumn({type: 'timestamptz'})
  created_at: Date;

  @UpdateDateColumn({type: 'timestamptz'})
  updated_at: Date;
}



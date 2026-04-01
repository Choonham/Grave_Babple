import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

/**
 * 사용자 신고 엔티티
 */
@Entity('user_reports')
export class UserReport {
  @PrimaryGeneratedColumn('uuid')
  report_id: string;

  @Column({type: 'uuid'})
  reporter_id: string; // 신고자 ID

  @Column({type: 'uuid'})
  reported_user_id: string; // 신고당한 사용자 ID

  @Column({type: 'varchar', length: 20, default: 'USER'})
  report_type: string; // 신고 타입: USER(사용자 신고), POST(게시글 신고), CHAT(채팅 신고)

  @Column({type: 'uuid', nullable: true})
  recipe_post_id?: string; // 게시글 신고인 경우 해당 게시글 ID

  @Column({type: 'uuid', nullable: true})
  chat_message_id?: string; // 채팅 신고인 경우 해당 채팅 메시지 ID

  @Column({type: 'uuid', nullable: true})
  chat_room_id?: string; // 채팅 신고인 경우 해당 채팅방 ID

  @Column({type: 'text'})
  report_reason: string; // 신고 사유

  @Column({type: 'text', nullable: true})
  report_detail?: string; // 신고 상세 내용

  @Column({type: 'varchar', length: 20, default: 'PENDING'})
  status: string; // 신고 상태: PENDING, PROCESSING, RESOLVED, REJECTED

  @Column({type: 'text', nullable: true})
  admin_comment?: string; // 관리자 코멘트

  @Column({type: 'varchar', length: 50, nullable: true})
  penalty_action?: string; // 제제 조치: WARNING, SUSPEND_7DAYS, SUSPEND_30DAYS, BAN, NONE

  @Column({type: 'timestamptz', nullable: true})
  penalty_applied_at?: Date; // 제제 적용 시간

  @Column({type: 'timestamptz', nullable: true})
  resolved_at?: Date; // 신고 처리 완료 시간

  @Column({type: 'uuid', nullable: true})
  resolved_by?: string; // 처리한 관리자 ID

  @CreateDateColumn({type: 'timestamptz'})
  created_at: Date;

  @UpdateDateColumn({type: 'timestamptz'})
  updated_at: Date;

  // 관계 설정
  @ManyToOne('User', 'reports')
  @JoinColumn({name: 'reporter_id'})
  reporter: any;

  @ManyToOne('User', 'reportedBy')
  @JoinColumn({name: 'reported_user_id'})
  reportedUser: any;

  @ManyToOne('User', 'resolvedReports')
  @JoinColumn({name: 'resolved_by'})
  resolver: any;

  @ManyToOne('RecipePost', 'reports')
  @JoinColumn({name: 'recipe_post_id'})
  recipePost: any;

  @ManyToOne('ChatMessage', 'reports')
  @JoinColumn({name: 'chat_message_id'})
  chatMessage: any;

  @ManyToOne('ChatRoom', 'reports')
  @JoinColumn({name: 'chat_room_id'})
  chatRoom: any;
}

/**
 * 사용자 숨김 처리 엔티티
 */
@Entity('hidden_users')
export class HiddenUser {
  @PrimaryGeneratedColumn('uuid')
  hidden_id: string;

  @Column({type: 'uuid'})
  user_id: string; // 숨김 처리한 사용자 ID

  @Column({type: 'uuid'})
  hidden_user_id: string; // 숨김 처리된 사용자 ID

  @CreateDateColumn({type: 'timestamptz'})
  created_at: Date;

  // 관계 설정
  @ManyToOne('User', 'hiddenUsers')
  @JoinColumn({name: 'user_id'})
  user: any;

  @ManyToOne('User', 'hiddenByUsers')
  @JoinColumn({name: 'hidden_user_id'})
  hiddenUser: any;
}


import {
  Entity,
  PrimaryGeneratedColumn,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import type {Point} from 'geojson';

/**
 * 사용자 엔티티
 * 사용자 및 계정 도메인의 핵심 엔티티
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  user_id: string;

  @Column({type: 'varchar', length: 255, unique: true})
  email: string;

  @Column({type: 'text'})
  password_hash: string;

  @Column({type: 'varchar', length: 50, unique: true})
  nickname: string;

  @Column({type: 'text', nullable: true})
  profile_image_url?: string;

  @Column({type: 'varchar', length: 255, nullable: true})
  introduction?: string;

  @Column({type: 'geography', spatialFeatureType: 'Point', srid: 4326, nullable: true})
  location?: Point;

  @Column({type: 'varchar', length: 100, nullable: true})
  location_text?: string;

  @Column({type: 'varchar', length: 20, nullable: true})
  phone_number?: string;

  @Column({type: 'varchar', length: 20, nullable: true})
  social_provider?: string | null;

  @Column({type: 'varchar', length: 10, nullable: true})
  age_group?: string;

  @Column({type: 'varchar', length: 10, nullable: true})
  gender?: string;

  @Column({type: 'smallint', default: 0})
  role: number;

  @Column({type: 'boolean', default: true})
  is_push_notification_enabled: boolean;

  @Column({type: 'varchar', length: 255, nullable: true})
  fcm_token?: string | null;

  @Column({type: 'boolean', default: false})
  is_email_verified: boolean;

  @Column({type: 'uuid', nullable: true})
  store_id?: string;

  @CreateDateColumn({type: 'timestamptz'})
  created_at: Date;

  @UpdateDateColumn({type: 'timestamptz'})
  updated_at: Date;

  @Column({type: 'smallint', nullable: true})
  view_mode?: number;

  @Column({type: 'boolean', default: false})
  delete_yn: boolean;

  @Column({type: 'timestamptz', nullable: true})
  deleted_at?: Date;

  // 관계 설정 (순환 참조 방지를 위해 문자열로 참조)
  @OneToMany('LinkedEmail', 'user')
  linkedEmails: any[];

  @OneToMany('UserTermAgree', 'user')
  userTermAgrees: any[];

  @OneToMany('Relationship', 'follower')
  following: any[];

  @OneToMany('Relationship', 'following')
  followers: any[];

  @OneToMany('UserTitle', 'user')
  userTitles: any[];

  @OneToOne('UserCredit', 'user')
  userCredit: any;

  @OneToMany('UserReport', 'reporter')
  reports: any[];

  @OneToMany('UserReport', 'reportedUser')
  reportedBy: any[];

  @OneToMany('UserReport', 'resolver')
  resolvedReports: any[];

  @OneToMany('HiddenUser', 'user')
  hiddenUsers: any[];

  @OneToMany('HiddenUser', 'hiddenUser')
  hiddenByUsers: any[];
}

/**
 * 연결된 이메일 엔티티
 * 소셜 로그인 연동을 위한 엔티티
 */
@Entity('linked_email')
export class LinkedEmail {
  @PrimaryGeneratedColumn('uuid')
  linked_email_id: string;

  @Column({type: 'uuid'})
  user_id: string;

  @Column({type: 'varchar', length: 255})
  email: string;

  @Column({type: 'varchar', length: 30})
  platform: string;

  // 관계 설정 (순환 참조 방지를 위해 문자열로 참조)
  @ManyToOne('User', 'linkedEmails')
  @JoinColumn({name: 'user_id'})
  user: any;
}

/**
 * 약관 엔티티
 */
@Entity('terms')
export class Term {
  @PrimaryGeneratedColumn()
  term_id: number;

  @Column({type: 'varchar', length: 255})
  title: string;

  @Column({type: 'text'})
  content: string;

  @Column({type: 'boolean', default: false})
  req: boolean; // 실제 DB 필드명 사용

  @Column({type: 'smallint', default: 0})
  type: number; // 0: 일반 약관, 1: 비즈니스 약관

  // 관계 설정 (순환 참조 방지를 위해 문자열로 참조)
  @OneToMany('UserTermAgree', 'term')
  userTermAgrees: any[];
}

/**
 * 사용자 약관 동의 엔티티
 */
@Entity('user_term_agree')
export class UserTermAgree {
  @PrimaryGeneratedColumn()
  team_agree_id: number;

  @Column({type: 'uuid'})
  user_id: string;

  @Column({type: 'int'})
  term_id: number;

  @Column({type: 'boolean', default: false})
  agree: boolean; // 실제 DB 필드명 사용

  // 관계 설정 (순환 참조 방지를 위해 문자열로 참조)
  @ManyToOne('User', 'userTermAgrees')
  @JoinColumn({name: 'user_id'})
  user: any;

  @ManyToOne('Term', 'userTermAgrees')
  @JoinColumn({name: 'term_id'})
  term: any;
}

/**
 * 리다이렉트 URL 엔티티
 */
@Entity('ridirect_urls')
export class RedirectUrl {
  @PrimaryGeneratedColumn()
  url_id: number;

  @Column({type: 'text'})
  url: string;

  @Column({type: 'text', nullable: true})
  description?: string;
}

/**
 * 팔로우 관계 엔티티
 */
@Entity('relationships')
export class Relationship {
  @Column({type: 'uuid'})
  follower_id: string;

  @Column({type: 'uuid'})
  following_id: string;

  @Column({type: 'boolean', default: true})
  is_notification_enabled: boolean;

  @CreateDateColumn({type: 'timestamptz'})
  created_at: Date;

  // 복합 기본키 설정
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // 관계 설정
  @ManyToOne(() => User, (user) => user.following)
  @JoinColumn({name: 'follower_id'})
  follower: User;

  @ManyToOne(() => User, (user) => user.followers)
  @JoinColumn({name: 'following_id'})
  following: User;
}

/**
 * 타이틀 엔티티
 */
@Entity('titles')
export class Title {
  @PrimaryGeneratedColumn()
  title_id: number;

  @Column({type: 'varchar', length: 100, unique: true})
  name: string;

  @Column({type: 'text'})
  description: string;

  @Column({type: 'text', nullable: true})
  icon_url?: string;

  @CreateDateColumn({type: 'timestamptz'})
  created_at: Date;

  // 관계 설정
  @OneToMany(() => UserTitle, (userTitle) => userTitle.title)
  userTitles: UserTitle[];
}

/**
 * 사용자 타이틀 엔티티
 */
@Entity('user_titles')
export class UserTitle {
  @PrimaryColumn({type: 'uuid'})
  user_id: string;

  @PrimaryColumn({type: 'int'})
  title_id: number;

  @CreateDateColumn({type: 'timestamptz'})
  achieved_at: Date;

  // 관계 설정
  @ManyToOne(() => User, (user) => user.userTitles)
  @JoinColumn({name: 'user_id'})
  user: User;

  @ManyToOne(() => Title, (title) => title.userTitles)
  @JoinColumn({name: 'title_id'})
  title: Title;
}

/**
 * 사용자 크레딧 엔티티
 */
@Entity('user_credits')
export class UserCredit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({type: 'uuid'})
  user_id: string;

  @Column({type: 'numeric', default: 0})
  balance: number;

  @UpdateDateColumn({type: 'timestamptz'})
  updated_at: Date;

  // 관계 설정
  @OneToOne(() => User, (user) => user.userCredit)
  @JoinColumn({name: 'user_id'})
  user: User;
}

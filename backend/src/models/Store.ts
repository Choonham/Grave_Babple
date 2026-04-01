import {
  Entity,
  PrimaryGeneratedColumn,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import type {Point} from 'geojson';
// import {User} from './User';
// import {Ingredient} from './Post';

/**
 * 상점 엔티티
 */
@Entity('stores')
export class Store {
  @PrimaryGeneratedColumn('uuid')
  store_id: string;

  @Column({type: 'uuid'})
  user_id: string;

  @Column({type: 'varchar', length: 100, nullable: true})
  biz_reg_no?: string;

  @Column({type: 'varchar', length: 100, nullable: true})
  owner?: string;

  @Column({type: 'varchar', length: 100})
  name: string;

  @Column({type: 'text', nullable: true})
  address?: string;

  @Column({type: 'geography', spatialFeatureType: 'Point', srid: 4326, nullable: true})
  location?: Point;

  @Column({type: 'varchar', length: 20, nullable: true})
  phone_number?: string;

  @Column({type: 'text', nullable: true})
  description?: string;

  @Column({type: 'text', nullable: true})
  profile_image_url?: string;

  @Column({type: 'jsonb', nullable: true})
  off_days?: any;

  @Column({type: 'jsonb', nullable: true})
  operating_hours?: any;

  @CreateDateColumn({type: 'timestamptz'})
  created_at: Date;

  @UpdateDateColumn({type: 'timestamptz'})
  updated_at: Date;

  @Column({type: 'int', default: 0})
  visit_count: number;

  // 관계 설정 (순환 참조 방지를 위해 문자열로 참조)
  @ManyToOne('User', 'stores')
  @JoinColumn({name: 'user_id'})
  user: any;

  @OneToMany('Flyer', 'store')
  flyers: any[];

  @OneToMany('Promotion', 'store')
  promotions: any[];
}

/**
 * 팁 엔티티
 */
@Entity('tips')
export class Tip {
  @PrimaryGeneratedColumn()
  tip_id: number;

  @Column({type: 'varchar', length: 255})
  content: string;
}

/**
 * 전단지 엔티티
 */
@Entity('flyers')
export class Flyer {
  @PrimaryGeneratedColumn('uuid')
  flyer_id: string;

  @Column({type: 'uuid'})
  store_id: string;

  @Column({type: 'varchar', length: 100})
  title: string;

  @Column({type: 'date'})
  start_date: Date;

  @Column({type: 'date'})
  end_date: Date;

  @Column({type: 'text'})
  flyer_image_url: string;

  @CreateDateColumn({type: 'timestamptz'})
  created_at: Date;

  @Column({type: 'int', default: 0})
  view_count: number;

  @Column({type: 'smallint', nullable: true})
  status?: number;

  @Column({type: 'boolean', default: false})
  delete_yn: boolean;

  @Column({type: 'timestamptz', nullable: true})
  deleted_at?: Date;

  // 관계 설정 (순환 참조 방지를 위해 문자열로 참조)
  @ManyToOne('Store', 'flyers')
  @JoinColumn({name: 'store_id'})
  store: any;

  @OneToMany('Promotion', 'flyer')
  promotions: any[];
}

/**
 * 프로모션 엔티티
 */
@Entity('promotions')
export class Promotion {
  @PrimaryGeneratedColumn('uuid')
  promotion_id: string;

  @Column({type: 'uuid'})
  store_id: string;

  @Column({type: 'int'})
  ingredient_id: number;

  @Column({type: 'uuid', nullable: true})
  flyer_id?: string;

  @Column({type: 'varchar', length: 100})
  title: string;

  @Column({type: 'text', nullable: true})
  description?: string;

  @Column({type: 'numeric'})
  sale_price: number;

  @Column({type: 'numeric', nullable: true})
  original_price?: number;

  @Column({type: 'date'})
  start_date: Date;

  @Column({type: 'date'})
  end_date: Date;

  @Column({type: 'text', nullable: true})
  promotion_image_url?: string;

  @Column({type: 'numeric', nullable: true})
  quantity?: number;

  @Column({type: 'varchar', length: 20, nullable: true})
  quantity_unit?: string;

  @CreateDateColumn({type: 'timestamptz'})
  created_at: Date;

  @Column({type: 'int', default: 0})
  view_count: number;

  @Column({type: 'smallint', nullable: true})
  status?: number;

  @Column({type: 'boolean', default: false})
  delete_yn: boolean;

  @Column({type: 'timestamptz', nullable: true})
  deleted_at?: Date;

  // 관계 설정 (순환 참조 방지를 위해 문자열로 참조)
  @ManyToOne('Store', 'promotions')
  @JoinColumn({name: 'store_id'})
  store: any;

  @ManyToOne('Ingredient', 'promotions')
  @JoinColumn({name: 'ingredient_id'})
  ingredient: any;

  @ManyToOne('Flyer', 'promotions')
  @JoinColumn({name: 'flyer_id'})
  flyer: any;
}

/**
 * 광고주 엔티티
 */
@Entity('advertisers')
export class Advertiser {
  @PrimaryGeneratedColumn('uuid')
  advertiser_id: string;

  @Column({type: 'uuid', unique: true})
  user_id: string;

  @Column({type: 'varchar', length: 100})
  biz_name: string;

  @Column({type: 'varchar', length: 50, nullable: true})
  biz_owner?: string;

  @Column({type: 'varchar', length: 50})
  biz_reg_no: string;

  @Column({type: 'varchar', length: 255, nullable: true})
  biz_address?: string;

  @Column({type: 'numeric', default: 0})
  charged: number;

  @CreateDateColumn({type: 'timestamptz'})
  created_at: Date;

  // 관계 설정 (순환 참조 방지를 위해 문자열로 참조)
  @ManyToOne('User', 'advertisers')
  @JoinColumn({name: 'user_id'})
  user: any;

  @OneToMany('AdCampaign', 'advertiser')
  adCampaigns: any[];

  @OneToMany('AdCreative', 'advertiser')
  adCreatives: any[];
}

/**
 * 광고 캠페인 엔티티
 */
@Entity('ad_campaigns')
export class AdCampaign {
  @PrimaryGeneratedColumn('uuid')
  campaign_id: string;

  @Column({type: 'uuid'})
  advertiser_id: string;

  @Column({type: 'varchar', length: 100})
  campaign_name: string;

  @Column({type: 'numeric'})
  total_budget: number;

  @Column({type: 'numeric'})
  cpi: number;

  @Column({type: 'date'})
  start_date: Date;

  @Column({type: 'date'})
  end_date: Date;

  @Column({type: 'varchar', length: 20, default: 'PENDING'})
  status: string;

  @CreateDateColumn({type: 'timestamptz'})
  created_at: Date;

  @UpdateDateColumn({type: 'timestamptz'})
  updated_at: Date;

  @Column({type: 'boolean', default: false})
  delete_yn: boolean;

  @Column({type: 'timestamptz', nullable: true})
  deleted_at?: Date;

  @Column({type: 'int', default: 0})
  view_count: number;

  @Column({type: 'int', default: 0})
  click_count: number;

  // 관계 설정 (순환 참조 방지를 위해 문자열로 참조)
  @ManyToOne('Advertiser', 'adCampaigns')
  @JoinColumn({name: 'advertiser_id'})
  advertiser: any;

  @OneToMany('AdCreative', 'campaign')
  adCreatives: any[];
}

/**
 * 광고 소재 엔티티
 */
@Entity('ad_creatives')
export class AdCreative {
  @PrimaryGeneratedColumn('uuid')
  creative_id: string;

  @Column({type: 'uuid'})
  advertiser_id: string;

  @Column({type: 'uuid', nullable: true})
  campaign_id?: string;

  @Column({type: 'varchar', length: 100, nullable: true})
  ad_title?: string;

  @Column({type: 'text', nullable: true})
  ad_body?: string;

  @Column({type: 'text'})
  ad_image_url: string;

  @Column({type: 'smallint', nullable: true})
  ad_type?: number;

  @Column({type: 'text'})
  landing_page_url: string;

  @Column({type: 'text', nullable: true})
  creater_image_url?: string;

  @Column({type: 'varchar', length: 50, nullable: true})
  creater_name?: string;

  @CreateDateColumn({type: 'timestamptz'})
  created_at: Date;

  @UpdateDateColumn({type: 'timestamptz'})
  updated_at: Date;

  @Column({type: 'boolean', default: false})
  delete_yn: boolean;

  @Column({type: 'timestamptz', nullable: true})
  deleted_at?: Date;

  // 관계 설정 (순환 참조 방지를 위해 문자열로 참조)
  @ManyToOne('Advertiser', 'adCreatives')
  @JoinColumn({name: 'advertiser_id'})
  advertiser: any;

  @ManyToOne('AdCampaign', 'adCreatives')
  @JoinColumn({name: 'campaign_id'})
  campaign: any;

  @OneToMany('AdImpression', 'creative')
  adImpressions: any[];

  @OneToMany('AdClick', 'creative')
  adClicks: any[];
}

/**
 * 광고 노출 엔티티
 */
@Entity('ad_impressions')
export class AdImpression {
  @PrimaryGeneratedColumn('uuid')
  impression_id: string;
  @Column({type: 'uuid'})
  creative_id: string;

  @Column({type: 'uuid'})
  user_id: string;

  @Column({type: 'uuid', nullable: true})
  recipe_post_id?: string;

  @Column({type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP'})
  timestamp: Date;

  @Column({type: 'boolean', default: false})
  clicked: boolean;

  // 관계 설정 (순환 참조 방지를 위해 문자열로 참조)
  @ManyToOne('AdCreative', 'adImpressions')
  @JoinColumn({name: 'creative_id'})
  creative: any;

  @ManyToOne('User', 'adImpressions')
  @JoinColumn({name: 'user_id'})
  user: any;

  @ManyToOne('RecipePost', 'recipe_post_id')
  @JoinColumn({name: 'recipe_post_id'})
  recipePost: any;

  @OneToMany('AdClick', 'impression')
  adClicks: any[];

  @OneToMany('CreditTransaction', 'sourceImpression')
  creditTransactions: any[];
}

/**
 * 광고 클릭 엔티티
 */
@Entity('ad_clicks')
export class AdClick {
  @PrimaryGeneratedColumn('uuid')
  click_id: string;

  @Column({type: 'uuid'})
  creative_id: string;

  @Column({type: 'uuid'})
  user_id: string;

  @Column({type: 'uuid', nullable: true})
  impression_id?: string;

  @Column({type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP'})
  timestamp: Date;

  // 관계 설정 (순환 참조 방지를 위해 문자열로 참조)
  @ManyToOne('AdCreative', 'adClicks')
  @JoinColumn({name: 'creative_id'})
  creative: any;

  @ManyToOne('User', 'adClicks')
  @JoinColumn({name: 'user_id'})
  user: any;

  @ManyToOne('AdImpression', 'adClicks')
  @JoinColumn({name: 'impression_id'})
  impression: any;
}

/**
 * 크레딧 거래 엔티티
 */
@Entity('credit_transactions')
export class CreditTransaction {
  @PrimaryGeneratedColumn('uuid')
  transaction_id: string;

  @Column({type: 'uuid'})
  user_id: string;

  @Column({type: 'numeric'})
  amount: number;

  @Column({type: 'varchar', length: 50})
  type: string;

  @Column({type: 'uuid', nullable: true})
  source_impression_id?: string;

  @CreateDateColumn({type: 'timestamptz'})
  created_at: Date;

  // 관계 설정 (순환 참조 방지를 위해 문자열로 참조)
  @ManyToOne('User', 'creditTransactions')
  @JoinColumn({name: 'user_id'})
  user: any;

  @ManyToOne('AdImpression', 'creditTransactions')
  @JoinColumn({name: 'source_impression_id'})
  sourceImpression: any;
}

/**
 * 사용자 크래딧 엔티티
 */
@Entity('user_credits')
export class UserCredit {
  @PrimaryColumn({type: 'uuid'})
  user_id: string;

  @Column({type: 'numeric', default: 0})
  balance: number;

  @UpdateDateColumn({type: 'timestamptz'})
  updated_at: Date;

  // 관계 설정 (순환 참조 방지를 위해 문자열로 참조)
  @ManyToOne('User', 'userCredits')
  @JoinColumn({name: 'user_id'})
  user: any;
}

/**
 * 기획 상품 노출 추적 엔티티
 */
@Entity('promotion_views')
export class PromotionView {
  @PrimaryGeneratedColumn('uuid')
  view_id: string;

  @Column({type: 'uuid'})
  promotion_id: string;

  @Column({type: 'uuid', nullable: true})
  user_id?: string;

  @CreateDateColumn({type: 'timestamptz'})
  timestamp: Date;

  // 관계 설정 (순환 참조 방지를 위해 문자열로 참조)
  @ManyToOne('Promotion', 'promotionViews')
  @JoinColumn({name: 'promotion_id'})
  promotion: any;

  @ManyToOne('User', 'promotionViews')
  @JoinColumn({name: 'user_id'})
  user: any;
}

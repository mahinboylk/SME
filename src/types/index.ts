export type UserRole = 'super_admin' | 'government_officer' | 'sme_owner' | 'buyer' | 'trade_consultant';
export type CompanyMemberRole = 'owner' | 'admin' | 'member';
export type TradeFlow = 'import' | 'export' | 're_export';
export type ListingStatus = 'draft' | 'active' | 'paused' | 'sold' | 'expired';
export type ReportStatus = 'pending' | 'generating' | 'completed' | 'failed';
export type AIRequestStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cached';
export type MessageType = 'text' | 'image' | 'file' | 'system';
export type ChatRoomType = 'direct' | 'group';
export type BookmarkType = 'product' | 'listing' | 'market' | 'company';
export type NotificationType = 'system' | 'trade_alert' | 'message' | 'marketplace' | 'compliance' | 'ai_result';

export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  created_by: string | null;
  updated_by: string | null;
}

export interface User extends Omit<BaseEntity, 'created_by' | 'updated_by'> {
  role: UserRole;
  email: string;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  language_preference: string;
  is_active: boolean;
  last_login_at: string | null;
  auth_provider: string | null;
}

export interface Company extends BaseEntity {
  name: string;
  registration_number: string;
  country: string;
  province: string | null;
  district: string | null;
  city: string | null;
  address: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  logo_key: string | null;
  cover_key: string | null;
  document_keys: string[] | null;
  is_verified: boolean;
  verified_at: string | null;
  verified_by: string | null;
  verification_status: string | null;
  verification_documents: string[] | null;
  rejected_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  industry: string | null;
  employee_count: string | null;
  annual_revenue: string | null;
  export_experience_years: number | null;
}

export interface CompanyMember extends BaseEntity {
  company_id: string;
  user_id: string;
  role: CompanyMemberRole;
  is_primary_contact: boolean;
  company?: Company;
  user?: User;
}

export interface SellerProfile extends BaseEntity {
  user_id: string;
  company_id: string | null;
  selling_categories: string[] | null;
  export_countries: string[] | null;
  min_order_value: number | null;
  lead_time_days: number | null;
  certifications: string[] | null;
  bio: string | null;
  user?: User;
  company?: Company;
}

export interface BuyerProfile extends BaseEntity {
  user_id: string;
  company_id: string | null;
  buying_categories: string[] | null;
  preferred_countries: string[] | null;
  min_order_value: number | null;
  max_order_value: number | null;
  payment_terms: string | null;
  verification_status: string | null;
  bio: string | null;
  user?: User;
  company?: Company;
}

export interface Product extends BaseEntity {
  company_id: string;
  name: string;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  unit_price: number | null;
  currency: string;
  min_order_quantity: number | null;
  unit_type: string | null;
  origin_country: string;
  is_active: boolean;
  specifications: Record<string, unknown> | null;
  certifications: Record<string, unknown> | null;
  company?: Company;
  images?: ProductImage[];
  hs_codes?: ProductHSCode[];
}

export interface ProductImage extends BaseEntity {
  product_id: string;
  image_url: string;
  display_order: number;
  is_primary: boolean;
  alt_text: string | null;
}

export interface HSCode extends BaseEntity {
  code: string;
  description: string | null;
  section: string | null;
  chapter: string | null;
  heading: string | null;
  subheading: string | null;
  level: number;
  parent_code: string | null;
  is_leaf: boolean;
}

export interface ProductHSCode extends BaseEntity {
  product_id: string;
  hs_code_id: string;
  confidence_score: number | null;
  is_primary: boolean;
  source: 'ai' | 'manual' | 'verified';
  rationale: string | null;
  hs_code?: HSCode;
}

export interface Country extends BaseEntity {
  iso_code: string;
  iso_code_2: string;
  name: string;
  region: string | null;
  sub_region: string | null;
  income_group: string | null;
  latitude: number | null;
  longitude: number | null;
  population: number | null;
  gdp_usd: number | null;
}

export interface TradeStatistic extends BaseEntity {
  reporter_country_id: string;
  partner_country_id: string;
  hs_code_id: string;
  year: number;
  trade_flow: TradeFlow;
  trade_value_usd: number;
  quantity: number | null;
  quantity_unit: string | null;
  data_source: string;
  data_source_id: string | null;
}

export interface Tariff extends BaseEntity {
  reporter_country_id: string;
  partner_country_id: string;
  hs_code_id: string;
  year: number;
  duty_type: string | null;
  duty_rate: number | null;
  preferential_rate: number | null;
  trade_agreement: string | null;
  data_source: string | null;
}

export interface ComplianceRule extends BaseEntity {
  country_id: string;
  hs_code_id: string;
  rule_type: string;
  title: string;
  description: string | null;
  requirements: Record<string, unknown> | null;
  effective_date: string | null;
  expiry_date: string | null;
  source_url: string | null;
  is_active: boolean;
}

export interface MarketplaceListingType extends BaseEntity {
  seller_profile_id: string;
  product_id: string;
  title: string;
  description: string | null;
  listing_price: number | null;
  currency: string;
  min_order_quantity: number | null;
  status: ListingStatus;
  is_featured: boolean;
  expires_at: string | null;
  views_count: number;
  inquiries_count: number;
  product?: Product;
}

export interface Notification extends BaseEntity {
  user_id: string;
  type: NotificationType;
  title: string;
  message: string | null;
  data: Record<string, unknown> | null;
  is_read: boolean;
  read_at: string | null;
  action_url: string | null;
}

export interface ChatRoom extends Omit<BaseEntity, 'created_by' | 'updated_by'> {
  type: ChatRoomType;
  name: string | null;
  created_by: string | null;
  members?: ChatRoomMember[];
  last_message?: Message;
}

export interface ChatRoomMember {
  chat_room_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string | null;
  user?: User;
}

export interface Message extends BaseEntity {
  chat_room_id: string;
  sender_id: string | null;
  content: string | null;
  message_type: MessageType;
  file_url: string | null;
  is_read: boolean;
  read_at: string | null;
  sender?: User;
}

export interface AIRequest extends BaseEntity {
  user_id: string | null;
  request_type: string;
  input_data: Record<string, unknown>;
  model_used: string | null;
  status: AIRequestStatus;
  tokens_used: number | null;
  processing_time_ms: number | null;
  cache_key: string | null;
  error_message: string | null;
  result?: AIResult;
  ai_results?: AIResult[] | null;
}

export interface AIResult extends BaseEntity {
  ai_request_id: string;
  output_data: Record<string, unknown>;
  confidence_score: number | null;
  feedback_rating: number | null;
  feedback_comment: string | null;
}

export interface Bookmark extends BaseEntity {
  user_id: string;
  bookmarkable_type: string;
  bookmarkable_id: string;
  user?: User;
}

export interface SearchHistory extends BaseEntity {
  user_id: string;
  query: string;
  search_type: string;
  filters: Record<string, unknown> | null;
  results_count: number | null;
  user?: User;
}

export interface AdminLog extends BaseEntity {
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  user?: User;
}

// API response types
export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Dashboard stat type
export interface DashboardStat {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: string;
}

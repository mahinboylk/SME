-- ============================================================================
-- BROOKE - AI-Powered Market Intelligence & Export Platform for Sri Lankan SMEs
-- Migration: 001_initial_schema.sql
-- Description: Complete database schema — tables, enums, triggers, indexes, comments
-- Created: 2026-07-11
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 2. ENUM TYPES
-- ============================================================================

CREATE TYPE user_role AS ENUM (
    'super_admin',
    'government_officer',
    'sme_owner',
    'buyer',
    'trade_consultant'
);

CREATE TYPE company_member_role AS ENUM (
    'owner',
    'admin',
    'member'
);

CREATE TYPE trade_flow_type AS ENUM (
    'import',
    'export',
    're_export'
);

CREATE TYPE listing_status AS ENUM (
    'draft',
    'active',
    'paused',
    'sold',
    'expired'
);

CREATE TYPE report_status AS ENUM (
    'pending',
    'generating',
    'completed',
    'failed'
);

CREATE TYPE ai_request_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed',
    'cached'
);

CREATE TYPE message_type AS ENUM (
    'text',
    'image',
    'file',
    'system'
);

CREATE TYPE chat_room_type AS ENUM (
    'direct',
    'group'
);

CREATE TYPE bookmark_type AS ENUM (
    'product',
    'listing',
    'market',
    'company'
);

CREATE TYPE notification_type AS ENUM (
    'system',
    'trade_alert',
    'message',
    'marketplace',
    'compliance',
    'ai_result'
);

-- ============================================================================
-- 3. TRIGGER FUNCTION — Auto-update updated_at on row modification
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. TABLES
-- ============================================================================

-- --------------------------------------------------------------------------
-- 4.1  users
-- --------------------------------------------------------------------------
CREATE TABLE users (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    role            user_role   NOT NULL DEFAULT 'sme_owner',
    email           VARCHAR     NOT NULL UNIQUE,
    full_name       VARCHAR,
    avatar_url      TEXT,
    phone           VARCHAR,
    language_preference VARCHAR  DEFAULT 'en',
    is_active       BOOLEAN     DEFAULT true,
    last_login_at   TIMESTAMPTZ,
    auth_provider   VARCHAR,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

-- --------------------------------------------------------------------------
-- 4.2  companies
-- --------------------------------------------------------------------------
CREATE TABLE companies (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    VARCHAR     NOT NULL,
    registration_number     VARCHAR     UNIQUE,
    country                 VARCHAR     DEFAULT 'LKA',
    province                VARCHAR,
    district                VARCHAR,
    city                    VARCHAR,
    address                 TEXT,
    website                 VARCHAR,
    phone                   VARCHAR,
    email                   VARCHAR,
    description             TEXT,
    logo_url                TEXT,
    cover_image_url         TEXT,
    is_verified             BOOLEAN     DEFAULT false,
    verified_at             TIMESTAMPTZ,
    verified_by             UUID        REFERENCES users(id) ON DELETE SET NULL,
    industry                VARCHAR,
    employee_count          VARCHAR,
    annual_revenue          VARCHAR,
    export_experience_years INT,
    created_by              UUID        REFERENCES users(id) ON DELETE SET NULL,
    updated_by              UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at              TIMESTAMPTZ
);

-- --------------------------------------------------------------------------
-- 4.3  company_members
-- --------------------------------------------------------------------------
CREATE TABLE company_members (
    id                  UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID                NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id             UUID                NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role                company_member_role DEFAULT 'member',
    is_primary_contact  BOOLEAN             DEFAULT false,
    created_by          UUID                REFERENCES users(id) ON DELETE SET NULL,
    updated_by          UUID                REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ         NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ         NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    UNIQUE (company_id, user_id)
);

-- --------------------------------------------------------------------------
-- 4.4  products
-- --------------------------------------------------------------------------
CREATE TABLE products (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name                VARCHAR     NOT NULL,
    description         TEXT,
    category            VARCHAR,
    subcategory         VARCHAR,
    unit_price          NUMERIC(15,2),
    currency            VARCHAR(3)  DEFAULT 'USD',
    min_order_quantity  INT,
    unit_type           VARCHAR,
    origin_country      VARCHAR     DEFAULT 'LKA',
    is_active           BOOLEAN     DEFAULT true,
    specifications      JSONB,
    certifications      JSONB,
    created_by          UUID        REFERENCES users(id) ON DELETE SET NULL,
    updated_by          UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

-- --------------------------------------------------------------------------
-- 4.5  product_images
-- --------------------------------------------------------------------------
CREATE TABLE product_images (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    image_url       TEXT        NOT NULL,
    display_order   INT         DEFAULT 0,
    is_primary      BOOLEAN     DEFAULT false,
    alt_text        VARCHAR,
    created_by      UUID        REFERENCES users(id) ON DELETE SET NULL,
    updated_by      UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

-- --------------------------------------------------------------------------
-- 4.6  hs_codes — Harmonized System classification codes
-- --------------------------------------------------------------------------
CREATE TABLE hs_codes (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(10) UNIQUE NOT NULL,
    description     TEXT,
    section         VARCHAR(10),
    chapter         VARCHAR(4),
    heading         VARCHAR(6),
    subheading      VARCHAR(8),
    level           INT         CHECK (level BETWEEN 1 AND 6),
    parent_code     VARCHAR(10),
    is_leaf         BOOLEAN     DEFAULT false,
    created_by      UUID        REFERENCES users(id) ON DELETE SET NULL,
    updated_by      UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

-- --------------------------------------------------------------------------
-- 4.7  product_hs_codes — Many-to-many link between products and HS codes
-- --------------------------------------------------------------------------
CREATE TABLE product_hs_codes (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id          UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    hs_code_id          UUID        NOT NULL REFERENCES hs_codes(id) ON DELETE CASCADE,
    confidence_score    NUMERIC(5,4),
    is_primary          BOOLEAN     DEFAULT false,
    source              VARCHAR     DEFAULT 'manual' CHECK (source IN ('ai','manual','verified')),
    rationale           TEXT,
    created_by          UUID        REFERENCES users(id) ON DELETE SET NULL,
    updated_by          UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    UNIQUE (product_id, hs_code_id)
);

-- --------------------------------------------------------------------------
-- 4.8  countries
-- --------------------------------------------------------------------------
CREATE TABLE countries (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    iso_code        CHAR(3)     UNIQUE NOT NULL,
    iso_code_2      CHAR(2)     UNIQUE NOT NULL,
    name            VARCHAR     NOT NULL,
    region          VARCHAR,
    sub_region      VARCHAR,
    income_group    VARCHAR,
    latitude        NUMERIC(10,6),
    longitude       NUMERIC(10,6),
    population      BIGINT,
    gdp_usd         NUMERIC(20,2),
    created_by      UUID        REFERENCES users(id) ON DELETE SET NULL,
    updated_by      UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

-- --------------------------------------------------------------------------
-- 4.9  trade_statistics
-- --------------------------------------------------------------------------
CREATE TABLE trade_statistics (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_country_id     UUID            NOT NULL REFERENCES countries(id),
    partner_country_id      UUID            NOT NULL REFERENCES countries(id),
    hs_code_id              UUID            NOT NULL REFERENCES hs_codes(id),
    year                    INT             NOT NULL CHECK (year > 1900 AND year < 2100),
    trade_flow              trade_flow_type NOT NULL,
    trade_value_usd         NUMERIC(20,2),
    quantity                NUMERIC(20,4),
    quantity_unit           VARCHAR,
    data_source             VARCHAR         NOT NULL,
    data_source_id          VARCHAR,
    created_by              UUID            REFERENCES users(id) ON DELETE SET NULL,
    updated_by              UUID            REFERENCES users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at              TIMESTAMPTZ,
    UNIQUE (reporter_country_id, partner_country_id, hs_code_id, year, trade_flow, data_source)
);

-- --------------------------------------------------------------------------
-- 4.10 tariffs
-- --------------------------------------------------------------------------
CREATE TABLE tariffs (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_country_id     UUID        NOT NULL REFERENCES countries(id),
    partner_country_id      UUID        NOT NULL REFERENCES countries(id),
    hs_code_id              UUID        NOT NULL REFERENCES hs_codes(id),
    year                    INT,
    duty_type               VARCHAR,
    duty_rate               NUMERIC(10,4),
    preferential_rate       NUMERIC(10,4),
    trade_agreement         VARCHAR,
    data_source             VARCHAR,
    created_by              UUID        REFERENCES users(id) ON DELETE SET NULL,
    updated_by              UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at              TIMESTAMPTZ,
    UNIQUE (reporter_country_id, partner_country_id, hs_code_id, year, duty_type, data_source)
);

-- --------------------------------------------------------------------------
-- 4.11 compliance_rules
-- --------------------------------------------------------------------------
CREATE TABLE compliance_rules (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    country_id      UUID        REFERENCES countries(id),
    hs_code_id      UUID        REFERENCES hs_codes(id),
    rule_type       VARCHAR     NOT NULL,
    title           VARCHAR     NOT NULL,
    description     TEXT,
    requirements    JSONB,
    effective_date  DATE,
    expiry_date     DATE,
    source_url      TEXT,
    is_active       BOOLEAN     DEFAULT true,
    created_by      UUID        REFERENCES users(id) ON DELETE SET NULL,
    updated_by      UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

-- --------------------------------------------------------------------------
-- 4.12 documents
-- --------------------------------------------------------------------------
CREATE TABLE documents (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    title           VARCHAR     NOT NULL,
    description     TEXT,
    file_url        TEXT        NOT NULL,
    file_type       VARCHAR,
    file_size       BIGINT,
    category        VARCHAR,
    uploaded_by     UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_by      UUID        REFERENCES users(id) ON DELETE SET NULL,
    updated_by      UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

-- --------------------------------------------------------------------------
-- 4.13 markets
-- --------------------------------------------------------------------------
CREATE TABLE markets (
    id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    country_id                  UUID        NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
    sector                      VARCHAR,
    market_size_usd             NUMERIC(20,2),
    growth_rate                 NUMERIC(8,4),
    ease_of_doing_business_rank INT,
    trade_agreements            JSONB,
    key_requirements            JSONB,
    risk_level                  VARCHAR     CHECK (risk_level IN ('low','medium','high')),
    opportunities               JSONB,
    created_by                  UUID        REFERENCES users(id) ON DELETE SET NULL,
    updated_by                  UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at                  TIMESTAMPTZ
);

-- --------------------------------------------------------------------------
-- 4.14 market_recommendations
-- --------------------------------------------------------------------------
CREATE TABLE market_recommendations (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    product_id          UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    market_id           UUID        NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    ai_score            NUMERIC(5,4),
    reasoning           TEXT,
    recommended_actions JSONB,
    status              VARCHAR     DEFAULT 'new' CHECK (status IN ('new','viewed','saved','dismissed')),
    created_by          UUID        REFERENCES users(id) ON DELETE SET NULL,
    updated_by          UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

-- --------------------------------------------------------------------------
-- 4.15 buyer_profiles
-- --------------------------------------------------------------------------
CREATE TABLE buyer_profiles (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    company_id              UUID        REFERENCES companies(id) ON DELETE SET NULL,
    buying_categories       JSONB,
    preferred_countries     JSONB,
    min_order_value         NUMERIC(15,2),
    max_order_value         NUMERIC(15,2),
    payment_terms           VARCHAR,
    verification_status     VARCHAR     DEFAULT 'unverified',
    bio                     TEXT,
    created_by              UUID        REFERENCES users(id) ON DELETE SET NULL,
    updated_by              UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at              TIMESTAMPTZ
);

-- --------------------------------------------------------------------------
-- 4.16 seller_profiles
-- --------------------------------------------------------------------------
CREATE TABLE seller_profiles (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    company_id          UUID        REFERENCES companies(id) ON DELETE SET NULL,
    selling_categories  JSONB,
    export_countries    JSONB,
    min_order_value     NUMERIC(15,2),
    lead_time_days      INT,
    certifications      JSONB,
    bio                 TEXT,
    created_by          UUID        REFERENCES users(id) ON DELETE SET NULL,
    updated_by          UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

-- --------------------------------------------------------------------------
-- 4.17 marketplace_listings
-- --------------------------------------------------------------------------
CREATE TABLE marketplace_listings (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_profile_id   UUID            NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE,
    product_id          UUID            NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    title               VARCHAR         NOT NULL,
    description         TEXT,
    listing_price       NUMERIC(15,2),
    currency            VARCHAR(3)      DEFAULT 'USD',
    min_order_quantity  INT,
    status              listing_status  DEFAULT 'draft',
    is_featured         BOOLEAN         DEFAULT false,
    expires_at          TIMESTAMPTZ,
    views_count         INT             DEFAULT 0,
    inquiries_count     INT             DEFAULT 0,
    created_by          UUID            REFERENCES users(id) ON DELETE SET NULL,
    updated_by          UUID            REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

-- --------------------------------------------------------------------------
-- 4.18 saved_listings
-- --------------------------------------------------------------------------
CREATE TABLE saved_listings (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    listing_id  UUID        NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
    created_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
    updated_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ,
    UNIQUE (user_id, listing_id)
);

-- --------------------------------------------------------------------------
-- 4.19 chat_rooms
-- --------------------------------------------------------------------------
CREATE TABLE chat_rooms (
    id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    type        chat_room_type  DEFAULT 'direct',
    name        VARCHAR,
    created_by  UUID            REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

-- --------------------------------------------------------------------------
-- 4.20 chat_room_members
-- --------------------------------------------------------------------------
CREATE TABLE chat_room_members (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_room_id    UUID        NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at       TIMESTAMPTZ DEFAULT now(),
    last_read_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE (chat_room_id, user_id)
);

-- --------------------------------------------------------------------------
-- 4.21 messages
-- --------------------------------------------------------------------------
CREATE TABLE messages (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_room_id    UUID            NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    sender_id       UUID            REFERENCES users(id) ON DELETE SET NULL,
    content         TEXT,
    message_type    message_type    DEFAULT 'text',
    file_url        TEXT,
    is_read         BOOLEAN         DEFAULT false,
    read_at         TIMESTAMPTZ,
    created_by      UUID            REFERENCES users(id) ON DELETE SET NULL,
    updated_by      UUID            REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

-- --------------------------------------------------------------------------
-- 4.22 notifications
-- --------------------------------------------------------------------------
CREATE TABLE notifications (
    id          UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID                NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        notification_type   DEFAULT 'system',
    title       VARCHAR             NOT NULL,
    message     TEXT,
    data        JSONB,
    is_read     BOOLEAN             DEFAULT false,
    read_at     TIMESTAMPTZ,
    action_url  TEXT,
    created_by  UUID                REFERENCES users(id) ON DELETE SET NULL,
    updated_by  UUID                REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ         NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ         NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

-- --------------------------------------------------------------------------
-- 4.23 reports
-- --------------------------------------------------------------------------
CREATE TABLE reports (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID            REFERENCES users(id) ON DELETE SET NULL,
    company_id      UUID            REFERENCES companies(id) ON DELETE SET NULL,
    report_type     VARCHAR         NOT NULL,
    title           VARCHAR         NOT NULL,
    parameters      JSONB,
    result_data     JSONB,
    status          report_status   DEFAULT 'pending',
    file_url        TEXT,
    error_message   TEXT,
    created_by      UUID            REFERENCES users(id) ON DELETE SET NULL,
    updated_by      UUID            REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

-- --------------------------------------------------------------------------
-- 4.24 search_history
-- --------------------------------------------------------------------------
CREATE TABLE search_history (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    query           TEXT        NOT NULL,
    search_type     VARCHAR     NOT NULL,
    filters         JSONB,
    results_count   INT         DEFAULT 0,
    created_by      UUID        REFERENCES users(id) ON DELETE SET NULL,
    updated_by      UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

-- --------------------------------------------------------------------------
-- 4.25 ai_requests
-- --------------------------------------------------------------------------
CREATE TABLE ai_requests (
    id                  UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID                REFERENCES users(id) ON DELETE SET NULL,
    request_type        VARCHAR             NOT NULL,
    input_data          JSONB               NOT NULL,
    model_used          VARCHAR,
    status              ai_request_status   DEFAULT 'pending',
    tokens_used         INT,
    processing_time_ms  INT,
    cache_key           VARCHAR,
    error_message       TEXT,
    created_by          UUID                REFERENCES users(id) ON DELETE SET NULL,
    updated_by          UUID                REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ         NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ         NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

-- --------------------------------------------------------------------------
-- 4.26 ai_results
-- --------------------------------------------------------------------------
CREATE TABLE ai_results (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    ai_request_id       UUID        NOT NULL REFERENCES ai_requests(id) ON DELETE CASCADE,
    output_data         JSONB       NOT NULL,
    confidence_score    NUMERIC(5,4),
    feedback_rating     INT         CHECK (feedback_rating BETWEEN 1 AND 5),
    feedback_comment    TEXT,
    created_by          UUID        REFERENCES users(id) ON DELETE SET NULL,
    updated_by          UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

-- --------------------------------------------------------------------------
-- 4.27 bookmarks — Polymorphic bookmarks for products, listings, markets, companies
-- --------------------------------------------------------------------------
CREATE TABLE bookmarks (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bookmarkable_type   bookmark_type   NOT NULL,
    bookmarkable_id     UUID            NOT NULL,
    created_by          UUID            REFERENCES users(id) ON DELETE SET NULL,
    updated_by          UUID            REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    UNIQUE (user_id, bookmarkable_type, bookmarkable_id)
);

-- --------------------------------------------------------------------------
-- 4.28 reviews
-- --------------------------------------------------------------------------
CREATE TABLE reviews (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    reviewer_id             UUID        REFERENCES users(id) ON DELETE SET NULL,
    reviewee_company_id     UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    listing_id              UUID        REFERENCES marketplace_listings(id) ON DELETE SET NULL,
    rating                  INT         NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title                   VARCHAR,
    comment                 TEXT,
    is_verified_purchase    BOOLEAN     DEFAULT false,
    created_by              UUID        REFERENCES users(id) ON DELETE SET NULL,
    updated_by              UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at              TIMESTAMPTZ
);

-- --------------------------------------------------------------------------
-- 4.29 admin_logs — NO created_by / updated_by
-- --------------------------------------------------------------------------
CREATE TABLE admin_logs (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        REFERENCES users(id) ON DELETE SET NULL,
    action          VARCHAR     NOT NULL,
    entity_type     VARCHAR,
    entity_id       UUID,
    old_data        JSONB,
    new_data        JSONB,
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

-- --------------------------------------------------------------------------
-- 4.30 system_settings — NO created_by; has updated_by
-- --------------------------------------------------------------------------
CREATE TABLE system_settings (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    key         VARCHAR     UNIQUE NOT NULL,
    value       JSONB       NOT NULL,
    description TEXT,
    updated_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

-- ============================================================================
-- 5. TRIGGERS — Auto-update updated_at on every table
-- ============================================================================

CREATE TRIGGER set_updated_at BEFORE UPDATE ON users              FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON companies          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON company_members    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON products           FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON product_images     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON hs_codes           FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON product_hs_codes   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON countries          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON trade_statistics   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tariffs            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON compliance_rules   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON documents          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON markets            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON market_recommendations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON buyer_profiles     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON seller_profiles    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON marketplace_listings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON saved_listings     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON chat_rooms         FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON chat_room_members  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON messages           FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON notifications      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON reports            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON search_history     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON ai_requests        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON ai_results         FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON bookmarks          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON reviews            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON admin_logs         FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON system_settings    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. INDEXES
-- ============================================================================

-- ---- users ----
CREATE INDEX idx_users_role          ON users (role);
CREATE INDEX idx_users_is_active     ON users (is_active);
CREATE INDEX idx_users_auth_provider ON users (auth_provider);
CREATE INDEX idx_users_deleted_at    ON users (deleted_at);

-- ---- companies ----
CREATE INDEX idx_companies_verified_by       ON companies (verified_by);
CREATE INDEX idx_companies_is_verified       ON companies (is_verified);
CREATE INDEX idx_companies_country           ON companies (country);
CREATE INDEX idx_companies_industry          ON companies (industry);
CREATE INDEX idx_companies_created_by        ON companies (created_by);
CREATE INDEX idx_companies_updated_by        ON companies (updated_by);
CREATE INDEX idx_companies_deleted_at        ON companies (deleted_at);

-- ---- company_members ----
CREATE INDEX idx_company_members_company_id  ON company_members (company_id);
CREATE INDEX idx_company_members_user_id     ON company_members (user_id);
CREATE INDEX idx_company_members_created_by  ON company_members (created_by);
CREATE INDEX idx_company_members_updated_by  ON company_members (updated_by);
CREATE INDEX idx_company_members_deleted_at  ON company_members (deleted_at);

-- ---- products ----
CREATE INDEX idx_products_company_id     ON products (company_id);
CREATE INDEX idx_products_category       ON products (category);
CREATE INDEX idx_products_is_active      ON products (is_active);
CREATE INDEX idx_products_created_by     ON products (created_by);
CREATE INDEX idx_products_updated_by     ON products (updated_by);
CREATE INDEX idx_products_deleted_at     ON products (deleted_at);

-- ---- product_images ----
CREATE INDEX idx_product_images_product_id   ON product_images (product_id);
CREATE INDEX idx_product_images_created_by   ON product_images (created_by);
CREATE INDEX idx_product_images_updated_by   ON product_images (updated_by);
CREATE INDEX idx_product_images_deleted_at   ON product_images (deleted_at);

-- ---- hs_codes ----
CREATE INDEX idx_hs_codes_chapter    ON hs_codes (chapter);
CREATE INDEX idx_hs_codes_section    ON hs_codes (section);
CREATE INDEX idx_hs_codes_is_leaf    ON hs_codes (is_leaf);
CREATE INDEX idx_hs_codes_parent_code ON hs_codes (parent_code);
CREATE INDEX idx_hs_codes_created_by ON hs_codes (created_by);
CREATE INDEX idx_hs_codes_updated_by ON hs_codes (updated_by);
CREATE INDEX idx_hs_codes_deleted_at ON hs_codes (deleted_at);

-- ---- product_hs_codes ----
CREATE INDEX idx_product_hs_codes_product_id ON product_hs_codes (product_id);
CREATE INDEX idx_product_hs_codes_hs_code_id ON product_hs_codes (hs_code_id);
CREATE INDEX idx_product_hs_codes_created_by ON product_hs_codes (created_by);
CREATE INDEX idx_product_hs_codes_updated_by ON product_hs_codes (updated_by);
CREATE INDEX idx_product_hs_codes_deleted_at ON product_hs_codes (deleted_at);

-- ---- countries ----
CREATE INDEX idx_countries_region     ON countries (region);
CREATE INDEX idx_countries_created_by ON countries (created_by);
CREATE INDEX idx_countries_updated_by ON countries (updated_by);
CREATE INDEX idx_countries_deleted_at ON countries (deleted_at);

-- ---- trade_statistics ----
CREATE INDEX idx_trade_statistics_reporter   ON trade_statistics (reporter_country_id);
CREATE INDEX idx_trade_statistics_partner    ON trade_statistics (partner_country_id);
CREATE INDEX idx_trade_statistics_hs_code    ON trade_statistics (hs_code_id);
CREATE INDEX idx_trade_statistics_year       ON trade_statistics (year);
CREATE INDEX idx_trade_statistics_trade_flow ON trade_statistics (trade_flow);
CREATE INDEX idx_trade_statistics_created_by ON trade_statistics (created_by);
CREATE INDEX idx_trade_statistics_updated_by ON trade_statistics (updated_by);
CREATE INDEX idx_trade_statistics_deleted_at ON trade_statistics (deleted_at);

-- ---- tariffs ----
CREATE INDEX idx_tariffs_reporter    ON tariffs (reporter_country_id);
CREATE INDEX idx_tariffs_partner     ON tariffs (partner_country_id);
CREATE INDEX idx_tariffs_hs_code     ON tariffs (hs_code_id);
CREATE INDEX idx_tariffs_year        ON tariffs (year);
CREATE INDEX idx_tariffs_created_by  ON tariffs (created_by);
CREATE INDEX idx_tariffs_updated_by  ON tariffs (updated_by);
CREATE INDEX idx_tariffs_deleted_at  ON tariffs (deleted_at);

-- ---- compliance_rules ----
CREATE INDEX idx_compliance_rules_country_id ON compliance_rules (country_id);
CREATE INDEX idx_compliance_rules_hs_code_id ON compliance_rules (hs_code_id);
CREATE INDEX idx_compliance_rules_is_active  ON compliance_rules (is_active);
CREATE INDEX idx_compliance_rules_created_by ON compliance_rules (created_by);
CREATE INDEX idx_compliance_rules_updated_by ON compliance_rules (updated_by);
CREATE INDEX idx_compliance_rules_deleted_at ON compliance_rules (deleted_at);

-- ---- documents ----
CREATE INDEX idx_documents_company_id   ON documents (company_id);
CREATE INDEX idx_documents_uploaded_by  ON documents (uploaded_by);
CREATE INDEX idx_documents_created_by   ON documents (created_by);
CREATE INDEX idx_documents_updated_by   ON documents (updated_by);
CREATE INDEX idx_documents_deleted_at   ON documents (deleted_at);

-- ---- markets ----
CREATE INDEX idx_markets_country_id  ON markets (country_id);
CREATE INDEX idx_markets_created_by  ON markets (created_by);
CREATE INDEX idx_markets_updated_by  ON markets (updated_by);
CREATE INDEX idx_markets_deleted_at  ON markets (deleted_at);

-- ---- market_recommendations ----
CREATE INDEX idx_market_recommendations_company_id ON market_recommendations (company_id);
CREATE INDEX idx_market_recommendations_product_id ON market_recommendations (product_id);
CREATE INDEX idx_market_recommendations_market_id  ON market_recommendations (market_id);
CREATE INDEX idx_market_recommendations_status     ON market_recommendations (status);
CREATE INDEX idx_market_recommendations_created_by ON market_recommendations (created_by);
CREATE INDEX idx_market_recommendations_updated_by ON market_recommendations (updated_by);
CREATE INDEX idx_market_recommendations_deleted_at ON market_recommendations (deleted_at);

-- ---- buyer_profiles ----
CREATE INDEX idx_buyer_profiles_company_id ON buyer_profiles (company_id);
CREATE INDEX idx_buyer_profiles_created_by ON buyer_profiles (created_by);
CREATE INDEX idx_buyer_profiles_updated_by ON buyer_profiles (updated_by);
CREATE INDEX idx_buyer_profiles_deleted_at ON buyer_profiles (deleted_at);

-- ---- seller_profiles ----
CREATE INDEX idx_seller_profiles_company_id ON seller_profiles (company_id);
CREATE INDEX idx_seller_profiles_created_by ON seller_profiles (created_by);
CREATE INDEX idx_seller_profiles_updated_by ON seller_profiles (updated_by);
CREATE INDEX idx_seller_profiles_deleted_at ON seller_profiles (deleted_at);

-- ---- marketplace_listings ----
CREATE INDEX idx_marketplace_listings_seller_profile_id ON marketplace_listings (seller_profile_id);
CREATE INDEX idx_marketplace_listings_product_id        ON marketplace_listings (product_id);
CREATE INDEX idx_marketplace_listings_status             ON marketplace_listings (status);
CREATE INDEX idx_marketplace_listings_is_featured        ON marketplace_listings (is_featured);
CREATE INDEX idx_marketplace_listings_created_by         ON marketplace_listings (created_by);
CREATE INDEX idx_marketplace_listings_updated_by         ON marketplace_listings (updated_by);
CREATE INDEX idx_marketplace_listings_deleted_at         ON marketplace_listings (deleted_at);

-- ---- saved_listings ----
CREATE INDEX idx_saved_listings_user_id    ON saved_listings (user_id);
CREATE INDEX idx_saved_listings_listing_id ON saved_listings (listing_id);
CREATE INDEX idx_saved_listings_created_by ON saved_listings (created_by);
CREATE INDEX idx_saved_listings_updated_by ON saved_listings (updated_by);
CREATE INDEX idx_saved_listings_deleted_at ON saved_listings (deleted_at);

-- ---- chat_rooms ----
CREATE INDEX idx_chat_rooms_created_by ON chat_rooms (created_by);
CREATE INDEX idx_chat_rooms_deleted_at ON chat_rooms (deleted_at);

-- ---- chat_room_members ----
CREATE INDEX idx_chat_room_members_chat_room_id ON chat_room_members (chat_room_id);
CREATE INDEX idx_chat_room_members_user_id      ON chat_room_members (user_id);
CREATE INDEX idx_chat_room_members_deleted_at   ON chat_room_members (deleted_at);

-- ---- messages ----
CREATE INDEX idx_messages_chat_room_id ON messages (chat_room_id);
CREATE INDEX idx_messages_sender_id    ON messages (sender_id);
CREATE INDEX idx_messages_is_read      ON messages (is_read);
CREATE INDEX idx_messages_created_by   ON messages (created_by);
CREATE INDEX idx_messages_updated_by   ON messages (updated_by);
CREATE INDEX idx_messages_deleted_at   ON messages (deleted_at);

-- ---- notifications ----
CREATE INDEX idx_notifications_user_id    ON notifications (user_id);
CREATE INDEX idx_notifications_is_read    ON notifications (is_read);
CREATE INDEX idx_notifications_type       ON notifications (type);
CREATE INDEX idx_notifications_created_by ON notifications (created_by);
CREATE INDEX idx_notifications_updated_by ON notifications (updated_by);
CREATE INDEX idx_notifications_deleted_at ON notifications (deleted_at);

-- ---- reports ----
CREATE INDEX idx_reports_user_id     ON reports (user_id);
CREATE INDEX idx_reports_company_id  ON reports (company_id);
CREATE INDEX idx_reports_status      ON reports (status);
CREATE INDEX idx_reports_created_by  ON reports (created_by);
CREATE INDEX idx_reports_updated_by  ON reports (updated_by);
CREATE INDEX idx_reports_deleted_at  ON reports (deleted_at);

-- ---- search_history ----
CREATE INDEX idx_search_history_user_id      ON search_history (user_id);
CREATE INDEX idx_search_history_search_type  ON search_history (search_type);
CREATE INDEX idx_search_history_created_by   ON search_history (created_by);
CREATE INDEX idx_search_history_updated_by   ON search_history (updated_by);
CREATE INDEX idx_search_history_deleted_at   ON search_history (deleted_at);

-- ---- ai_requests ----
CREATE INDEX idx_ai_requests_user_id       ON ai_requests (user_id);
CREATE INDEX idx_ai_requests_status        ON ai_requests (status);
CREATE INDEX idx_ai_requests_cache_key     ON ai_requests (cache_key);
CREATE INDEX idx_ai_requests_request_type  ON ai_requests (request_type);
CREATE INDEX idx_ai_requests_created_by    ON ai_requests (created_by);
CREATE INDEX idx_ai_requests_updated_by    ON ai_requests (updated_by);
CREATE INDEX idx_ai_requests_deleted_at    ON ai_requests (deleted_at);

-- ---- ai_results ----
CREATE INDEX idx_ai_results_ai_request_id ON ai_results (ai_request_id);
CREATE INDEX idx_ai_results_created_by    ON ai_results (created_by);
CREATE INDEX idx_ai_results_updated_by    ON ai_results (updated_by);
CREATE INDEX idx_ai_results_deleted_at    ON ai_results (deleted_at);

-- ---- bookmarks ----
CREATE INDEX idx_bookmarks_user_id            ON bookmarks (user_id);
CREATE INDEX idx_bookmarks_bookmarkable_type  ON bookmarks (bookmarkable_type);
CREATE INDEX idx_bookmarks_bookmarkable_id    ON bookmarks (bookmarkable_id);
CREATE INDEX idx_bookmarks_created_by         ON bookmarks (created_by);
CREATE INDEX idx_bookmarks_updated_by         ON bookmarks (updated_by);
CREATE INDEX idx_bookmarks_deleted_at         ON bookmarks (deleted_at);

-- ---- reviews ----
CREATE INDEX idx_reviews_reviewer_id        ON reviews (reviewer_id);
CREATE INDEX idx_reviews_reviewee_company_id ON reviews (reviewee_company_id);
CREATE INDEX idx_reviews_listing_id         ON reviews (listing_id);
CREATE INDEX idx_reviews_created_by         ON reviews (created_by);
CREATE INDEX idx_reviews_updated_by         ON reviews (updated_by);
CREATE INDEX idx_reviews_deleted_at         ON reviews (deleted_at);

-- ---- admin_logs ----
CREATE INDEX idx_admin_logs_user_id      ON admin_logs (user_id);
CREATE INDEX idx_admin_logs_action       ON admin_logs (action);
CREATE INDEX idx_admin_logs_entity_type  ON admin_logs (entity_type);
CREATE INDEX idx_admin_logs_entity_id    ON admin_logs (entity_id);
CREATE INDEX idx_admin_logs_deleted_at   ON admin_logs (deleted_at);

-- ---- system_settings ----
CREATE INDEX idx_system_settings_updated_by ON system_settings (updated_by);
CREATE INDEX idx_system_settings_deleted_at ON system_settings (deleted_at);

-- ============================================================================
-- 7. TABLE COMMENTS
-- ============================================================================

COMMENT ON TABLE users                  IS 'Platform users — SME owners, buyers, government officers, trade consultants, admins';
COMMENT ON TABLE companies              IS 'Registered companies / SMEs on the platform';
COMMENT ON TABLE company_members        IS 'Many-to-many relationship linking users to companies with roles';
COMMENT ON TABLE products               IS 'Products offered by companies for export';
COMMENT ON TABLE product_images         IS 'Images associated with products';
COMMENT ON TABLE hs_codes               IS 'Harmonized System (HS) trade classification codes';
COMMENT ON TABLE product_hs_codes       IS 'Mapping of products to HS codes with AI confidence scores';
COMMENT ON TABLE countries              IS 'Reference table of countries with geographic and economic data';
COMMENT ON TABLE trade_statistics       IS 'Historical trade data between countries for specific HS codes';
COMMENT ON TABLE tariffs                IS 'Import/export tariff and duty information between countries';
COMMENT ON TABLE compliance_rules       IS 'Regulatory compliance rules per country and HS code';
COMMENT ON TABLE documents              IS 'Company documents — certificates, licenses, export paperwork';
COMMENT ON TABLE markets                IS 'Target market profiles with sector-level intelligence';
COMMENT ON TABLE market_recommendations IS 'AI-generated market recommendations for company products';
COMMENT ON TABLE buyer_profiles         IS 'Extended profiles for users with the buyer role';
COMMENT ON TABLE seller_profiles        IS 'Extended profiles for users with the seller/SME role';
COMMENT ON TABLE marketplace_listings   IS 'Product listings in the B2B marketplace';
COMMENT ON TABLE saved_listings         IS 'Listings saved/bookmarked by users';
COMMENT ON TABLE chat_rooms             IS 'Chat rooms for direct and group messaging';
COMMENT ON TABLE chat_room_members      IS 'Membership records for chat rooms';
COMMENT ON TABLE messages               IS 'Individual messages within chat rooms';
COMMENT ON TABLE notifications          IS 'User notifications — system alerts, trade alerts, messages';
COMMENT ON TABLE reports                IS 'Generated reports — market analysis, compliance, trade';
COMMENT ON TABLE search_history         IS 'User search history for analytics and personalization';
COMMENT ON TABLE ai_requests            IS 'Requests to AI services — HS classification, market analysis, etc.';
COMMENT ON TABLE ai_results             IS 'Results returned from AI service requests';
COMMENT ON TABLE bookmarks              IS 'Polymorphic bookmarks for products, listings, markets, companies';
COMMENT ON TABLE reviews                IS 'Reviews and ratings for companies and marketplace listings';
COMMENT ON TABLE admin_logs             IS 'Audit log of administrative actions on the platform';
COMMENT ON TABLE system_settings        IS 'Key-value system configuration settings';

COMMIT;

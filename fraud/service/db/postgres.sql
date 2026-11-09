CREATE TABLE IF NOT EXISTS users (
  address CHAR(42) PRIMARY KEY,
  role VARCHAR(24) NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);
-- Expiration values are Unix milliseconds, matching the Node store implementation.
CREATE TABLE IF NOT EXISTS auth_nonces (address CHAR(42) PRIMARY KEY REFERENCES users(address), nonce TEXT NOT NULL, expires_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token_hash CHAR(64) PRIMARY KEY, address CHAR(42) NOT NULL REFERENCES users(address), expires_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS kyc_applications (
  address CHAR(42) PRIMARY KEY REFERENCES users(address),
  proof_hash CHAR(66) NOT NULL, sealed_data TEXT NOT NULL, status VARCHAR(16) NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(), reviewed_at TIMESTAMPTZ, reviewed_by CHAR(42)
);
CREATE INDEX IF NOT EXISTS kyc_status_idx ON kyc_applications(status);

CREATE TABLE IF NOT EXISTS fraud_scans (
  id BIGSERIAL PRIMARY KEY,
  scanned_at TIMESTAMPTZ NOT NULL,
  block_number BIGINT,
  total INTEGER NOT NULL,
  flagged INTEGER NOT NULL,
  ml_available BOOLEAN NOT NULL,
  detector JSONB NOT NULL DEFAULT '{}'::jsonb,
  report JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS fraud_scans_scanned_at_idx ON fraud_scans(scanned_at DESC);

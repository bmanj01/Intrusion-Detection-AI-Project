-- Create alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  label TEXT NOT NULL,
  anomaly_score NUMERIC NOT NULL,
  severity TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'New',
  features JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create logs table
CREATE TABLE IF NOT EXISTS logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create settings table
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create analyses table
CREATE TABLE IF NOT EXISTS analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  input_features JSONB NOT NULL,
  predicted_label TEXT NOT NULL,
  anomaly_score NUMERIC NOT NULL,
  raw_proba JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

-- Policies for alerts
CREATE POLICY "alerts_select" ON alerts FOR SELECT USING (true);
CREATE POLICY "alerts_insert" ON alerts FOR INSERT WITH CHECK (true);
CREATE POLICY "alerts_update" ON alerts FOR UPDATE USING (true);
CREATE POLICY "alerts_delete" ON alerts FOR DELETE USING (true);

-- Policies for logs
CREATE POLICY "logs_select" ON logs FOR SELECT USING (true);
CREATE POLICY "logs_insert" ON logs FOR INSERT WITH CHECK (true);
CREATE POLICY "logs_delete" ON logs FOR DELETE USING (true);

-- Policies for settings
CREATE POLICY "settings_select" ON settings FOR SELECT USING (true);
CREATE POLICY "settings_insert" ON settings FOR INSERT WITH CHECK (true);
CREATE POLICY "settings_update" ON settings FOR UPDATE USING (true);

-- Policies for analyses
CREATE POLICY "analyses_select" ON analyses FOR SELECT USING (true);
CREATE POLICY "analyses_insert" ON analyses FOR INSERT WITH CHECK (true);

-- Default settings
INSERT INTO settings (key, value) VALUES 
  ('anomalyThreshold', '0.45'),
  ('autoSmartThreshold', 'true'),
  ('autoCreateAlert', 'true'),
  ('apiUrl', '"http://localhost:8000/predict"')
ON CONFLICT (key) DO NOTHING;

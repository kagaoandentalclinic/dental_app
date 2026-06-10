-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ADMIN / STAFF USERS
-- ============================================
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  role VARCHAR(20) DEFAULT 'dentist' CHECK (role IN ('admin', 'dentist', 'hygienist', 'receptionist')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);
ALTER TABLE admins ADD COLUMN IF NOT EXISTS profile_photo TEXT;

-- ============================================
-- PATIENTS
-- ============================================
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_date DATE DEFAULT CURRENT_DATE,
  last_name VARCHAR(100) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100),
  date_of_birth DATE,
  sex VARCHAR(10) CHECK (sex IN ('male', 'female', 'other')),
  height VARCHAR(20),
  weight VARCHAR(20),
  occupation VARCHAR(100),
  marital_status VARCHAR(20) CHECK (marital_status IN ('single', 'married', 'widowed', 'divorced')),
  spouse_name VARCHAR(100),
  address TEXT,
  zip_code VARCHAR(10),
  phone VARCHAR(20),
  business_address TEXT,
  business_phone VARCHAR(20),
  email VARCHAR(255),
  referred_by VARCHAR(100),
  preferred_appointment_time VARCHAR(100),
  insurance_provider VARCHAR(100),
  insurance_id VARCHAR(50),
  notes TEXT,
  profile_photo TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES admins(id)
);

-- Add profile_photo to existing patients tables (safe to run multiple times)
ALTER TABLE patients ADD COLUMN IF NOT EXISTS profile_photo TEXT;
ALTER TABLE patients ALTER COLUMN date_of_birth DROP NOT NULL;

-- ============================================
-- PATIENT CONTACTS
-- ============================================
CREATE TABLE IF NOT EXISTS patient_contacts (
  patient_id UUID PRIMARY KEY REFERENCES patients(id) ON DELETE CASCADE,
  address TEXT,
  zip_code VARCHAR(10),
  phone VARCHAR(20),
  email VARCHAR(255),
  business_address TEXT,
  business_phone VARCHAR(20),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PATIENT PROFILE DETAILS
-- ============================================
CREATE TABLE IF NOT EXISTS patient_profile_details (
  patient_id UUID PRIMARY KEY REFERENCES patients(id) ON DELETE CASCADE,
  occupation VARCHAR(100),
  marital_status VARCHAR(20) CHECK (marital_status IN ('single', 'married', 'widowed', 'divorced')),
  spouse_name VARCHAR(100),
  referred_by VARCHAR(100),
  preferred_appointment_time VARCHAR(100),
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PATIENT INSURANCE
-- ============================================
CREATE TABLE IF NOT EXISTS patient_insurance (
  patient_id UUID PRIMARY KEY REFERENCES patients(id) ON DELETE CASCADE,
  insurance_provider VARCHAR(100),
  insurance_id VARCHAR(50),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MEDICAL HISTORY
-- ============================================
CREATE TABLE IF NOT EXISTS medical_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
  general_health VARCHAR(20) CHECK (general_health IN ('excellent', 'good', 'fair', 'poor', 'unknown')),
  height VARCHAR(20),
  weight VARCHAR(20),
  physician_name_address TEXT,
  last_physical_exam TEXT,
  taking_medication BOOLEAN DEFAULT false,
  medication_details TEXT,
  heart_disease BOOLEAN DEFAULT false,
  heart_murmur BOOLEAN DEFAULT false,
  rheumatic_fever BOOLEAN DEFAULT false,
  jaundice BOOLEAN DEFAULT false,
  abnormal_blood_pressure BOOLEAN DEFAULT false,
  asthma_hay_fever BOOLEAN DEFAULT false,
  ulcers BOOLEAN DEFAULT false,
  sinus_trouble BOOLEAN DEFAULT false,
  tuberculosis_lung_disease BOOLEAN DEFAULT false,
  cough BOOLEAN DEFAULT false,
  diabetes BOOLEAN DEFAULT false,
  hepatitis BOOLEAN DEFAULT false,
  epilepsy BOOLEAN DEFAULT false,
  arthritis BOOLEAN DEFAULT false,
  anemia BOOLEAN DEFAULT false,
  stroke BOOLEAN DEFAULT false,
  congenital_heart_lesions BOOLEAN DEFAULT false,
  glaucoma BOOLEAN DEFAULT false,
  treated_with_xray BOOLEAN DEFAULT false,
  allergic_penicillin BOOLEAN DEFAULT false,
  allergic_codeine BOOLEAN DEFAULT false,
  allergic_local_anesthetic BOOLEAN DEFAULT false,
  allergic_other_medications BOOLEAN DEFAULT false,
  allergic_other_details TEXT,
  prolonged_bleeding BOOLEAN DEFAULT false,
  fainting_spells BOOLEAN DEFAULT false,
  excessive_urination_thirst BOOLEAN DEFAULT false,
  is_pregnant BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES admins(id)
);

DO $$
BEGIN
    ALTER TABLE medical_history DROP CONSTRAINT IF EXISTS medical_history_general_health_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
ALTER TABLE medical_history ADD COLUMN IF NOT EXISTS height VARCHAR(20);
ALTER TABLE medical_history ADD COLUMN IF NOT EXISTS weight VARCHAR(20);
DO $$
BEGIN
    ALTER TABLE medical_history ADD CONSTRAINT medical_history_general_health_check
      CHECK (general_health IN ('excellent', 'good', 'fair', 'poor', 'unknown'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- DENTAL CHART
-- ============================================
CREATE TABLE IF NOT EXISTS dental_chart (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  tooth_number INTEGER NOT NULL CHECK (tooth_number >= 1),
  status VARCHAR(20) DEFAULT 'healthy' CHECK (status IN (
    'healthy', 'cavity', 'filled', 'crown', 'missing',
    'root_canal', 'extracted', 'implant', 'bridge', 'veneer'
  )),
  surface VARCHAR(50),
  notes TEXT,
  is_extra BOOLEAN DEFAULT false,
  extra_label VARCHAR(50),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES admins(id),
  UNIQUE(patient_id, tooth_number)
);

-- Migrate existing dental_chart tables
DO $$
BEGIN
    -- Drop old check constraint that limits tooth_number to 1-32
    ALTER TABLE dental_chart DROP CONSTRAINT IF EXISTS dental_chart_tooth_number_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
ALTER TABLE dental_chart ADD COLUMN IF NOT EXISTS is_extra BOOLEAN DEFAULT false;
ALTER TABLE dental_chart ADD COLUMN IF NOT EXISTS extra_label VARCHAR(50);

-- ============================================
-- VISITS
-- ============================================
CREATE TABLE IF NOT EXISTS visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  dentist_id UUID REFERENCES admins(id),
  visit_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  visit_type VARCHAR(100) NOT NULL,
  chief_complaint TEXT,
  diagnosis TEXT,
  treatment_performed TEXT NOT NULL,
  teeth_treated INTEGER[],
  prescriptions TEXT,
  next_appointment DATE,
  cost DECIMAL(10,2),
  payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN (
    'pending', 'paid', 'insurance', 'partial'
  )),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ORTHODONTIC CASES
-- ============================================
CREATE TABLE IF NOT EXISTS orthodontic_cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
  dentist_id UUID REFERENCES admins(id),
  bracket_type VARCHAR(50) DEFAULT 'metal'
    CHECK (bracket_type IN ('metal','ceramic','lingual','clear_aligner','other')),
  start_date DATE,
  estimated_end_date DATE,
  actual_end_date DATE,
  total_cost DECIMAL(10,2) DEFAULT 0,
  downpayment DECIMAL(10,2) DEFAULT 0,
  total_paid DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active'
    CHECK (status IN ('active','completed','discontinued')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES admins(id)
);

-- ============================================
-- ORTHODONTIC ADJUSTMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS orthodontic_adjustments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID REFERENCES orthodontic_cases(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  adjustment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  next_adjustment_date DATE,
  performed_by UUID REFERENCES admins(id),
  amount_paid DECIMAL(10,2) DEFAULT 0,
  payment_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add payment columns to existing orthodontic_adjustments tables
ALTER TABLE orthodontic_adjustments ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2) DEFAULT 0;
ALTER TABLE orthodontic_adjustments ADD COLUMN IF NOT EXISTS payment_notes TEXT;

-- ============================================
-- CLINIC SETTINGS
-- ============================================
CREATE TABLE IF NOT EXISTS clinic_settings (
  id SERIAL PRIMARY KEY,
  clinic_name VARCHAR(200) DEFAULT 'Dental Clinic',
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(255),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PATIENT PHOTOS
-- ============================================
CREATE TABLE IF NOT EXISTS patient_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  photo_data TEXT NOT NULL,
  photo_type VARCHAR(20) NOT NULL DEFAULT 'other'
    CHECK (photo_type IN ('before','after','xray','intraoral','panoramic','other')),
  label VARCHAR(100),
  notes TEXT,
  uploaded_by UUID REFERENCES admins(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- APPOINTMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  dentist_id UUID REFERENCES admins(id),
  appointment_date TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 60 CHECK (duration_minutes > 0),
  appointment_type VARCHAR(50) NOT NULL DEFAULT 'checkup',
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES admins(id)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_patient_contacts_phone ON patient_contacts(phone);
CREATE INDEX IF NOT EXISTS idx_patient_contacts_email ON patient_contacts(email);
CREATE INDEX IF NOT EXISTS idx_dental_chart_patient ON dental_chart(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_patient ON visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_patient_photos_patient ON patient_photos(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);

-- ============================================
-- INTAKE FORM SETTINGS (additions to clinic_settings)
-- ============================================
ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS intake_enabled BOOLEAN DEFAULT true;
ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS intake_slug VARCHAR(100);
ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS intake_redirect_url VARCHAR(500);

-- Appointment request form settings
ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS appt_form_enabled BOOLEAN DEFAULT true;
ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS appt_form_slug VARCHAR(100);
ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS appt_form_redirect_url VARCHAR(500);

-- Add 'pending' status for patient-submitted appointment requests
DO $$
BEGIN
    ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
    ALTER TABLE appointments ADD CONSTRAINT appointments_status_check
        CHECK (status IN ('pending', 'scheduled', 'completed', 'cancelled', 'no_show'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================
-- INTAKE SUBMISSIONS
-- ============================================
CREATE TABLE IF NOT EXISTS intake_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address VARCHAR(45),
  UNIQUE(patient_id)
);

CREATE INDEX IF NOT EXISTS idx_intake_submissions_patient ON intake_submissions(patient_id);

-- ============================================
-- CLINIC KIOSK
-- ============================================
ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS kiosk_token VARCHAR(64);

-- ============================================
-- BACKFILL HYBRID PATIENT SECTIONS
-- ============================================
INSERT INTO patient_contacts (patient_id, address, zip_code, phone, email, business_address, business_phone, updated_at)
SELECT id, address, zip_code, phone, email, business_address, business_phone, updated_at
FROM patients
ON CONFLICT (patient_id) DO UPDATE SET
  address = EXCLUDED.address,
  zip_code = EXCLUDED.zip_code,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  business_address = EXCLUDED.business_address,
  business_phone = EXCLUDED.business_phone,
  updated_at = EXCLUDED.updated_at;

INSERT INTO patient_profile_details (
  patient_id, occupation, marital_status, spouse_name, referred_by, preferred_appointment_time, notes, updated_at
)
SELECT id, occupation, marital_status, spouse_name, referred_by, preferred_appointment_time, notes, updated_at
FROM patients
ON CONFLICT (patient_id) DO UPDATE SET
  occupation = EXCLUDED.occupation,
  marital_status = EXCLUDED.marital_status,
  spouse_name = EXCLUDED.spouse_name,
  referred_by = EXCLUDED.referred_by,
  preferred_appointment_time = EXCLUDED.preferred_appointment_time,
  notes = EXCLUDED.notes,
  updated_at = EXCLUDED.updated_at;

INSERT INTO patient_insurance (patient_id, insurance_provider, insurance_id, updated_at)
SELECT id, insurance_provider, insurance_id, updated_at
FROM patients
ON CONFLICT (patient_id) DO UPDATE SET
  insurance_provider = EXCLUDED.insurance_provider,
  insurance_id = EXCLUDED.insurance_id,
  updated_at = EXCLUDED.updated_at;

INSERT INTO medical_history (patient_id, height, weight, updated_at)
SELECT id, height, weight, updated_at
FROM patients
WHERE height IS NOT NULL OR weight IS NOT NULL
ON CONFLICT (patient_id) DO UPDATE SET
  height = COALESCE(EXCLUDED.height, medical_history.height),
  weight = COALESCE(EXCLUDED.weight, medical_history.weight),
  updated_at = NOW();

-- ============================================
-- DROP visit_type CHECK constraint to allow multiple types
-- ============================================
DO $$
BEGIN
    ALTER TABLE visits DROP CONSTRAINT IF EXISTS visits_visit_type_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Widen the column to hold comma-separated type lists
ALTER TABLE visits ALTER COLUMN visit_type TYPE VARCHAR(200);

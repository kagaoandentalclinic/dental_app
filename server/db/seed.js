const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { createPool } = require('./config');

const pool = createPool();

async function seed() {
    const client = await pool.connect();
    try {
        console.log('🔧 Running schema...');
        const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
        await client.query(schema);
        console.log('✅ Schema applied.');

        // ─── Admin ──────────────────────────────────────
        const adminHash = await bcrypt.hash('admin123', 10);
        const adminRes = await client.query(`
      INSERT INTO admins (username, email, password_hash, full_name, role)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash
      RETURNING id
    `, ['admin', 'admin@dentalclinic.com', adminHash, 'Dr. Maria Santos', 'admin']);
        const adminId = adminRes.rows[0].id;
        console.log('✅ Admin seeded.');

        // Second dentist
        const dentistHash = await bcrypt.hash('dentist123', 10);
        const dentistRes = await client.query(`
      INSERT INTO admins (username, email, password_hash, full_name, role)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash
      RETURNING id
    `, ['drreyes', 'reyes@dentalclinic.com', dentistHash, 'Dr. Jose Reyes', 'dentist']);
        const dentistId = dentistRes.rows[0].id;
        console.log('✅ Second dentist seeded.');

        // ─── Patients ────────────────────────────────────
        const patients = [
            {
                last_name: 'Dela Cruz', first_name: 'Juan', middle_name: 'Reyes',
                date_of_birth: '1985-03-15', sex: 'male', height: '170 cm', weight: '72 kg',
                occupation: 'Engineer', marital_status: 'married', spouse_name: 'Maria Dela Cruz',
                address: '123 Burgos St., Vigan City, Ilocos Sur', zip_code: '2700',
                phone: '09171234567', email: 'jdelacruz@email.com',
                referred_by: 'Dr. Reyes', preferred_appointment_time: 'Morning',
                insurance_provider: 'PhilHealth', insurance_id: 'PH-12345678',
            },
            {
                last_name: 'Bautista', first_name: 'Ana', middle_name: 'Santos',
                date_of_birth: '1992-07-22', sex: 'female', height: '158 cm', weight: '55 kg',
                occupation: 'Teacher', marital_status: 'single', spouse_name: null,
                address: '456 Quezon Ave., Vigan City, Ilocos Sur', zip_code: '2700',
                phone: '09189876543', email: 'abautista@email.com',
                referred_by: 'Walk-in', preferred_appointment_time: 'Afternoon',
                insurance_provider: null, insurance_id: null,
            },
            {
                last_name: 'Villanueva', first_name: 'Roberto', middle_name: 'Garcia',
                date_of_birth: '1978-11-05', sex: 'male', height: '175 cm', weight: '85 kg',
                occupation: 'Business Owner', marital_status: 'married', spouse_name: 'Lourdes Villanueva',
                address: '789 Rizal St., Vigan City, Ilocos Sur', zip_code: '2700',
                phone: '09201112222', email: 'rvillanueva@email.com',
                referred_by: 'Juan Dela Cruz', preferred_appointment_time: 'Morning',
                insurance_provider: 'Maxicare', insurance_id: 'MC-98765432',
            },
            {
                last_name: 'Mendoza', first_name: 'Liza', middle_name: null,
                date_of_birth: '2000-01-30', sex: 'female', height: '162 cm', weight: '50 kg',
                occupation: 'Student', marital_status: 'single', spouse_name: null,
                address: '321 Mabini St., Bantay, Ilocos Sur', zip_code: '2727',
                phone: '09153334444', email: 'lmendoza@email.com',
                referred_by: 'School clinic', preferred_appointment_time: 'Anytime',
                insurance_provider: null, insurance_id: null,
            },
            {
                last_name: 'Pascual', first_name: 'Carlos', middle_name: 'Aguilar',
                date_of_birth: '1955-06-18', sex: 'male', height: '168 cm', weight: '80 kg',
                occupation: 'Retired', marital_status: 'widowed', spouse_name: null,
                address: '555 Bonifacio St., Vigan City, Ilocos Sur', zip_code: '2700',
                phone: '09275556666', email: 'cpascual@email.com',
                referred_by: 'Ana Bautista', preferred_appointment_time: 'Morning',
                insurance_provider: 'PhilHealth', insurance_id: 'PH-55555555',
            },
        ];

        const patientIds = [];
        for (const p of patients) {
            const res = await client.query(`
        INSERT INTO patients (
          last_name, first_name, middle_name, date_of_birth, sex, height, weight,
          occupation, marital_status, spouse_name, address, zip_code, phone, email,
          referred_by, preferred_appointment_time, insurance_provider, insurance_id,
          created_by
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
        )
        ON CONFLICT DO NOTHING
        RETURNING id
      `, [
                p.last_name, p.first_name, p.middle_name, p.date_of_birth, p.sex, p.height, p.weight,
                p.occupation, p.marital_status, p.spouse_name, p.address, p.zip_code, p.phone, p.email,
                p.referred_by, p.preferred_appointment_time, p.insurance_provider, p.insurance_id,
                adminId,
            ]);
            if (res.rows[0]) {
                patientIds.push(res.rows[0].id);
                await client.query(`
          INSERT INTO patient_contacts (patient_id, address, zip_code, phone, email, updated_at)
          VALUES ($1,$2,$3,$4,$5,NOW())
          ON CONFLICT (patient_id) DO NOTHING
        `, [res.rows[0].id, p.address, p.zip_code, p.phone, p.email]);
                await client.query(`
          INSERT INTO patient_profile_details (
            patient_id, occupation, marital_status, spouse_name, referred_by, preferred_appointment_time, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,NOW())
          ON CONFLICT (patient_id) DO NOTHING
        `, [res.rows[0].id, p.occupation, p.marital_status, p.spouse_name, p.referred_by, p.preferred_appointment_time]);
                await client.query(`
          INSERT INTO patient_insurance (patient_id, insurance_provider, insurance_id, updated_at)
          VALUES ($1,$2,$3,NOW())
          ON CONFLICT (patient_id) DO NOTHING
        `, [res.rows[0].id, p.insurance_provider, p.insurance_id]);
                await client.query(`
          INSERT INTO medical_history (patient_id, height, weight, updated_by)
          VALUES ($1,$2,$3,$4)
          ON CONFLICT (patient_id) DO UPDATE SET
            height = EXCLUDED.height,
            weight = EXCLUDED.weight,
            updated_by = EXCLUDED.updated_by,
            updated_at = NOW()
        `, [res.rows[0].id, p.height, p.weight, adminId]);
            }
        }
        console.log(`✅ ${patientIds.length} patients seeded.`);

        // ─── Medical History ─────────────────────────────
        if (patientIds[0]) {
            await client.query(`
        INSERT INTO medical_history (patient_id, general_health, taking_medication,
          medication_details, diabetes, abnormal_blood_pressure, updated_by)
        VALUES ($1, 'good', true, 'Metformin 500mg daily', true, true, $2)
        ON CONFLICT (patient_id) DO NOTHING
      `, [patientIds[0], adminId]);
        }
        if (patientIds[2]) {
            await client.query(`
        INSERT INTO medical_history (patient_id, general_health, asthma_hay_fever,
          allergic_penicillin, updated_by)
        VALUES ($1, 'fair', true, true, $2)
        ON CONFLICT (patient_id) DO NOTHING
      `, [patientIds[2], adminId]);
        }
        console.log('✅ Medical history seeded.');

        // ─── Dental Chart ─────────────────────────────────
        if (patientIds[0]) {
            const teethPatient1 = [
                { number: 1, status: 'healthy' },
                { number: 2, status: 'cavity', notes: 'Small cavity on occlusal surface' },
                { number: 3, status: 'filled', surface: 'occlusal' },
                { number: 4, status: 'crown' },
                { number: 5, status: 'healthy' },
                { number: 14, status: 'missing' },
                { number: 15, status: 'healthy' },
                { number: 16, status: 'extracted', notes: 'Extracted 2023' },
                { number: 17, status: 'healthy' },
                { number: 18, status: 'cavity', notes: 'Moderate cavity' },
                { number: 19, status: 'root_canal', notes: 'Root canal completed Jan 2025' },
                { number: 30, status: 'filled', surface: 'mesial,occlusal' },
                { number: 31, status: 'healthy' },
                { number: 32, status: 'missing' },
            ];
            for (const t of teethPatient1) {
                await client.query(`
          INSERT INTO dental_chart (patient_id, tooth_number, status, surface, notes, updated_by)
          VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (patient_id, tooth_number) DO NOTHING
        `, [patientIds[0], t.number, t.status, t.surface || null, t.notes || null, adminId]);
            }
        }

        if (patientIds[1]) {
            const teethPatient2 = [
                { number: 1, status: 'healthy' },
                { number: 2, status: 'healthy' },
                { number: 3, status: 'veneer', notes: 'Porcelain veneer' },
                { number: 4, status: 'veneer', notes: 'Porcelain veneer' },
                { number: 12, status: 'filling', notes: 'Composite filling' },
                { number: 13, status: 'filling', notes: 'Composite filling' },
                { number: 16, status: 'missing' },
                { number: 17, status: 'missing' },
                { number: 32, status: 'missing' },
            ];
            for (const t of teethPatient2) {
                await client.query(`
          INSERT INTO dental_chart (patient_id, tooth_number, status, surface, notes, updated_by)
          VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (patient_id, tooth_number) DO NOTHING
        `, [patientIds[1], t.number, t.status === 'filling' ? 'filled' : t.status, t.surface || null, t.notes || null, adminId]);
            }
        }
        console.log('✅ Dental chart seeded.');

        // ─── Visits ──────────────────────────────────────
        if (patientIds[0]) {
            await client.query(`
        INSERT INTO visits (patient_id, dentist_id, visit_date, visit_type, chief_complaint,
          diagnosis, treatment_performed, teeth_treated, cost, payment_status)
        VALUES
          ($1,$2,'2026-02-10 09:00:00','checkup','Regular checkup','Good oral health overall',
           'Full dental examination and cleaning',NULL,800.00,'paid'),
          ($1,$2,'2026-03-15 10:30:00','filling','Toothache on upper right','Cavity on tooth #2 and #18',
           'Composite filling on teeth #2 and #18','{2,18}',1500.00,'paid')
        ON CONFLICT DO NOTHING
      `, [patientIds[0], adminId]);
        }
        if (patientIds[2]) {
            await client.query(`
        INSERT INTO visits (patient_id, dentist_id, visit_date, visit_type, chief_complaint,
          diagnosis, treatment_performed, teeth_treated, cost, payment_status, next_appointment)
        VALUES
          ($1,$2,'2026-01-20 14:00:00','extraction','Severe pain on lower right','Irreversible pulpitis tooth #18',
           'Extraction of tooth #18','{18}',1200.00,'insurance','2026-04-20')
        ON CONFLICT DO NOTHING
      `, [patientIds[2], dentistId]);
        }
        if (patientIds[3]) {
            await client.query(`
        INSERT INTO visits (patient_id, dentist_id, visit_date, visit_type,
          treatment_performed, cost, payment_status, next_appointment)
        VALUES
          ($1,$2,'2026-04-03 11:00:00','cleaning','Prophylaxis and fluoride treatment',
           600.00,'pending','2026-10-03')
        ON CONFLICT DO NOTHING
      `, [patientIds[3], adminId]);
        }
        console.log('✅ Visits seeded.');

        console.log('\n🦷 Database seeded successfully!');
        console.log('──────────────────────────────────');
        console.log('Default Admin Credentials:');
        console.log('  Username: admin');
        console.log('  Password: admin123');
        console.log('──────────────────────────────────');
    } catch (err) {
        console.error('❌ Seed failed:', err);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

seed().catch(console.error);

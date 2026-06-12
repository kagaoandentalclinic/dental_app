const schema = require('./patient-form-schema.json');

const SECTION_FIELDS = schema.sections;

function valueOrNull(value) {
    if (typeof value !== 'string') return value ?? null;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
}

function pickFields(source = {}, fields = []) {
    const out = {};
    for (const field of fields) {
        if (Object.prototype.hasOwnProperty.call(source, field)) {
            out[field] = source[field];
        }
    }
    return out;
}

function mergeSection(body = {}, sectionName) {
    const nested = body[sectionName] || {};
    return {
        ...pickFields(body, SECTION_FIELDS[sectionName]),
        ...pickFields(nested, SECTION_FIELDS[sectionName]),
    };
}

function normalizePatientPayload(body = {}) {
    const patient = mergeSection(body, 'patient');
    const contact = mergeSection(body, 'contact');
    const profile = mergeSection(body, 'profile');
    const insurance = mergeSection(body, 'insurance');
    const medical = mergeSection(body, 'medical');

    for (const key of Object.keys(patient)) patient[key] = valueOrNull(patient[key]);
    for (const key of Object.keys(contact)) contact[key] = valueOrNull(contact[key]);
    for (const key of Object.keys(profile)) profile[key] = valueOrNull(profile[key]);
    for (const key of Object.keys(insurance)) insurance[key] = valueOrNull(insurance[key]);
    for (const key of Object.keys(medical)) medical[key] = valueOrNull(medical[key]);

    if (profile.marital_status !== 'married') {
        profile.spouse_name = null;
    }

    const hasInsurance = body.has_insurance === true
        || body.insurance?.has_insurance === true
        || Boolean(insurance.insurance_provider || insurance.insurance_id);
    if (!hasInsurance) {
        insurance.insurance_provider = null;
        insurance.insurance_id = null;
    }

    const profilePhoto = patient.profile_photo;
    if (profilePhoto && typeof profilePhoto === 'string' && !profilePhoto.startsWith('data:image/')) {
        patient.profile_photo = null;
    }

    return { patient, contact, profile, insurance, medical };
}

function validateRequiredPatientFields(sections) {
    const missing = [];
    for (const field of schema.requiredFields) {
        if (!sections.patient[field]) missing.push(field);
    }
    return missing;
}

async function findExistingPatientId(pool, patient) {
    const result = await pool.query(
        `SELECT id FROM patients
         WHERE LOWER(TRIM(last_name)) = LOWER(TRIM($1))
           AND LOWER(TRIM(first_name)) = LOWER(TRIM($2))
           AND date_of_birth = $3
           AND is_active = true
         LIMIT 1`,
        [patient.last_name, patient.first_name, patient.date_of_birth]
    );
    return result.rows[0]?.id || null;
}

async function upsertContact(client, patientId, contact = {}) {
    await client.query(
        `INSERT INTO patient_contacts (
            patient_id, address, zip_code, phone, email, business_address, business_phone, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
        ON CONFLICT (patient_id) DO UPDATE SET
            address = EXCLUDED.address,
            zip_code = EXCLUDED.zip_code,
            phone = EXCLUDED.phone,
            email = EXCLUDED.email,
            business_address = EXCLUDED.business_address,
            business_phone = EXCLUDED.business_phone,
            updated_at = NOW()`,
        [
            patientId,
            contact.address ?? null,
            contact.zip_code ?? null,
            contact.phone ?? null,
            contact.email ?? null,
            contact.business_address ?? null,
            contact.business_phone ?? null,
        ]
    );
}

async function upsertProfile(client, patientId, profile = {}) {
    await client.query(
        `INSERT INTO patient_profile_details (
            patient_id, occupation, marital_status, spouse_name, referred_by, preferred_appointment_time, notes, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
        ON CONFLICT (patient_id) DO UPDATE SET
            occupation = EXCLUDED.occupation,
            marital_status = EXCLUDED.marital_status,
            spouse_name = EXCLUDED.spouse_name,
            referred_by = EXCLUDED.referred_by,
            preferred_appointment_time = EXCLUDED.preferred_appointment_time,
            notes = EXCLUDED.notes,
            updated_at = NOW()`,
        [
            patientId,
            profile.occupation ?? null,
            profile.marital_status ?? null,
            profile.spouse_name ?? null,
            profile.referred_by ?? null,
            profile.preferred_appointment_time ?? null,
            profile.notes ?? null,
        ]
    );
}

async function upsertInsurance(client, patientId, insurance = {}) {
    await client.query(
        `INSERT INTO patient_insurance (
            patient_id, insurance_provider, insurance_id, updated_at
        ) VALUES ($1,$2,$3,NOW())
        ON CONFLICT (patient_id) DO UPDATE SET
            insurance_provider = EXCLUDED.insurance_provider,
            insurance_id = EXCLUDED.insurance_id,
            updated_at = NOW()`,
        [
            patientId,
            insurance.insurance_provider ?? null,
            insurance.insurance_id ?? null,
        ]
    );
}

async function upsertMedicalSnapshot(client, patientId, medical = {}, updatedBy = null) {
    await client.query(
        `INSERT INTO medical_history (
            patient_id, height, weight, updated_at, updated_by
        ) VALUES ($1,$2,$3,NOW(),$4)
        ON CONFLICT (patient_id) DO UPDATE SET
            height = COALESCE(EXCLUDED.height, medical_history.height),
            weight = COALESCE(EXCLUDED.weight, medical_history.weight),
            updated_at = NOW(),
            updated_by = EXCLUDED.updated_by`,
        [
            patientId,
            medical.height ?? null,
            medical.weight ?? null,
            updatedBy,
        ]
    );
}

async function insertPatientCore(client, patient, createdBy = null) {
    const result = await client.query(
        `INSERT INTO patients (
            record_date, last_name, first_name, middle_name, date_of_birth, sex, profile_photo, created_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *`,
        [
            patient.record_date ?? null,
            patient.last_name,
            patient.first_name,
            patient.middle_name ?? null,
            patient.date_of_birth,
            patient.sex ?? null,
            patient.profile_photo ?? null,
            createdBy,
        ]
    );
    return result.rows[0];
}

async function updatePatientCore(client, patientId, patient = {}) {
    const result = await client.query(
        `UPDATE patients SET
            record_date = $1,
            last_name = $2,
            first_name = $3,
            middle_name = $4,
            date_of_birth = $5,
            sex = $6,
            profile_photo = COALESCE($7, profile_photo),
            updated_at = NOW()
         WHERE id = $8 AND is_active = true
         RETURNING *`,
        [
            patient.record_date ?? null,
            patient.last_name,
            patient.first_name,
            patient.middle_name ?? null,
            patient.date_of_birth,
            patient.sex ?? null,
            patient.profile_photo ?? null,
            patientId,
        ]
    );
    return result.rows[0] || null;
}

async function updateCoreSection(pool, patientId, patient) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const updated = await updatePatientCore(client, patientId, patient);
        if (!updated) {
            await client.query('ROLLBACK');
            return false;
        }
        await client.query('COMMIT');
        return true;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

async function createPatientWithSections(pool, sections, createdBy = null) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const inserted = await insertPatientCore(client, sections.patient, createdBy);
        await upsertContact(client, inserted.id, sections.contact);
        await upsertProfile(client, inserted.id, sections.profile);
        await upsertInsurance(client, inserted.id, sections.insurance);
        await upsertMedicalSnapshot(client, inserted.id, sections.medical, createdBy);
        await client.query('COMMIT');
        return inserted;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

async function updatePatientSections(pool, patientId, sections, updatedBy = null) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const updated = await updatePatientCore(client, patientId, sections.patient);
        if (!updated) {
            await client.query('ROLLBACK');
            return null;
        }
        await upsertContact(client, patientId, sections.contact);
        await upsertProfile(client, patientId, sections.profile);
        await upsertInsurance(client, patientId, sections.insurance);
        await upsertMedicalSnapshot(client, patientId, sections.medical, updatedBy);
        await client.query('COMMIT');
        return updated;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

async function updateContactSection(pool, patientId, contact) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const exists = await client.query('SELECT id FROM patients WHERE id = $1 AND is_active = true', [patientId]);
        if (exists.rows.length === 0) {
            await client.query('ROLLBACK');
            return false;
        }
        await upsertContact(client, patientId, contact);
        await client.query('UPDATE patients SET updated_at = NOW() WHERE id = $1', [patientId]);
        await client.query('COMMIT');
        return true;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

async function updateProfileSection(pool, patientId, profile) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const exists = await client.query('SELECT id FROM patients WHERE id = $1 AND is_active = true', [patientId]);
        if (exists.rows.length === 0) {
            await client.query('ROLLBACK');
            return false;
        }
        await upsertProfile(client, patientId, profile);
        await client.query('UPDATE patients SET updated_at = NOW() WHERE id = $1', [patientId]);
        await client.query('COMMIT');
        return true;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

async function updateInsuranceSection(pool, patientId, insurance) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const exists = await client.query('SELECT id FROM patients WHERE id = $1 AND is_active = true', [patientId]);
        if (exists.rows.length === 0) {
            await client.query('ROLLBACK');
            return false;
        }
        await upsertInsurance(client, patientId, insurance);
        await client.query('UPDATE patients SET updated_at = NOW() WHERE id = $1', [patientId]);
        await client.query('COMMIT');
        return true;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

async function getPatientDetail(pool, patientId) {
    const result = await pool.query(
        `SELECT
            p.id,
            p.record_date,
            p.last_name,
            p.first_name,
            p.middle_name,
            p.date_of_birth,
            p.sex,
            p.profile_photo,
            p.created_at,
            p.updated_at,
            a.full_name AS created_by_name,
            CASE WHEN pc.patient_id IS NOT NULL THEN pc.address ELSE p.address END AS address,
            CASE WHEN pc.patient_id IS NOT NULL THEN pc.zip_code ELSE p.zip_code END AS zip_code,
            CASE WHEN pc.patient_id IS NOT NULL THEN pc.phone ELSE p.phone END AS phone,
            CASE WHEN pc.patient_id IS NOT NULL THEN pc.email ELSE p.email END AS email,
            CASE WHEN pc.patient_id IS NOT NULL THEN pc.business_address ELSE p.business_address END AS business_address,
            CASE WHEN pc.patient_id IS NOT NULL THEN pc.business_phone ELSE p.business_phone END AS business_phone,
            CASE WHEN pp.patient_id IS NOT NULL THEN pp.occupation ELSE p.occupation END AS occupation,
            CASE WHEN pp.patient_id IS NOT NULL THEN pp.marital_status ELSE p.marital_status END AS marital_status,
            CASE WHEN pp.patient_id IS NOT NULL THEN pp.spouse_name ELSE p.spouse_name END AS spouse_name,
            CASE WHEN pp.patient_id IS NOT NULL THEN pp.referred_by ELSE p.referred_by END AS referred_by,
            CASE WHEN pp.patient_id IS NOT NULL THEN pp.preferred_appointment_time ELSE p.preferred_appointment_time END AS preferred_appointment_time,
            CASE WHEN pp.patient_id IS NOT NULL THEN pp.notes ELSE p.notes END AS notes,
            CASE WHEN pi.patient_id IS NOT NULL THEN pi.insurance_provider ELSE p.insurance_provider END AS insurance_provider,
            CASE WHEN pi.patient_id IS NOT NULL THEN pi.insurance_id ELSE p.insurance_id END AS insurance_id,
            CASE WHEN mh.patient_id IS NOT NULL THEN mh.height ELSE p.height END AS height,
            CASE WHEN mh.patient_id IS NOT NULL THEN mh.weight ELSE p.weight END AS weight,
            (SELECT COUNT(*) FROM dental_chart dc WHERE dc.patient_id = p.id AND dc.status IN ('cavity', 'root_fragment')) AS dental_issues,
            (SELECT COUNT(*) FROM visits v WHERE v.patient_id = p.id) AS total_visits,
            (SELECT MAX(v.visit_date) FROM visits v WHERE v.patient_id = p.id) AS last_visit
         FROM patients p
         LEFT JOIN admins a ON p.created_by = a.id
         LEFT JOIN patient_contacts pc ON pc.patient_id = p.id
         LEFT JOIN patient_profile_details pp ON pp.patient_id = p.id
         LEFT JOIN patient_insurance pi ON pi.patient_id = p.id
         LEFT JOIN medical_history mh ON mh.patient_id = p.id
         WHERE p.id = $1 AND p.is_active = true`,
        [patientId]
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
        patient: {
            id: row.id,
            record_date: row.record_date,
            last_name: row.last_name,
            first_name: row.first_name,
            middle_name: row.middle_name,
            date_of_birth: row.date_of_birth,
            sex: row.sex,
            profile_photo: row.profile_photo,
            created_at: row.created_at,
            updated_at: row.updated_at,
            created_by_name: row.created_by_name,
        },
        contact: {
            address: row.address,
            zip_code: row.zip_code,
            phone: row.phone,
            email: row.email,
            business_address: row.business_address,
            business_phone: row.business_phone,
        },
        profile: {
            occupation: row.occupation,
            marital_status: row.marital_status,
            spouse_name: row.spouse_name,
            referred_by: row.referred_by,
            preferred_appointment_time: row.preferred_appointment_time,
            notes: row.notes,
        },
        insurance: {
            has_insurance: Boolean(row.insurance_provider || row.insurance_id),
            insurance_provider: row.insurance_provider,
            insurance_id: row.insurance_id,
        },
        medical: {
            height: row.height,
            weight: row.weight,
        },
        summary: {
            dental_issues: Number(row.dental_issues || 0),
            total_visits: Number(row.total_visits || 0),
            last_visit: row.last_visit,
        },
    };
}

module.exports = {
    SECTION_FIELDS,
    normalizePatientPayload,
    validateRequiredPatientFields,
    findExistingPatientId,
    createPatientWithSections,
    updatePatientSections,
    updateCoreSection,
    updateContactSection,
    updateProfileSection,
    updateInsuranceSection,
    getPatientDetail,
    upsertContact,
    upsertProfile,
    upsertInsurance,
    upsertMedicalSnapshot,
};

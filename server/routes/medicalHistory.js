const express = require('express');
const router = express.Router({ mergeParams: true });
const pool = require('../db/pool');
const { verifyToken } = require('../middleware/auth');

// GET /api/patients/:id/medical-history
router.get('/', verifyToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT mh.*, a.full_name AS updated_by_name
       FROM medical_history mh
       LEFT JOIN admins a ON mh.updated_by = a.id
       WHERE mh.patient_id = $1`,
            [req.params.id]
        );
        if (result.rows.length === 0) return res.json(null);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/patients/:id/medical-history - upsert
router.put('/', verifyToken, async (req, res) => {
    const {
        height, weight,
        general_health, physician_name_address, last_physical_exam, taking_medication, medication_details,
        heart_disease, heart_murmur, rheumatic_fever, jaundice, abnormal_blood_pressure,
        asthma_hay_fever, ulcers, sinus_trouble, tuberculosis_lung_disease, cough,
        diabetes, hepatitis, epilepsy, arthritis, anemia, stroke, congenital_heart_lesions, glaucoma,
        treated_with_xray, allergic_penicillin, allergic_codeine, allergic_local_anesthetic,
        allergic_other_medications, allergic_other_details, prolonged_bleeding, fainting_spells,
        excessive_urination_thirst, is_pregnant,
    } = req.body;

    try {
        const result = await pool.query(`
      INSERT INTO medical_history (
        patient_id, height, weight, general_health, physician_name_address, last_physical_exam, taking_medication, medication_details,
        heart_disease, heart_murmur, rheumatic_fever, jaundice, abnormal_blood_pressure,
        asthma_hay_fever, ulcers, sinus_trouble, tuberculosis_lung_disease, cough,
        diabetes, hepatitis, epilepsy, arthritis, anemia, stroke, congenital_heart_lesions, glaucoma,
        treated_with_xray, allergic_penicillin, allergic_codeine, allergic_local_anesthetic,
        allergic_other_medications, allergic_other_details, prolonged_bleeding, fainting_spells,
        excessive_urination_thirst, is_pregnant, updated_at, updated_by
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,NOW(),$37
      )
      ON CONFLICT (patient_id) DO UPDATE SET
        height=EXCLUDED.height,
        weight=EXCLUDED.weight,
        general_health=EXCLUDED.general_health,
        physician_name_address=EXCLUDED.physician_name_address,
        last_physical_exam=EXCLUDED.last_physical_exam,
        taking_medication=EXCLUDED.taking_medication,
        medication_details=EXCLUDED.medication_details,
        heart_disease=EXCLUDED.heart_disease, heart_murmur=EXCLUDED.heart_murmur,
        rheumatic_fever=EXCLUDED.rheumatic_fever, jaundice=EXCLUDED.jaundice,
        abnormal_blood_pressure=EXCLUDED.abnormal_blood_pressure, asthma_hay_fever=EXCLUDED.asthma_hay_fever,
        ulcers=EXCLUDED.ulcers, sinus_trouble=EXCLUDED.sinus_trouble,
        tuberculosis_lung_disease=EXCLUDED.tuberculosis_lung_disease, cough=EXCLUDED.cough,
        diabetes=EXCLUDED.diabetes, hepatitis=EXCLUDED.hepatitis, epilepsy=EXCLUDED.epilepsy,
        arthritis=EXCLUDED.arthritis, anemia=EXCLUDED.anemia, stroke=EXCLUDED.stroke,
        congenital_heart_lesions=EXCLUDED.congenital_heart_lesions, glaucoma=EXCLUDED.glaucoma,
        treated_with_xray=EXCLUDED.treated_with_xray, allergic_penicillin=EXCLUDED.allergic_penicillin,
        allergic_codeine=EXCLUDED.allergic_codeine, allergic_local_anesthetic=EXCLUDED.allergic_local_anesthetic,
        allergic_other_medications=EXCLUDED.allergic_other_medications,
        allergic_other_details=EXCLUDED.allergic_other_details,
        prolonged_bleeding=EXCLUDED.prolonged_bleeding, fainting_spells=EXCLUDED.fainting_spells,
        excessive_urination_thirst=EXCLUDED.excessive_urination_thirst, is_pregnant=EXCLUDED.is_pregnant,
        updated_at=NOW(), updated_by=EXCLUDED.updated_by
      RETURNING *
    `, [
            req.params.id, height || null, weight || null, general_health || null, physician_name_address || null, last_physical_exam || null,
            taking_medication || false, medication_details || null,
            heart_disease || false, heart_murmur || false, rheumatic_fever || false, jaundice || false,
            abnormal_blood_pressure || false, asthma_hay_fever || false, ulcers || false, sinus_trouble || false,
            tuberculosis_lung_disease || false, cough || false, diabetes || false, hepatitis || false,
            epilepsy || false, arthritis || false, anemia || false, stroke || false,
            congenital_heart_lesions || false, glaucoma || false, treated_with_xray || false,
            allergic_penicillin || false, allergic_codeine || false, allergic_local_anesthetic || false,
            allergic_other_medications || false, allergic_other_details || null,
            prolonged_bleeding || false, fainting_spells || false, excessive_urination_thirst || false,
            is_pregnant || false, req.admin.id,
        ]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

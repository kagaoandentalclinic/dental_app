import { toLocalDateInput } from '../../utils/helpers';
import { createEmptyPatientSections, PATIENT_FORM_SCHEMA } from './schema';

function sectionValue(detail, section, field) {
    if (!detail) return '';
    if (detail[section] && detail[section][field] != null) return detail[section][field];
    if (detail[field] != null) return detail[field];
    return '';
}

export function createPatientFormState(detail = null, { defaultRecordDate = '' } = {}) {
    const base = createEmptyPatientSections(defaultRecordDate);
    if (!detail) return base;

    const form = {
        patient: {
            record_date: toLocalDateInput(sectionValue(detail, 'patient', 'record_date')),
            last_name: sectionValue(detail, 'patient', 'last_name'),
            first_name: sectionValue(detail, 'patient', 'first_name'),
            middle_name: sectionValue(detail, 'patient', 'middle_name'),
            date_of_birth: toLocalDateInput(sectionValue(detail, 'patient', 'date_of_birth')),
            sex: sectionValue(detail, 'patient', 'sex'),
            profile_photo: sectionValue(detail, 'patient', 'profile_photo'),
        },
        contact: {
            address: sectionValue(detail, 'contact', 'address'),
            zip_code: sectionValue(detail, 'contact', 'zip_code'),
            phone: sectionValue(detail, 'contact', 'phone'),
            email: sectionValue(detail, 'contact', 'email'),
            business_address: sectionValue(detail, 'contact', 'business_address'),
            business_phone: sectionValue(detail, 'contact', 'business_phone'),
        },
        profile: {
            occupation: sectionValue(detail, 'profile', 'occupation'),
            marital_status: sectionValue(detail, 'profile', 'marital_status'),
            spouse_name: sectionValue(detail, 'profile', 'spouse_name'),
            referred_by: sectionValue(detail, 'profile', 'referred_by'),
            preferred_appointment_time: sectionValue(detail, 'profile', 'preferred_appointment_time'),
            notes: sectionValue(detail, 'profile', 'notes'),
        },
        insurance: {
            has_insurance: Boolean(
                sectionValue(detail, 'insurance', 'insurance_provider') ||
                sectionValue(detail, 'insurance', 'insurance_id') ||
                detail.insurance?.has_insurance
            ),
            insurance_provider: sectionValue(detail, 'insurance', 'insurance_provider'),
            insurance_id: sectionValue(detail, 'insurance', 'insurance_id'),
        },
        medical: {
            height: sectionValue(detail, 'medical', 'height'),
            weight: sectionValue(detail, 'medical', 'weight'),
        },
    };

    if (!form.patient.record_date) {
        form.patient.record_date = defaultRecordDate;
    }

    return form;
}

export function buildPatientPayload(form) {
    const insurance = form.insurance?.has_insurance
        ? {
            insurance_provider: form.insurance.insurance_provider,
            insurance_id: form.insurance.insurance_id,
        }
        : {
            insurance_provider: '',
            insurance_id: '',
        };

    return {
        patient: { ...form.patient },
        contact: { ...form.contact },
        profile: {
            ...form.profile,
            spouse_name: form.profile.marital_status === 'married' ? form.profile.spouse_name : '',
        },
        insurance: {
            ...insurance,
            has_insurance: form.insurance?.has_insurance === true,
        },
        medical: { ...form.medical },
    };
}

export function validatePatientForm(form) {
    const errors = {};
    for (const field of PATIENT_FORM_SCHEMA.requiredFields) {
        if (!form.patient?.[field]?.toString().trim()) {
            errors[field] = `${field.replace(/_/g, ' ')} is required`;
        }
    }
    return errors;
}

export function flattenPatientDetail(detail) {
    if (!detail) return null;
    return {
        ...detail.patient,
        ...detail.contact,
        ...detail.profile,
        ...detail.insurance,
        ...detail.medical,
        ...detail.summary,
    };
}

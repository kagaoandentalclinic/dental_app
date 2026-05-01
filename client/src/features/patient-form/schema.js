import sharedSchema from '../../../../shared/patient-form-schema.json';

export const PATIENT_FORM_SCHEMA = sharedSchema;
export const SEX_OPTIONS = PATIENT_FORM_SCHEMA.options.sex;
export const MARITAL_STATUS_OPTIONS = PATIENT_FORM_SCHEMA.options.maritalStatus;

export function createEmptyPatientSections(recordDate = '') {
    return {
        patient: {
            record_date: recordDate,
            last_name: '',
            first_name: '',
            middle_name: '',
            date_of_birth: '',
            sex: '',
            profile_photo: '',
        },
        contact: {
            address: '',
            zip_code: '',
            phone: '',
            email: '',
            business_address: '',
            business_phone: '',
        },
        profile: {
            occupation: '',
            marital_status: '',
            spouse_name: '',
            referred_by: '',
            preferred_appointment_time: '',
            notes: '',
        },
        insurance: {
            has_insurance: false,
            insurance_provider: '',
            insurance_id: '',
        },
        medical: {
            height: '',
            weight: '',
        },
    };
}

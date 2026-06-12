const DEFAULT_CLINIC_TIMEZONE_OFFSET = '+08:00';

function normalizeClinicTimezoneOffset(rawOffset) {
    const value = String(rawOffset || DEFAULT_CLINIC_TIMEZONE_OFFSET).trim().toUpperCase();
    if (value === 'Z') return 'Z';
    if (/^[+-]\d{2}:\d{2}$/.test(value)) return value;
    return DEFAULT_CLINIC_TIMEZONE_OFFSET;
}

function buildClinicAppointmentDateTime(preferredDate, preferredTime) {
    const date = String(preferredDate || '').trim();
    const time = String(preferredTime || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    if (!/^\d{2}:\d{2}$/.test(time)) return null;

    const clinicOffset = normalizeClinicTimezoneOffset(process.env.CLINIC_TIMEZONE_OFFSET);
    const appointmentDate = new Date(`${date}T${time}:00${clinicOffset}`);
    if (Number.isNaN(appointmentDate.getTime())) return null;
    return appointmentDate;
}

module.exports = {
    buildClinicAppointmentDateTime,
    normalizeClinicTimezoneOffset,
    DEFAULT_CLINIC_TIMEZONE_OFFSET,
};

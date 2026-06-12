const PERMISSIONS = {
    VIEW_SETTINGS: 'view_settings',
    MANAGE_CLINIC_SETTINGS: 'manage_clinic_settings',
    MANAGE_STAFF: 'manage_staff',
    MANAGE_PUBLIC_FORMS: 'manage_public_forms',
    MANAGE_KIOSK: 'manage_kiosk',
    MANAGE_BACKUPS: 'manage_backups',
    VIEW_AUDIT_LOGS: 'view_audit_logs',
    MANAGE_PATIENTS: 'manage_patients',
    MANAGE_APPOINTMENTS: 'manage_appointments',
};

const ROLE_PERMISSIONS = {
    admin: Object.values(PERMISSIONS),
    dentist: [
        PERMISSIONS.VIEW_SETTINGS,
        PERMISSIONS.MANAGE_PATIENTS,
        PERMISSIONS.MANAGE_APPOINTMENTS,
    ],
    hygienist: [
        PERMISSIONS.VIEW_SETTINGS,
        PERMISSIONS.MANAGE_PATIENTS,
        PERMISSIONS.MANAGE_APPOINTMENTS,
    ],
    receptionist: [
        PERMISSIONS.VIEW_SETTINGS,
        PERMISSIONS.MANAGE_PATIENTS,
        PERMISSIONS.MANAGE_APPOINTMENTS,
    ],
};

function getRolePermissions(role) {
    return ROLE_PERMISSIONS[role] || [];
}

function hasPermission(role, permission) {
    return getRolePermissions(role).includes(permission);
}

function attachPermissions(admin = {}) {
    return {
        ...admin,
        permissions: getRolePermissions(admin.role),
    };
}

module.exports = {
    PERMISSIONS,
    ROLE_PERMISSIONS,
    getRolePermissions,
    hasPermission,
    attachPermissions,
};

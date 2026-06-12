// Tooth statuses
export const TOOTH_STATUSES = [
    { value: 'healthy', label: 'Healthy', color: '#28A745', bg: '#d4edda', text: '#155724' },
    { value: 'cavity', label: 'Caries', color: '#DC3545', bg: '#f8d7da', text: '#721c24' },
    { value: 'root_fragment', label: 'Root Fragment', color: '#B45309', bg: '#fef3c7', text: '#78350f' },
    { value: 'filled', label: 'Filled', color: '#17A2B8', bg: '#d1ecf1', text: '#0c5460' },
    { value: 'crown', label: 'Crown', color: '#F0AD4E', bg: '#fff3cd', text: '#856404' },
    { value: 'missing', label: 'Missing', color: '#6C757D', bg: '#e2e3e5', text: '#383d41' },
    { value: 'root_canal', label: 'Root Canal', color: '#6F42C1', bg: '#e2d9f3', text: '#432874' },
    { value: 'extracted', label: 'Extracted', color: '#343A40', bg: '#d6d8db', text: '#1b1e21' },
    { value: 'implant', label: 'Implant', color: '#20C997', bg: '#d2f4ea', text: '#0a5c44' },
    { value: 'bridge', label: 'Bridge', color: '#FD7E14', bg: '#ffe5d0', text: '#7a3a00' },
    { value: 'veneer', label: 'Veneer', color: '#E83E8C', bg: '#fce4ef', text: '#7c1339' },
];

export const TOOTH_STATUS_MAP = Object.fromEntries(TOOTH_STATUSES.map(s => [s.value, s]));

// Tooth names (Universal Numbering System)
export const TOOTH_NAMES = {
    1: 'Upper Right Third Molar', 2: 'Upper Right Second Molar', 3: 'Upper Right First Molar',
    4: 'Upper Right Second Premolar', 5: 'Upper Right First Premolar', 6: 'Upper Right Canine',
    7: 'Upper Right Lateral Incisor', 8: 'Upper Right Central Incisor',
    9: 'Upper Left Central Incisor', 10: 'Upper Left Lateral Incisor', 11: 'Upper Left Canine',
    12: 'Upper Left First Premolar', 13: 'Upper Left Second Premolar', 14: 'Upper Left First Molar',
    15: 'Upper Left Second Molar', 16: 'Upper Left Third Molar',
    17: 'Lower Left Third Molar', 18: 'Lower Left Second Molar', 19: 'Lower Left First Molar',
    20: 'Lower Left Second Premolar', 21: 'Lower Left First Premolar', 22: 'Lower Left Canine',
    23: 'Lower Left Lateral Incisor', 24: 'Lower Left Central Incisor',
    25: 'Lower Right Central Incisor', 26: 'Lower Right Lateral Incisor', 27: 'Lower Right Canine',
    28: 'Lower Right First Premolar', 29: 'Lower Right Second Premolar', 30: 'Lower Right First Molar',
    31: 'Lower Right Second Molar', 32: 'Lower Right Third Molar',
};

export const TOOTH_SURFACES = ['Mesial', 'Distal', 'Occlusal', 'Buccal', 'Lingual'];

export const VISIT_TYPES = [
    { value: 'checkup', label: 'Checkup', color: 'blue' },
    { value: 'cleaning', label: 'Cleaning', color: 'teal' },
    { value: 'filling', label: 'Filling', color: 'purple' },
    { value: 'extraction', label: 'Extraction', color: 'red' },
    { value: 'root_canal', label: 'Root Canal', color: 'orange' },
    { value: 'crown', label: 'Crown', color: 'amber' },
    { value: 'emergency', label: 'Emergency', color: 'red' },
    { value: 'consultation', label: 'Consultation', color: 'blue' },
    { value: 'whitening', label: 'Whitening', color: 'pink' },
    { value: 'braces', label: 'Braces', color: 'purple' },
    { value: 'dentures', label: 'Dentures', color: 'gray' },
    { value: 'implant', label: 'Implant', color: 'teal' },
    { value: 'other', label: 'Other', color: 'gray' },
];

export const PAYMENT_STATUSES = [
    { value: 'pending', label: 'Pending', class: 'badge-amber' },
    { value: 'paid', label: 'Paid', class: 'badge-green' },
    { value: 'insurance', label: 'Insurance', class: 'badge-blue' },
    { value: 'partial', label: 'Partial', class: 'badge-orange' },
];

export const BRACKET_TYPES = [
    { value: 'metal',         label: 'Metal Braces' },
    { value: 'ceramic',       label: 'Ceramic Braces' },
    { value: 'lingual',       label: 'Lingual Braces' },
    { value: 'clear_aligner', label: 'Clear Aligners' },
    { value: 'other',         label: 'Other' },
];

export const ORTHO_STATUSES = [
    { value: 'active',       label: 'Active',       class: 'badge-green' },
    { value: 'completed',    label: 'Completed',    class: 'badge-blue' },
    { value: 'discontinued', label: 'Discontinued', class: 'badge-red' },
];

export const APPOINTMENT_STATUSES = [
    { value: 'pending',   label: 'Pending'   },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'no_show',   label: 'No Show'   },
];

export const APPOINTMENT_STATUS_STYLES = {
    pending:   { bg: 'bg-amber-100',  border: 'border-amber-400',  text: 'text-amber-800',  dot: 'bg-amber-500'  },
    scheduled: { bg: 'bg-blue-100',   border: 'border-blue-400',   text: 'text-blue-800',   dot: 'bg-blue-500'   },
    completed: { bg: 'bg-green-100',  border: 'border-green-400',  text: 'text-green-800',  dot: 'bg-green-500'  },
    cancelled: { bg: 'bg-gray-100',   border: 'border-gray-300',   text: 'text-gray-500',   dot: 'bg-gray-400'   },
    no_show:   { bg: 'bg-red-100',    border: 'border-red-400',    text: 'text-red-700',    dot: 'bg-red-500'    },
};

export const VISIT_TYPE_COLORS = {
    checkup: 'badge-blue', cleaning: 'badge-teal', filling: 'badge-purple',
    extraction: 'badge-red', root_canal: 'badge-orange', crown: 'badge-amber',
    emergency: 'badge-red', consultation: 'badge-blue', whitening: 'badge-pink',
    braces: 'badge-purple', dentures: 'badge-gray', implant: 'badge-teal', other: 'badge-gray',
};

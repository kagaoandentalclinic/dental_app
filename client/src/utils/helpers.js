import { format, parseISO, differenceInYears, isValid } from 'date-fns';

// Converts any date value (ISO string, Date object) to YYYY-MM-DD using LOCAL timezone.
// Fixes the off-by-one bug caused by pg returning DATE columns as local-midnight Date objects,
// which serialize to the previous day in UTC (e.g. "2001-10-24T16:00:00.000Z" for Oct 25 in UTC+8).
export function toLocalDateInput(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function formatDate(date, fmt = 'MMM d, yyyy') {
    if (!date) return '—';
    try {
        const d = typeof date === 'string' ? parseISO(date) : date;
        return isValid(d) ? format(d, fmt) : '—';
    } catch { return '—'; }
}

export function formatDateTime(date) {
    return formatDate(date, 'MMM d, yyyy h:mm a');
}

export function calcAge(dob) {
    if (!dob) return '—';
    try {
        const d = typeof dob === 'string' ? parseISO(dob) : dob;
        return isValid(d) ? differenceInYears(new Date(), d) : '—';
    } catch { return '—'; }
}

export function formatName(p, style = 'full') {
    if (!p) return '';
    const person = p.patient || p;
    if (style === 'last-first') {
        const mn = person.middle_name ? ` ${person.middle_name[0]}.` : '';
        return `${person.last_name}, ${person.first_name}${mn}`;
    }
    const mn = person.middle_name ? ` ${person.middle_name}` : '';
    return `${person.first_name}${mn} ${person.last_name}`;
}

export function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatCurrency(amount) {
    if (amount == null || amount === '') return '—';
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
}

export function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
}

export function debounce(fn, delay) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

const TOOTH_STATUSES = [
    'healthy',
    'cavity',
    'root_fragment',
    'filled',
    'crown',
    'missing',
    'root_canal',
    'extracted',
    'implant',
    'bridge',
    'veneer',
];

const DENTAL_ISSUE_STATUSES = ['cavity', 'root_fragment'];

const quoteStatuses = (statuses) => statuses.map(status => `'${status}'`).join(', ');

const TOOTH_STATUSES_SQL = quoteStatuses(TOOTH_STATUSES);
const DENTAL_ISSUE_STATUSES_SQL = quoteStatuses(DENTAL_ISSUE_STATUSES);

function isValidToothStatus(status) {
    return TOOTH_STATUSES.includes(status || 'healthy');
}

function isDentalIssueStatus(status) {
    return DENTAL_ISSUE_STATUSES.includes(status);
}

function getDentalIssueSql(alias = 'dc') {
    return `${alias}.status IN (${DENTAL_ISSUE_STATUSES_SQL})`;
}

module.exports = {
    TOOTH_STATUSES,
    TOOTH_STATUSES_SQL,
    DENTAL_ISSUE_STATUSES,
    DENTAL_ISSUE_STATUSES_SQL,
    isValidToothStatus,
    isDentalIssueStatus,
    getDentalIssueSql,
};

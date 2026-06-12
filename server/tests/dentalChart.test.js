const test = require('node:test');
const assert = require('node:assert/strict');

const {
    DENTAL_ISSUE_STATUSES,
    TOOTH_STATUSES,
    getDentalIssueSql,
    isDentalIssueStatus,
    isValidToothStatus,
} = require('../utils/dentalChart');

test('only caries and root fragment are counted as dental issues', () => {
    assert.deepEqual(DENTAL_ISSUE_STATUSES, ['cavity', 'root_fragment']);
    assert.equal(isDentalIssueStatus('cavity'), true);
    assert.equal(isDentalIssueStatus('root_fragment'), true);
    assert.equal(isDentalIssueStatus('filled'), false);
    assert.equal(isDentalIssueStatus('healthy'), false);
});

test('valid tooth statuses include restorative states and default healthy', () => {
    assert.equal(isValidToothStatus(undefined), true);
    assert.equal(isValidToothStatus('healthy'), true);
    assert.equal(isValidToothStatus('filled'), true);
    assert.equal(isValidToothStatus('veneer'), true);
    assert.equal(isValidToothStatus('not_a_real_status'), false);
    assert.ok(TOOTH_STATUSES.includes('root_fragment'));
});

test('shared dental issue SQL is generated from one source of truth', () => {
    assert.equal(
        getDentalIssueSql('dc'),
        "dc.status IN ('cavity', 'root_fragment')"
    );
});

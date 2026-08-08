const MIN_LENGTH = 8;

function isStrongPassword(value) {
    if (typeof value !== 'string' || value.length < MIN_LENGTH) return false;
    return /[a-zA-Z]/.test(value) && /[0-9]/.test(value);
}

const PASSWORD_POLICY_MESSAGE = `Password must be at least ${MIN_LENGTH} characters and include a letter and a number`;

module.exports = { MIN_LENGTH, isStrongPassword, PASSWORD_POLICY_MESSAGE };

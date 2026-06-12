require('dotenv').config();
const { createPool } = require('./config');
const logger = require('../utils/logger');

const pool = createPool();

pool.on('error', (err) => {
    logger.error('Unexpected error on idle PostgreSQL client', err);
});

module.exports = pool;

function timestamp() {
    return new Date().toISOString();
}

function serializeMeta(meta) {
    if (!meta) return '';
    try {
        return ` ${JSON.stringify(meta)}`;
    } catch {
        return ' {"meta":"unserializable"}';
    }
}

function write(level, message, meta) {
    const line = `[${timestamp()}] ${level.toUpperCase()} ${message}${serializeMeta(meta)}`;
    if (level === 'error') {
        console.error(line);
        return;
    }
    if (level === 'warn') {
        console.warn(line);
        return;
    }
    console.log(line);
}

function error(message, err, meta = {}) {
    write('error', message, {
        ...meta,
        error: err ? {
            name: err.name,
            message: err.message,
            stack: err.stack,
        } : undefined,
    });
}

module.exports = {
    info: (message, meta) => write('info', message, meta),
    warn: (message, meta) => write('warn', message, meta),
    error,
};

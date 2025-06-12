export class DebugLogger {
    constructor(moduleName) {
        this.moduleName = moduleName;
        this.logger = console;
    }

    log(...args) {
        this.logger.log(`[${this.moduleName}]`, ...args);
    }

    error(...args) {
        this.logger.error(`[${this.moduleName}]`, ...args);
    }

    warn(...args) {
        this.logger.warn(`[${this.moduleName}]`, ...args);
    }
} 
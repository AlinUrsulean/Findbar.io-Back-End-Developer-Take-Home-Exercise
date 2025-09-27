const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

class Logger {
  constructor() {
    this.level = process.env.LOG_LEVEL || 'info';
  }

  shouldLog(level) {
    return LOG_LEVELS[level] <= LOG_LEVELS[this.level];
  }

  formatMessage(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ` ${args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : arg
    ).join(' ')}` : '';
    
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${formattedArgs}`;
  }

  error(message, ...args) {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, ...args));
    }
  }

  warn(message, ...args) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, ...args));
    }
  }

  info(message, ...args) {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, ...args));
    }
  }

  debug(message, ...args) {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, ...args));
    }
  }
}

const logger = new Logger();

module.exports = { logger };


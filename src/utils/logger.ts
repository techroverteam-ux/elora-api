import fs from 'fs';
import path from 'path';

class Logger {
  private logFile: string;

  constructor() {
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    this.logFile = path.join(logsDir, 'upload.log');
  }

  private writeLog(level: string, message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${level}: ${message}${data ? ' ' + JSON.stringify(data) : ''}\n`;
    
    // Write to file
    fs.appendFileSync(this.logFile, logEntry);
    
    // Also log to console
    console.log(logEntry.trim());
  }

  info(message: string, data?: any) {
    this.writeLog('INFO', message, data);
  }

  error(message: string, data?: any) {
    this.writeLog('ERROR', message, data);
  }

  debug(message: string, data?: any) {
    this.writeLog('DEBUG', message, data);
  }
}

export default new Logger();
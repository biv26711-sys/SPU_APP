
class Logger {
  constructor() {
    this.logs = this.loadLogs();
    this.maxLogs = 1000; 
  }

  loadLogs() {
    try {
      const savedLogs = localStorage.getItem('spu_app_logs');
      return savedLogs ? JSON.parse(savedLogs) : [];
    } catch (error) {
      console.warn('Ошибка загрузки логов:', error);
      return [];
    }
  }

  saveLogs() {
    try {
      if (this.logs.length > this.maxLogs) {
        this.logs = this.logs.slice(-this.maxLogs);
      }
      localStorage.setItem('spu_app_logs', JSON.stringify(this.logs));
    } catch (error) {
      console.warn('Ошибка сохранения логов:', error);
    }
  }

  log(action, details = {}, level = 'info') {
    const logEntry = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      action,
      details,
      level,
      sessionId: this.getSessionId(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    this.logs.push(logEntry);
    this.saveLogs();

    if (level === 'error') {
      console.error(`[SPU Logger] ${action}:`, details);
    } else if (level === 'warn') {
      console.warn(`[SPU Logger] ${action}:`, details);
    } else {
      console.log(`[SPU Logger] ${action}:`, details);
    }

    return logEntry;
  }

  getSessionId() {
    let sessionId = sessionStorage.getItem('spu_session_id');
    if (!sessionId) {
      sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('spu_session_id', sessionId);
    }
    return sessionId;
  }

  logInfo(action, details = {}) {
    return this.log(action, details, 'info');
  }

  logWarning(action, details = {}) {
    return this.log(action, details, 'warn');
  }

  logError(action, details = {}) {
    return this.log(action, details, 'error');
  }

  logUserAction(action, details = {}) {
    return this.log(`USER_ACTION: ${action}`, details, 'info');
  }

  logSystemEvent(event, details = {}) {
    return this.log(`SYSTEM_EVENT: ${event}`, details, 'info');
  }

  logCalculationError(error, taskData = {}) {
    return this.log('CALCULATION_ERROR', {
      error: error.message,
      stack: error.stack,
      taskData
    }, 'error');
  }

  logCalculationSuccess(result) {
    return this.log('CALCULATION_SUCCESS', {
      tasksCount: result.tasks?.length || 0,
      projectDuration: result.projectDuration,
      criticalPathLength: result.criticalPath?.length || 0,
      hasErrors: result.errors?.length > 0
    }, 'info');
  }

  logFileOperation(operation, filename, success = true, error = null) {
    return this.log(`FILE_OPERATION: ${operation}`, {
      filename,
      success,
      error: error?.message,
      timestamp: new Date().toISOString()
    }, success ? 'info' : 'error');
  }

  getLogs(filter = {}) {
    let filteredLogs = [...this.logs];

    if (filter.level) {
      filteredLogs = filteredLogs.filter(log => log.level === filter.level);
    }

    if (filter.action) {
      filteredLogs = filteredLogs.filter(log => 
        log.action.toLowerCase().includes(filter.action.toLowerCase())
      );
    }

    if (filter.startDate) {
      const startDate = new Date(filter.startDate);
      filteredLogs = filteredLogs.filter(log => 
        new Date(log.timestamp) >= startDate
      );
    }

    if (filter.endDate) {
      const endDate = new Date(filter.endDate);
      filteredLogs = filteredLogs.filter(log => 
        new Date(log.timestamp) <= endDate
      );
    }

    if (filter.sessionId) {
      filteredLogs = filteredLogs.filter(log => log.sessionId === filter.sessionId);
    }

    filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (filter.limit) {
      filteredLogs = filteredLogs.slice(0, filter.limit);
    }

    return filteredLogs;
  }

  getStatistics() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const todayLogs = this.logs.filter(log => new Date(log.timestamp) >= today);
    const weekLogs = this.logs.filter(log => new Date(log.timestamp) >= thisWeek);
    const monthLogs = this.logs.filter(log => new Date(log.timestamp) >= thisMonth);

    const actionCounts = {};
    this.logs.forEach(log => {
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
    });

    const levelCounts = {};
    this.logs.forEach(log => {
      levelCounts[log.level] = (levelCounts[log.level] || 0) + 1;
    });

    return {
      total: this.logs.length,
      today: todayLogs.length,
      thisWeek: weekLogs.length,
      thisMonth: monthLogs.length,
      actionCounts,
      levelCounts,
      sessions: [...new Set(this.logs.map(log => log.sessionId))].length,
      firstLog: this.logs.length > 0 ? this.logs[0].timestamp : null,
      lastLog: this.logs.length > 0 ? this.logs[this.logs.length - 1].timestamp : null
    };
  }

  exportToCSV() {
    const headers = [
      'Время',
      'Действие',
      'Уровень',
      'Детали',
      'Сессия',
      'URL'
    ];

    const csvContent = [
      headers.join(','),
      ...this.logs.map(log => [
        `"${new Date(log.timestamp).toLocaleString('ru-RU')}"`,
        `"${log.action}"`,
        `"${log.level}"`,
        `"${JSON.stringify(log.details).replace(/"/g, '""')}"`,
        `"${log.sessionId}"`,
        `"${log.url}"`
      ].join(','))
    ].join('\n');

    const dataBlob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `spu_logs_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    this.logFileOperation('EXPORT_LOGS', link.download, true);
    return true;
  }

  clearLogs() {
    const logsCount = this.logs.length;
    this.logs = [];
    this.saveLogs();
    this.logSystemEvent('LOGS_CLEARED', { clearedCount: logsCount });
    return logsCount;
  }

  clearOldLogs(daysToKeep = 30) {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    const initialCount = this.logs.length;
    
    this.logs = this.logs.filter(log => new Date(log.timestamp) >= cutoffDate);
    this.saveLogs();
    
    const clearedCount = initialCount - this.logs.length;
    if (clearedCount > 0) {
      this.logSystemEvent('OLD_LOGS_CLEARED', { 
        clearedCount, 
        daysToKeep, 
        cutoffDate: cutoffDate.toISOString() 
      });
    }
    
    return clearedCount;
  }
}

const logger = new Logger();

logger.logSystemEvent('APP_STARTED', {
  timestamp: new Date().toISOString(),
  userAgent: navigator.userAgent,
  screen: {
    width: screen.width,
    height: screen.height
  },
  viewport: {
    width: window.innerWidth,
    height: window.innerHeight
  }
});

logger.clearOldLogs(30);

export default logger;


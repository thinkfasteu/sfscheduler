// Monitoring Dashboard UI Component for System Health and Metrics

export class MonitoringDashboard {
    constructor() {
        this.refreshInterval = null;
        this.autoRefresh = true;
        this.refreshRate = 30000; // 30 seconds
    }

    renderDashboard() {
        const host = document.getElementById('monitoringDashboard');
        if (!host) {
            console.warn('Monitoring dashboard container not found');
            return;
        }

        const report = window.__services?.monitoring?.generateReport();
        if (!report) {
            host.innerHTML = '<div class="monitoring-error">Monitoring service not available</div>';
            return;
        }

        const statusClass = this.getStatusClass(report.status);
        const lastRunTime = report.lastRun.timestamp ? 
            new Date(report.lastRun.timestamp).toLocaleString('de-DE') : 'Nie';

        host.innerHTML = `
            <div class="monitoring-dashboard">
                <div class="monitoring-header">
                    <h3>System-Monitoring</h3>
                    <div class="monitoring-controls">
                        <button id="refreshMonitoring" class="btn btn-sm">Aktualisieren</button>
                        <button id="exportMonitoring" class="btn btn-sm btn-secondary">Export</button>
                        <label class="auto-refresh-toggle">
                            <input type="checkbox" id="autoRefreshToggle" ${this.autoRefresh ? 'checked' : ''}>
                            Auto-Refresh
                        </label>
                    </div>
                </div>

                <div class="monitoring-grid">
                    <!-- System Health Status -->
                    <div class="monitoring-card status-card">
                        <div class="card-header">
                            <h4>System Status</h4>
                            <div class="status-indicator ${statusClass}">
                                <span class="status-dot"></span>
                                ${report.status.toUpperCase()}
                            </div>
                        </div>
                        <div class="card-content">
                            <div class="metric">
                                <span class="metric-label">Erfolgsrate:</span>
                                <span class="metric-value">${report.successRate}</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Letzter Lauf:</span>
                                <span class="metric-value">${lastRunTime}</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Status:</span>
                                <span class="metric-value ${report.lastRun.status === 'success' ? 'success' : 'error'}">
                                    ${report.lastRun.status || 'unbekannt'}
                                </span>
                            </div>
                            ${report.warnings.length > 0 ? `
                                <div class="warnings">
                                    <strong>Warnungen:</strong>
                                    <ul>
                                        ${report.warnings.map(w => `<li>${w}</li>`).join('')}
                                    </ul>
                                </div>
                            ` : ''}
                            ${report.errors.length > 0 ? `
                                <div class="errors">
                                    <strong>Fehler:</strong>
                                    <ul>
                                        ${report.errors.map(e => `<li>${e}</li>`).join('')}
                                    </ul>
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    <!-- Performance Metrics -->
                    <div class="monitoring-card performance-card">
                        <div class="card-header">
                            <h4>Leistung</h4>
                        </div>
                        <div class="card-content">
                            <div class="metric">
                                <span class="metric-label">Ø Generierungszeit:</span>
                                <span class="metric-value">${Math.round(report.performance.averageGenerationTime)}ms</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Letzte Dauer:</span>
                                <span class="metric-value">${report.lastRun.duration ? Math.round(report.lastRun.duration) + 'ms' : '—'}</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Offene Schichten:</span>
                                <span class="metric-value">${report.metrics.scheduleGeneration.unfilledShiftsCount}</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Regelkonflikte:</span>
                                <span class="metric-value">${report.metrics.scheduleGeneration.constraintViolations}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Business Metrics -->
                    <div class="monitoring-card business-card">
                        <div class="card-header">
                            <h4>Geschäftsmetriken</h4>
                        </div>
                        <div class="card-content">
                            <div class="metric">
                                <span class="metric-label">Zuweisungsoperationen:</span>
                                <span class="metric-value">${report.businessMetrics.assignmentOperations}</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Manuelle Übersteuerungen:</span>
                                <span class="metric-value">${report.businessMetrics.overrideRate}</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Regelübersteuerungen:</span>
                                <span class="metric-value">${report.businessMetrics.violationOverrides}</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Minijob-Warnungen ignoriert:</span>
                                <span class="metric-value">${report.businessMetrics.minijobWarningsIgnored}</span>
                            </div>
                        </div>
                    </div>

                    <!-- System Health -->
                    <div class="monitoring-card system-card">
                        <div class="card-header">
                            <h4>System</h4>
                        </div>
                        <div class="card-content">
                            <div class="metric">
                                <span class="metric-label">Datenoperationen:</span>
                                <span class="metric-value">${report.systemHealth.dataOperations}</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Audit-Einträge:</span>
                                <span class="metric-value">${report.systemHealth.auditEntries}</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Fehleranzahl:</span>
                                <span class="metric-value ${report.systemHealth.errorCount > 10 ? 'error' : ''}">${report.systemHealth.errorCount}</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Warnungsanzahl:</span>
                                <span class="metric-value">${report.systemHealth.warningCount}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="monitoring-footer">
                    <div class="last-updated">
                        Zuletzt aktualisiert: ${new Date().toLocaleString('de-DE')}
                    </div>
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    getStatusClass(status) {
        switch (status) {
            case 'healthy': return 'status-healthy';
            case 'degraded': return 'status-degraded';
            case 'critical': return 'status-critical';
            default: return 'status-unknown';
        }
    }

    attachEventListeners() {
        // Refresh button
        const refreshBtn = document.getElementById('refreshMonitoring');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.renderDashboard());
        }

        // Export button
        const exportBtn = document.getElementById('exportMonitoring');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportReport());
        }

        // Auto-refresh toggle
        const autoRefreshToggle = document.getElementById('autoRefreshToggle');
        if (autoRefreshToggle) {
            autoRefreshToggle.addEventListener('change', (e) => {
                this.autoRefresh = e.target.checked;
                if (this.autoRefresh) {
                    this.startAutoRefresh();
                } else {
                    this.stopAutoRefresh();
                }
            });
        }
    }

    startAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        this.refreshInterval = setInterval(() => {
            this.renderDashboard();
        }, this.refreshRate);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    exportReport() {
        const report = window.__services?.monitoring?.generateReport();
        if (!report) {
            alert('Monitoring service not available');
            return;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `monitoring-report-${timestamp}.json`;
        
        const dataStr = JSON.stringify(report, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = filename;
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    }

    init() {
        // Initialize the dashboard
        this.renderDashboard();
        
        // Start auto-refresh if enabled
        if (this.autoRefresh) {
            this.startAutoRefresh();
        }
    }

    destroy() {
        this.stopAutoRefresh();
    }
}
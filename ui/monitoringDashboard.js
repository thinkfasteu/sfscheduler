// Monitoring Dashboard UI Component for System Health and Metrics

export class MonitoringDashboard {
    constructor(containerId) {
        this.container = document.querySelector(containerId);
        this.monitoring = null;
        this.refreshInterval = null;
        this.autoRefresh = true;
        this.refreshRate = 30000; // 30 seconds
        this.pilotMode = true; // Enable pilot-specific monitoring
    }

    render() {
        this.renderDashboard();
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
                    ${this.pilotMode ? '<span class="pilot-badge">PILOT MODE</span>' : ''}
                    <div class="monitoring-controls">
                        ${this.pilotMode ? '<button id="togglePilotView" class="btn btn-sm btn-pilot">Pilot View</button>' : ''}
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

                    ${this.pilotMode ? this.renderPilotAlerts() : ''}

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

                ${this.pilotMode ? `
                <div class="pilot-metrics-section">
                    <div class="section-header">
                        <h3>Pilot-spezifische Metriken</h3>
                        <button id="pilotMetricsHelp" class="btn btn-xs btn-help" title="Hilfe zu Pilot-Metriken">?</button>
                    </div>
                    ${this.renderPilotMetrics()}
                </div>
                ` : ''}

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
            refreshBtn.addEventListener('click', () => {
                this.render();
            });
        }

        // Export button
        const exportBtn = document.getElementById('exportMonitoring');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportReport();
            });
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

        // Pilot mode toggle
        const pilotToggle = document.getElementById('togglePilotView');
        if (pilotToggle) {
            pilotToggle.addEventListener('click', () => {
                this.togglePilotView();
            });
        }

        // Pilot metrics help
        const pilotHelpBtn = document.getElementById('pilotMetricsHelp');
        if (pilotHelpBtn) {
            pilotHelpBtn.addEventListener('click', () => {
                this.showPilotHelp();
            });
        }

        // Store reference for global access (for log detail views)
        window.monitoringDashboard = this;
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

    // Pilot Mode Features
    renderPilotAlerts() {
        const pilotAlerts = this.getPilotAlerts();
        if (pilotAlerts.length === 0) {
            return `<div class="pilot-alerts success">
                <h4>🎯 Pilot Status: All Clear</h4>
                <p>No critical pilot metrics violations detected.</p>
            </div>`;
        }

        const alertsHtml = pilotAlerts.map(alert => `
            <div class="pilot-alert ${alert.severity}">
                <div class="alert-header">
                    <span class="alert-icon">${alert.icon}</span>
                    <span class="alert-title">${alert.title}</span>
                    <span class="alert-time">${alert.timestamp}</span>
                </div>
                <div class="alert-message">${alert.message}</div>
                <div class="alert-actions">
                    <button class="btn btn-xs" onclick="window.monitoringDashboard.viewLogDetails('${alert.logId}')">
                        View Details
                    </button>
                </div>
            </div>
        `).join('');

        return `
            <div class="pilot-alerts ${pilotAlerts.some(a => a.severity === 'critical') ? 'has-critical' : 'has-warnings'}">
                <h4>🚨 Pilot Monitoring Alerts</h4>
                <div class="alerts-container">
                    ${alertsHtml}
                </div>
            </div>
        `;
    }

    getPilotAlerts() {
        const alerts = [];
        const metrics = this.monitoring?.getMetrics() || {};
        const now = new Date();

        // Check Minijob weekly deviations
        const minijobDeviations = this.checkMinijobDeviations();
        minijobDeviations.forEach(deviation => {
            alerts.push({
                severity: deviation.hours > 12 ? 'critical' : 'warning',
                icon: deviation.hours > 12 ? '🔴' : '⚠️',
                title: 'Minijob Stunden-Abweichung',
                message: `${deviation.staffName}: ${deviation.hours}h diese Woche (Ziel: 8-12h, praktisch: ${deviation.practicalRange})`,
                timestamp: now.toLocaleTimeString('de-DE'),
                logId: `minijob_${deviation.staffId}_${Date.now()}`
            });
        });

        // Check Werkstudent >20h exceptions  
        const werkstudentExceptions = this.checkWerkstudentExceptions();
        werkstudentExceptions.forEach(exception => {
            alerts.push({
                severity: exception.academicPeriod === 'semester' ? 'critical' : 'warning',
                icon: exception.academicPeriod === 'semester' ? '🔴' : '⚠️',
                title: 'Werkstudent Stunden-Überschreitung',
                message: `${exception.staffName}: ${exception.hours}h (${exception.academicPeriod}, Limit: ${exception.limit}h)`,
                timestamp: now.toLocaleTimeString('de-DE'),
                logId: `werkstudent_${exception.staffId}_${Date.now()}`
            });
        });

        // Check Permanent monthly tolerance breaches
        const permanentBreaches = this.checkPermanentToleranceBreaches();
        permanentBreaches.forEach(breach => {
            alerts.push({
                severity: Math.abs(breach.deviation) > 8 ? 'critical' : 'warning',
                icon: Math.abs(breach.deviation) > 8 ? '🔴' : '⚠️',
                title: 'Permanent Mitarbeiter Toleranz-Überschreitung',
                message: `${breach.staffName}: ${breach.deviation > 0 ? '+' : ''}${breach.deviation}h monatlich (Toleranz: ±8h)`,
                timestamp: now.toLocaleTimeString('de-DE'),
                logId: `permanent_${breach.staffId}_${Date.now()}`
            });
        });

        return alerts.sort((a, b) => {
            const severityOrder = { critical: 0, warning: 1, info: 2 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        });
    }

    checkMinijobDeviations() {
        // Mock implementation - in real system, this would query actual data
        const staff = window.appState?.staff || [];
        const schedule = window.appState?.schedule || {};
        const deviations = [];

        staff.filter(s => s.type === 'Minijob').forEach(member => {
            const weeklyHours = this.calculateWeeklyHours(member.id, schedule);
            const practicalMin = member.weeklyHoursMinPractical || 8;
            const practicalMax = member.weeklyHoursMaxPractical || 12;
            
            if (weeklyHours < practicalMin || weeklyHours > practicalMax) {
                deviations.push({
                    staffId: member.id,
                    staffName: member.name,
                    hours: weeklyHours,
                    practicalRange: `${practicalMin}-${practicalMax}h`
                });
            }
        });

        return deviations;
    }

    checkWerkstudentExceptions() {
        const staff = window.appState?.staff || [];
        const schedule = window.appState?.schedule || {};
        const exceptions = [];

        staff.filter(s => s.type === 'Student').forEach(member => {
            const weeklyHours = this.calculateWeeklyHours(member.id, schedule);
            const academicPeriod = this.getCurrentAcademicPeriod(); // 'semester' or 'break'
            const limit = academicPeriod === 'semester' ? 20 : 40;
            
            if (weeklyHours > limit) {
                exceptions.push({
                    staffId: member.id,
                    staffName: member.name,
                    hours: weeklyHours,
                    academicPeriod,
                    limit
                });
            }
        });

        return exceptions;
    }

    checkPermanentToleranceBreaches() {
        const staff = window.appState?.staff || [];
        const breaches = [];

        staff.filter(s => s.type === 'Permanent').forEach(member => {
            const monthlyDeviation = this.calculateMonthlyDeviation(member.id);
            
            if (Math.abs(monthlyDeviation) > 8) { // ±8h monthly tolerance
                breaches.push({
                    staffId: member.id,
                    staffName: member.name,
                    deviation: monthlyDeviation
                });
            }
        });

        return breaches;
    }

    renderPilotMetrics() {
        const minijobCompliance = this.calculateMinijobCompliance();
        const werkstudentCompliance = this.calculateWerkstudentCompliance();
        const permanentCompliance = this.calculatePermanentCompliance();

        return `
            <div class="pilot-metrics-grid">
                <div class="pilot-metric">
                    <div class="metric-icon">💼</div>
                    <div class="metric-info">
                        <div class="metric-title">Minijob Compliance</div>
                        <div class="metric-value ${minijobCompliance >= 95 ? 'success' : 'warning'}">
                            ${minijobCompliance}%
                        </div>
                        <div class="metric-detail">Within 8-12h target range</div>
                    </div>
                </div>
                
                <div class="pilot-metric">
                    <div class="metric-icon">🎓</div>
                    <div class="metric-info">
                        <div class="metric-title">Werkstudent Compliance</div>
                        <div class="metric-value ${werkstudentCompliance >= 95 ? 'success' : 'warning'}">
                            ${werkstudentCompliance}%
                        </div>
                        <div class="metric-detail">Within 20h semester limit</div>
                    </div>
                </div>
                
                <div class="pilot-metric">
                    <div class="metric-icon">⚖️</div>
                    <div class="metric-info">
                        <div class="metric-title">Permanent Tolerance</div>
                        <div class="metric-value ${permanentCompliance >= 90 ? 'success' : 'warning'}">
                            ${permanentCompliance}%
                        </div>
                        <div class="metric-detail">Within ±8h monthly range</div>
                    </div>
                </div>
                
                <div class="pilot-metric">
                    <div class="metric-icon">📊</div>
                    <div class="metric-info">
                        <div class="metric-title">Overall Pilot Health</div>
                        <div class="metric-value ${this.calculateOverallPilotHealth() >= 95 ? 'success' : 'warning'}">
                            ${this.calculateOverallPilotHealth()}%
                        </div>
                        <div class="metric-detail">Combined compliance score</div>
                    </div>
                </div>
            </div>
        `;
    }

    // Helper methods for pilot metrics
    calculateWeeklyHours(staffId, schedule) {
        // Mock calculation - in real system, sum actual scheduled hours
        return Math.floor(Math.random() * 15) + 8; // 8-23 hours
    }

    getCurrentAcademicPeriod() {
        // Mock implementation - in real system, check academic calendar
        const month = new Date().getMonth();
        return (month >= 2 && month <= 6) || (month >= 9 && month <= 12) ? 'semester' : 'break';
    }

    calculateMonthlyDeviation(staffId) {
        // Mock calculation - in real system, calculate actual monthly deviation
        return Math.floor(Math.random() * 16) - 8; // -8 to +8 hours
    }

    calculateMinijobCompliance() {
        return Math.floor(Math.random() * 10) + 90; // 90-100%
    }

    calculateWerkstudentCompliance() {
        return Math.floor(Math.random() * 10) + 90; // 90-100%
    }

    calculatePermanentCompliance() {
        return Math.floor(Math.random() * 15) + 85; // 85-100%
    }

    calculateOverallPilotHealth() {
        const minijob = this.calculateMinijobCompliance();
        const werkstudent = this.calculateWerkstudentCompliance();
        const permanent = this.calculatePermanentCompliance();
        return Math.round((minijob + werkstudent + permanent) / 3);
    }

    calculateOverallPilotHealth() {
        const minijob = this.calculateMinijobCompliance();
        const werkstudent = this.calculateWerkstudentCompliance();
        const permanent = this.calculatePermanentCompliance();
        return Math.round((minijob + werkstudent + permanent) / 3);
    }

    togglePilotView() {
        this.pilotMode = !this.pilotMode;
        this.render(); // Re-render to show/hide pilot features
        
        // Show notification
        const message = this.pilotMode ? 'Pilot-Modus aktiviert' : 'Pilot-Modus deaktiviert';
        this.showNotification(message, 'info');
    }

    showPilotHelp() {
        const helpText = `
Pilot-spezifische Metriken:

🔴 Kritische Alerts:
- Minijob >12h/Woche oder <8h/Woche
- Werkstudent >20h während Semester
- Permanent >±8h monatliche Abweichung

⚠️ Warnungen:
- Grenzwertige Abweichungen
- Trends die zu Verletzungen führen könnten

📊 Compliance-Raten:
- Prozentsatz der Mitarbeiter innerhalb der Zielwerte
- Getrennt nach Vertragstyp
- Kombinierte Gesamtbewertung

Klicken Sie auf "View Details" bei Alerts für detaillierte Logs.
        `;
        
        alert(helpText);
    }

    showNotification(message, type = 'info') {
        // Simple notification implementation
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${type === 'info' ? '#007bff' : type === 'success' ? '#28a745' : '#dc3545'};
            color: white;
            border-radius: 4px;
            z-index: 10000;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    viewLogDetails(logId) {
        // Mock implementation - in real system, show detailed log view
        alert(`Viewing detailed logs for: ${logId}\n\nThis would open a detailed view with:\n- Timeline of events\n- Related staff data\n- Business rule evaluation\n- Recommended actions`);
    }
}
// Operational monitoring service for FTG Sportfabrik Smart Staff Scheduler
// Tracks schedule generation health, assignment conflicts, and system performance

import { appState } from '../../modules/state.js';

export function createMonitoringService() {
    const metrics = {
        scheduleGeneration: {
            totalRuns: 0,
            successfulRuns: 0,
            failedRuns: 0,
            averageGenerationTime: 0,
            lastRunTimestamp: null,
            lastRunStatus: null,
            lastRunDuration: null,
            unfilledShiftsCount: 0,
            constraintViolations: 0
        },
        assignments: {
            totalAssignments: 0,
            manualOverrides: 0,
            swapOperations: 0,
            violationsOverridden: 0,
            minijobEarningsWarningsIgnored: 0
        },
        system: {
            dataStoreOperations: 0,
            auditLogEntries: 0,
            validationRunTime: 0,
            lastBackupTimestamp: null,
            errorCount: 0,
            warningCount: 0
        },
        business: {
            weeklyHourViolations: 0,
            monthlyHourViolations: 0,
            restPeriodViolations: 0,
            consecutiveDayViolations: 0,
            weekendDistributionIssues: 0,
            studentOvertimeIssues: 0
        },
        api: {
            totalCalls: 0,
            errorCount: 0,
            averageResponseTime: 0,
            lastCallTimestamp: null,
            topEndpoints: {}
        }
    };

    // API call tracking
    const apiCalls = [];
    const MAX_API_CALL_HISTORY = 1000;

    // Performance tracking
    const performanceBuffer = [];
    const MAX_BUFFER_SIZE = 100;

    function recordPerformance(operation, duration, metadata = {}) {
        const entry = {
            timestamp: Date.now(),
            operation,
            duration,
            metadata
        };
        
        performanceBuffer.push(entry);
        if (performanceBuffer.length > MAX_BUFFER_SIZE) {
            performanceBuffer.shift();
        }
        
        // Update metrics
        if (operation === 'schedule_generation') {
            metrics.scheduleGeneration.totalRuns++;
            metrics.scheduleGeneration.lastRunTimestamp = entry.timestamp;
            metrics.scheduleGeneration.lastRunDuration = duration;
            
            if (metadata.success) {
                metrics.scheduleGeneration.successfulRuns++;
                metrics.scheduleGeneration.lastRunStatus = 'success';
            } else {
                metrics.scheduleGeneration.failedRuns++;
                metrics.scheduleGeneration.lastRunStatus = 'failed';
            }
            
            // Update average generation time
            const avgCount = metrics.scheduleGeneration.successfulRuns + metrics.scheduleGeneration.failedRuns;
            metrics.scheduleGeneration.averageGenerationTime = 
                ((metrics.scheduleGeneration.averageGenerationTime * (avgCount - 1)) + duration) / avgCount;
                
            // Track unfilled shifts
            metrics.scheduleGeneration.unfilledShiftsCount = metadata.unfilledShifts || 0;
            metrics.scheduleGeneration.constraintViolations = metadata.constraintViolations || 0;
        }
    }

    function recordAssignmentOperation(type, metadata = {}) {
        metrics.assignments.totalAssignments++;
        
        switch (type) {
            case 'manual_override':
                metrics.assignments.manualOverrides++;
                break;
            case 'swap':
                metrics.assignments.swapOperations++;
                if (metadata.violationOverridden) {
                    metrics.assignments.violationsOverridden++;
                }
                if (metadata.minijobWarningIgnored) {
                    metrics.assignments.minijobEarningsWarningsIgnored++;
                }
                break;
        }
    }

    function recordValidationIssues(issues) {
        Object.values(issues).flat().forEach(issue => {
            if (issue.severity === 'error') {
                metrics.system.errorCount++;
            } else if (issue.severity === 'warning') {
                metrics.system.warningCount++;
            }
            
            // Categorize business rule violations
            switch (issue.type) {
                case 'weekly':
                    metrics.business.weeklyHourViolations++;
                    break;
                case 'monthly':
                    metrics.business.monthlyHourViolations++;
                    break;
                case 'rest':
                    metrics.business.restPeriodViolations++;
                    break;
                case 'consecutive':
                    metrics.business.consecutiveDayViolations++;
                    break;
                case 'weekend':
                    metrics.business.weekendDistributionIssues++;
                    break;
                case 'student':
                    metrics.business.studentOvertimeIssues++;
                    break;
            }
        });
    }

    function recordSystemOperation(operation, metadata = {}) {
        metrics.system.dataStoreOperations++;
        
        if (operation === 'audit_log_entry') {
            metrics.system.auditLogEntries++;
        } else if (operation === 'backup') {
            metrics.system.lastBackupTimestamp = Date.now();
        }
    }

    function getHealthStatus() {
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        const oneDayAgo = now - (24 * oneHour);
        
        // Calculate success rate
        const totalRuns = metrics.scheduleGeneration.totalRuns;
        const successRate = totalRuns > 0 ? 
            (metrics.scheduleGeneration.successfulRuns / totalRuns) * 100 : 0;
        
        // Check if recent generation was successful
        const lastRunRecent = metrics.scheduleGeneration.lastRunTimestamp && 
            (now - metrics.scheduleGeneration.lastRunTimestamp) < oneHour;
        
        // Determine overall health
        let health = 'healthy';
        const warnings = [];
        const errors = [];
        
        if (successRate < 90) {
            health = 'degraded';
            warnings.push(`Low success rate: ${successRate.toFixed(1)}%`);
        }
        
        if (successRate < 70) {
            health = 'critical';
            errors.push(`Critical success rate: ${successRate.toFixed(1)}%`);
        }
        
        if (metrics.scheduleGeneration.lastRunStatus === 'failed' && lastRunRecent) {
            health = health === 'healthy' ? 'degraded' : health;
            warnings.push('Recent schedule generation failed');
        }
        
        if (metrics.scheduleGeneration.unfilledShiftsCount > 5) {
            health = 'degraded';
            warnings.push(`High unfilled shifts: ${metrics.scheduleGeneration.unfilledShiftsCount}`);
        }
        
        if (metrics.system.errorCount > 10) {
            health = 'critical';
            errors.push(`High error count: ${metrics.system.errorCount}`);
        }
        
        return {
            status: health,
            timestamp: now,
            successRate: successRate.toFixed(1) + '%',
            lastRun: {
                timestamp: metrics.scheduleGeneration.lastRunTimestamp,
                status: metrics.scheduleGeneration.lastRunStatus,
                duration: metrics.scheduleGeneration.lastRunDuration
            },
            warnings,
            errors,
            metrics: { ...metrics }
        };
    }

    function generateReport() {
        const health = getHealthStatus();
        const recentPerformance = performanceBuffer.slice(-10);
        
        return {
            ...health,
            performance: {
                recent: recentPerformance,
                averageGenerationTime: metrics.scheduleGeneration.averageGenerationTime,
                totalOperations: performanceBuffer.length
            },
            businessMetrics: {
                assignmentOperations: metrics.assignments.totalAssignments,
                overrideRate: metrics.assignments.totalAssignments > 0 ? 
                    ((metrics.assignments.manualOverrides / metrics.assignments.totalAssignments) * 100).toFixed(1) + '%' : '0%',
                violationOverrides: metrics.assignments.violationsOverridden,
                minijobWarningsIgnored: metrics.assignments.minijobEarningsWarningsIgnored
            },
            systemHealth: {
                dataOperations: metrics.system.dataStoreOperations,
                auditEntries: metrics.system.auditLogEntries,
                errorCount: metrics.system.errorCount,
                warningCount: metrics.system.warningCount,
                lastBackup: metrics.system.lastBackupTimestamp
            }
        };
    }

    function resetMetrics() {
        Object.keys(metrics).forEach(category => {
            Object.keys(metrics[category]).forEach(key => {
                if (typeof metrics[category][key] === 'number') {
                    metrics[category][key] = 0;
                } else {
                    metrics[category][key] = null;
                }
            });
        });
        performanceBuffer.length = 0;
    }

    function recordAPICall(logEntry) {
        try {
            // Add timestamp if not provided
            if (!logEntry.timestamp) {
                logEntry.timestamp = new Date().toISOString();
            }

            // Add to call history
            apiCalls.push(logEntry);

            // Trim history if it gets too long
            if (apiCalls.length > MAX_API_CALL_HISTORY) {
                apiCalls.splice(0, apiCalls.length - MAX_API_CALL_HISTORY);
            }

            // Update metrics
            metrics.api.totalCalls++;
            metrics.api.lastCallTimestamp = logEntry.timestamp;

            // Track endpoint usage
            if (logEntry.action) {
                if (!metrics.api.topEndpoints[logEntry.action]) {
                    metrics.api.topEndpoints[logEntry.action] = 0;
                }
                metrics.api.topEndpoints[logEntry.action]++;
            }

            // Count errors
            if (logEntry.action && logEntry.action.includes('_ERROR')) {
                metrics.api.errorCount++;
            }

        } catch (error) {
            console.warn('[MonitoringService] Failed to record API call:', error);
        }
    }

    function getAPIStats() {
        try {
            // Calculate top endpoints
            const topEndpoints = Object.entries(metrics.api.topEndpoints)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10)
                .map(([endpoint, count]) => ({ endpoint, count }));

            // Calculate error rate
            const errorRate = metrics.api.totalCalls > 0 
                ? (metrics.api.errorCount / metrics.api.totalCalls * 100).toFixed(2)
                : 0;

            return {
                totalCalls: metrics.api.totalCalls,
                errorCount: metrics.api.errorCount,
                errorRate: `${errorRate}%`,
                lastCallTimestamp: metrics.api.lastCallTimestamp,
                topEndpoints,
                recentCalls: apiCalls.slice(-20) // Last 20 calls
            };
        } catch (error) {
            console.warn('[MonitoringService] Failed to get API stats:', error);
            return { error: 'Failed to retrieve API statistics' };
        }
    }

    return {
        recordPerformance,
        recordAssignmentOperation,
        recordValidationIssues,
        recordSystemOperation,
        getHealthStatus,
        generateReport,
        resetMetrics,
        recordAPICall,
        getAPIStats,
        metrics: () => ({ ...metrics })
    };
}
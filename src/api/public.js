/**
 * Public API namespace for external integrations
 * 
 * Provides a clean, stable interface for external systems to interact with
 * the FTG Sportfabrik Smart Staff Scheduler while maintaining internal
 * architectural flexibility and security.
 * 
 * Security considerations:
 * - All methods validate input parameters
 * - Rate limiting should be implemented at infrastructure level
 * - Sensitive operations require authentication tokens
 * - Audit logging for all public API calls
 */

import { appState } from '@state';
import { APP_CONFIG } from '../../modules/config.js';

class PublicAPI {
    constructor() {
        this.version = '1.0.0';
        this.initialized = false;
        this.apiPrefix = 'FTG_SCHEDULER_API';
    }

    /**
     * Initialize the public API namespace
     * Called once during application bootstrap
     */
    init() {
        if (this.initialized) return;
        
        try {
            // Expose the public namespace
            window.FTG_SCHEDULER_API = {
                version: this.version,
                staff: this.createStaffAPI(),
                schedule: this.createScheduleAPI(),
                availability: this.createAvailabilityAPI(),
                vacation: this.createVacationAPI(),
                reports: this.createReportsAPI(),
                monitoring: this.createMonitoringAPI(),
                health: this.createHealthAPI()
            };
            
            this.initialized = true;
            console.info(`[PublicAPI] Initialized v${this.version}`);
            
            // Log initialization for audit trail
            this.logAPICall('INIT', { version: this.version, timestamp: new Date().toISOString() });
            
        } catch (error) {
            console.error('[PublicAPI] Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Staff management API endpoints
     */
    createStaffAPI() {
        return {
            /**
             * Get all staff members
             * @returns {Array} Staff list with sanitized data
             */
            getAll: () => {
                this.logAPICall('STAFF_GET_ALL');
                try {
                    const staff = appState.staff || [];
                    return staff.map(this.sanitizeStaffData);
                } catch (error) {
                    this.logAPICall('STAFF_GET_ALL_ERROR', { error: error.message });
                    throw new Error('Failed to retrieve staff data');
                }
            },

            /**
             * Get staff member by ID
             * @param {string} staffId - Staff member ID
             * @returns {Object|null} Staff member data or null if not found
             */
            getById: (staffId) => {
                this.validateRequired('staffId', staffId);
                this.logAPICall('STAFF_GET_BY_ID', { staffId });
                
                try {
                    const staff = (appState.staff || []).find(s => s.id === staffId);
                    return staff ? this.sanitizeStaffData(staff) : null;
                } catch (error) {
                    this.logAPICall('STAFF_GET_BY_ID_ERROR', { staffId, error: error.message });
                    throw new Error('Failed to retrieve staff member');
                }
            },

            /**
             * Get staff availability summary
             * @param {string} staffId - Staff member ID
             * @returns {Object} Availability summary
             */
            getAvailabilitySummary: (staffId) => {
                this.validateRequired('staffId', staffId);
                this.logAPICall('STAFF_GET_AVAILABILITY', { staffId });
                
                try {
                    const availability = appState.availability?.[staffId] || {};
                    return {
                        staffId,
                        totalSlots: Object.keys(availability).length,
                        availableDays: Object.values(availability).filter(day => 
                            Object.values(day || {}).some(slot => slot)
                        ).length
                    };
                } catch (error) {
                    this.logAPICall('STAFF_GET_AVAILABILITY_ERROR', { staffId, error: error.message });
                    throw new Error('Failed to retrieve staff availability');
                }
            }
        };
    }

    /**
     * Schedule management API endpoints
     */
    createScheduleAPI() {
        return {
            /**
             * Get current schedule
             * @returns {Object} Current schedule data
             */
            getCurrent: () => {
                this.logAPICall('SCHEDULE_GET_CURRENT');
                try {
                    return {
                        schedule: appState.schedule || {},
                        lastGenerated: appState.lastScheduleGeneration || null,
                        weekStart: appState.currentWeekStart || null
                    };
                } catch (error) {
                    this.logAPICall('SCHEDULE_GET_CURRENT_ERROR', { error: error.message });
                    throw new Error('Failed to retrieve current schedule');
                }
            },

            /**
             * Get schedule statistics
             * @returns {Object} Schedule statistics
             */
            getStats: () => {
                this.logAPICall('SCHEDULE_GET_STATS');
                try {
                    const schedule = appState.schedule || {};
                    const totalShifts = Object.keys(schedule).length;
                    const assignedShifts = Object.values(schedule).filter(shift => shift.staffId).length;
                    
                    return {
                        totalShifts,
                        assignedShifts,
                        unassignedShifts: totalShifts - assignedShifts,
                        coveragePercent: totalShifts > 0 ? Math.round((assignedShifts / totalShifts) * 100) : 0
                    };
                } catch (error) {
                    this.logAPICall('SCHEDULE_GET_STATS_ERROR', { error: error.message });
                    throw new Error('Failed to retrieve schedule statistics');
                }
            },

            /**
             * Get shifts for specific staff member
             * @param {string} staffId - Staff member ID
             * @returns {Array} Array of shifts assigned to staff member
             */
            getShiftsForStaff: (staffId) => {
                this.validateRequired('staffId', staffId);
                this.logAPICall('SCHEDULE_GET_SHIFTS_FOR_STAFF', { staffId });
                
                try {
                    const schedule = appState.schedule || {};
                    const shifts = Object.entries(schedule)
                        .filter(([_, shift]) => shift.staffId === staffId)
                        .map(([shiftKey, shift]) => ({
                            shiftKey,
                            ...shift,
                            staffId: undefined // Remove for security
                        }));
                    
                    return shifts;
                } catch (error) {
                    this.logAPICall('SCHEDULE_GET_SHIFTS_FOR_STAFF_ERROR', { staffId, error: error.message });
                    throw new Error('Failed to retrieve staff shifts');
                }
            }
        };
    }

    /**
     * Availability management API endpoints
     */
    createAvailabilityAPI() {
        return {
            /**
             * Get availability for specific day
             * @param {string} dayKey - Day key (e.g., 'monday')
             * @returns {Object} Availability data for the day
             */
            getByDay: (dayKey) => {
                this.validateRequired('dayKey', dayKey);
                this.logAPICall('AVAILABILITY_GET_BY_DAY', { dayKey });
                
                try {
                    const availability = appState.availability || {};
                    const dayAvailability = {};
                    
                    Object.keys(availability).forEach(staffId => {
                        const staffDay = availability[staffId]?.[dayKey];
                        if (staffDay) {
                            dayAvailability[staffId] = staffDay;
                        }
                    });
                    
                    return dayAvailability;
                } catch (error) {
                    this.logAPICall('AVAILABILITY_GET_BY_DAY_ERROR', { dayKey, error: error.message });
                    throw new Error('Failed to retrieve day availability');
                }
            },

            /**
             * Get availability summary for all staff
             * @returns {Object} Availability summary by staff member
             */
            getSummary: () => {
                this.logAPICall('AVAILABILITY_GET_SUMMARY');
                try {
                    const availability = appState.availability || {};
                    const summary = {};
                    
                    Object.keys(availability).forEach(staffId => {
                        const staffAvailability = availability[staffId] || {};
                        const totalSlots = Object.keys(staffAvailability).reduce((sum, day) => {
                            return sum + Object.values(staffAvailability[day] || {}).filter(slot => slot).length;
                        }, 0);
                        
                        summary[staffId] = { totalSlots };
                    });
                    
                    return summary;
                } catch (error) {
                    this.logAPICall('AVAILABILITY_GET_SUMMARY_ERROR', { error: error.message });
                    throw new Error('Failed to retrieve availability summary');
                }
            }
        };
    }

    /**
     * Vacation management API endpoints
     */
    createVacationAPI() {
        return {
            /**
             * Get vacation requests for date range
             * @param {string} startDate - Start date (YYYY-MM-DD)
             * @param {string} endDate - End date (YYYY-MM-DD)
             * @returns {Array} Vacation requests in date range
             */
            getByDateRange: (startDate, endDate) => {
                this.validateRequired('startDate', startDate);
                this.validateRequired('endDate', endDate);
                this.logAPICall('VACATION_GET_BY_DATE_RANGE', { startDate, endDate });
                
                try {
                    const vacations = appState.vacationRequests || [];
                    const start = new Date(startDate);
                    const end = new Date(endDate);
                    
                    return vacations.filter(vacation => {
                        const vacDate = new Date(vacation.date);
                        return vacDate >= start && vacDate <= end;
                    }).map(this.sanitizeVacationData);
                } catch (error) {
                    this.logAPICall('VACATION_GET_BY_DATE_RANGE_ERROR', { startDate, endDate, error: error.message });
                    throw new Error('Failed to retrieve vacation requests');
                }
            },

            /**
             * Get vacation balance for staff member
             * @param {string} staffId - Staff member ID
             * @returns {Object} Vacation balance information
             */
            getBalance: (staffId) => {
                this.validateRequired('staffId', staffId);
                this.logAPICall('VACATION_GET_BALANCE', { staffId });
                
                try {
                    // This would integrate with the vacation service
                    // For now, return basic structure
                    return {
                        staffId,
                        currentBalance: 0,
                        usedDays: 0,
                        plannedDays: 0,
                        note: 'Vacation balance calculation not yet implemented'
                    };
                } catch (error) {
                    this.logAPICall('VACATION_GET_BALANCE_ERROR', { staffId, error: error.message });
                    throw new Error('Failed to retrieve vacation balance');
                }
            }
        };
    }

    /**
     * Reports API endpoints
     */
    createReportsAPI() {
        return {
            /**
             * Get overtime summary
             * @returns {Object} Overtime summary by staff member
             */
            getOvertimeSummary: () => {
                this.logAPICall('REPORTS_GET_OVERTIME_SUMMARY');
                try {
                    // This would integrate with the overtime service
                    const overtimeRequests = appState.overtimeRequests || [];
                    const summary = {};
                    
                    overtimeRequests.forEach(request => {
                        if (!summary[request.staffId]) {
                            summary[request.staffId] = { total: 0, requests: 0 };
                        }
                        summary[request.staffId].total += request.hours || 0;
                        summary[request.staffId].requests += 1;
                    });
                    
                    return summary;
                } catch (error) {
                    this.logAPICall('REPORTS_GET_OVERTIME_SUMMARY_ERROR', { error: error.message });
                    throw new Error('Failed to retrieve overtime summary');
                }
            },

            /**
             * Get coverage report
             * @returns {Object} Schedule coverage statistics
             */
            getCoverageReport: () => {
                this.logAPICall('REPORTS_GET_COVERAGE_REPORT');
                try {
                    const schedule = appState.schedule || {};
                    const shifts = Object.values(schedule);
                    const totalShifts = shifts.length;
                    const coveredShifts = shifts.filter(shift => shift.staffId).length;
                    
                    return {
                        totalShifts,
                        coveredShifts,
                        uncoveredShifts: totalShifts - coveredShifts,
                        coveragePercentage: totalShifts > 0 ? Math.round((coveredShifts / totalShifts) * 100) : 0
                    };
                } catch (error) {
                    this.logAPICall('REPORTS_GET_COVERAGE_REPORT_ERROR', { error: error.message });
                    throw new Error('Failed to retrieve coverage report');
                }
            }
        };
    }

    /**
     * Monitoring API endpoints
     */
    createMonitoringAPI() {
        return {
            /**
             * Get current system metrics
             * @returns {Object} Current monitoring metrics
             */
            getMetrics: () => {
                this.logAPICall('MONITORING_GET_METRICS');
                try {
                    const monitoring = window.__services?.monitoring;
                    if (!monitoring) {
                        return { error: 'Monitoring service not available' };
                    }
                    
                    return monitoring.getMetrics();
                } catch (error) {
                    this.logAPICall('MONITORING_GET_METRICS_ERROR', { error: error.message });
                    throw new Error('Failed to retrieve monitoring metrics');
                }
            },

            /**
             * Get system health status
             * @returns {Object} System health information
             */
            getHealth: () => {
                this.logAPICall('MONITORING_GET_HEALTH');
                try {
                    const monitoring = window.__services?.monitoring;
                    if (!monitoring) {
                        return { status: 'unknown', message: 'Monitoring service not available' };
                    }
                    
                    return monitoring.getHealthStatus();
                } catch (error) {
                    this.logAPICall('MONITORING_GET_HEALTH_ERROR', { error: error.message });
                    throw new Error('Failed to retrieve system health');
                }
            }
        };
    }

    /**
     * Health check API endpoints
     */
    createHealthAPI() {
        return {
            /**
             * Basic health check
             * @returns {Object} Basic health status
             */
            check: () => {
                this.logAPICall('HEALTH_CHECK');
                try {
                    return {
                        status: 'healthy',
                        timestamp: new Date().toISOString(),
                        version: this.version,
                        services: {
                            state: !!appState,
                            config: !!APP_CONFIG,
                            monitoring: !!window.__services?.monitoring
                        }
                    };
                } catch (error) {
                    this.logAPICall('HEALTH_CHECK_ERROR', { error: error.message });
                    return {
                        status: 'unhealthy',
                        timestamp: new Date().toISOString(),
                        error: error.message
                    };
                }
            },

            /**
             * Get API usage statistics
             * @returns {Object} API call statistics
             */
            getStats: () => {
                this.logAPICall('HEALTH_GET_STATS');
                try {
                    const monitoring = window.__services?.monitoring;
                    if (monitoring && monitoring.getAPIStats) {
                        return monitoring.getAPIStats();
                    }
                    return { message: 'API statistics not available' };
                } catch (error) {
                    this.logAPICall('HEALTH_GET_STATS_ERROR', { error: error.message });
                    throw new Error('Failed to retrieve API statistics');
                }
            }
        };
    }

    /**
     * Utility methods
     */

    /**
     * Validate required parameter
     * @param {string} name - Parameter name
     * @param {*} value - Parameter value
     */
    validateRequired(name, value) {
        if (value === undefined || value === null || value === '') {
            throw new Error(`Required parameter '${name}' is missing or empty`);
        }
    }

    /**
     * Sanitize staff data for external consumption
     * @param {Object} staff - Raw staff data
     * @returns {Object} Sanitized staff data
     */
    sanitizeStaffData(staff) {
        return {
            id: staff.id,
            name: staff.name,
            type: staff.type,
            contractHours: staff.contractHours,
            typicalWorkdays: staff.typicalWorkdays,
            weekendPreference: staff.weekendPreference,
            practicalLimits: {
                weeklyHoursMin: staff.weeklyHoursMinPractical,
                weeklyHoursMax: staff.weeklyHoursMaxPractical
            }
            // Exclude sensitive fields like internal IDs, notes, etc.
        };
    }

    /**
     * Sanitize vacation data for external consumption
     * @param {Object} vacation - Raw vacation data
     * @returns {Object} Sanitized vacation data
     */
    sanitizeVacationData(vacation) {
        return {
            id: vacation.id,
            staffId: vacation.staffId,
            date: vacation.date,
            type: vacation.type,
            status: vacation.status
            // Exclude internal processing fields
        };
    }

    /**
     * Log API call for audit and monitoring
     * @param {string} action - API action name
     * @param {Object} metadata - Additional metadata
     */
    logAPICall(action, metadata = {}) {
        try {
            const logEntry = {
                timestamp: new Date().toISOString(),
                action,
                source: 'PUBLIC_API',
                ...metadata
            };
            
            // Log to monitoring service if available
            const monitoring = window.__services?.monitoring;
            if (monitoring && monitoring.recordAPICall) {
                monitoring.recordAPICall(logEntry);
            }
            
            // Also log to console in development
            if (APP_CONFIG?.ENV === 'development') {
                console.debug('[PublicAPI]', logEntry);
            }
        } catch (error) {
            console.warn('[PublicAPI] Failed to log API call:', error);
        }
    }
}

// Export singleton instance
export const publicAPI = new PublicAPI();
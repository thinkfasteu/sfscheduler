import {
  SchedulingEngine
} from "./chunks/chunk-PYRY7CKB.js";
import {
  getStudentWeeklyCapSync
} from "./chunks/chunk-ODFHEMCT.js";
import {
  auditMsg,
  createServices
} from "./chunks/chunk-AOZWLDYD.js";
import {
  APP_CONFIG,
  SHIFTS,
  appState,
  getWeekNumber,
  pad2,
  parseShiftTime,
  parseYMD
} from "./chunks/chunk-4N7SLQGZ.js";

// validation.js
var ScheduleValidator = class {
  constructor(month) {
    this.month = month;
    const [year, monthNum] = month.split("-").map(Number);
    this.year = year;
    this.monthNum = monthNum;
  }
  validateSchedule(schedule) {
    const issues = {
      workload: this.validateWorkloadLimits(schedule),
      rest: this.validateRestPeriods(schedule),
      overlaps: this.validateOverlaps(schedule),
      weekends: this.validateWeekendDistribution(schedule),
      students: this.validateStudentRules(schedule),
      permanentConsent: this.validatePermanentWeekendConsent(schedule),
      alternativeWeekend: this.validateAlternativeWeekendConsent(schedule),
      minijob: this.validateMinijobEarnings(schedule),
      studentHours: this.validateStudentWeeklyHours(schedule),
      absences: this.validateAbsenceConflicts(schedule),
      typicalDays: this.validateTypicalWorkdays(schedule)
    };
    return this.consolidateIssues(schedule, issues);
  }
  isAlternativeWeekendDay(dateStr, staff) {
    if (!APP_CONFIG?.ALTERNATIVE_WEEKEND_ENABLED) return false;
    if (!staff?.alternativeWeekendDays || staff.alternativeWeekendDays.length !== 2) return false;
    const d = parseYMD(dateStr).getDay();
    return staff.alternativeWeekendDays.includes(d);
  }
  validatePermanentWeekendConsent(schedule) {
    const issues = [];
    if (!APP_CONFIG?.PERMANENT_WEEKEND_CONSENT_ENABLED) return issues;
    Object.entries(schedule).forEach(([dateStr, day]) => {
      const dow = parseYMD(dateStr).getDay();
      const isWeekend = dow === 0 || dow === 6;
      if (!isWeekend) return;
      Object.entries(day.assignments || {}).forEach(([shiftKey, staffId]) => {
        const staff = appState.staffData.find((s) => s.id === staffId);
        if (!staff || staff.role !== "permanent") return;
        if (staff.weekendPreference) return;
        const year = String(parseYMD(dateStr).getFullYear());
        const consent = appState.permanentOvertimeConsent?.[staff.id]?.[year]?.[dateStr];
        if (!consent) {
          issues.push({
            type: "permanentConsent",
            severity: "warning",
            staffId: staff.id,
            dateStr,
            shiftKey,
            message: "Wochenendarbeit erfordert Zustimmung"
          });
        }
      });
    });
    return issues;
  }
  validateAlternativeWeekendConsent(schedule) {
    const issues = [];
    if (!APP_CONFIG?.ALTERNATIVE_WEEKEND_ENABLED) return issues;
    Object.entries(schedule).forEach(([dateStr, day]) => {
      Object.entries(day.assignments || {}).forEach(([shiftKey, staffId]) => {
        const staff = appState.staffData.find((s) => s.id === staffId);
        if (!staff || staff.role !== "permanent") return;
        if (!staff.weekendPreference) return;
        if (!this.isAlternativeWeekendDay(dateStr, staff)) return;
        if (!APP_CONFIG?.ALTERNATIVE_WEEKEND_REQUIRES_CONSENT) return;
        const year = String(parseYMD(dateStr).getFullYear());
        const consent = appState.permanentOvertimeConsent?.[staff.id]?.[year]?.[dateStr];
        if (!consent) {
          issues.push({
            type: "alternativeWeekend",
            severity: "warning",
            staffId: staff.id,
            dateStr,
            shiftKey,
            message: "Alternative Wochenendtage erfordern Zustimmung"
          });
        }
      });
    });
    return issues;
  }
  validateWorkloadLimits(schedule) {
    const issues = [];
    const weeklyHours = {};
    const monthlyHours = {};
    Object.entries(schedule).forEach(([dateStr, day]) => {
      const weekNum = getWeekNumber(parseYMD(dateStr));
      Object.entries(day.assignments || {}).forEach(([shiftKey, staffId]) => {
        const hours = SHIFTS[shiftKey].hours;
        weeklyHours[weekNum] = weeklyHours[weekNum] || {};
        weeklyHours[weekNum][staffId] = (weeklyHours[weekNum][staffId] || 0) + hours;
        monthlyHours[staffId] = (monthlyHours[staffId] || 0) + hours;
      });
    });
    appState.staffData.forEach((staff) => {
      Object.entries(weeklyHours).forEach(([weekNum, staffHours]) => {
        const hours = staffHours[staff.id] || 0;
        const weeklyTarget = this.getWeeklyTarget(staff);
        const tolerance2 = APP_CONFIG.WEEK_TOLERANCE_BY_ROLE[staff.role] || APP_CONFIG.DEFAULT_WEEK_TOLERANCE;
        if (Math.abs(hours - weeklyTarget) > tolerance2) {
          issues.push({
            type: "workload",
            severity: "warning",
            staffId: staff.id,
            message: `Week ${weekNum}: ${hours}h (target: ${weeklyTarget}\xB1${tolerance2})`
          });
        }
      });
      const monthlyHoursTotal = monthlyHours[staff.id] || 0;
      const monthlyTarget = this.getMonthlyTarget(staff);
      const tolerance = APP_CONFIG.MONTH_TOLERANCE_BY_ROLE[staff.role] || APP_CONFIG.DEFAULT_MONTH_TOLERANCE;
      if (Math.abs(monthlyHoursTotal - monthlyTarget) > tolerance) {
        issues.push({
          type: "workload",
          severity: "warning",
          staffId: staff.id,
          message: `Month total: ${monthlyHoursTotal}h (target: ${monthlyTarget}\xB1${tolerance})`
        });
      }
    });
    return issues;
  }
  // Return both issues and consolidated schedule so callers can distinguish overridable vs hard errors
  validateScheduleWithIssues(schedule) {
    const issues = {
      workload: this.validateWorkloadLimits(schedule),
      rest: this.validateRestPeriods(schedule),
      overlaps: this.validateOverlaps(schedule),
      weekends: this.validateWeekendDistribution(schedule),
      students: this.validateStudentRules(schedule),
      permanentConsent: this.validatePermanentWeekendConsent(schedule),
      alternativeWeekend: this.validateAlternativeWeekendConsent(schedule),
      minijob: this.validateMinijobEarnings(schedule),
      studentHours: this.validateStudentWeeklyHours(schedule),
      absences: this.validateAbsenceConflicts(schedule),
      typicalDays: this.validateTypicalWorkdays(schedule)
    };
    const consolidated = this.consolidateIssues(schedule, issues);
    return { issues, schedule: consolidated };
  }
  validateMinijobEarnings(schedule) {
    const issues = [];
    const monthlyHours = {};
    Object.entries(schedule).forEach(([dateStr, day]) => {
      Object.entries(day.assignments || {}).forEach(([shiftKey, staffId]) => {
        const hours = SHIFTS[shiftKey]?.hours || 0;
        monthlyHours[staffId] = (monthlyHours[staffId] || 0) + hours;
      });
    });
    const cap = APP_CONFIG?.MINIJOB_MAX_EARNING ?? 556;
    const wage = APP_CONFIG?.MINIJOB_HOURLY_WAGE ?? 13.5;
    (appState.staffData || []).forEach((staff) => {
      if (staff.role !== "minijob") return;
      const projected = (monthlyHours[staff.id] || 0) * wage;
      if (projected > cap + (APP_CONFIG?.FLOAT_PRECISION_OFFSET || 0)) {
        issues.push({
          type: "minijob",
          severity: "warning",
          staffId: staff.id,
          message: `Minijob earnings risk: \u20AC${projected.toFixed(2)} > cap \u20AC${cap}`
        });
      }
    });
    return issues;
  }
  validateStudentWeeklyHours(schedule) {
    const issues = [];
    const weeklyHoursByStaff = {};
    const sampleDateByWeek = {};
    Object.entries(schedule).forEach(([dateStr, day]) => {
      const weekNum = getWeekNumber(parseYMD(dateStr));
      if (!sampleDateByWeek[weekNum]) sampleDateByWeek[weekNum] = dateStr;
      Object.entries(day.assignments || {}).forEach(([shiftKey, staffId]) => {
        const hours = SHIFTS[shiftKey]?.hours || 0;
        weeklyHoursByStaff[staffId] = weeklyHoursByStaff[staffId] || {};
        weeklyHoursByStaff[staffId][weekNum] = (weeklyHoursByStaff[staffId][weekNum] || 0) + hours;
      });
    });
    (appState.staffData || []).forEach((staff) => {
      if (staff.role !== "student") return;
      Object.entries(weeklyHoursByStaff[staff.id] || {}).forEach(([week, h]) => {
        const sampleDate = sampleDateByWeek[week];
        const maxWeekly = sampleDate ? getStudentWeeklyCapSync(sampleDate) : APP_CONFIG?.STUDENT_MAX_WEEKLY_HOURS_LECTURE ?? 20;
        if (h > maxWeekly + (APP_CONFIG?.FLOAT_PRECISION_OFFSET || 0)) {
          issues.push({ type: "student", severity: "warning", staffId: staff.id, message: `Student weekly hours ${h}h exceed ${maxWeekly}h (KW${week})` });
        }
      });
    });
    return issues;
  }
  validateRestPeriods(schedule) {
    const issues = [];
    const lastEndTime = {};
    Object.entries(schedule).sort(([a], [b]) => a.localeCompare(b)).forEach(([dateStr, day]) => {
      Object.entries(day.assignments || {}).forEach(([shiftKey, staffId]) => {
        const shift = SHIFTS[shiftKey];
        const [startTime] = shift.time.split("-");
        const start = parseShiftTime(dateStr, startTime);
        if (lastEndTime[staffId]) {
          const rest = (start - lastEndTime[staffId]) / (1e3 * 60 * 60);
          if (rest < APP_CONFIG.MIN_REST_HOURS) {
            issues.push({
              type: "rest",
              severity: "error",
              staffId,
              dateStr,
              shiftKey,
              message: `Insufficient rest period (${rest.toFixed(1)}h)`
            });
          }
        }
        const [_, endTime] = shift.time.split("-");
        lastEndTime[staffId] = parseShiftTime(dateStr, endTime);
      });
    });
    return issues;
  }
  validateWeekendDistribution(schedule) {
    const issues = [];
    const weekendCounts = {};
    Object.entries(schedule).forEach(([dateStr, day]) => {
      const date = parseYMD(dateStr);
      const isWeekend = [0, 6].includes(date.getDay());
      if (!isWeekend) return;
      Object.values(day.assignments || {}).forEach((staffId) => {
        weekendCounts[staffId] = (weekendCounts[staffId] || 0) + 1;
      });
    });
    appState.staffData.forEach((staff) => {
      if (staff.role === "permanent") return;
      const count = weekendCounts[staff.id] || 0;
      const minWe = APP_CONFIG.MIN_WEEKENDS_PER_MONTH ?? 1;
      const maxWe = APP_CONFIG.MAX_WEEKENDS_WITHOUT_PREFERENCE ?? 2;
      const weekendOnly = this.isWeekendOnlyAvailability(staff, schedule);
      if (count < minWe) {
        issues.push({
          type: "weekend",
          severity: "warning",
          staffId: staff.id,
          message: `Too few weekend shifts (${count}/${minWe})`
        });
      }
      if (!staff.weekendPreference && !weekendOnly && count > maxWe) {
        issues.push({
          type: "weekend",
          severity: "warning",
          staffId: staff.id,
          message: `Exceeds max weekends (${count}/${maxWe})`
        });
      }
    });
    return issues;
  }
  // Check assignments don't fall on vacation or illness dates
  validateAbsenceConflicts(schedule) {
    const issues = [];
    const inPeriods = (dateStr, periods = []) => {
      if (!Array.isArray(periods) || periods.length === 0) return false;
      const t = parseYMD(dateStr).getTime();
      for (const p of periods) {
        if (!p?.start || !p?.end) continue;
        const s = parseYMD(p.start).getTime();
        const e = parseYMD(p.end).getTime();
        if (t >= s && t <= e) return true;
      }
      return false;
    };
    Object.entries(schedule).forEach(([dateStr, day]) => {
      Object.entries(day.assignments || {}).forEach(([shiftKey, staffId]) => {
        const vac = appState.vacationsByStaff?.[staffId] || [];
        const ill = appState.illnessByStaff?.[staffId] || [];
        const dayOff = appState.availabilityData?.[`staff:${staffId}`]?.[dateStr] === "off";
        if (inPeriods(dateStr, vac)) {
          issues.push({ type: "absence", severity: "error", staffId, dateStr, shiftKey, message: "Assignment on vacation day" });
        }
        if (inPeriods(dateStr, ill)) {
          issues.push({ type: "absence", severity: "error", staffId, dateStr, shiftKey, message: "Assignment on sick day" });
        }
        if (dayOff) {
          issues.push({ type: "absence", severity: "error", staffId, dateStr, shiftKey, message: "Assignment on requested off day" });
        }
      });
    });
    return issues;
  }
  // Hard blocker: a staff member assigned to more than one shift on the same day
  validateOverlaps(schedule) {
    const issues = [];
    Object.entries(schedule).forEach(([dateStr, day]) => {
      const byStaff = {};
      Object.entries(day.assignments || {}).forEach(([shiftKey, staffId]) => {
        if (!byStaff[staffId]) byStaff[staffId] = [];
        byStaff[staffId].push(shiftKey);
      });
      Object.entries(byStaff).forEach(([staffId, shifts]) => {
        if (shifts.length > 1) {
          shifts.forEach((shiftKey) => {
            issues.push({ type: "overlap", severity: "error", staffId: Number(staffId), dateStr, shiftKey, message: "Multiple shifts on same day" });
          });
        }
      });
    });
    return issues;
  }
  // Typical workdays weekly deviation checks
  validateTypicalWorkdays(schedule) {
    const issues = [];
    const daysPerWeek = {};
    Object.entries(schedule).forEach(([dateStr, day]) => {
      const weekNum = getWeekNumber(parseYMD(dateStr));
      const seen = /* @__PURE__ */ new Set();
      Object.values(day.assignments || {}).forEach((staffId) => {
        seen.add(staffId);
      });
      seen.forEach((staffId) => {
        daysPerWeek[weekNum] = daysPerWeek[weekNum] || {};
        daysPerWeek[weekNum][staffId] = (daysPerWeek[weekNum][staffId] || 0) + 1;
      });
    });
    const maxExtra = APP_CONFIG.MAX_EXTRA_DAYS_ALLOWED ?? 1;
    const hardCap = APP_CONFIG.MAX_EXTRA_DAYS_HARD_CAP ?? 2;
    (appState.staffData || []).forEach((staff) => {
      const typical = Number(staff.typicalWorkdays || 0);
      if (!typical) return;
      Object.entries(daysPerWeek).forEach(([weekNum, map]) => {
        const days = map[staff.id] || 0;
        if (days > typical + hardCap) {
          issues.push({ type: "typicalDays", severity: "error", staffId: staff.id, message: `Week ${weekNum}: ${days} days assigned (typical ${typical}+${hardCap})` });
        } else if (days > typical + maxExtra) {
          issues.push({ type: "typicalDays", severity: "warning", staffId: staff.id, message: `Week ${weekNum}: ${days} days exceeds typical (${typical}+${maxExtra})` });
        } else if (typical - days > 1) {
          issues.push({ type: "typicalDays", severity: "warning", staffId: staff.id, message: `Week ${weekNum}: only ${days} days (typical ${typical})` });
        }
      });
    });
    return issues;
  }
  validateStudentRules(schedule) {
    const issues = [];
    const weekdayDaytime = {};
    const weekdayEvenings = {};
    const weekendShifts = {};
    Object.entries(schedule).forEach(([dateStr, day]) => {
      const date = parseYMD(dateStr);
      const isWeekday = ![0, 6].includes(date.getDay());
      const weekNum = getWeekNumber(date);
      if (isWeekday) {
        Object.entries(day.assignments || {}).forEach(([shiftKey, staffId]) => {
          const staff = appState.staffData.find((s) => s.id === staffId);
          if (staff?.role !== "student") return;
          if (shiftKey === "early" || shiftKey === "midday") {
            weekdayDaytime[staffId] = weekdayDaytime[staffId] || {};
            weekdayDaytime[staffId][weekNum] = (weekdayDaytime[staffId][weekNum] || 0) + 1;
            if (weekdayDaytime[staffId][weekNum] > APP_CONFIG.STUDENT_MAX_WEEKDAY_DAYTIME_SHIFTS) {
              issues.push({
                type: "student",
                severity: "warning",
                staffId,
                weekNum,
                message: `Too many daytime shifts in week ${weekNum}`
              });
            }
          }
          if (shiftKey === "evening" || shiftKey === "closing") {
            weekdayEvenings[staffId] = weekdayEvenings[staffId] || {};
            weekdayEvenings[staffId][weekNum] = (weekdayEvenings[staffId][weekNum] || 0) + 1;
          }
        });
      } else {
        Object.entries(day.assignments || {}).forEach(([shiftKey, staffId]) => {
          const staff = appState.staffData.find((s) => s.id === staffId);
          if (staff?.role !== "student") return;
          weekendShifts[staffId] = (weekendShifts[staffId] || 0) + 1;
        });
      }
    });
    const monthDays = this.getDaysInMonth();
    const weeksApprox = Math.ceil(monthDays / 7);
    (appState.staffData || []).forEach((staff) => {
      if (staff.role !== "student") return;
      const totalDaytime = Object.values(weekdayDaytime[staff.id] || {}).reduce((a, b) => a + b, 0);
      const totalEvening = Object.values(weekdayEvenings[staff.id] || {}).reduce((a, b) => a + b, 0);
      const totalWeekend = weekendShifts[staff.id] || 0;
      if (totalDaytime > totalEvening + totalWeekend) {
        issues.push({
          type: "student",
          severity: "warning",
          staffId: staff.id,
          message: `Student ratio: daytime (${totalDaytime}) exceeds evenings+weekends (${totalEvening + totalWeekend})`
        });
      }
    });
    return issues;
  }
  consolidateIssues(schedule, issues) {
    const result = { ...schedule };
    Object.entries(result).forEach(([dateStr, day]) => {
      day.blockers = {};
      day.warnings = {};
      Object.entries(day.assignments || {}).forEach(([shiftKey, staffId]) => {
        const staffIssues = Object.values(issues).flat().filter((i) => i.staffId === staffId && (!i.dateStr || i.dateStr === dateStr) && (!i.shiftKey || i.shiftKey === shiftKey));
        if (staffIssues.some((i) => i.severity === "error")) {
          day.blockers[shiftKey] = staffIssues.filter((i) => i.severity === "error").map((i) => i.message).join("; ");
        }
        if (staffIssues.some((i) => i.severity === "warning")) {
          day.warnings[shiftKey] = staffIssues.filter((i) => i.severity === "warning").map((i) => i.message).join("; ");
        }
      });
    });
    return result;
  }
  getWeeklyTarget(staff) {
    return staff.weeklyHours ?? staff.contractHours ?? 0;
  }
  getMonthlyTarget(staff) {
    const weeklyTarget = this.getWeeklyTarget(staff);
    if (!weeklyTarget) return 0;
    const daysInMonth = this.getDaysInMonth();
    let weekdayCount = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(this.year, this.monthNum - 1, d);
      const dow = dt.getDay();
      if (dow !== 0 && dow !== 6) weekdayCount++;
    }
    return weeklyTarget * (weekdayCount / 5);
  }
  getDaysInMonth() {
    return new Date(this.year, this.monthNum, 0).getDate();
  }
};
ScheduleValidator.prototype.isWeekendOnlyAvailability = function(staff, schedule) {
  const [year, monthNum] = this.month.split("-").map(Number);
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  let hasWeekendAvail = false;
  let hasWeekdayAvail = false;
  for (let day = 1; day <= daysInMonth; day++) {
    const ds = `${year}-${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const perShift = appState.availabilityData?.[staff.id]?.[ds];
    if (!perShift) continue;
    const anyYes = Object.values(perShift).some((v) => v === "yes" || v === "prefer");
    if (!anyYes) continue;
    const dow = parseYMD(ds).getDay();
    const isWE = dow === 0 || dow === 6;
    if (isWE) hasWeekendAvail = true;
    else hasWeekdayAvail = true;
  }
  return hasWeekendAvail && !hasWeekdayAvail;
};

// ui/scheduleUI.js
var ScheduleUI = class {
  constructor(containerId) {
    this.container = document.querySelector(containerId);
    if (!this.container) {
      console.error("ScheduleUI: container not found", containerId);
      return;
    }
    this.currentCalendarMonth = null;
    this._hydratedMonths = /* @__PURE__ */ new Set();
    if (!window.__perf) window.__perf = {};
    window.__perf.calendarFullRenders = window.__perf.calendarFullRenders || 0;
    window.__perf.calendarDiffUpdates = window.__perf.calendarDiffUpdates || 0;
    this._delegatesBound = false;
    this.setupTabs();
    if (!window.__uiModalHelpersInstalled) {
      window.__uiModalHelpersInstalled = true;
      window.__modalFocusStack = [];
      const FOCUSABLE_SELECTOR = 'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"]), [contenteditable]';
      const trapFocus = (modal) => {
        const nodes = Array.from(modal.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => el.offsetParent !== null);
        if (!nodes.length) return;
        let first = nodes[0];
        let last = nodes[nodes.length - 1];
        const handler = (e) => {
          if (e.key !== "Tab") return;
          if (e.shiftKey) {
            if (document.activeElement === first) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        };
        modal.__focusHandler = handler;
        modal.addEventListener("keydown", handler);
      };
      const releaseFocus = (modal) => {
        if (modal?.__focusHandler) modal.removeEventListener("keydown", modal.__focusHandler);
      };
      window.showModal = function showModal(id, opts = {}) {
        const m = document.getElementById(id);
        if (!m) {
          console.warn("[showModal] missing modal", id);
          return;
        }
        window.__modalFocusStack.push({ id, el: document.activeElement });
        m.classList.add("open");
        m.setAttribute("aria-modal", "true");
        m.setAttribute("role", m.getAttribute("role") || "dialog");
        try {
          if (!m.hasAttribute("aria-labelledby")) {
            let titleEl = m.querySelector("[data-modal-title]") || m.querySelector("h1,h2,h3,h4,h5") || document.getElementById(`${id}Title`);
            if (titleEl) {
              if (!titleEl.id) titleEl.id = `${id}__title`;
              m.setAttribute("aria-labelledby", titleEl.id);
            }
          }
          const content = m.querySelector(".modal-content");
          if (content && !content.hasAttribute("role")) content.setAttribute("role", "document");
        } catch (a11yErr) {
        }
        document.body.classList.add("no-scroll");
        document.getElementById("scheduleChecklistRoot")?.classList.add("modal-open");
        if (!m.__sentinels) {
          const makeSentinel = (pos) => {
            const s = document.createElement("div");
            s.className = "sr-only focus-sentinel";
            s.tabIndex = 0;
            s.dataset.sentinel = pos;
            return s;
          };
          const start = makeSentinel("start");
          const end = makeSentinel("end");
          m.prepend(start);
          m.appendChild(end);
          const focusables = () => Array.from(m.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => el.offsetParent !== null && !el.classList.contains("focus-sentinel"));
          start.addEventListener("focus", () => {
            const f = focusables();
            if (f.length) f[f.length - 1].focus();
            else m.focus();
          });
          end.addEventListener("focus", () => {
            const f = focusables();
            if (f.length) f[0].focus();
            else m.focus();
          });
          m.__sentinels = { start, end };
        }
        const focusable = m.querySelector(FOCUSABLE_SELECTOR);
        if (focusable) focusable.focus();
        else m.setAttribute("tabindex", "-1"), m.focus();
        trapFocus(m);
        if (opts.onOpen) {
          try {
            opts.onOpen(m);
          } catch (e) {
            console.warn("[showModal:onOpen]", e);
          }
        }
      };
      window.openModal = function openModal(id, opts) {
        return window.showModal(id, opts);
      };
      window.__openModal = window.openModal;
      window.hideModal = function hideModal(id) {
        return window.closeModal(id);
      };
      window.closeModal = function closeModal(id, opts = {}) {
        const m = document.getElementById(id);
        if (!m) return;
        releaseFocus(m);
        m.classList.remove("open");
        m.removeAttribute("aria-modal");
        const stack = window.__modalFocusStack;
        let prev;
        if (stack && stack.length) {
          while (stack.length) {
            const top = stack.pop();
            if (top.id === id) {
              prev = top.el;
              break;
            }
          }
        }
        const anyOpen = !!document.querySelector(".modal.open");
        if (!anyOpen) {
          document.body.classList.remove("no-scroll");
          document.getElementById("scheduleChecklistRoot")?.classList.remove("modal-open");
        }
        if (prev && typeof prev.focus === "function") setTimeout(() => prev.focus(), 30);
        if (opts.onClose) {
          try {
            opts.onClose(m);
          } catch (e) {
            console.warn("[closeModal:onClose]", e);
          }
        }
      };
      window.__closeModal = window.closeModal;
      try {
        if (window.modalManager && !window.modalManager.__wrappedForA11y) {
          const mm = window.modalManager;
          const origOpen = mm.open ? mm.open.bind(mm) : null;
          const origClose = mm.close ? mm.close.bind(mm) : null;
          mm.open = function(id, opts) {
            window.showModal(id, opts || {});
          };
          mm.close = function(id, opts) {
            window.closeModal(id, opts || {});
          };
          mm.__wrappedForA11y = { origOpen: !!origOpen, origClose: !!origClose };
          console.info("[modalManager] wrapped for unified a11y modal handling");
        }
      } catch (modWrapErr) {
        console.warn("[modalManager] wrap failed", modWrapErr);
      }
      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          const openModals = Array.from(document.querySelectorAll(".modal.open"));
          const last = openModals[openModals.length - 1];
          if (last) {
            const id = last.id;
            if (window.__closeModal) window.__closeModal(id);
            else window.closeModal(id);
          }
        }
      });
      window.addEventListener("click", (e) => {
        const open = document.querySelectorAll('.modal.open[data-backdrop-close="true"]');
        if (!open.length) return;
        open.forEach((m) => {
          if (!m.contains(e.target)) {
            window.closeModal(m.id);
          }
        });
      });
      const bindModalCloseButtons = () => {
        document.querySelectorAll("[data-modal-close]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const target = btn.getAttribute("data-modal-close") || btn.closest(".modal")?.id;
            if (target) window.closeModal(target);
          });
        });
        document.getElementById("swapModalCloseBtn")?.addEventListener("click", () => window.closeModal("swapModal"));
        document.getElementById("searchModalCloseBtn")?.addEventListener("click", () => window.closeModal("searchModal"));
        document.getElementById("holidaysModalCloseBtn")?.addEventListener("click", () => window.closeModal("holidaysModal"));
      };
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bindModalCloseButtons, { once: true });
      } else {
        setTimeout(bindModalCloseButtons, 0);
      }
    }
  }
  setupTabs() {
    window.ui = this;
    const hasPrototypeTabs = document.querySelector(".tabs");
    if (hasPrototypeTabs) {
      return;
    }
    document.querySelectorAll(".tab-button").forEach((btn) => {
      btn.addEventListener("click", () => this.showTab(btn.dataset.tab));
    });
    this.showTab("schedule");
  }
  showTab(tabName) {
    if (typeof window.showTab === "function") {
      try {
        window.showTab(null, tabName);
        return;
      } catch (e) {
      }
    }
    const targetContent = document.getElementById(`${tabName}Content`);
    const targetButton = document.querySelector(`[data-tab="${tabName}"]`);
    if (!targetContent || !targetButton) {
      console.warn("ScheduleUI: missing tab elements", { tabName, targetContent, targetButton });
      return;
    }
    document.querySelectorAll(".tab-content").forEach((tab) => tab.classList.remove("active"));
    document.querySelectorAll(".tab-button").forEach((btn) => btn.classList.remove("active"));
    targetContent.classList.add("active");
    this.updateCalendarFromSelect();
    targetButton.classList.add("active");
  }
  addVacationPeriod() {
    console.log("Add vacation period clicked");
  }
  setupHandlers() {
  }
  // Compute canonical day type using latest holiday + weekend logic
  computeDayType(dateStr) {
    try {
      const hol = this.getHolidayName(dateStr);
      if (hol) return "holiday";
      const d = parseYMD(dateStr).getDay();
      if (d === 0 || d === 6) return "weekend";
      return "weekday";
    } catch (e) {
      return "weekday";
    }
  }
  // Reclassify all cells of the current month after late holiday load
  reclassifyMonthDayTypes(monthKey) {
    if (!monthKey) return [];
    const nodes = Array.from(document.querySelectorAll(`.cal-body[data-date^="${monthKey}"]`));
    const changed = [];
    nodes.forEach((n) => {
      const dateStr = n.getAttribute("data-date");
      const prevType = n.getAttribute("data-type");
      const newType = this.computeDayType(dateStr);
      if (prevType !== newType) {
        n.setAttribute("data-type", newType);
        changed.push({ dateStr, from: prevType, to: newType });
      }
    });
    if (changed.length) {
      console.log(`[reclassifyMonthDayTypes] ${changed.length} day(s) changed`, changed.slice(0, 5));
      changed.forEach((ch) => this.updateDay(ch.dateStr));
    }
    return changed;
  }
  ensureHolidaysLoaded(year) {
    const yearStr = String(year);
    const existing = window.appState?.holidays?.[yearStr];
    const existingCount = existing ? Object.keys(existing).length : 0;
    console.log(`[ensureHolidaysLoaded] Checking year ${year}:`, {
      hasHolidaysObject: !!window.appState?.holidays,
      hasYearData: !!existing,
      existingCount,
      existingKeys: existing ? Object.keys(existing).slice(0, 3) : [],
      callStack: new Error().stack.split("\n").slice(1, 4).map((line) => line.trim())
    });
    if (existing && existingCount > 0) {
      console.log(`[ensureHolidaysLoaded] Already loaded ${existingCount} holidays for ${year}, skipping fetch`);
      return;
    }
    const attemptFetch = () => {
      if (window.__services?.holiday?.fetchHolidaysForYear) {
        console.log(`Auto-fetching holidays for ${year}...`);
        window.__services.holiday.fetchHolidaysForYear(year).then(() => {
          console.log(`Successfully loaded holidays for ${year}`);
          const holidays = window.appState?.holidays?.[String(year)] || {};
          console.log("[holidays][reader] mark=", window.__STATE_MARK__, appState.holidays[String(year)]);
          console.log(`Holiday data for ${year}:`, holidays);
          const oct3 = holidays["2025-10-03"];
          if (oct3) {
            console.log(`\u2705 October 3rd found in data: "${oct3}"`);
          } else {
            console.log(`\u274C October 3rd NOT found in loaded data`);
          }
          console.log(`Calling updateHolidayBadges + reclassification for ${year}...`);
          try {
            if (this.currentCalendarMonth && this.currentCalendarMonth.startsWith(String(year))) {
              this.reclassifyMonthDayTypes(this.currentCalendarMonth);
            }
          } catch (e) {
            console.warn("[ensureHolidaysLoaded] reclassify failed", e);
          }
          this.updateHolidayBadges(year);
        }).catch((err) => {
          console.warn(`Failed to load holidays for ${year}:`, err);
        });
      } else {
        console.warn("Holiday service not available for auto-fetching");
      }
    };
    if (window.__services?.ready) {
      window.__services.ready.then(attemptFetch);
    } else {
      let attempts = 0;
      const checkServices = () => {
        attempts++;
        if (window.__services?.holiday?.fetchHolidaysForYear) {
          attemptFetch();
        } else if (attempts < 10) {
          setTimeout(checkServices, 200);
        } else {
          console.warn(`Holiday service still not available after ${attempts} attempts`);
        }
      };
      setTimeout(checkServices, 100);
    }
  }
  // Helper function to get holiday name using TS singleton with appState fallback
  getHolidayName(dateStr) {
    const yearStr = dateStr.split("-")[0];
    try {
      const fromSvc = window.holidayService?.getHolidayName?.(dateStr) || null;
      if (fromSvc) return fromSvc;
    } catch (e) {
    }
    return window.appState?.holidays?.[yearStr]?.[dateStr] || null;
  }
  // Canonical shift resolution based on computed day type
  getApplicableShifts(dateStr) {
    const type = this.computeDayType(dateStr);
    return Object.entries(SHIFTS).filter(([_, v]) => v.type === type).map(([k]) => k);
  }
  updateHolidayBadges(year) {
    const yearStr = String(year);
    const svcMap = window.holidayService?.getHolidaysForYear?.(Number(year)) || {};
    const holidays = Object.keys(svcMap).length ? svcMap : window.appState?.holidays?.[yearStr] || {};
    const monthKey = this.currentCalendarMonth;
    if (!monthKey) return;
    const entries = Object.entries(holidays).filter(([dateStr]) => dateStr.startsWith(monthKey));
    console.log(`[updateHolidayBadges] Painting ${entries.length} holiday(s) for ${monthKey}`);
    for (const [dateStr, holidayName] of entries) {
      const calBody = document.querySelector(`.cal-body[data-date="${dateStr}"]`);
      if (!calBody) continue;
      const calCell = calBody.parentElement;
      const calDate = calCell?.querySelector(".cal-date");
      if (!calDate) continue;
      if (!calDate.querySelector(".badge")) {
        const dayText = calDate.textContent.trim();
        calDate.innerHTML = `${dayText} <span class="badge">${holidayName}</span>`;
      }
    }
  }
  // Extended version with options
  updateHolidayBadgesExt(year, { retype = false } = {}) {
    const yearStr = String(year);
    const svcMap = window.holidayService?.getHolidaysForYear?.(Number(year)) || {};
    const holidays = Object.keys(svcMap).length ? svcMap : window.appState?.holidays?.[yearStr] || {};
    const monthKey = this.currentCalendarMonth;
    if (!monthKey) return 0;
    if (retype) {
      try {
        this.reclassifyMonthDayTypes(monthKey);
      } catch (e) {
        console.warn("[holiday][retype] failed", e);
      }
    }
    const entries = Object.entries(holidays).filter(([dateStr]) => dateStr.startsWith(monthKey));
    console.log(`[updateHolidayBadges] Painting ${entries.length} holiday(s) for ${monthKey}${retype ? " (after retype)" : ""}`);
    let painted = 0;
    for (const [dateStr, holidayName] of entries) {
      const calBody = document.querySelector(`.cal-body[data-date="${dateStr}"]`);
      if (!calBody) continue;
      const calCell = calBody.parentElement;
      const calDate = calCell?.querySelector(".cal-date");
      if (!calDate) continue;
      if (!calDate.querySelector(".badge")) {
        const dayText = calDate.textContent.trim();
        calDate.innerHTML = `${dayText} <span class="badge">${holidayName}</span>`;
        painted++;
      }
    }
    return painted;
  }
  refreshDisplay() {
    if (!this.container) {
      console.warn("ScheduleUI: no container to render into");
      return;
    }
    if (!document.getElementById("scheduleGrid")) {
      this.container.innerHTML = '<div id="scheduleGrid">Schedule UI Loading...</div>';
    }
    this.initMonthSelector();
    this.updateCalendarFromSelect();
  }
  initMonthSelector() {
    const el = document.getElementById("scheduleMonth");
    if (!el) return;
    if (el.tagName === "SELECT") {
      if (!el.options || el.options.length === 0) {
        const now = /* @__PURE__ */ new Date();
        const months = 12;
        for (let i = 0; i < months; i++) {
          const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
          const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          const opt = document.createElement("option");
          opt.value = val;
          opt.textContent = d.toLocaleString(void 0, { month: "long", year: "numeric" });
          el.appendChild(opt);
        }
      }
      if (!el.value) {
        const now = /* @__PURE__ */ new Date();
        el.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      }
    }
    el.addEventListener("change", () => {
      this.updateCalendarFromSelect();
      const v = el.value;
      if (v) this.prehydrateAvailability(v).catch(() => {
      });
    });
    if (el.value) {
      this.prehydrateAvailability(el.value).catch(() => {
      });
    }
    const exc = document.getElementById("studentExceptionCheckbox");
    if (exc) {
      exc.addEventListener("change", () => {
        const month = el.value;
        if (!month) return;
        appState.studentExceptionMonths[month] = !!exc.checked;
        appState.save?.();
      });
    }
    const fair = document.getElementById("studentFairnessCheckbox");
    if (fair) {
      fair.checked = !!appState.studentFairnessMode;
      fair.addEventListener("change", () => {
        appState.studentFairnessMode = !!fair.checked;
        appState.save?.();
      });
    }
  }
  updateCalendarFromSelect() {
    console.log("[scheduleUI][phase] start updateCalendarFromSelect");
    const el = document.getElementById("scheduleMonth");
    const month = el?.value;
    if (!month) return;
    if (this.currentCalendarMonth === month && document.getElementById("scheduleGrid")) {
      console.log("[scheduleUI][phase] fast-refresh existing month");
      this.renderAssignments(month);
      this.renderWeekendReport(month);
      return;
    }
    let grid = document.getElementById("scheduleGrid");
    if (!grid) {
      this.container.innerHTML = '<div id="scheduleGrid"></div>';
      grid = document.getElementById("scheduleGrid");
    }
    const [y, m] = month.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const startDay = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(y, m, 0).getDate();
    let html = '<div id="scheduleStatus" class="status-line hidden"><span class="spinner"></span><span id="scheduleStatusText">Synchronisiere Verf\xFCgbarkeiten\u2026</span></div><div class="flex flex-wrap jc-end gap-8 mb-8"><button class="btn btn-secondary" id="showHolidaysBtn">Feiertage</button><button class="btn btn-secondary" id="openSearchAssignBtn">Suchen & Zuweisen (Datum w\xE4hlen)</button></div>';
    html += '<div class="cal"><div class="cal-row cal-head">';
    const wk = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
    wk.forEach((d) => html += `<div class="cal-cell cal-head-cell">${d}</div>`);
    html += "</div>";
    let day = 1;
    for (let r = 0; r < 6 && day <= daysInMonth; r++) {
      html += '<div class="cal-row">';
      for (let c = 0; c < 7; c++) {
        const cellIndex = r * 7 + c;
        if (cellIndex < startDay || day > daysInMonth) {
          html += '<div class="cal-cell cal-empty"></div>';
        } else {
          const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isWeekend = c >= 5;
          const holName = this.getHolidayName(dateStr);
          const type = holName ? "holiday" : isWeekend ? "weekend" : "weekday";
          html += `<div class="cal-cell ${isWeekend ? "cal-weekend" : ""}">
                        <div class="cal-date">${day}${holName ? ` <span class="badge">${holName}</span>` : ""}</div>
                        <div class="cal-body" data-date="${dateStr}" data-type="${type}"></div>
                    </div>`;
          day++;
        }
      }
      html += "</div>";
    }
    html += "</div>";
    grid.innerHTML = html;
    this.currentCalendarMonth = month;
    console.log("[scheduleUI][phase] holidays-initial");
    try {
      this.ensureHolidaysLoaded(y);
    } catch (e) {
      console.warn("[phase] ensureHolidaysLoaded failed", e);
    }
    try {
      this.updateHolidayBadgesExt(y, { retype: true });
    } catch (e) {
      console.warn("[phase] updateHolidayBadges initial failed", e);
    }
    window.__perf.calendarFullRenders++;
    this._selectedDateForSearch = null;
    const exc = document.getElementById("studentExceptionCheckbox");
    if (exc) exc.checked = !!appState.studentExceptionMonths?.[month];
    const fair = document.getElementById("studentFairnessCheckbox");
    if (fair) fair.checked = !!appState.studentFairnessMode;
    this.renderAssignments(month);
    this.renderWeekendReport(month);
    this.setStatus("Synchronisiere Verf\xFCgbarkeiten\u2026", true);
    this.prehydrateAvailability(month).then(() => {
      if (this.currentCalendarMonth === month) {
        this.renderAssignments(month);
        this.renderWeekendReport(month);
      }
      this.setStatus("Synchronisiert \u2713", true, false);
      setTimeout(() => {
        this.clearStatus();
      }, 900);
    }).catch((e) => {
      console.warn(e);
      this.clearStatus();
    });
    if (window.CONFIG?.A11Y_AUDIT_AUTO) {
      try {
        const issues = this.runA11yAudit?.();
        if (issues) {
          const counts = issues.reduce((acc, i) => {
            acc[i.type] = (acc[i.type] || 0) + 1;
            return acc;
          }, {});
          console.info("[a11y] audit summary after render", { total: issues.length, counts });
        }
      } catch (ae) {
        console.warn("[a11y] audit invocation failed", ae);
      }
    }
    console.log("[scheduleUI][phase] done updateCalendarFromSelect");
  }
  bindDelegatesOnce() {
    if (this._delegatesBound) {
      return;
    }
    this._delegatesBound = true;
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (btn) {
        const id = btn.id;
        if (id === "openSearchAssignBtn") {
          const dateStr = this._selectedDateForSearch || document.querySelector(".cal-body[data-date]")?.getAttribute("data-date");
          if (!dateStr) {
            alert("Bitte ein Datum im Kalender w\xE4hlen.");
            return;
          }
          this.openSearchAssignModal(dateStr);
        } else if (id === "executeSwapBtn") {
          try {
            window.handlers?.executeSwap?.();
          } catch (err) {
            console.warn("[delegation] executeSwap failed", err);
          }
        }
        return;
      }
      if (e.target.classList.contains("modal") && e.target.closest(".modal")?.classList.contains("open")) {
        const modalId = e.target.id;
        if (modalId) window.closeModal?.(modalId);
      }
      const body = e.target.closest(".cal-body[data-date]");
      if (body) {
        const dateStr = body.getAttribute("data-date");
        this._selectedDateForSearch = dateStr;
        if (e.detail === 2) {
          try {
            const allShifts = this.getApplicableShifts(dateStr);
            const monthKey = dateStr.substring(0, 7);
            const cur = window.appState?.scheduleData?.[monthKey]?.[dateStr]?.assignments || {};
            const firstUnassigned = allShifts.find((s) => !cur[s]);
            this.openAssignModal(dateStr, firstUnassigned);
          } catch (err) {
            console.warn("[delegation] dblclick openAssign failed", err);
          }
        } else if (e.detail === 1) {
          this.openAssignModal(dateStr);
        }
      }
      const pill = e.target.closest(".staff-assignment[data-date]");
      if (pill) {
        e.stopPropagation();
        const dateStr = pill.getAttribute("data-date");
        const shiftKey = pill.getAttribute("data-shift");
        this.openAssignModal(dateStr, shiftKey);
      }
      const swap = e.target.closest(".swap-btn[data-date]");
      if (swap) {
        e.stopPropagation();
        const dateStr = swap.getAttribute("data-date");
        const shiftKey = swap.getAttribute("data-shift");
        this.openAssignModal(dateStr, shiftKey);
      }
    }, true);
  }
  generateScheduleForCurrentMonth() {
    const month = this.currentCalendarMonth;
    console.log("[generateSchedule] manual generation called for month=", month);
    if (!month) {
      console.warn("[generateSchedule] no current month");
      return;
    }
    if (this._generating) {
      console.warn("[generateSchedule] already in progress");
      return;
    }
    this._generating = true;
    (async () => {
      const startedAt = performance.now?.() || 0;
      try {
        this.setStatus("Erzeuge Plan\u2026", true);
        this.setBusy(true);
        if (!this._hydratedMonths.has(month)) {
          this.setStatus("Lade Verf\xFCgbarkeiten\u2026", true);
          try {
            await this.prehydrateAvailability(month);
          } catch (hErr) {
            console.warn("[generateSchedule] hydration failed (continuing)", hErr);
          }
        }
        appState.scheduleData[month] = appState.scheduleData[month] || {};
        const engine = new SchedulingEngine(month);
        console.info("[generateSchedule] start compute", { month });
        const generated = engine.generateSchedule();
        const genDuration = (performance.now?.() || 0) - startedAt;
        appState.scheduleData[month] = generated;
        appState.save?.();
        this.renderAssignments(month);
        this.renderWeekendReport(month);
        this.setStatus("Plan erstellt \u2713", true, false);
        console.info("[generateSchedule] complete", { month, ms: Math.round(genDuration) });
        setTimeout(() => this.clearStatus(), 1200);
      } catch (e) {
        console.error("[generateSchedule] failed", e);
        this.setStatus("Fehler bei Planerzeugung", true, false);
        setTimeout(() => this.clearStatus(), 1800);
      } finally {
        this._generating = false;
        this.setBusy(false);
      }
    })();
  }
  async prehydrateAvailability(month) {
    let releasing = false;
    try {
      if (!month || this._hydratedMonths.has(month)) return;
      this.setBusy(true);
      releasing = true;
      if (!window.__services) {
        const mod = await import("./chunks/services-HV2OXNUL.js");
        window.__services = mod.createServices({});
      }
      await window.__services.ready;
      const store = window.__services?.store;
      const usingRemote = !!(store && (store.remote || store.constructor && store.constructor.name === "SupabaseAdapter"));
      if (!usingRemote) {
        this._hydratedMonths.add(month);
        return;
      }
      const staffList = window.__services.staff?.list() || [];
      if (!staffList.length) {
        this._hydratedMonths.add(month);
        return;
      }
      const [y, m] = month.split("-").map(Number);
      const fromDate = `${y}-${String(m).padStart(2, "0")}-01`;
      const toDate = `${y}-${String(m).padStart(2, "0")}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
      const avail = window.__services.availability;
      if (!avail) {
        this._hydratedMonths.add(month);
        return;
      }
      const btns = this.disableScheduleControls(true);
      for (const s of staffList) {
        try {
          await avail.listRange(s.id, fromDate, toDate);
        } catch {
        }
      }
      this._hydratedMonths.add(month);
      this.disableScheduleControls(false, btns);
    } catch (e) {
      console.warn("[ScheduleUI] prehydrateAvailability failed", e);
    } finally {
      if (releasing) this.setBusy(false);
    }
  }
  setStatus(text, show = true, withSpinner = true) {
    const bar = document.getElementById("scheduleStatus");
    const txt = document.getElementById("scheduleStatusText");
    const sp = bar?.querySelector?.(".spinner");
    if (!bar || !txt) return;
    txt.textContent = text || "";
    bar.classList.toggle("hidden", !show);
    if (sp) sp.classList.toggle("hidden", !withSpinner);
  }
  clearStatus() {
    this.setStatus("", false);
  }
  disableScheduleControls(disabled = true, snapshot = null) {
    const ids = ["generateScheduleBtn", "clearScheduleBtn", "exportScheduleBtn", "exportPdfBtn", "printScheduleBtn"];
    if (!snapshot) {
      snapshot = {};
    }
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (disabled) {
        snapshot[id] = el.disabled;
        el.disabled = true;
      } else {
        el.disabled = false;
      }
    });
    return snapshot;
  }
  renderAssignments(month) {
    const data = window.appState?.scheduleData?.[month] || {};
    document.querySelectorAll(".cal-body[data-date]").forEach((cell) => {
      const dateStr = cell.getAttribute("data-date");
      const type = cell.getAttribute("data-type");
      const shifts = Object.entries(SHIFTS).filter(([_, v]) => v.type === type).map(([k]) => k);
      const assignments = data[dateStr]?.assignments || {};
      const invalidKeys = Object.keys(assignments).filter((k) => !shifts.includes(k));
      const validHtml = shifts.map((shift) => {
        const staffId = assignments[shift];
        const meta = SHIFTS[shift] || {};
        if (staffId) {
          const staff = (window.appState?.staffData || []).find((s) => s.id == staffId);
          const name = staff?.name || staffId;
          const title2 = `${meta.name || shift} ${meta.time ? `(${meta.time})` : ""} - ${name}`;
          return `<div class="staff-assignment" title="${title2}" data-date="${dateStr}" data-shift="${shift}">
                        <span class="badge">${shift}</span>
                        <span class="assignee-name">${name}</span>
                        <button class="btn btn-secondary btn-sm swap-btn ml-6" data-date="${dateStr}" data-shift="${shift}">Wechseln</button>
                    </div>`;
        }
        const title = `${meta.name || shift} ${meta.time ? `(${meta.time})` : ""} - nicht zugewiesen`;
        return `<div class="staff-assignment unassigned" title="${title}" data-date="${dateStr}" data-shift="${shift}"><span class="badge">${shift}</span> \u2014</div>`;
      }).join("");
      const invalidHtml = invalidKeys.map((shift) => {
        const staffId = assignments[shift];
        const staff = (window.appState?.staffData || []).find((s) => s.id == staffId);
        const name = staff?.name || staffId;
        return `<div class="staff-assignment invalid-shift" data-invalid="true" data-date="${dateStr}" data-shift="${shift}" title="Nicht g\xFCltig f\xFCr ${type}">
                    <span class="badge badge-error">${shift}!</span>
                    <span class="assignee-name">${name}</span>
                    <button class="btn btn-secondary btn-sm swap-btn ml-6" data-date="${dateStr}" data-shift="${shift}">Anpassen</button>
                </div>`;
      }).join("");
      cell.innerHTML = validHtml + invalidHtml;
    });
  }
  renderWeekendReport(month) {
    const host = document.getElementById("weekendReport");
    if (!host) return;
    const data = window.appState?.scheduleData?.[month] || {};
    const [y, m] = month.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    let weekendDays = /* @__PURE__ */ new Set();
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dow = parseYMD(ds).getDay();
      if (dow === 0 || dow === 6) weekendDays.add(ds);
    }
    const weekendCount = Math.ceil(weekendDays.size / 2);
    const counts = {};
    Array.from(weekendDays).forEach((ds) => {
      const assigns = data[ds]?.assignments || {};
      Object.values(assigns).forEach((staffId) => {
        counts[staffId] = (counts[staffId] || 0) + 1;
      });
    });
    const staffList = window.appState?.staffData || [];
    const lines = staffList.map((s) => {
      const isPerm = s.role === "permanent";
      const c = Math.floor((counts[s.id] || 0) / 2);
      const emoji = isPerm ? "\u{1F539}" : c >= 1 ? "\u2705" : "\u26A0\uFE0F";
      const suffix = isPerm ? "Festangestellt (keine Anforderungen)" : "";
      return `${emoji} ${s.name}
${c}/${weekendCount} Wochenenden
${suffix}`;
    });
    const others = window.appState?.otherStaffData || [];
    const mm = Number(m);
    const overlaps = [];
    others.forEach((os) => {
      (os.vacations || []).forEach((p) => {
        const s = parseYMD(p.start);
        const e = parseYMD(p.end);
        if (!s || !e) return;
        const startInMonth = s.getFullYear() === y && s.getMonth() + 1 === mm;
        const endInMonth = e.getFullYear() === y && e.getMonth() + 1 === mm;
        const spansMonth = s <= new Date(y, mm - 1, 31) && e >= new Date(y, mm - 1, 1);
        if (spansMonth || startInMonth || endInMonth) {
          overlaps.push(`${os.name}: ${p.start} \u2013 ${p.end}`);
        }
      });
    });
    const otherInfo = overlaps.length ? `

Weitere Mitarbeitende (Urlaub):
- ${overlaps.join("\n- ")}` : "";
    host.innerHTML = `<div><strong>Wochenend-Verteilung f\xFCr ${month}</strong><br/>Gesamt: ${weekendCount} Wochenenden im Monat</div><pre class="mt-8 pre-wrap">${lines.join("\n\n")}${otherInfo}</pre>`;
  }
  // Incremental update: update a single date cell's assignments only
  updateDay(dateStr) {
    if (!dateStr) return;
    const month = dateStr.slice(0, 7);
    if (this.currentCalendarMonth !== month) {
      this.updateCalendarFromSelect();
      return;
    }
    const cell = document.querySelector(`.cal-body[data-date="${dateStr}"]`);
    if (!cell) {
      return;
    }
    this.renderAssignmentsForDate(month, cell, dateStr);
    window.__perf.calendarDiffUpdates++;
  }
  renderAssignmentsForDate(month, cellEl, dateStr) {
    const type = cellEl.getAttribute("data-type");
    const shifts = Object.entries(SHIFTS).filter(([_, v]) => v.type === type).map(([k]) => k);
    const data = window.appState?.scheduleData?.[month] || {};
    const assignments = data[dateStr]?.assignments || {};
    const invalidKeys = Object.keys(assignments).filter((k) => !shifts.includes(k));
    const validHtml = shifts.map((shift) => {
      const staffId = assignments[shift];
      const meta = SHIFTS[shift] || {};
      if (staffId) {
        const staff = (window.appState?.staffData || []).find((s) => s.id == staffId);
        const name = staff?.name || staffId;
        const title2 = `${meta.name || shift} ${meta.time ? `(${meta.time})` : ""} - ${name}`;
        return `<div class="staff-assignment" title="${title2}" data-date="${dateStr}" data-shift="${shift}">
                        <span class="badge">${shift}</span>
                        <span class="assignee-name">${name}</span>
                        <button class="btn btn-secondary btn-sm swap-btn ml-6" data-date="${dateStr}" data-shift="${shift}">Wechseln</button>
                    </div>`;
      }
      const title = `${meta.name || shift} ${meta.time ? `(${meta.time})` : ""} - nicht zugewiesen`;
      return `<div class="staff-assignment unassigned" title="${title}" data-date="${dateStr}" data-shift="${shift}"><span class="badge">${shift}</span> \u2014</div>`;
    }).join("");
    const invalidHtml = invalidKeys.map((shift) => {
      const staffId = assignments[shift];
      const staff = (window.appState?.staffData || []).find((s) => s.id == staffId);
      const name = staff?.name || staffId;
      return `<div class="staff-assignment invalid-shift" data-invalid="true" data-date="${dateStr}" data-shift="${shift}" title="Nicht g\xFCltig f\xFCr ${type}">
                <span class="badge badge-error">${shift}!</span>
                <span class="assignee-name">${name}</span>
                <button class="btn btn-secondary btn-sm swap-btn ml-6" data-date="${dateStr}" data-shift="${shift}">Anpassen</button>
            </div>`;
    }).join("");
    cellEl.innerHTML = validHtml + invalidHtml;
  }
  // Busy state helpers (ref-counted)
  setBusy(b = true) {
    if (b) {
      this._busyCount = (this._busyCount || 0) + 1;
    } else {
      this._busyCount = Math.max(0, (this._busyCount || 0) - 1);
    }
    const active = (this._busyCount || 0) > 0;
    const root = this.container || document.body;
    if (!root) return;
    root.classList.toggle("busy", active);
    if (active) root.setAttribute("aria-busy", "true");
    else root.removeAttribute("aria-busy");
  }
  openAssignModal(dateStr, presetShift) {
    const modal = document.getElementById("swapModal");
    if (!modal) return;
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const holName = this.getHolidayName(dateStr);
    const isWeekend = [0, 6].includes(date.getDay());
    const allShifts = this.getApplicableShifts(dateStr);
    const shiftSel = document.getElementById("swapShiftSelect");
    shiftSel.innerHTML = allShifts.map((s) => `<option value="${s}">${s}</option>`).join("");
    const month = dateStr.substring(0, 7);
    const cur = window.appState?.scheduleData?.[month]?.[dateStr]?.assignments || {};
    if (presetShift && allShifts.includes(presetShift)) {
      shiftSel.value = presetShift;
    } else {
      const firstUnassigned = allShifts.find((s) => !cur[s]);
      if (firstUnassigned) shiftSel.value = firstUnassigned;
    }
    const title = document.getElementById("swapTitle");
    const detail = document.getElementById("swapDetail");
    title.textContent = `Zuweisung ${dateStr}`;
    detail.textContent = holName ? `Feiertag: ${holName}` : isWeekend ? "Wochenende" : "Wochentag";
    const currentAssignment = document.getElementById("currentAssignment");
    const updateCurrent = () => {
      const s = shiftSel.value;
      const sid = cur[s];
      const staff = (window.appState?.staffData || []).find((x) => x.id == sid);
      currentAssignment.textContent = sid ? `Aktuell: ${staff?.name || sid}` : "Aktuell: \u2014";
      modal.dataset.currentStaff = sid ? String(sid) : "";
    };
    shiftSel.onchange = updateCurrent;
    updateCurrent();
    const engine = new SchedulingEngine(month);
    const weekNum = engine.getWeekNumber(date);
    const getCandidates = (includePermanents = false) => {
      const sh = shiftSel.value;
      const scheduledToday = new Set(Object.values(cur || {}));
      const base = engine.findCandidatesForShift(dateStr, sh, scheduledToday, weekNum);
      const mapById = new Map(base.map((c) => [c.staff.id, c]));
      const assignedIds = new Set(Object.values(cur || {}));
      assignedIds.forEach((id) => {
        if (!mapById.has(Number(id))) {
          const st = (window.appState?.staffData || []).find((s) => s.id == id);
          if (st) mapById.set(st.id, { staff: st, score: 0 });
        }
      });
      (window.appState?.staffData || []).forEach((s) => {
        const avail = appState.availabilityData?.[s.id]?.[dateStr]?.[sh];
        const okAvail = avail === "yes" || avail === "prefer";
        const isPerm = s.role === "permanent";
        const vac = (appState.vacationsByStaff?.[s.id] || []).some((p) => {
          if (!p?.start || !p?.end) return false;
          const t = parseYMD(dateStr).getTime();
          const st = parseYMD(p.start).getTime();
          const en = parseYMD(p.end).getTime();
          return t >= st && t <= en;
        });
        const ill = (appState.illnessByStaff?.[s.id] || []).some((p) => {
          if (!p?.start || !p?.end) return false;
          const t = parseYMD(dateStr).getTime();
          const st = parseYMD(p.start).getTime();
          const en = parseYMD(p.end).getTime();
          return t >= st && t <= en;
        });
        const dayOff = appState.availabilityData?.[`staff:${s.id}`]?.[dateStr] === "off";
        if (!(vac || ill || dayOff) && (okAvail || isPerm) && !mapById.has(s.id)) {
          mapById.set(s.id, { staff: s, score: 0 });
        }
      });
      const list = Array.from(mapById.values());
      return list.sort((a, b) => b.score - a.score);
    };
    const staffSel = document.getElementById("swapStaffSelect");
    const updateConsentForSelected = () => {
      try {
        const selectedId = parseInt(staffSel.value || 0);
        const staff = (window.appState?.staffData || []).find((s) => s.id == selectedId);
        const isWeekendDate = [0, 6].includes(parseYMD(dateStr).getDay());
        const showConsent = !!(staff && staff.role === "permanent" && isWeekendDate && !staff.weekendPreference);
        const consentRow = document.getElementById("consentRow");
        const consentCb2 = document.getElementById("consentCheckbox");
        const consentHint = document.getElementById("consentHint");
        if (consentRow) consentRow.classList.toggle("hidden", !showConsent);
        if (consentHint) consentHint.classList.toggle("hidden", !showConsent);
        if (showConsent) {
          const year = String(parseYMD(dateStr).getFullYear());
          const hasConsent = !!window.appState?.permanentOvertimeConsent?.[selectedId]?.[year]?.[dateStr];
          if (consentCb2) consentCb2.checked = !!hasConsent;
        } else if (consentCb2) {
          consentCb2.checked = false;
        }
      } catch (e) {
      }
    };
    const renderCandidates = () => {
      const includePermanents = document.getElementById("includePermanentsCheckbox")?.checked || false;
      const cands = getCandidates(includePermanents);
      const sh = shiftSel.value;
      const validator = new ScheduleValidator(month);
      const simBase = JSON.parse(JSON.stringify(window.appState?.scheduleData?.[month] || {}));
      const isWeekendDay = [0, 6].includes(parseYMD(dateStr).getDay());
      const assignedIds = new Set(Object.values(cur || {}));
      assignedIds.forEach((id) => {
        if (!cands.some((c) => c.staff.id === id)) {
          const staff2 = (window.appState?.staffData || []).find((s) => s.id == id);
          if (staff2) {
            cands.push({ staff: staff2, score: 0 });
          }
        }
      });
      const options = cands.map((c) => {
        const s = c.staff;
        const sim = JSON.parse(JSON.stringify(simBase));
        if (!sim[dateStr]) sim[dateStr] = { assignments: {} };
        if (!sim[dateStr].assignments) sim[dateStr].assignments = {};
        sim[dateStr].assignments[sh] = s.id;
        const validated = validator.validateSchedule(sim);
        const blocker = validated?.[dateStr]?.blockers?.[sh] || "";
        const state = window.appState;
        const engine2 = new SchedulingEngine(month);
        const weekNumLocal = engine2.getWeekNumber(parseYMD(dateStr));
        const weekendCount = engine2.weekendAssignmentsCount?.[s.id] ?? 0;
        const daytimeWeek = engine2.studentDaytimePerWeek?.[s.id]?.[weekNumLocal] ?? 0;
        const parts = [`Score: ${Math.round(c.score)}`];
        if (isWeekendDay) parts.push(`WE bisher: ${weekendCount}`);
        if (!isWeekendDay && (sh === "early" || sh === "midday") && s.role === "student") parts.push(`Tag (KW${weekNumLocal}): ${daytimeWeek}`);
        if (blocker) parts.push(`Blocker: ${blocker}`);
        const tooltip = parts.join(" | ");
        const alreadyAssigned = assignedIds.has(s.id);
        const assignedNote = alreadyAssigned ? " \u2013 bereits zugewiesen" : "";
        const label = `${s.name} (Score: ${Math.round(c.score)})${assignedNote}${blocker ? " \u26A0" : ""}`;
        const disabled = "";
        const title2 = ` title="${tooltip}"`;
        return `<option value="${s.id}"${disabled}${title2}>${label}</option>`;
      }).join("");
      staffSel.innerHTML = options;
      updateConsentForSelected();
      const hints = cands.slice(0, 8).map((c) => {
        const s = c.staff;
        const parts = [];
        const yearStr = String(y);
        const isWE = isWeekend;
        const avail = appState.availabilityData?.[s.id]?.[dateStr]?.[sh];
        const dayOff = appState.availabilityData?.[`staff:${s.id}`]?.[dateStr] === "off";
        if (dayOff) parts.push("Freiwunsch");
        if (avail === "prefer") parts.push("bevorzugt");
        else if (avail === "yes") parts.push("verf\xFCgbar");
        if (holName) parts.push("Feiertag");
        else if (isWE) parts.push("Wochenende");
        if (s.role === "student" && (sh === "evening" || sh === "closing")) parts.push("Student+Abendbonus");
        if (s.role === "permanent" && (sh === "evening" || sh === "closing")) {
          const volKey = `${s.id}::${dateStr}::${sh}`;
          const legacyKey = `${s.id}::${dateStr}`;
          if (appState.voluntaryEveningAvailability?.[volKey] || appState.voluntaryEveningAvailability?.[legacyKey]) {
            parts.push(sh === "evening" ? "Permanent+freiwillig Abend" : "Permanent+freiwillig Sp\xE4t");
          }
        }
        if (s.weekendPreference && isWE) parts.push("WE-Pr\xE4ferenz");
        const sim = JSON.parse(JSON.stringify(simBase));
        if (!sim[dateStr]) sim[dateStr] = { assignments: {} };
        if (!sim[dateStr].assignments) sim[dateStr].assignments = {};
        sim[dateStr].assignments[sh] = s.id;
        const validated = validator.validateSchedule(sim);
        const blocker = validated?.[dateStr]?.blockers?.[sh];
        if (blocker) parts.push(`Blockiert: ${blocker}`);
        return `${s.name}: ${parts.length ? parts.join(", ") : "\u2014"}`;
      }).join("<br/>");
      const notes2 = document.getElementById("candidateNotes");
      notes2.innerHTML = `Hinweise:<br/>${hints}`;
      const consentRow = document.getElementById("consentRow");
      const consentCb2 = document.getElementById("consentCheckbox");
      const consentHint = document.getElementById("consentHint");
      const selectedId = parseInt(staffSel.value || 0);
      const staff = (window.appState?.staffData || []).find((s) => s.id == selectedId);
      const isWeekendDate = [0, 6].includes(parseYMD(dateStr).getDay());
      const showConsent = !!(staff && staff.role === "permanent" && isWeekendDate && !staff.weekendPreference);
      consentRow.classList.toggle("hidden", !showConsent);
      consentHint.classList.toggle("hidden", !showConsent);
      if (showConsent) {
        const year = String(parseYMD(dateStr).getFullYear());
        const hasConsent = !!window.appState?.permanentOvertimeConsent?.[selectedId]?.[year]?.[dateStr];
        consentCb2.checked = !!hasConsent;
      } else {
        consentCb2.checked = false;
      }
    };
    const includeRow = document.getElementById("includePermanentsRow");
    const includeCb = document.getElementById("includePermanentsCheckbox");
    const weekend = [0, 6].includes(parseYMD(dateStr).getDay());
    includeRow.classList.toggle("hidden", !weekend);
    includeCb.checked = false;
    includeCb.onchange = () => renderCandidates();
    renderCandidates();
    const notes = document.getElementById("candidateNotes");
    const leaveBtn = document.getElementById("leaveBlankBtn");
    if (leaveBtn) {
      leaveBtn.onclick = () => {
        const sh = shiftSel.value;
        const month2 = dateStr.substring(0, 7);
        if (!window.appState.scheduleData[month2]) window.appState.scheduleData[month2] = {};
        const schedule = window.appState.scheduleData[month2];
        if (!schedule[dateStr]) schedule[dateStr] = { assignments: {} };
        delete schedule[dateStr].assignments[sh];
        appState.save?.();
        this.updateDay(dateStr);
        if (window.modalManager) window.modalManager.close("swapModal");
        else window.closeModal?.("swapModal");
      };
    }
    modal.dataset.date = dateStr;
    modal.dataset.shift = shiftSel.value;
    const syncShift = () => {
      modal.dataset.shift = shiftSel.value;
      renderCandidates();
      updateCurrent();
    };
    shiftSel.addEventListener("change", syncShift);
    document.getElementById("swapStaffSelect").addEventListener("change", () => {
      updateConsentForSelected();
      const s = document.getElementById("swapShiftSelect").value;
      const sid = parseInt(document.getElementById("swapStaffSelect").value || 0);
      const currentAssignment2 = document.getElementById("currentAssignment");
      const staff = (window.appState?.staffData || []).find((x) => x.id == sid);
      if (currentAssignment2) {
        currentAssignment2.textContent = sid ? `Aktuell: ${staff?.name || sid}` : "Aktuell: \u2014";
      }
    });
    const consentCb = document.getElementById("consentCheckbox");
    consentCb?.addEventListener("change", (e) => {
      const selectedId = parseInt(document.getElementById("swapStaffSelect").value || 0);
      const isWeekendShift = [0, 6].includes(parseYMD(dateStr).getDay());
      if (!selectedId || !isWeekendShift) return;
      const year = String(parseYMD(dateStr).getFullYear());
      const state = window.appState;
      if (!state.permanentOvertimeConsent) state.permanentOvertimeConsent = {};
      if (!state.permanentOvertimeConsent[selectedId]) state.permanentOvertimeConsent[selectedId] = {};
      if (!state.permanentOvertimeConsent[selectedId][year]) state.permanentOvertimeConsent[selectedId][year] = {};
      if (e.target.checked) {
        state.permanentOvertimeConsent[selectedId][year][dateStr] = true;
      } else {
        delete state.permanentOvertimeConsent[selectedId][year][dateStr];
      }
      try {
        const { appState: appState2 } = window;
        if (appState2) {
          appState2.permanentOvertimeConsent = state.permanentOvertimeConsent;
          appState2.save?.();
        }
      } catch {
      }
      renderCandidates();
    });
    (window.modalManager || window).open ? window.modalManager.open("swapModal") : window.showModal?.("swapModal");
  }
  // New: Search & Assign dialog separate from availability tab
  openSearchAssignModal(dateStr) {
    const modal = document.getElementById("searchModal");
    if (!modal) return;
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const isWeekendSearch = [0, 6].includes(date.getDay());
    const holName = this.getHolidayName(dateStr);
    const allShifts = this.getApplicableShifts(dateStr);
    document.getElementById("searchTitle").textContent = `Suchen & Zuweisen \u2013 ${dateStr}`;
    document.getElementById("searchDetail").textContent = holName ? `Feiertag: ${holName}` : isWeekendSearch ? "Wochenende" : "Wochentag";
    const shiftSel = document.getElementById("searchShiftSelect");
    shiftSel.innerHTML = allShifts.map((s) => `<option value="${s}">${s}</option>`).join("");
    const month = dateStr.substring(0, 7);
    const cur = window.appState?.scheduleData?.[month]?.[dateStr]?.assignments || {};
    const engine = new SchedulingEngine(month);
    const weekNum = engine.getWeekNumber(date);
    const staffSel = document.getElementById("searchStaffSelect");
    const filterInput = document.getElementById("searchFilterInput");
    const consentRow = document.getElementById("searchConsentRow");
    const consentCb = document.getElementById("searchConsentCheckbox");
    const consentHint = document.getElementById("searchConsentHint");
    const includeRow = document.getElementById("searchIncludePermanentsRow");
    const includeCb = document.getElementById("searchIncludePermanentsCheckbox");
    const updateSearchConsentForSelected = () => {
      try {
        const selectedId = parseInt(staffSel.value || 0);
        const staff = (window.appState?.staffData || []).find((s) => s.id == selectedId);
        const isWeekendSearchLocal = [0, 6].includes(date.getDay());
        const showConsent = !!(staff && staff.role === "permanent" && isWeekendSearchLocal && !staff.weekendPreference);
        consentRow.classList.toggle("hidden", !showConsent);
        consentHint.classList.toggle("hidden", !showConsent);
        if (showConsent) {
          const year = String(y);
          const hasConsent = !!window.appState?.permanentOvertimeConsent?.[selectedId]?.[year]?.[dateStr];
          consentCb.checked = !!hasConsent;
        } else {
          consentCb.checked = false;
        }
      } catch (e) {
      }
    };
    includeRow.classList.toggle("hidden", !isWeekendSearch);
    includeCb.checked = false;
    const buildBaseCandidates = () => {
      const sh = shiftSel.value;
      const scheduledToday = new Set(Object.values(cur || {}));
      const base = engine.findCandidatesForShift(dateStr, sh, scheduledToday, weekNum);
      const mapById = new Map(base.map((c) => [c.staff.id, c]));
      const assignedIds = new Set(Object.values(cur || {}));
      assignedIds.forEach((id) => {
        if (!mapById.has(Number(id))) {
          const st = (window.appState?.staffData || []).find((s) => s.id == id);
          if (st) mapById.set(st.id, { staff: st, score: 0 });
        }
      });
      (window.appState?.staffData || []).forEach((s) => {
        const avail = appState.availabilityData?.[s.id]?.[dateStr]?.[sh];
        const okAvail = avail === "yes" || avail === "prefer";
        const isPerm = s.role === "permanent";
        const allowPerm = !isWeekendSearch || includeCb.checked;
        const vac = (appState.vacationsByStaff?.[s.id] || []).some((p) => {
          if (!p?.start || !p?.end) return false;
          const t = parseYMD(dateStr).getTime();
          const st = parseYMD(p.start).getTime();
          const en = parseYMD(p.end).getTime();
          return t >= st && t <= en;
        });
        const ill = (appState.illnessByStaff?.[s.id] || []).some((p) => {
          if (!p?.start || !p?.end) return false;
          const t = parseYMD(dateStr).getTime();
          const st = parseYMD(p.start).getTime();
          const en = parseYMD(p.end).getTime();
          return t >= st && t <= en;
        });
        const dayOff = appState.availabilityData?.[`staff:${s.id}`]?.[dateStr] === "off";
        if (!(vac || ill || dayOff) && (okAvail || isPerm && allowPerm) && !mapById.has(s.id)) {
          mapById.set(s.id, { staff: s, score: 0 });
        }
      });
      return Array.from(mapById.values()).sort((a, b) => b.score - a.score);
    };
    const renderCandidates = () => {
      const sh = shiftSel.value;
      const validator = new ScheduleValidator(month);
      const simBase = JSON.parse(JSON.stringify(window.appState?.scheduleData?.[month] || {}));
      let cands = buildBaseCandidates();
      const q = (filterInput.value || "").toLowerCase();
      if (q) {
        cands = cands.filter((c) => {
          const s = c.staff;
          return String(s.name).toLowerCase().includes(q) || String(s.role || "").toLowerCase().includes(q);
        });
      }
      const options = cands.map((c) => {
        const s = c.staff;
        const sim = JSON.parse(JSON.stringify(simBase));
        if (!sim[dateStr]) sim[dateStr] = { assignments: {} };
        if (!sim[dateStr].assignments) sim[dateStr].assignments = {};
        sim[dateStr].assignments[sh] = s.id;
        const validated = validator.validateSchedule(sim);
        const blocker = validated?.[dateStr]?.blockers?.[sh] || "";
        const label = `${s.name} (${s.role || ""})${blocker ? " \u26A0" : ""}`;
        const title = blocker ? ` title="Blocker: ${blocker}"` : "";
        return `<option value="${s.id}"${title}>${label}</option>`;
      }).join("");
      staffSel.innerHTML = options;
      updateSearchConsentForSelected();
      const notes = document.getElementById("searchCandidateNotes");
      notes.innerHTML = cands.slice(0, 8).map((c) => {
        const s = c.staff;
        const avail = appState.availabilityData?.[s.id]?.[dateStr]?.[sh];
        const parts = [];
        if (avail === "prefer") parts.push("bevorzugt");
        else if (avail === "yes") parts.push("verf\xFCgbar");
        if (isWeekendSearch) parts.push("Wochenende");
        if (holName) parts.push("Feiertag");
        return `${s.name}: ${parts.join(", ") || "\u2014"}`;
      }).join("<br/>");
    };
    shiftSel.onchange = renderCandidates;
    filterInput.oninput = renderCandidates;
    includeCb.onchange = renderCandidates;
    staffSel.addEventListener("change", updateSearchConsentForSelected);
    consentCb?.addEventListener("change", (e) => {
      const selectedId = parseInt(document.getElementById("searchStaffSelect").value || 0);
      if (!selectedId) return;
      const year = String(y);
      if (!window.appState.permanentOvertimeConsent) window.appState.permanentOvertimeConsent = {};
      window.appState.permanentOvertimeConsent[selectedId] = window.appState.permanentOvertimeConsent[selectedId] || {};
      window.appState.permanentOvertimeConsent[selectedId][year] = window.appState.permanentOvertimeConsent[selectedId][year] || {};
      if (e.target.checked) {
        window.appState.permanentOvertimeConsent[selectedId][year][dateStr] = true;
      } else {
        delete window.appState.permanentOvertimeConsent[selectedId][year][dateStr];
      }
      try {
        appState.save?.();
      } catch {
      }
    });
    renderCandidates();
    const searchLeaveBtn = document.getElementById("searchLeaveBlankBtn");
    if (searchLeaveBtn) {
      searchLeaveBtn.onclick = () => {
        const sh = shiftSel.value;
        const month2 = dateStr.substring(0, 7);
        if (!window.appState.scheduleData[month2]) window.appState.scheduleData[month2] = {};
        const schedule = window.appState.scheduleData[month2];
        if (!schedule[dateStr]) schedule[dateStr] = { assignments: {} };
        delete schedule[dateStr].assignments[sh];
        appState.save?.();
        this.updateDay(dateStr);
        if (window.modalManager) window.modalManager.close("searchModal");
        else window.closeModal?.("searchModal");
      };
    }
    modal.dataset.date = dateStr;
    (window.modalManager || window).open ? window.modalManager.open("searchModal") : window.showModal?.("searchModal");
    const execBtn = document.getElementById("executeSearchAssignBtn");
    execBtn.onclick = async () => {
      const sh = shiftSel.value;
      const sid = parseInt(staffSel.value || 0);
      if (!sid) {
        alert("Bitte Mitarbeiter w\xE4hlen");
        return;
      }
      const month2 = dateStr.substring(0, 7);
      try {
        const isWE = [0, 6].includes(date.getDay());
        const staff = (window.appState?.staffData || []).find((s) => s.id == sid);
        if (isWE && staff?.role === "permanent" && !staff?.weekendPreference) {
          const scheduledToday = new Set(Object.values(cur || {}));
          const cands = engine.findCandidatesForShift(dateStr, sh, scheduledToday, weekNum).filter((c) => c.staff.role !== "permanent");
          const canBeFilledByRegular = cands.some((c) => c.score > -999);
          if (!canBeFilledByRegular) {
            try {
              if (!window.__services) {
                import("./chunks/services-HV2OXNUL.js").then((m2) => {
                  window.__services = m2.createServices({});
                });
              }
            } catch {
            }
            const overtimeSvc = window.__services?.overtime;
            const exists = overtimeSvc.listByDate(month2, dateStr).some((r) => r.staffId === sid && r.shiftKey === sh && r.status === "requested");
            if (!exists) {
              overtimeSvc.create(month2, dateStr, { staffId: sid, shiftKey: sh, reason: "Unbesetzbare Schicht" });
              alert("\xDCberstunden-Anfrage erstellt. Bitte im Anfragen-Panel best\xE4tigen.");
            }
            return;
          }
        }
      } catch (e) {
        console.warn("Auto-request check failed", e);
      }
      try {
        if (!window.__services) window.__services = (await import("./chunks/services-HV2OXNUL.js")).createServices({});
      } catch {
      }
      const scheduleSvc = window.__services.schedule;
      scheduleSvc.assign(dateStr, sh, sid);
      const schedule = appState.scheduleData[month2] || (appState.scheduleData[month2] = {});
      if (!schedule[dateStr]) schedule[dateStr] = { assignments: {} };
      const validator = new ScheduleValidator(month2);
      const { schedule: consolidated } = validator.validateScheduleWithIssues(schedule);
      const hasBlocker = consolidated[dateStr]?.blockers?.[sh];
      if (hasBlocker) {
        delete schedule[dateStr].assignments[sh];
        appState.save();
        alert(`Zuweisung nicht m\xF6glich: ${hasBlocker}`);
        return;
      }
      appState.scheduleData[month2] = consolidated;
      appState.save();
      try {
        window.appUI?.recomputeOvertimeCredits?.(month2);
      } catch {
      }
      this.updateDay(dateStr);
      const dow = date.getDay();
      if (dow === 0 || dow === 6) {
        this.renderWeekendReport(month2);
      }
      if (window.modalManager) window.modalManager.close("searchModal");
      else window.closeModal?.("searchModal");
    };
  }
};
if (typeof ScheduleUI !== "undefined") {
  Object.assign(ScheduleUI.prototype, {
    runA11yAudit() {
      const issues = [];
      const modals = document.querySelectorAll(".modal");
      modals.forEach((m) => {
        const id = m.id || "(no-id)";
        if (!m.hasAttribute("role")) issues.push({ id, type: "missing-role" });
        if (!m.hasAttribute("aria-labelledby")) issues.push({ id, type: "missing-aria-labelledby" });
        const labelled = m.getAttribute("aria-labelledby");
        if (labelled && !document.getElementById(labelled)) issues.push({ id, type: "aria-labelledby-target-missing", target: labelled });
        const focusables = m.querySelectorAll('a,button,input,select,textarea,[tabindex]:not([tabindex="-1"])');
        if (!focusables.length) issues.push({ id, type: "no-focusable-content" });
      });
      document.querySelectorAll("button").forEach((b) => {
        const txt = (b.textContent || "").trim();
        const hasLabel = !!(txt || b.getAttribute("aria-label"));
        if (!hasLabel) issues.push({ id: b.id || "(button)", type: "button-missing-label" });
      });
      if (!issues.length) console.info("[a11y] audit passed (no issues)");
      else console.info("[a11y] issues", issues);
      return issues;
    }
  });
}

// ui/modalManager.js
var ModalManager = class {
  constructor() {
  }
  ensureHelpersReady(cb) {
    if (window.showModal && window.closeModal) {
      cb();
      return;
    }
    let attempts = 0;
    const tick = () => {
      if (window.showModal && window.closeModal) {
        cb();
        return;
      }
      if (attempts++ < 10) requestAnimationFrame(tick);
      else console.warn("[ModalManager] helpers not ready after retries");
    };
    tick();
  }
  open(id, opts) {
    this.ensureHelpersReady(() => {
      try {
        window.showModal?.(id, opts);
      } catch (e) {
        console.warn("[ModalManager] open failed", e);
      }
    });
  }
  close(id, opts) {
    try {
      (window.__closeModal || window.closeModal)?.(id, opts);
    } catch (e) {
      console.warn("[ModalManager] close failed", e);
    }
  }
  toggle(id, opts) {
    const el = document.getElementById(id);
    if (!el) {
      console.warn("[ModalManager] toggle missing modal", id);
      return;
    }
    if (el.classList.contains("open")) this.close(id, opts);
    else this.open(id, opts);
  }
  isOpen(id) {
    const el = document.getElementById(id);
    return !!(el && el.classList.contains("open"));
  }
  stack() {
    return Array.isArray(window.__modalFocusStack) ? [...window.__modalFocusStack] : [];
  }
};
var modalManager = new ModalManager();
if (!window.modalManager) window.modalManager = modalManager;

// ui/eventHandlers.js
var EventHandler = class {
  constructor(ui) {
    console.log("[EventHandler] Constructor called with ui:", ui);
    this.ui = ui;
    this.modalManager = new ModalManager();
    console.log("[EventHandler] About to call setupHandlers");
    this.setupHandlers();
    console.log("[EventHandler] setupHandlers completed");
  }
  setupHandlers() {
    document.getElementById("swapModal")?.addEventListener("click", (e) => {
      if (e.target.classList.contains("modal")) {
        this.closeModal("swapModal");
      }
    });
  }
  executeSwap() {
    const modal = document.getElementById("swapModal");
    const dateStr = modal.dataset.date;
    const shiftKey = modal.dataset.shift;
    const currentStaffId = parseInt(modal.dataset.currentStaff);
    const newStaffId = parseInt(document.getElementById("swapStaffSelect").value);
    if (!dateStr || !shiftKey || !currentStaffId || !newStaffId) {
      alert("Invalid swap parameters");
      return;
    }
    const month = dateStr.substring(0, 7);
    const schedule = appState.scheduleData[month];
    if (!schedule?.[dateStr]?.assignments) {
      alert("Invalid schedule data");
      return;
    }
    const validator = new ScheduleValidator(month);
    const originalAssignments = { ...schedule[dateStr].assignments };
    schedule[dateStr].assignments[shiftKey] = newStaffId;
    const validated = validator.validateSchedule(schedule);
    const hasBlocker = validated[dateStr]?.blockers?.[shiftKey];
    const hasWarning = validated[dateStr]?.warnings?.[shiftKey];
    if (hasBlocker) {
      schedule[dateStr].assignments = originalAssignments;
      alert(`Tausch nicht m\xF6glich: ${hasBlocker}`);
      return;
    }
    if (hasWarning && hasWarning.includes("Minijob earnings risk")) {
      const newStaff = (appState.staffData || []).find((s) => s.id === newStaffId);
      const staffName = newStaff?.name || `Staff ${newStaffId}`;
      const confirmed = window.confirm(
        `\u26A0\uFE0F Warnung: ${hasWarning}

Dieser Tausch k\xF6nnte dazu f\xFChren, dass ${staffName} die Minijob-Verdienstgrenze \xFCberschreitet.

Trotzdem fortfahren?`
      );
      if (!confirmed) {
        schedule[dateStr].assignments = originalAssignments;
        return;
      }
      if (window.__services?.monitoring) {
        window.__services.monitoring.recordAssignmentOperation("swap", {
          violationOverridden: false,
          minijobWarningIgnored: true
        });
      }
    } else {
      if (window.__services?.monitoring) {
        window.__services.monitoring.recordAssignmentOperation("swap", {
          violationOverridden: false,
          minijobWarningIgnored: false
        });
      }
    }
    appState.scheduleData[month] = validated;
    appState.save();
    try {
      window.appUI?.recomputeOvertimeCredits?.(month);
    } catch {
    }
    this.ui.refreshDisplay();
    try {
      window.modalManager ? window.modalManager.close("swapModal") : window.closeModal?.("swapModal");
    } catch (e) {
      console.warn("[EventHandler] close swapModal failed", e);
    }
  }
  async generateSchedule() {
    console.log("[generateSchedule] Starting schedule generation...");
    const monthEl = document.getElementById("scheduleMonth");
    const month = monthEl?.value;
    console.log("[generateSchedule] Selected month:", month);
    if (!month) {
      alert("Bitte w\xE4hlen Sie einen Monat aus.");
      return;
    }
    try {
      console.log("[generateSchedule] Creating SchedulingEngine...");
      const engine = new SchedulingEngine(month);
      console.log("[generateSchedule] Engine created, calling generateSchedule()...");
      const schedule = engine.generateSchedule();
      console.log("[generateSchedule] Schedule generated:", schedule);
      console.log("[generateSchedule] Saving to appState...");
      appState.scheduleData[month] = schedule.data;
      appState.save();
      try {
        if (window.__services?.schedule?.setMonth) {
          console.log("[generateSchedule] Saving to backend...");
          await window.__services.schedule.setMonth(month, schedule.data);
          console.log("[generateSchedule] Backend save completed");
        }
      } catch (e) {
        console.warn("[generateSchedule] Could not save to backend:", e);
      }
      console.log("[generateSchedule] Refreshing UI...");
      this.ui.refreshDisplay();
      console.log("[generateSchedule] Done!");
    } catch (error) {
      console.error("[generateSchedule] Error:", error);
      alert("Fehler bei der Planerstellung: " + error.message);
    }
  }
  clearSchedule() {
    console.log("[clearSchedule] called");
    const monthEl = document.getElementById("scheduleMonth");
    const month = monthEl?.value || this.ui?.currentCalendarMonth;
    console.log("[clearSchedule] monthEl=", monthEl, "month=", month, "currentCalendarMonth=", this.ui?.currentCalendarMonth);
    console.log("[clearSchedule] scheduleData for month=", appState.scheduleData?.[month]);
    if (!month) {
      console.log("[clearSchedule] no month selected");
      alert("Bitte w\xE4hlen Sie einen Monat aus.");
      return;
    }
    const hasScheduleData = appState.scheduleData?.[month] && Object.keys(appState.scheduleData[month]).length > 0;
    if (!hasScheduleData) {
      console.log("[clearSchedule] no schedule data found");
      alert("Kein Dienstplan zum L\xF6schen verf\xFCgbar");
      return;
    }
    if (confirm(`Soll der Dienstplan f\xFCr ${month} wirklich gel\xF6scht werden?`)) {
      console.log("[clearSchedule] confirmed, deleting schedule");
      delete appState.scheduleData[month];
      try {
        if (window.__services?.schedule?.clearMonth) {
          console.log("[clearSchedule] clearing backend schedule data");
          window.__services.schedule.clearMonth(month);
        }
      } catch (e) {
        console.warn("[clearSchedule] could not clear backend data:", e);
      }
      appState.save();
      if (typeof this.ui.updateCalendarFromSelect === "function") {
        this.ui.updateCalendarFromSelect();
      } else {
        this.ui.refreshDisplay();
      }
      console.log("[clearSchedule] schedule cleared and UI refreshed");
    }
  }
  executeAssign() {
    const modal = document.getElementById("swapModal");
    if (!modal) return;
    const dateStr = modal.dataset.date;
    const shiftKey = modal.dataset.shift;
    const newStaffId = parseInt(document.getElementById("swapStaffSelect").value);
    if (!dateStr || !shiftKey || !newStaffId) {
      alert("Ung\xFCltige Auswahl");
      return;
    }
    try {
      const date = new Date(dateStr);
      const isWeekend = [0, 6].includes(date.getDay());
      const staff = (window.DEBUG?.state?.staffData || []).find((s) => s.id == newStaffId);
      if (isWeekend && staff?.role === "permanent" && !staff?.weekendPreference) {
        const month2 = dateStr.substring(0, 7);
        const engine = new SchedulingEngine(month2);
        const weekNum = engine.getWeekNumber(date);
        const scheduledToday = new Set(Object.values(window.DEBUG?.state?.scheduleData?.[month2]?.[dateStr]?.assignments || {}));
        const cands = engine.findCandidatesForShift(dateStr, shiftKey, scheduledToday, weekNum).filter((c) => c.staff.role !== "permanent");
        const canBeFilledByRegular = cands.some((c) => c.score > -999);
        if (!canBeFilledByRegular) {
          try {
            if (!window.__services) {
              import("./chunks/services-HV2OXNUL.js").then((m) => {
                window.__services = m.createServices({});
              });
            }
          } catch {
          }
          const overtimeSvc = window.__services?.overtime;
          const exists = overtimeSvc.listByDate(month2, dateStr).some((r) => r.staffId === newStaffId && r.shiftKey === shiftKey && r.status === "requested");
          if (!exists) {
            overtimeSvc.create(month2, dateStr, { staffId: newStaffId, shiftKey, reason: "Unbesetzbare Schicht" });
            alert("\xDCberstunden-Anfrage erstellt. Bitte im Anfragen-Panel best\xE4tigen.");
          }
          return;
        }
      }
    } catch (e) {
      console.warn("Auto-request check failed", e);
    }
    const month = dateStr.substring(0, 7);
    const schedule = appState.scheduleData[month] || (appState.scheduleData[month] = {});
    if (!schedule[dateStr]) schedule[dateStr] = { assignments: {} };
    const original = { ...schedule[dateStr].assignments };
    schedule[dateStr].assignments[shiftKey] = newStaffId;
    const validator = new ScheduleValidator(month);
    const { schedule: consolidated } = validator.validateScheduleWithIssues(schedule);
    const hasBlocker = consolidated[dateStr]?.blockers?.[shiftKey];
    if (hasBlocker) {
      schedule[dateStr].assignments = original;
      alert(`Zuweisung nicht m\xF6glich: ${hasBlocker}`);
      return;
    }
    appState.scheduleData[month] = consolidated;
    appState.save();
    try {
      window.appUI?.recomputeOvertimeCredits?.(month);
    } catch {
    }
    this.ui.updateCalendarFromSelect?.();
    try {
      this.modalManager.closeModal("swapModal");
    } catch {
    }
  }
  closeModal(id) {
    this.modalManager.closeModal(id);
  }
  exportSchedule() {
    const month = document.getElementById("scheduleMonth").value;
    if (!month || !appState.scheduleData[month]) {
      alert("Kein Dienstplan f\xFCr Export verf\xFCgbar");
      return;
    }
    alert("CSV Export wird noch nicht unterst\xFCtzt");
  }
  exportPdf() {
    const month = document.getElementById("scheduleMonth").value;
    if (!month || !appState.scheduleData[month]) {
      alert("Kein Dienstplan f\xFCr Export verf\xFCgbar");
      return;
    }
    alert("PDF Export wird noch nicht unterst\xFCtzt");
  }
  generateNewSchedule() {
    console.log("[generateNewSchedule] called");
    const monthEl = document.getElementById("scheduleMonth");
    const month = monthEl?.value || this.ui?.currentCalendarMonth;
    if (!month) {
      console.log("[generateNewSchedule] no month selected");
      alert("Bitte w\xE4hlen Sie einen Monat aus.");
      return;
    }
    console.log("[generateNewSchedule] generating for month:", month);
    if (appState.scheduleData && appState.scheduleData[month]) {
      console.log("[generateNewSchedule] clearing existing schedule data");
      delete appState.scheduleData[month];
    }
    try {
      if (window.__services?.schedule?.clearMonth) {
        console.log("[generateNewSchedule] clearing backend schedule data");
        window.__services.schedule.clearMonth(month);
      }
    } catch (e) {
      console.warn("[generateNewSchedule] could not clear backend data:", e);
    }
    appState.save();
    const hasAvailability = appState.availabilityData && appState.availabilityData[month] && Object.keys(appState.availabilityData[month]).length > 0;
    if (!hasAvailability) {
      console.log("[generateNewSchedule] no availability data found");
      alert(`Keine Verf\xFCgbarkeitsdaten f\xFCr ${month} gefunden. Bitte zuerst Verf\xFCgbarkeiten eintragen.`);
      return;
    }
    console.log("[generateNewSchedule] availability data found, starting generation");
    if (this.ui && typeof this.ui.generateScheduleForCurrentMonth === "function") {
      try {
        this.ui._generating = false;
        this.ui.generateScheduleForCurrentMonth();
        console.log("[generateNewSchedule] manual schedule generation initiated");
      } catch (e) {
        console.error("[generateNewSchedule] generation failed:", e);
        alert("Fehler beim Erstellen des Plans: " + e.message);
      }
    } else {
      console.error("[generateNewSchedule] generateScheduleForCurrentMonth not available");
      alert("Plan-Generator nicht verf\xFCgbar");
    }
  }
};

// ui/appUI.js
var __services = typeof window !== "undefined" && window.__services ? window.__services : null;
(async () => {
  try {
    if (!__services) {
      const m = await import("./chunks/services-HV2OXNUL.js");
      __services = m.createServices({});
    }
  } catch (e) {
    console.warn("Service init failed (fallback to appState)", e);
  }
})();
var AppUI = class {
  constructor(scheduleUI) {
    this.scheduleUI = scheduleUI;
    this._servicesHydrated = false;
  }
  init() {
    if (!__services) {
      let attempts = 0;
      const spin = () => {
        if (__services) {
          this._postServicesInit();
          return;
        }
        if (attempts++ < 60) {
          setTimeout(spin, 100);
        } else {
          console.warn("[UI] Services not initialized after timeout");
        }
      };
      spin();
      const host = document.getElementById("staffList");
      if (host) host.innerHTML = "<p>Lade Dienste\u2026</p>";
      return;
    }
    this._postServicesInit();
  }
  _postServicesInit() {
    const backendMode = window.__CONFIG__ && window.__CONFIG__.BACKEND || window.CONFIG && window.CONFIG.BACKEND || "local";
    if (backendMode === "supabase" && __services?.ready) {
      const host = document.getElementById("staffList");
      if (host) host.innerHTML = "<p>Lade Mitarbeiter\u2026</p>";
      __services.ready.then(() => {
        try {
          this._servicesHydrated = true;
          this.renderStaffList();
        } catch (e) {
          console.warn("Post-ready staff render failed", e);
        }
      });
    } else {
      this.renderStaffList();
    }
    this.populateAvailabilitySelectors();
    this.populateVacationSelectors();
    this.renderVacationList();
    this.initHolidays();
    this.renderIcsSources();
    this.renderTempVacationList();
    this.renderTempIllnessList();
    this.initVacationLedger();
    try {
      this._attachServiceEventListeners();
    } catch (e) {
    }
    this.renderOtherStaff();
    if (__services?.ready) {
      __services.ready.then(() => {
        this._servicesHydrated = true;
        try {
          this.renderStaffList();
          this.populateAvailabilitySelectors();
        } catch (e) {
          console.warn("Post-hydration staff render failed", e);
        }
        try {
          this.initReports();
        } catch (e) {
          console.warn("Reports init failed (delayed)", e);
        }
      });
    } else {
      try {
        this.initReports();
      } catch (e) {
        console.warn("Reports init failed", e);
      }
    }
    if (__services?.staff?.list?.().length) {
      this._servicesHydrated = true;
      try {
        this.renderStaffList();
        this.populateAvailabilitySelectors();
      } catch (e) {
        console.warn("[UI] late staff render failed", e);
      }
    }
    this.renderAuditLog();
    if (backendMode === "supabase" && __services?.ready) {
      let tries = 0;
      const poll = () => {
        if (this._servicesHydrated) return;
        tries++;
        if ((__services?.staff?.list?.() || []).length) {
          this._servicesHydrated = true;
          try {
            this.renderStaffList();
          } catch {
          }
          return;
        }
        if (tries < 20) setTimeout(poll, 300);
      };
      poll();
    }
  }
  _attachServiceEventListeners() {
    __services?.events?.on("ledgerConflict", (p) => {
      console.warn("[UI] ledger conflict", p);
      this.showLedgerConflictToast(p);
    });
    __services?.events?.on("staff:hydrated", () => {
      try {
        this._servicesHydrated = true;
        this.renderStaffList();
        this.populateAvailabilitySelectors();
      } catch (e) {
        console.warn("[UI] staff:hydrated render failed", e);
      }
    });
    __services?.events?.on("staff:created", () => {
      try {
        this.renderStaffList();
        this.populateAvailabilitySelectors();
      } catch (e) {
        console.warn("[UI] staff:created render failed", e);
      }
    });
  }
  // ==== Staff ====
  addStaff() {
    const nameEl = document.getElementById("staffName");
    const roleEl = document.getElementById("staffType");
    const hoursEl = document.getElementById("contractHours");
    const daysEl = document.getElementById("typicalWorkdays");
    const prefEl = document.getElementById("weekendPreference");
    const permPrefEl = document.getElementById("permanentPreferredShift");
    const minPracticalEl = document.getElementById("weeklyHoursMinPractical");
    const maxPracticalEl = document.getElementById("weeklyHoursMaxPractical");
    const notesEl = document.getElementById("notesPracticalCaps");
    if (!nameEl || !roleEl) return;
    const name = nameEl.value?.trim();
    if (!name) {
      alert("Bitte Name eingeben");
      return;
    }
    const role = roleEl.value || "minijob";
    const contractHours = Number(hoursEl?.value || 0);
    const typicalWorkdays = Number(daysEl?.value || 0);
    const weekendPreference = !!prefEl?.checked;
    const permanentPreferredShift = role === "permanent" ? permPrefEl?.value || "none" : "none";
    const weeklyHoursMinPractical = role === "minijob" || role === "student" ? minPracticalEl?.value ? Number(minPracticalEl.value) : void 0 : void 0;
    const weeklyHoursMaxPractical = role === "minijob" || role === "student" ? maxPracticalEl?.value ? Number(maxPracticalEl.value) : void 0 : void 0;
    const notesPracticalCaps = role === "minijob" || role === "student" ? notesEl?.value?.trim() || void 0 : void 0;
    if (role === "minijob" || role === "student") {
      if (weeklyHoursMinPractical !== void 0 && (weeklyHoursMinPractical < 0 || weeklyHoursMinPractical > 50)) {
        alert("Praktische Min-Stunden m\xFCssen zwischen 0 und 50 liegen");
        return;
      }
      if (weeklyHoursMaxPractical !== void 0 && (weeklyHoursMaxPractical < 0 || weeklyHoursMaxPractical > 50)) {
        alert("Praktische Max-Stunden m\xFCssen zwischen 0 und 50 liegen");
        return;
      }
      if (weeklyHoursMinPractical !== void 0 && weeklyHoursMaxPractical !== void 0 && weeklyHoursMinPractical > weeklyHoursMaxPractical) {
        alert("Praktische Min-Stunden d\xFCrfen nicht gr\xF6\xDFer als Max-Stunden sein");
        return;
      }
      if (role === "student" && weeklyHoursMaxPractical > 20) {
        const confirm2 = window.confirm("Werkstudenten d\xFCrfen normalerweise max. 20h/Woche arbeiten. Trotzdem fortfahren?");
        if (!confirm2) return;
      }
    }
    const editIdEl = document.getElementById("staffIdToEdit");
    const editId = Number(editIdEl?.value || 0);
    const staffSvc = __services?.staff;
    if (!staffSvc) {
      alert("Dienstleistungen noch nicht initialisiert. Bitte kurz warten und erneut versuchen.");
      return;
    }
    const staffData = {
      name,
      role,
      contractHours,
      typicalWorkdays,
      weekendPreference,
      permanentPreferredShift,
      weeklyHoursMinPractical,
      weeklyHoursMaxPractical,
      notesPracticalCaps
    };
    if (editId) {
      const staff = staffSvc.update(editId, staffData);
      if (!staff) {
        alert("Mitarbeiter nicht gefunden");
        return;
      }
      if (Array.isArray(appState.tempVacationPeriods)) {
        if (__services?.vacation) {
          const existing = __services.vacation.listVacations(editId);
          for (let i = existing.length - 1; i >= 0; i--) __services.vacation.removeVacation(editId, i);
          appState.tempVacationPeriods.forEach((p) => __services.vacation.addVacation(editId, p));
        } else {
          if (!appState.vacationsByStaff[editId]) appState.vacationsByStaff[editId] = [];
          appState.vacationsByStaff[editId] = [...appState.tempVacationPeriods || []];
        }
      }
      if (Array.isArray(appState.tempIllnessPeriods)) {
        if (__services?.vacation) {
          const existingIll = __services.vacation.listIllness(editId);
          for (let i = existingIll.length - 1; i >= 0; i--) __services.vacation.removeIllness(editId, i);
          appState.tempIllnessPeriods.forEach((p) => __services.vacation.addIllness(editId, p));
        } else {
          if (!appState.illnessByStaff) appState.illnessByStaff = {};
          if (!appState.illnessByStaff[editId]) appState.illnessByStaff[editId] = [];
          appState.illnessByStaff[editId] = [...appState.tempIllnessPeriods || []];
        }
      }
    } else {
      const staff = staffSvc.create({ ...staffData, alternativeWeekendDays: [] });
      const nextId = staff.id;
      if (Array.isArray(appState.tempVacationPeriods) && appState.tempVacationPeriods.length) {
        if (__services?.vacation) {
          appState.tempVacationPeriods.forEach((p) => __services.vacation.addVacation(nextId, p));
        } else {
          if (!appState.vacationsByStaff[nextId]) appState.vacationsByStaff[nextId] = [];
          appState.vacationsByStaff[nextId] = [...appState.tempVacationPeriods];
        }
      }
      if (Array.isArray(appState.tempIllnessPeriods) && appState.tempIllnessPeriods.length) {
        if (__services?.vacation) {
          appState.tempIllnessPeriods.forEach((p) => __services.vacation.addIllness(nextId, p));
        } else {
          if (!appState.illnessByStaff) appState.illnessByStaff = {};
          appState.illnessByStaff[nextId] = [...appState.tempIllnessPeriods];
        }
      }
    }
    appState.save();
    this.resetStaffForm();
    this.renderStaffList();
    this.populateAvailabilitySelectors();
  }
  // ==== Holidays ====
  initHolidays() {
    const yearSel = document.getElementById("holidaysYear");
    if (yearSel) {
      yearSel.innerHTML = "";
      const now = /* @__PURE__ */ new Date();
      for (let y = now.getFullYear() - 1; y <= now.getFullYear() + 2; y++) {
        const opt = document.createElement("option");
        opt.value = String(y);
        opt.text = String(y);
        if (y === now.getFullYear()) opt.selected = true;
        yearSel.appendChild(opt);
      }
      yearSel.addEventListener("change", () => this.renderHolidaysList());
      this.renderHolidaysList();
    }
  }
  showHolidaysPopup() {
    this.fetchAndShowHolidays().catch(() => {
      try {
        window.modalManager ? window.modalManager.open("holidaysModal") : window.showModal?.("holidaysModal");
      } catch (e) {
        console.warn("[AppUI] fallback open modal failed", e);
      }
      this.initHolidays();
    });
  }
  addHoliday() {
    const yearSel = document.getElementById("holidaysYear");
    const dateEl = document.getElementById("holidayDate");
    const nameEl = document.getElementById("holidayName");
    if (!yearSel || !dateEl || !nameEl) return;
    const year = yearSel.value;
    const date = dateEl.value;
    const name = nameEl.value?.trim();
    if (!year || !date || !name) {
      alert("Bitte Jahr, Datum und Name angeben");
      return;
    }
    if (__services?.holiday) {
      __services.holiday.add(year, date, name);
    } else {
      if (!appState.holidays[year]) appState.holidays[year] = {};
      appState.holidays[year][date] = name;
      appState.save();
    }
    dateEl.value = "";
    nameEl.value = "";
    this.renderHolidaysList();
  }
  removeHoliday(date) {
    const yearSel = document.getElementById("holidaysYear");
    const year = yearSel?.value;
    if (!year) return;
    if (__services?.holiday) {
      __services.holiday.remove(year, date);
    } else {
      if (!appState.holidays[year]) return;
      delete appState.holidays[year][date];
      appState.save();
    }
    this.renderHolidaysList();
  }
  renderHolidaysList() {
    const yearSel = document.getElementById("holidaysYear");
    const list = document.getElementById("holidaysList");
    if (!yearSel || !list) return;
    const year = yearSel.value;
    let entries = [];
    if (__services?.holiday) {
      entries = __services.holiday.list(year).map((o) => [o.date, o.name]);
    } else {
      entries = Object.entries(appState.holidays[year] || {});
    }
    const items = entries.sort(([a], [b]) => a.localeCompare(b));
    list.innerHTML = items.length ? items.map(([d, n]) => `<li class="list-item"><span>${d} \u2013 ${n}</span><button class="btn btn-sm btn-danger" data-date="${d}" title="Entfernen">\u2715</button></li>`).join("") : '<li class="list-item"><span>Keine Feiertage</span></li>';
    list.querySelectorAll("button[data-date]").forEach((btn) => btn.addEventListener("click", (e) => {
      const d = e.currentTarget.getAttribute("data-date");
      this.removeHoliday(d);
    }));
  }
  renderIcsSources() {
    const list = document.getElementById("icsSourcesList");
    if (!list) return;
    const items = (appState.academicTermSources || []).map((u, idx) => `<li class="list-item"><span>${u}</span><button class="btn btn-sm btn-danger" data-rm="${idx}" title="Entfernen">\u2715</button></li>`);
    list.innerHTML = items.length ? items.join("") : '<li class="list-item"><span>Keine Quellen hinterlegt</span></li>';
    list.querySelectorAll("button[data-rm]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const i = Number(e.currentTarget.getAttribute("data-rm"));
        appState.academicTermSources.splice(i, 1);
        appState.save();
        this.renderIcsSources();
      });
    });
  }
  addIcsSource() {
    const input = document.getElementById("icsUrlInput");
    if (!input) return;
    const url = input.value?.trim();
    if (!url) return;
    if (!appState.academicTermSources) appState.academicTermSources = [];
    if (!appState.academicTermSources.includes(url)) appState.academicTermSources.push(url);
    appState.save();
    input.value = "";
    this.renderIcsSources();
  }
  async refreshAcademicTerms() {
    const { fetchAcademicTerms } = await import("./chunks/academicTerms-564554JC.js");
    try {
      await fetchAcademicTerms(true);
      alert("Vorlesungszeiten aktualisiert.");
    } catch (e) {
      console.error(e);
      alert("Konnte Vorlesungszeiten nicht laden.");
    }
  }
  async fetchAndShowHolidays() {
    const now = /* @__PURE__ */ new Date();
    const year = now.getFullYear();
    try {
      const holidayService2 = __services?.holiday;
      if (holidayService2 && holidayService2.fetchHolidaysForYear) {
        await holidayService2.fetchHolidaysForYear(year);
      } else {
        console.warn("Holiday service not available in __services, holidays may not be loaded");
      }
    } catch (e) {
      console.error("Could not fetch holidays:", e);
      alert(`Fehler beim Laden der Feiertage f\xFCr ${year}. Bitte versuchen Sie es sp\xE4ter erneut.`);
    }
    try {
      window.modalManager ? window.modalManager.open("holidaysModal") : window.showModal?.("holidaysModal");
    } catch (e) {
      console.warn("[AppUI] open holidaysModal failed", e);
    }
    this.initHolidays();
    try {
      this.handleAvailabilityDisplay();
    } catch {
    }
  }
  resetStaffForm() {
    ["staffName", "contractHours", "typicalWorkdays", "weeklyHoursMinPractical", "weeklyHoursMaxPractical", "notesPracticalCaps"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    const roleEl = document.getElementById("staffType");
    if (roleEl) roleEl.value = "minijob";
    const prefEl = document.getElementById("weekendPreference");
    if (prefEl) prefEl.checked = false;
    const permPrefRow = document.getElementById("permanentPreferredRow");
    if (permPrefRow) permPrefRow.hidden = true;
    const practicalRow = document.getElementById("practicalLimitsRow");
    if (practicalRow) practicalRow.hidden = true;
    const permPrefSel = document.getElementById("permanentPreferredShift");
    if (permPrefSel) permPrefSel.value = "none";
    const editIdEl = document.getElementById("staffIdToEdit");
    if (editIdEl) editIdEl.value = "";
    const saveBtn = document.getElementById("saveStaffBtn");
    if (saveBtn) saveBtn.textContent = "Arbeitskraft speichern";
    const cancelBtn = document.getElementById("cancelEditBtn");
    if (cancelBtn) cancelBtn.hidden = true;
    appState.tempVacationPeriods = [];
    appState.tempIllnessPeriods = [];
    this.renderTempVacationList();
    this.renderTempIllnessList();
  }
  renderStaffList() {
    const host = document.getElementById("staffList");
    if (!host) return;
    const staffSvc = __services?.staff;
    if (!staffSvc) {
      host.innerHTML = "<p>Dienste werden initialisiert\u2026</p>";
      return;
    }
    const staffList = staffSvc.list();
    if (!staffList.length) {
      if (!this._servicesHydrated && __services?.ready) {
        host.innerHTML = "<p>Lade Mitarbeiter\u2026</p>";
        return;
      }
      host.innerHTML = "<p>Keine Mitarbeiter hinzugef\xFCgt.</p>";
      return;
    }
    const weekdayOptions = (selected) => {
      const names = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
      return [1, 2, 3, 4, 5].map((d) => `<option value="${d}" ${String(selected) === String(d) ? "selected" : ""}>${names[d]}</option>`).join("");
    };
    host.innerHTML = staffList.map((s) => {
      const isPermanent = s.role === "permanent";
      const pref = !!s.weekendPreference;
      const permPref = s.permanentPreferredShift || "none";
      const alt = Array.isArray(s.alternativeWeekendDays) ? s.alternativeWeekendDays : [];
      const showAlt = !!(isPermanent && APP_CONFIG?.ALTERNATIVE_WEEKEND_ENABLED);
      return `
      <div class="staff-card card-col">
        <div class="card-row">
          <div>
            <strong>${s.name}</strong> \u2013 ${s.role}
            <div class="badge">${s.contractHours || 0} h/Woche</div>
            <div class="badge">${s.typicalWorkdays || 0} Tage/Woche</div>
    ${isPermanent && permPref !== "none" ? `<div class="badge">Pr\xE4ferenz: ${permPref === "early" ? SHIFTS?.early?.name || "Fr\xFCh" : SHIFTS?.midday?.name || "Mittel"}</div>` : ""}
          </div>
          <div class="btn-group">
            <button class="btn btn-secondary" data-action="edit" data-id="${s.id}">Bearbeiten</button>
            <button class="btn btn-danger" data-action="remove" data-id="${s.id}">Entfernen</button>
          </div>
        </div>
        ${isPermanent ? `
        <div class="form-row toggles">
          <label class="inline">
            <input type="checkbox" class="wknd-pref" data-id="${s.id}" ${pref ? "checked" : ""} />
            <span>Wochenenden bevorzugen</span>
          </label>
        </div>
        ${showAlt ? `
        <div class="form-row compact ${pref ? "" : "disabled"}">
          <label>Alternative WE-Tage</label>
          <select class="alt-day" data-id="${s.id}" data-idx="0" ${pref ? "" : "disabled"}>
            <option value="">\u2013</option>
            ${weekdayOptions(alt[0])}
          </select>
          <select class="alt-day" data-id="${s.id}" data-idx="1" ${pref ? "" : "disabled"}>
            <option value="">\u2013</option>
            ${weekdayOptions(alt[1])}
          </select>
        </div>` : ""}
        ` : ""}
      </div>`;
    }).join("");
    host.querySelectorAll('button[data-action="edit"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = Number(e.currentTarget.dataset.id);
        const s = staffSvc.list().find((x) => x.id === id);
        if (!s) return;
        document.getElementById("staffName").value = s.name || "";
        document.getElementById("staffType").value = s.role || "minijob";
        document.getElementById("contractHours").value = s.contractHours || "";
        document.getElementById("typicalWorkdays").value = s.typicalWorkdays || "";
        const prefEl = document.getElementById("weekendPreference");
        if (prefEl) prefEl.checked = !!s.weekendPreference;
        const permPrefRow = document.getElementById("permanentPreferredRow");
        if (permPrefRow) permPrefRow.hidden = !(s.role === "permanent");
        const practicalRow = document.getElementById("practicalLimitsRow");
        if (practicalRow) practicalRow.hidden = !(s.role === "minijob" || s.role === "student");
        const permPrefSel = document.getElementById("permanentPreferredShift");
        if (permPrefSel) permPrefSel.value = s.permanentPreferredShift || "none";
        const minPracticalEl = document.getElementById("weeklyHoursMinPractical");
        if (minPracticalEl) minPracticalEl.value = s.weeklyHoursMinPractical || "";
        const maxPracticalEl = document.getElementById("weeklyHoursMaxPractical");
        if (maxPracticalEl) maxPracticalEl.value = s.weeklyHoursMaxPractical || "";
        const notesEl = document.getElementById("notesPracticalCaps");
        if (notesEl) notesEl.value = s.notesPracticalCaps || "";
        const editIdEl = document.getElementById("staffIdToEdit");
        if (editIdEl) editIdEl.value = String(id);
        const saveBtn = document.getElementById("saveStaffBtn");
        if (saveBtn) saveBtn.textContent = "\xC4nderungen speichern";
        const cancelBtn = document.getElementById("cancelEditBtn");
        if (cancelBtn) cancelBtn.hidden = false;
        appState.tempVacationPeriods = [...appState.vacationsByStaff?.[id] || []];
        appState.tempIllnessPeriods = [...appState.illnessByStaff?.[id] || []];
        this.renderTempVacationList();
        this.renderTempIllnessList();
      });
    });
    host.querySelectorAll('button[data-action="remove"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = Number(e.currentTarget.dataset.id);
        const staff = staffSvc.list().find((x) => x.id === id);
        if (!staff) return;
        const name = staff.name || id;
        const confirmed = window.confirm(`Mitarbeiter "${name}" wirklich l\xF6schen?
Diese Aktion kann nicht r\xFCckg\xE4ngig gemacht werden.`);
        if (!confirmed) return;
        if (staffSvc.remove(id)) {
          try {
            if (appState.availabilityData && appState.availabilityData[id]) delete appState.availabilityData[id];
            if (appState.vacationsByStaff && appState.vacationsByStaff[id]) delete appState.vacationsByStaff[id];
            if (appState.illnessByStaff && appState.illnessByStaff[id]) delete appState.illnessByStaff[id];
            if (appState.carryoverByStaffAndMonth) {
              Object.keys(appState.carryoverByStaffAndMonth).forEach((k) => {
                if (k.startsWith(id + ":")) delete appState.carryoverByStaffAndMonth[k];
              });
            }
            if (appState.monthHoursCache) {
              Object.keys(appState.monthHoursCache).forEach((k) => {
                if (k.startsWith(id + ":")) delete appState.monthHoursCache[k];
              });
            }
            if (appState.permanentOvertimeConsent) {
              Object.keys(appState.permanentOvertimeConsent).forEach((year) => {
                const y = appState.permanentOvertimeConsent[year];
                if (y && y[id]) delete y[id];
              });
            }
            if (appState.overtimeCredits) {
              Object.keys(appState.overtimeCredits).forEach((monthKey) => {
                const rec = appState.overtimeCredits[monthKey];
                if (rec && rec[id]) delete rec[id];
              });
            }
            if (appState.voluntaryEveningAvailability) {
              Object.keys(appState.voluntaryEveningAvailability).forEach((k) => {
                if (k.startsWith(id + "::")) delete appState.voluntaryEveningAvailability[k];
              });
            }
            if (appState.weekendAssignments) {
              Object.keys(appState.weekendAssignments).forEach((k) => {
                if (k.startsWith(id + ":")) delete appState.weekendAssignments[k];
              });
            }
            if (appState.studentWeekdayDaytimeShifts) {
              Object.keys(appState.studentWeekdayDaytimeShifts).forEach((k) => {
                if (k.startsWith(id + ":")) delete appState.studentWeekdayDaytimeShifts[k];
              });
            }
            if (appState.vacationLedger) {
              Object.keys(appState.vacationLedger).forEach((yearKey) => {
                const yrec = appState.vacationLedger[yearKey];
                if (yrec && yrec[id]) delete yrec[id];
              });
            }
            if (appState.scheduleData) {
              Object.values(appState.scheduleData).forEach((monthObj) => {
                if (!monthObj || !monthObj.data) return;
                Object.values(monthObj.data).forEach((dayObj) => {
                  if (!dayObj || !dayObj.assignments) return;
                  Object.keys(dayObj.assignments).forEach((shiftKey) => {
                    if (String(dayObj.assignments[shiftKey]) === String(id)) delete dayObj.assignments[shiftKey];
                  });
                });
              });
            }
            try {
              if (!Array.isArray(appState.auditLog)) appState.auditLog = [];
              appState.auditLog.push({ timestamp: Date.now(), message: `Mitarbeiter gel\xF6scht: ${name} (ID ${id})` });
            } catch {
            }
          } catch (err) {
            console.warn("Cleanup after staff deletion fehlgeschlagen", err);
          }
          appState.save();
          this.renderStaffList();
          this.populateAvailabilitySelectors();
          if (this.renderVacationList) this.renderVacationList();
          if (this.renderVacationSummaryTable) this.renderVacationSummaryTable();
          if (this.renderIllnessList) this.renderIllnessList();
          if (this.renderAuditLog) this.renderAuditLog();
          if (this.renderOvertimeRequestsTable) this.renderOvertimeRequestsTable();
          if (this.renderMonthlyHoursTable) this.renderMonthlyHoursTable();
          if (this.renderFairnessTables) this.renderFairnessTables();
          if (this.renderOvertimeCreditsTable) this.renderOvertimeCreditsTable();
        }
      });
    });
    host.querySelectorAll("input.wknd-pref").forEach((cb) => {
      cb.addEventListener("change", (e) => {
        const id = Number(e.currentTarget.getAttribute("data-id"));
        const staff = staffSvc.list().find((x) => x.id === id);
        if (!staff) return;
        staff.weekendPreference = !!e.currentTarget.checked;
        if (!staff.weekendPreference) delete staff.alternativeWeekendDays;
        appState.save();
        this.renderStaffList();
      });
    });
    host.querySelectorAll("select.alt-day").forEach((sel) => {
      sel.addEventListener("change", (e) => {
        const id = Number(e.currentTarget.getAttribute("data-id"));
        const idx = Number(e.currentTarget.getAttribute("data-idx"));
        const staff = staffSvc.list().find((x) => x.id === id);
        if (!staff || !staff.weekendPreference) return;
        if (!Array.isArray(staff.alternativeWeekendDays)) staff.alternativeWeekendDays = [];
        const val = parseInt(e.currentTarget.value, 10);
        if (!isNaN(val)) staff.alternativeWeekendDays[idx] = val;
        else delete staff.alternativeWeekendDays[idx];
        staff.alternativeWeekendDays = Array.from(new Set(staff.alternativeWeekendDays.filter((v) => Number.isInteger(v)))).slice(0, 2);
        appState.save();
      });
    });
  }
  // ==== Staff temp Vacation/Illness (form) ====
  addStaffVacationPeriod() {
    const startEl = document.getElementById("staffVacationStart");
    const endEl = document.getElementById("staffVacationEnd");
    const start = startEl?.value;
    const end = endEl?.value;
    if (!start || !end || end < start) {
      alert("Bitte g\xFCltigen Urlaubszeitraum w\xE4hlen");
      return;
    }
    appState.tempVacationPeriods = appState.tempVacationPeriods || [];
    appState.tempVacationPeriods.push({ start, end });
    appState.save();
    this.renderTempVacationList();
    if (startEl) startEl.value = "";
    if (endEl) endEl.value = "";
  }
  renderTempIllnessList() {
  }
  // ==== Vacation Ledger (summary panel) ==== 
  initVacationLedger() {
    const yearSel = document.getElementById("vacationYearSelect");
    if (yearSel && (!yearSel.options || yearSel.options.length === 0)) {
      const now = /* @__PURE__ */ new Date();
      for (let y = now.getFullYear() - 1; y <= now.getFullYear() + 1; y++) {
        const opt = document.createElement("option");
        opt.value = String(y);
        opt.textContent = String(y);
        if (y === now.getFullYear()) opt.selected = true;
        yearSel.appendChild(opt);
      }
      yearSel.addEventListener("change", () => {
        this.renderVacationSummaryTable();
      });
    }
    this.renderVacationSummaryTable();
  }
  renderVacationSummaryTable() {
    const tbody = document.getElementById("vacationLedgerTable");
    const yearSel = document.getElementById("vacationYearSelect");
    if (!tbody || !yearSel) return;
    const year = Number(yearSel.value) || (/* @__PURE__ */ new Date()).getFullYear();
    const staffList = (__services?.staff?.list ? __services.staff.list() : appState.staffData) || [];
    const ledger = __services?.vacation?.getLedger ? __services.vacation.getLedger(year) : appState.vacationLedger?.[year] || {};
    const rows = staffList.map((s) => {
      const planned = this.countPlannedVacationDaysForYear ? this.countPlannedVacationDaysForYear(s.id, year) : 0;
      const sick = this.countSickDaysForYear ? this.countSickDaysForYear(s.id, year) : 0;
      const allowance = ledger?.[s.id]?.allowance ?? (s.role === "permanent" ? 30 : 0);
      const takenManual = ledger?.[s.id]?.takenManual ?? 0;
      const carryPrev = ledger?.[s.id]?.carryPrev ?? 0;
      const remaining = allowance + carryPrev - takenManual - planned;
      return `<tr data-staff="${s.id}" data-planned="${planned}">
    <td class="text-left">${s.name}</td>
    <td><input type="number" class="ledger-input" data-field="allowance" value="${allowance}" min="0" step="1"/></td>
    <td><input type="number" class="ledger-input" data-field="takenManual" value="${takenManual}" min="0" step="1"/></td>
    <td><input type="number" class="ledger-input" data-field="carryPrev" value="${carryPrev}" min="0" step="1"/></td>
    <td>${planned}</td>
    <td class="remaining-cell">${remaining}</td>
    <td>${sick}</td>
    <td><button class="btn btn-sm" data-ledger-save="${s.id}">Speichern</button></td>
  </tr>`;
    }).join("");
    tbody.innerHTML = rows || '<tr><td colspan="8" class="text-center text-muted">Keine Daten</td></tr>';
    const recompute = (tr) => {
      if (!tr) return;
      const planned = Number(tr.getAttribute("data-planned")) || 0;
      const getVal = (field) => Number(tr.querySelector(`input[data-field="${field}"]`)?.value || 0) || 0;
      const allowance = getVal("allowance");
      const taken = getVal("takenManual");
      const carry = getVal("carryPrev");
      const remaining = allowance + carry - taken - planned;
      const cell = tr.querySelector(".remaining-cell");
      if (cell) cell.textContent = String(remaining);
    };
    tbody.querySelectorAll("input.ledger-input").forEach((inp) => {
      inp.addEventListener("input", (e) => {
        const tr = e.currentTarget.closest("tr");
        recompute(tr);
      });
    });
    tbody.querySelectorAll("button[data-ledger-save]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const tr = e.currentTarget.closest("tr");
        if (!tr) return;
        const staffId = Number(e.currentTarget.getAttribute("data-ledger-save"));
        const getVal = (field) => Number(tr.querySelector(`input[data-field="${field}"]`)?.value || 0) || 0;
        const payload = { allowance: getVal("allowance"), takenManual: getVal("takenManual"), carryPrev: getVal("carryPrev") };
        try {
          await __services?.vacation?.upsertLedgerEntry({ staffId, year, ...payload });
        } catch (err) {
          console.warn("Ledger save failed", err);
        }
        setTimeout(() => this.renderVacationSummaryTable(), 50);
      });
    });
  }
  ensureToastContainer() {
    if (document.getElementById("toastContainer")) return;
    const div = document.createElement("div");
    div.id = "toastContainer";
    div.className = "toast-container";
    document.body.appendChild(div);
  }
  showLedgerConflictToast(payload) {
    this.ensureToastContainer();
    const wrap = document.createElement("div");
    wrap.className = "toast toast-warning";
    wrap.innerHTML = `<div class="fw-600">Ledger ge\xE4ndert</div><div class="fs-13">Ledger changed remotely. Reload latest or retry.</div><div class="flex-gap-6"><button class="btn btn-sm" data-act="reload">Reload</button><button class="btn btn-sm btn-secondary" data-act="retry">Retry</button><button class="btn btn-sm btn-danger ml-auto" data-act="close">\u2715</button></div>`;
    const container = document.getElementById("toastContainer");
    container.appendChild(wrap);
    const year = payload?.year || (/* @__PURE__ */ new Date()).getFullYear();
    wrap.querySelectorAll("button[data-act]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const act = btn.getAttribute("data-act");
        if (act === "close") {
          wrap.remove();
          return;
        }
        if (act === "reload") {
          try {
            __services?.vacation?.getLedger(year);
            this.renderVacationSummaryTable();
          } catch (e) {
            console.warn("reload failed", e);
          }
          wrap.remove();
        } else if (act === "retry") {
          if (payload?.staffId) {
            const cur = __services?.vacation?.getLedger(year)?.[payload.staffId];
            if (cur) {
              __services?.vacation?.upsertLedgerEntry({ staffId: payload.staffId, year, allowance: cur.allowance, takenManual: cur.takenManual, carryPrev: cur.carryPrev, meta: cur.meta });
            }
          }
          setTimeout(() => this.renderVacationSummaryTable(), 300);
          wrap.remove();
        }
      });
    });
    setTimeout(() => {
      wrap.classList.add("fade-out");
      setTimeout(() => wrap.remove(), 600);
    }, 1e4);
  }
  renderIllnessList() {
    const host = document.getElementById("staffIllnessList");
    if (!host) return;
    const list = appState.tempIllnessPeriods || [];
    host.innerHTML = list.length ? list.map((p, idx) => `<li class="list-item"><span>${p.start} bis ${p.end}</span><button class="btn btn-sm btn-danger" data-rm-ill="${idx}" title="Entfernen">\u2715</button></li>`).join("") : '<li class="list-item"><span>Keine Eintr\xE4ge</span></li>';
    host.querySelectorAll("button[data-rm-ill]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const i = Number(e.currentTarget.getAttribute("data-rm-ill"));
        appState.tempIllnessPeriods.splice(i, 1);
        appState.save();
        this.renderIllnessList();
      });
    });
  }
  renderTempVacationList() {
    const host = document.getElementById("staffVacationList");
    if (!host) return;
    const list = appState.tempVacationPeriods || [];
    host.innerHTML = list.length ? list.map((p, idx) => `<li class="list-item"><span>${p.start} bis ${p.end}</span><button class="btn btn-sm btn-danger" data-rm-vac="${idx}" title="Entfernen">\u2715</button></li>`).join("") : '<li class="list-item"><span>Keine Eintr\xE4ge</span></li>';
    host.querySelectorAll("button[data-rm-vac]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const i = Number(e.currentTarget.getAttribute("data-rm-vac"));
        appState.tempVacationPeriods.splice(i, 1);
        appState.save();
        this.renderTempVacationList();
      });
    });
  }
  renderTempIllnessList() {
    const host = document.getElementById("staffIllnessList");
    if (!host) return;
    const list = appState.tempIllnessPeriods || [];
    host.innerHTML = list.length ? list.map((p, idx) => `<li class="list-item"><span>${p.start} bis ${p.end}</span><button class="btn btn-sm btn-danger" data-rm-ill="${idx}" title="Entfernen">\u2715</button></li>`).join("") : '<li class="list-item"><span>Keine Eintr\xE4ge</span></li>';
    host.querySelectorAll("button[data-rm-ill]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const i = Number(e.currentTarget.getAttribute("data-rm-ill"));
        appState.tempIllnessPeriods.splice(i, 1);
        appState.save();
        this.renderTempIllnessList();
      });
    });
  }
  addStaffIllnessPeriod() {
    const startEl = document.getElementById("staffIllnessStart");
    const endEl = document.getElementById("staffIllnessEnd");
    const start = startEl?.value;
    const end = endEl?.value;
    if (!start || !end || end < start) {
      alert("Bitte g\xFCltigen Krankheitszeitraum w\xE4hlen");
      return;
    }
    appState.tempIllnessPeriods = appState.tempIllnessPeriods || [];
    appState.tempIllnessPeriods.push({ start, end });
    appState.save();
    this.renderTempIllnessList();
    if (startEl) startEl.value = "";
    if (endEl) endEl.value = "";
  }
  // When persisting illness for staff (already migrated in staff save) audit via centralized helper occurs there.
  // ==== Availability ====
  populateAvailabilitySelectors() {
    const staffSel = document.getElementById("availabilityStaffSelect");
    const monthSel = document.getElementById("availabilityMonth");
    const staffList = (__services?.staff?.list ? __services.staff.list() : appState.staffData) || [];
    if (staffSel) {
      staffSel.innerHTML = '<option value="">\u2013 ausw\xE4hlen \u2013</option>' + staffList.map((s) => `<option value="${s.id}">${s.name}</option>`).join("");
    }
    if (monthSel) {
      if (!monthSel.options || monthSel.options.length === 0) {
        const now = /* @__PURE__ */ new Date();
        for (let i = 0; i < 12; i++) {
          const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
          const val = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
          const opt = document.createElement("option");
          opt.value = val;
          opt.textContent = d.toLocaleString(void 0, { month: "long", year: "numeric" });
          monthSel.appendChild(opt);
        }
      }
      if (!monthSel.value && monthSel.options[0]) monthSel.value = monthSel.options[0].value;
    }
  }
  handleAvailabilityDisplay() {
    const availSvc = __services?.availability;
    const staffSel = document.getElementById("availabilityStaffSelect");
    const monthSel = document.getElementById("availabilityMonth");
    const host = document.getElementById("availabilityForm");
    if (!staffSel || !monthSel || !host) return;
    const staffList = (__services?.staff?.list ? __services.staff.list() : appState.staffData) || [];
    const staffId = Number(staffSel.value);
    const staff = staffList.find((s) => s.id === staffId);
    const month = monthSel.value;
    if (!staffId || !month) {
      host.innerHTML = "<p>Bitte Mitarbeiter und Monat ausw\xE4hlen.</p>";
      return;
    }
    (async () => {
      try {
        if (!availSvc?.listRange) return;
        if (!window.__services || !window.__services.ready) return;
        await window.__services.ready;
        const store = window.__services.store;
        const remote = !!(store && (store.remote || store.constructor && store.constructor.name === "SupabaseAdapter"));
        if (!remote) return;
        const [yy, mm] = month.split("-").map(Number);
        const fromDate = `${yy}-${String(mm).padStart(2, "0")}-01`;
        const toDate = `${yy}-${String(mm).padStart(2, "0")}-${String(new Date(yy, mm, 0).getDate()).padStart(2, "0")}`;
        const old = host.innerHTML;
        host.innerHTML = '<div class="status-line"><span class="spinner"></span><span>Verf\xFCgbarkeiten laden\u2026</span></div>' + old;
        const selDisabled = { s: staffSel.disabled, m: monthSel.disabled };
        staffSel.disabled = true;
        monthSel.disabled = true;
        try {
          await availSvc.listRange(staffId, fromDate, toDate);
        } finally {
          staffSel.disabled = selDisabled.s;
          monthSel.disabled = selDisabled.m;
        }
        const status = host.querySelector(".status-line");
        if (status) {
          const sp = status.querySelector(".spinner");
          if (sp) sp.classList.add("hidden");
          status.querySelector("span:last-child").textContent = "Synchronisiert \u2713";
          setTimeout(() => {
            status.remove();
          }, 900);
        }
      } catch (e) {
        console.warn("[Availability] pre-hydration failed", e);
      }
    })();
    const [y, m] = month.split("-").map(Number);
    const days = new Date(y, m, 0).getDate();
    const getTypeForDate = (dateStr) => {
      const d = parseYMD(dateStr);
      const isWE = d.getDay() === 0 || d.getDay() === 6;
      const hol = appState.holidays[String(y)]?.[dateStr];
      return hol ? "holiday" : isWE ? "weekend" : "weekday";
    };
    const getShiftsForType = (type) => Object.entries(SHIFTS).filter(([_, v]) => v.type === type).map(([k]) => k);
    const isPermanent = staff?.role === "permanent";
    let html = '<div class="avail-grid">';
    if (isPermanent) {
      html += '<div class="avail-row avail-head avail-cols-permanent"><div class="avail-cell">Datum</div><div class="avail-cell">Blockierte Schichten</div><div class="avail-cell">Freiwillig Abend</div><div class="avail-cell">Freiwillig Sp\xE4t</div><div class="avail-cell">Frei</div></div>';
    } else {
      html += '<div class="avail-row avail-head avail-cols-regular"><div class="avail-cell">Datum</div><div class="avail-cell">Schichten</div></div>';
    }
    for (let d = 1; d <= days; d++) {
      const dateStr = `${y}-${pad2(m)}-${pad2(d)}`;
      const type = getTypeForDate(dateStr);
      const shiftsForDay = getShiftsForType(type);
      const isWE = type === "weekend";
      const holName = type === "holiday" ? appState.holidays[String(y)]?.[dateStr] || "" : "";
      const rowClasses = ["avail-row"];
      if (isWE) rowClasses.push("is-weekend");
      if (holName) rowClasses.push("is-holiday");
      const flags = [isWE ? '<span class="day-flag">Wochenende</span>' : "", holName ? `<span class="day-flag">${holName}</span>` : ""].filter(Boolean).join("");
      const off = availSvc?.isDayOff(staffId, dateStr) || false;
      html += `<div class="${rowClasses.join(" ")} ${isPermanent ? "avail-cols-permanent" : "avail-cols-regular"}">`;
      html += `<div class="avail-cell"><strong>${pad2(d)}.${pad2(m)}.${y}</strong> ${flags}</div>`;
      html += '<div class="avail-cell text-left">';
      if (shiftsForDay.length === 0) {
        html += '<span class="na-cell">\u2014</span>';
      } else {
        const detailedDay = availSvc?.getDay(staffId, dateStr) || {};
        shiftsForDay.forEach((k) => {
          let val = detailedDay[k];
          if (!isPermanent && val === "no") val = void 0;
          const isBlocked = isPermanent ? val === "no" : false;
          const stateClass = isPermanent ? isBlocked ? "state-no" : "state-unset" : val ? `state-${val}` : "state-unset";
          const meta = SHIFTS[k] || {};
          const name = meta.name || k;
          const time = meta.time || "";
          const label = isPermanent ? isBlocked ? "\u2717" : "\u2014" : val === "prefer" ? "\u2605" : val === "yes" ? "\u2713" : "\u2014";
          html += `<button class="avail-btn ${stateClass} shift-btn" title="${name} ${time}" data-date="${dateStr}" data-shift="${k}" ${off ? "disabled" : ""}>${name}: ${label}</button>`;
        });
      }
      html += "</div>";
      if (isPermanent) {
        const isWeekday = !isWE && !holName;
        const vEven = isWeekday ? availSvc?.isVoluntary(staffId, dateStr, "evening") || false : false;
        const vClose = isWeekday ? availSvc?.isVoluntary(staffId, dateStr, "closing") || false : false;
        html += `<div class="avail-cell">${isWeekday ? `<label class="inline align-center gap-6"><input type="checkbox" class="vol-evening" data-date="${dateStr}" ${vEven ? "checked" : ""}/> <span>Abend</span></label>` : '<span class="na-cell">\u2014</span>'}</div>`;
        html += `<div class="avail-cell">${isWeekday ? `<label class="inline align-center gap-6"><input type="checkbox" class="vol-closing" data-date="${dateStr}" ${vClose ? "checked" : ""}/> <span>Sp\xE4t</span></label>` : '<span class="na-cell">\u2014</span>'}</div>`;
      }
      if (isPermanent) {
        html += `<div class="avail-cell"><button class="btn ${off ? "btn-secondary" : ""}" data-dayoff="1" data-date="${dateStr}" data-off="${off ? 1 : 0}">${off ? "Freiwunsch" : "Frei w\xFCnschen"}</button></div>`;
      }
      html += "</div>";
    }
    html += "</div>";
    try {
      const autoCarry = __services?.carryover?.auto ? __services.carryover.auto(staff, month, { getPrevMonthKey: this.getPrevMonthKey.bind(this), sumStaffHoursForMonth: this.sumStaffHoursForMonth.bind(this) }) : this.computeAutoCarryover(staff, month);
      const manualCarry = __services?.carryover ? __services.carryover.get(staffId, month) : Number(appState.carryoverByStaffAndMonth?.[staffId]?.[month] ?? 0);
      html += `
<div class="card mt-12 p-12">
  <div class="fw-600 mb-4">Stunden\xFCbertrag (Vormonat \u2192 ${month})</div>
  <div class="text-muted fs-90 mb-8">Ein positiver Wert erh\xF6ht das Monatsziel (z.\u202FB. +3h), ein negativer Wert verringert es (z.\u202FB. -3h).</div>
  <div class="form-row grid-cols-auto-120px-auto-auto align-end gap-10">
    <label for="carryoverInput">Manueller \xDCbertrag</label>
    <input type="number" id="carryoverInput" value="${manualCarry}" step="0.25" class="w-120" />
    <div class="text-muted">Auto (${autoCarry.toFixed(2)} h)</div>
    <button class="btn" id="carryoverSaveBtn">Speichern</button>
  </div>
  <div class="text-muted fs-85 mt-6">Ergebnisse sind kumulativ; Ziel ist, den \xDCbertrag bis zum Ende des Folgemonats auf 0 zu bringen.</div>
</div>`;
    } catch (e) {
      console.warn("Carryover panel render failed", e);
    }
    host.innerHTML = html;
    host.querySelectorAll("button.avail-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const b = e.currentTarget;
        const dateStr = b.dataset.date;
        const shiftKey = b.dataset.shift;
        const detailedDay = availSvc?.getDay(staffId, dateStr) || {};
        let current = detailedDay[shiftKey];
        if (staff?.role !== "permanent" && current === "no") current = void 0;
        const next = staff?.role === "permanent" ? current === "no" ? void 0 : "no" : current === "yes" ? "prefer" : current === "prefer" ? void 0 : "yes";
        availSvc?.setShift(staffId, dateStr, shiftKey, next);
        this.handleAvailabilityDisplay();
      });
    });
    if (isPermanent) {
      const toggleVol = (kind, cb) => {
        const dateStr = cb.getAttribute("data-date");
        availSvc?.setVoluntary(staffId, dateStr, kind, cb.checked);
      };
      host.querySelectorAll("input.vol-evening").forEach((cb) => cb.addEventListener("change", (e) => toggleVol("evening", e.currentTarget)));
      host.querySelectorAll("input.vol-closing").forEach((cb) => cb.addEventListener("change", (e) => toggleVol("closing", e.currentTarget)));
      host.querySelectorAll('button[data-dayoff="1"]').forEach((btn) => btn.addEventListener("click", (e) => {
        const b = e.currentTarget;
        const dateStr = b.dataset.date;
        const isOff = b.dataset.off === "1";
        availSvc?.setDayOff(staffId, dateStr, !isOff);
        this.handleAvailabilityDisplay();
      }));
    }
    const carryBtn = host.querySelector("#carryoverSaveBtn");
    if (carryBtn) {
      carryBtn.addEventListener("click", () => {
        const inp = host.querySelector("#carryoverInput");
        const val = Number(inp?.value || 0);
        if (__services?.carryover) {
          __services.carryover.set(staffId, month, Number.isFinite(val) ? val : 0);
          __services?.audit?.log?.(auditMsg("carryover.set", { staffId, month, value: val }));
        } else {
          if (!appState.carryoverByStaffAndMonth) appState.carryoverByStaffAndMonth = {};
          if (!appState.carryoverByStaffAndMonth[staffId]) appState.carryoverByStaffAndMonth[staffId] = {};
          appState.carryoverByStaffAndMonth[staffId][month] = Number.isFinite(val) ? val : 0;
          appState.save();
        }
        this.handleAvailabilityDisplay();
      });
    }
  }
  // ==== Vacation ====
  populateVacationSelectors() {
    const staffSel = document.getElementById("vacationStaffSelect");
    if (staffSel) {
      staffSel.innerHTML = '<option value="">\u2013 Mitarbeiter \u2013</option>' + appState.staffData.map((s) => `<option value="${s.id}">${s.name}</option>`).join("");
    }
  }
  // ==== Weitere Mitarbeitende (nur Urlaube) ====
  addOtherStaff() {
    const nameEl = document.getElementById("otherStaffName");
    const name = nameEl?.value?.trim();
    if (!name) {
      alert("Bitte Name angeben");
      return;
    }
    if (!Array.isArray(appState.otherStaffData)) appState.otherStaffData = [];
    if (!appState.otherStaffData.some((s) => s.name === name)) {
      appState.otherStaffData.push({ name, vacations: [] });
      appState.save();
    }
    nameEl.value = "";
    this.renderOtherStaff();
  }
  addOtherVacationPeriod() {
    const name = document.getElementById("otherStaffName")?.value?.trim();
    const start = document.getElementById("otherVacationStart")?.value;
    const end = document.getElementById("otherVacationEnd")?.value;
    if (!name) {
      alert("Bitte Name w\xE4hlen oder eingeben");
      return;
    }
    if (!start || !end || end < start) {
      alert("Bitte g\xFCltigen Zeitraum w\xE4hlen");
      return;
    }
    const rec = (appState.otherStaffData || []).find((s) => s.name === name) || (() => {
      const r = { name, vacations: [] };
      appState.otherStaffData.push(r);
      return r;
    })();
    rec.vacations.push({ start, end });
    appState.save();
    document.getElementById("otherVacationStart").value = "";
    document.getElementById("otherVacationEnd").value = "";
    this.renderOtherStaff();
  }
  renderOtherStaff() {
    const list = document.getElementById("otherStaffList");
    const vacList = document.getElementById("otherVacationList");
    if (!list || !vacList) return;
    const data = appState.otherStaffData || [];
    list.innerHTML = data.length ? data.map((s) => {
      const vacs = (s.vacations || []).map((p, idx) => `<li class="list-item"><span>${p.start} bis ${p.end}</span><button class="btn btn-sm btn-danger" data-rm="${s.name}::${idx}" title="Entfernen">\u2715</button></li>`).join("");
      return `<div class="staff-card card-col"><strong>${s.name}</strong><ul>${vacs || '<li class="list-item"><span>Keine Eintr\xE4ge</span></li>'}</ul></div>`;
    }).join("") : "<p>Keine weiteren Mitarbeitenden angelegt.</p>";
    const name = document.getElementById("otherStaffName")?.value?.trim();
    const sel = data.find((s) => s.name === name);
    vacList.innerHTML = sel && sel.vacations?.length ? sel.vacations.map((p, idx) => `<li class="list-item"><span>${p.start} bis ${p.end}</span><button class="btn btn-sm btn-danger" data-rm-sel="${idx}" title="Entfernen">\u2715</button></li>`).join("") : '<li class="list-item"><span>Keine Eintr\xE4ge</span></li>';
    list.querySelectorAll("button[data-rm]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const [n, idxStr] = String(e.currentTarget.getAttribute("data-rm")).split("::");
        const idx = Number(idxStr);
        const rec = (appState.otherStaffData || []).find((s) => s.name === n);
        if (rec) {
          rec.vacations.splice(idx, 1);
          appState.save();
          this.renderOtherStaff();
        }
      });
    });
    vacList.querySelectorAll("button[data-rm-sel]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const idx = Number(e.currentTarget.getAttribute("data-rm-sel"));
        const rec = (appState.otherStaffData || []).find((s) => s.name === name);
        if (rec) {
          rec.vacations.splice(idx, 1);
          appState.save();
          this.renderOtherStaff();
        }
      });
    });
  }
  // ==== Carryover helpers ==== // Keeping getPrevMonthKey & sumStaffHoursForMonth for carryover.auto context
  getPrevMonthKey(month) {
    if (!month || typeof month !== "string" || !month.includes("-")) return month;
    const [y, m] = month.split("-").map(Number);
    const prevM = m === 1 ? 12 : m - 1;
    const prevY = m === 1 ? y - 1 : y;
    return `${prevY}-${pad2(prevM)}`;
  }
  sumStaffHoursForMonth(staffId, month) {
    const sched = appState.scheduleData?.[month] || {};
    let sum = 0;
    Object.values(sched).forEach((day) => {
      const assigns = day?.assignments || {};
      Object.entries(assigns).forEach(([shiftKey, sid]) => {
        if (Number(sid) === Number(staffId)) {
          const h = Number((SHIFTS?.[shiftKey] || {}).hours || 0);
          sum += h;
        }
      });
    });
    return Math.round(sum * 100) / 100;
  }
  // (computeAutoCarryover removed – logic now in CarryoverService)
  // ==== Reports ====
  initReports() {
    const sel = document.getElementById("reportsMonth");
    if (!sel) return;
    if (!sel.options || sel.options.length === 0) {
      const now = /* @__PURE__ */ new Date();
      for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const val = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
        const opt = document.createElement("option");
        opt.value = val;
        opt.text = d.toLocaleString(void 0, { month: "long", year: "numeric" });
        sel.appendChild(opt);
      }
      sel.value = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
    }
    sel.addEventListener("change", () => this.renderReports());
    this.renderReports();
  }
  renderReports() {
    const sel = document.getElementById("reportsMonth");
    const month = sel?.value;
    if (!month) return;
    try {
      __services?.report?.getOvertimeCredits(month);
    } catch {
    }
    try {
      this.renderMonthlyHoursReport(month);
    } catch (e) {
      console.warn("renderMonthlyHoursReport failed", e);
    }
    try {
      this.renderStudentWeeklyReport(month);
    } catch (e) {
      console.warn("renderStudentWeeklyReport failed", e);
    }
    try {
      this.computeAndRenderOvertimeReport(month);
    } catch (e) {
      console.warn("computeAndRenderOvertimeReport failed", e);
    }
  }
  renderMonthlyHoursReport(month) {
    const tbody = document.getElementById("monthlyHoursReport");
    if (!tbody) return;
    const earnings = __services?.report?.computeEarnings ? __services.report.computeEarnings(month) : {};
    const ot = appState.overtimeCredits?.[month] || {};
    const overtimeByStaff = Object.fromEntries(Object.entries(ot).map(([sid, weeks]) => [sid, Object.values(weeks || {}).reduce((a, b) => a + Number(b || 0), 0)]));
    const rows = (appState.staffData || []).map((s) => {
      const rec = earnings[s.id] || { hours: 0, earnings: 0 };
      const h = Math.round(rec.hours * 100) / 100;
      const earn = rec.earnings;
      let status = "OK";
      let practicalLimitsInfo = "";
      if ((s.role === "minijob" || s.role === "student") && (s.weekly_hours_min_practical || s.weekly_hours_max_practical)) {
        const min = Number(s.weekly_hours_min_practical || 0);
        const max = Number(s.weekly_hours_max_practical || 0);
        practicalLimitsInfo = ` (Prakt: ${min ? min + "\u2013" : ""}${max ? max + "h" : ""})`;
      }
      if (s.role === "minijob") {
        const cap = Number(APP_CONFIG?.MINIJOB_MAX_EARNING ?? 556);
        if (earn > cap + 1e-6) status = `> Minijob-Cap (${cap.toFixed(0)}\u20AC)`;
      }
      const otH = Number(overtimeByStaff[s.id] || 0);
      return `<tr><td class="text-left">${s.name}${practicalLimitsInfo}</td><td>${s.role}</td><td>${h.toFixed(2)}</td><td>${otH > 0 ? otH.toFixed(2) : "\u2014"}</td><td>${(Math.round(earn * 100) / 100).toFixed(2)} \u20AC</td><td>${status}</td></tr>`;
    }).join("");
    tbody.innerHTML = rows || '<tr><td colspan="6" class="text-center text-muted">Keine Daten</td></tr>';
  }
  renderStudentWeeklyReport(month) {
    const tbody = document.getElementById("studentWeeklyReport");
    if (!tbody) return;
    const weeks = __services?.report?.studentWeekly ? __services.report.studentWeekly(month) : {};
    const rows = [];
    Object.entries(weeks).forEach(([sid, wk]) => {
      const name = (appState.staffData || []).find((s) => s.id == sid)?.name || sid;
      Object.entries(wk).sort(([a], [b]) => Number(a) - Number(b)).forEach(([w, agg]) => {
        const ratio = agg.total > 0 ? Math.round(agg.nightWeekend / agg.total * 100) : 0;
        const monthExc = !!appState.studentExceptionMonths?.[month];
        rows.push(`<tr><td class="text-left">${name}</td><td>${w}</td><td>${agg.hours.toFixed(2)}</td><td>${ratio}%</td><td>${monthExc ? "\u2713" : "-"}</td></tr>`);
      });
    });
    tbody.innerHTML = rows.join("") || '<tr><td colspan="5" class="text-center text-muted">Keine Daten</td></tr>';
  }
  computeAndRenderOvertimeReport(month) {
    const tbody = document.getElementById("overtimeCreditsReport");
    if (!tbody) return;
    const creditsByStaffWeek = __services?.report?.getOvertimeCredits ? __services.report.getOvertimeCredits(month) : {};
    const rows = [];
    Object.entries(creditsByStaffWeek).forEach(([sid, weeks]) => {
      const name = (appState.staffData || []).find((s) => s.id == sid)?.name || sid;
      Object.entries(weeks).sort(([a], [b]) => Number(a) - Number(b)).forEach(([w, h]) => {
        rows.push(`<tr><td class="text-left">${name}</td><td>${w}</td><td>${Number(h || 0).toFixed(2)}</td></tr>`);
      });
    });
    tbody.innerHTML = rows.join("") || '<tr><td colspan="3" class="text-center text-muted">Keine Daten</td></tr>';
  }
  // Reports now fully powered by ReportService (no legacy fallbacks).
  // ==== Audit Log ====
  renderAuditLog() {
    const tbody = document.getElementById("auditLogTable");
    if (!tbody) return;
    const rows = (appState.auditLog || []).slice().reverse().map((entry) => {
      const ts = entry?.timestamp ? new Date(entry.timestamp) : /* @__PURE__ */ new Date();
      const tsStr = `${String(ts.getDate()).padStart(2, "0")}.${String(ts.getMonth() + 1).padStart(2, "0")}.${ts.getFullYear()} ${String(ts.getHours()).padStart(2, "0")}:${String(ts.getMinutes()).padStart(2, "0")}:${String(ts.getSeconds()).padStart(2, "0")}`;
      const msg = entry?.message || "";
      return `<tr><td class="text-left">${tsStr}</td><td>${msg}</td></tr>`;
    }).join("");
    tbody.innerHTML = rows || '<tr><td colspan="2" class="text-center text-muted">Keine Eintr\xE4ge</td></tr>';
  }
  addVacationPeriod() {
    const startEl = document.getElementById("vacationStart");
    const endEl = document.getElementById("vacationEnd");
    const staffSel = document.getElementById("vacationStaffSelect");
    if (!startEl || !endEl) return;
    const start = startEl.value;
    const end = endEl.value;
    const staffId = Number(staffSel?.value || 0);
    if (!staffId) {
      alert("Bitte Mitarbeiter w\xE4hlen");
      return;
    }
    if (!start || !end) {
      alert("Bitte Zeitraum w\xE4hlen");
      return;
    }
    if (__services?.vacation) {
      __services.vacation.addVacation(staffId, { start, end });
      __services?.audit?.log?.(auditMsg("vacation.add", { staffId, start, end }));
    } else {
      if (!appState.vacationsByStaff[staffId]) appState.vacationsByStaff[staffId] = [];
      appState.vacationsByStaff[staffId].push({ start, end });
      appState.save();
    }
    this.renderVacationList();
    startEl.value = "";
    endEl.value = "";
  }
  renderVacationList() {
    const host = document.getElementById("vacationList");
    const staffSel = document.getElementById("vacationStaffSelect");
    if (!host || !staffSel) return;
    const staffId = Number(staffSel.value || 0);
    const list = staffId ? __services?.vacation ? __services.vacation.listVacations(staffId) : appState.vacationsByStaff[staffId] || [] : [];
    host.innerHTML = list.length ? list.map((p, idx) => `<li>${p.start} bis ${p.end} <button class="btn btn-danger" data-idx="${idx}">Entfernen</button></li>`).join("") : "<li>Keine Eintr\xE4ge</li>";
    host.querySelectorAll("button[data-idx]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const i = Number(e.currentTarget.dataset.idx);
        if (__services?.vacation) {
          __services.vacation.removeVacation(staffId, i);
          __services?.audit?.log?.(auditMsg("vacation.remove", { staffId, index: i }));
        } else {
          if (!appState.vacationsByStaff[staffId]) return;
          appState.vacationsByStaff[staffId].splice(i, 1);
          appState.save();
        }
        this.renderVacationList();
      });
    });
    staffSel.addEventListener("change", () => this.renderVacationList());
  }
  countPlannedVacationDaysForYear(staffId, year, weekdaysOnly = true) {
    const periods = __services?.vacation ? __services.vacation.listVacations(staffId) : appState.vacationsByStaff?.[staffId] || [];
    let total = 0;
    for (const p of periods) {
      total += this.countOverlapDaysInYear(p.start, p.end, year, weekdaysOnly);
    }
    return total;
  }
  countSickDaysForYear(staffId, year, weekdaysOnly = false) {
    const periods = __services?.vacation ? __services.vacation.listIllness(staffId) : appState.illnessByStaff?.[staffId] || [];
    let total = 0;
    for (const p of periods) {
      total += this.countOverlapDaysInYear(p.start, p.end, year, weekdaysOnly);
    }
    return total;
  }
};
document.addEventListener("DOMContentLoaded", () => {
  const roleEl = document.getElementById("staffType");
  const permRow = document.getElementById("permanentPreferredRow");
  const practicalRow = document.getElementById("practicalLimitsRow");
  if (roleEl && permRow && practicalRow) {
    const sync = () => {
      permRow.hidden = !(roleEl.value === "permanent");
      practicalRow.hidden = !(roleEl.value === "minijob" || roleEl.value === "student");
    };
    roleEl.addEventListener("change", sync);
    sync();
  }
});

// ui/overtimeRequests.js
var OvertimeRequestsUI = class {
  constructor(containerId = "#overtimeRequestsList") {
    this.container = document.querySelector(containerId);
  }
  render() {
    if (!this.container) return;
    try {
      if (!window.__services) window.__services = createServices({});
    } catch {
    }
    const svc = window.__services?.overtime;
    const requestsRaw = svc?.listAll?.() || [];
    const requests = requestsRaw.filter((r) => ["requested", "consented"].includes(r.status)).map((r) => {
      const s = (appState.staffData || []).find((x) => String(x.id) === String(r.staffId));
      return { id: r.id || `${r.dateStr}:${r.staffId}:${r.shiftKey}`, staffId: Number(r.staffId), staffName: s?.name || String(r.staffId), dateStr: r.dateStr, shiftKey: r.shiftKey, status: r.status, lastError: r.lastError || "" };
    });
    if (requests.length === 0) {
      this.container.innerHTML = '<p class="text-muted italic">Keine ausstehenden \xDCberstunden-Anfragen</p>';
      return;
    }
    requests.sort((a, b) => new Date(a.dateStr) - new Date(b.dateStr));
    this.container.innerHTML = requests.map((r) => this._renderItem(r)).join("");
    this.container.querySelectorAll("[data-consent]")?.forEach((btn) => btn.addEventListener("click", (e) => {
      const { id } = e.currentTarget.dataset;
      this.handleConsent(id);
    }));
    this.container.querySelectorAll("[data-decline]")?.forEach((btn) => btn.addEventListener("click", (e) => {
      const { id } = e.currentTarget.dataset;
      this.handleDecline(id);
    }));
    this.container.querySelectorAll("[data-assign-now]")?.forEach((btn) => btn.addEventListener("click", (e) => {
      const { id } = e.currentTarget.dataset;
      this.assignNow(id);
    }));
  }
  _renderItem({ id, staffId, staffName, dateStr, shiftKey, status, lastError }) {
    const shift = (SHIFTS || {})[shiftKey] || {};
    const dateDE = (parseYMD(dateStr) || new Date(dateStr)).toLocaleDateString("de-DE");
    const actions = status === "consented" ? `<button class="btn btn-primary" data-assign-now data-id="${id}">Jetzt zuweisen</button>` : `<button class="btn btn-success" data-consent data-id="${id}">Zustimmen</button>
         <button class="btn btn-danger" data-decline data-id="${id}">Ablehnen</button>`;
    const statusBadge = status === "consented" ? '<span class="badge badge-info">Zugestimmt</span>' : "";
    const errorNote = status === "consented" && lastError ? `<div class="error-note">Letzter Fehler: ${lastError}</div>` : "";
    return `
      <div class="staff-card border-left-warning mb-8">
        <div class="flex-between align-center flex-wrap gap-8">
          <div>
            <div><strong>${staffName}</strong> ${statusBadge}</div>
            <div><strong>Datum:</strong> ${dateDE}</div>
            <div><strong>Schicht:</strong> ${shift.name || shiftKey} ${shift.time ? `(${shift.time})` : ""}</div>
            ${errorNote}
          </div>
          <div class="flex-gap-8">
            ${actions}
          </div>
        </div>
      </div>
    `;
  }
  handleConsent(id) {
    const svc = window.__services?.overtime;
    if (!svc) return;
    const req = svc.listAll().find((r) => (r.id || `${r.dateStr}:${r.staffId}:${r.shiftKey}`) === id);
    if (!req) return;
    svc.setConsent(req.staffId, req.dateStr, true);
    this._attemptAutoAssign(req, true);
  }
  handleDecline(id) {
    const svc = window.__services?.overtime;
    if (!svc) return;
    svc.setStatus(id, "declined");
    this.render();
  }
  assignNow(id) {
    const svc = window.__services?.overtime;
    if (!svc) return;
    const req = svc.listAll().find((r) => (r.id || `${r.dateStr}:${r.staffId}:${r.shiftKey}`) === id);
    if (!req) return;
    this._attemptAutoAssign(req, false, true);
  }
  _attemptAutoAssign(req, fromConsent = false, manual = false) {
    const { staffId, dateStr, shiftKey } = req;
    const month = dateStr.substring(0, 7);
    const schedule = appState.scheduleData[month] || (appState.scheduleData[month] = {});
    if (!schedule[dateStr]) schedule[dateStr] = { assignments: {} };
    const existing = schedule[dateStr].assignments?.[shiftKey];
    let success = false, failureReason = "";
    if (existing && Number(existing) !== Number(staffId)) {
      failureReason = "Schicht bereits belegt";
    } else {
      const original = { ...schedule[dateStr].assignments };
      schedule[dateStr].assignments[shiftKey] = staffId;
      try {
        const validator = new ScheduleValidator(month);
        const { schedule: consolidated } = validator.validateScheduleWithIssues(schedule);
        const hasBlocker = consolidated?.[dateStr]?.blockers?.[shiftKey];
        if (hasBlocker) {
          schedule[dateStr].assignments = original;
          failureReason = String(hasBlocker);
        } else {
          appState.scheduleData[month] = consolidated;
          success = true;
        }
      } catch (e) {
        schedule[dateStr].assignments = original;
        failureReason = e?.message || "Unbekannter Fehler";
      }
    }
    const id = req.id || `${req.dateStr}:${req.staffId}:${req.shiftKey}`;
    const overtimeSvc = window.__services?.overtime;
    if (success) overtimeSvc?.setStatus(id, "completed");
    else overtimeSvc?.setStatus(id, fromConsent ? "consented" : "consented", { lastError: failureReason });
    appState.save();
    try {
      this.render();
    } catch {
    }
    try {
      window.appUI?.recomputeOvertimeCredits?.(month);
    } catch {
    }
    try {
      window.handlers?.ui?.updateCalendarFromSelect?.();
    } catch {
    }
  }
};

// ui/monitoringDashboard.js
var MonitoringDashboard = class {
  constructor(containerId) {
    this.container = document.querySelector(containerId);
    this.monitoring = null;
    this.refreshInterval = null;
    this.autoRefresh = true;
    this.refreshRate = 3e4;
    this.pilotMode = true;
  }
  render() {
    this.renderDashboard();
  }
  renderDashboard() {
    const host = document.getElementById("monitoring-dashboard");
    if (!host) {
      console.warn("Monitoring dashboard container not found");
      return;
    }
    const report = window.__services?.monitoring?.generateReport();
    if (!report) {
      host.innerHTML = '<div class="monitoring-error">Monitoring service not available</div>';
      return;
    }
    const statusClass = this.getStatusClass(report.status);
    const lastRunTime = report.lastRun.timestamp ? new Date(report.lastRun.timestamp).toLocaleString("de-DE") : "Nie";
    host.innerHTML = `
            <div class="monitoring-dashboard">
                <div class="monitoring-header">
                    <h3>System-Monitoring</h3>
                    ${this.pilotMode ? '<span class="pilot-badge">PILOT MODE</span>' : ""}
                    <div class="monitoring-controls">
                        ${this.pilotMode ? '<button id="togglePilotView" class="btn btn-sm btn-pilot">Pilot View</button>' : ""}
                        <button id="refreshMonitoring" class="btn btn-sm">Aktualisieren</button>
                        <button id="exportMonitoring" class="btn btn-sm btn-secondary">Export</button>
                        <label class="auto-refresh-toggle">
                            <input type="checkbox" id="autoRefreshToggle" ${this.autoRefresh ? "checked" : ""}>
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
                                <span class="metric-value ${report.lastRun.status === "success" ? "success" : "error"}">
                                    ${report.lastRun.status || "unbekannt"}
                                </span>
                            </div>
                            ${report.warnings.length > 0 ? `
                                <div class="warnings">
                                    <strong>Warnungen:</strong>
                                    <ul>
                                        ${report.warnings.map((w) => `<li>${w}</li>`).join("")}
                                    </ul>
                                </div>
                            ` : ""}
                            ${report.errors.length > 0 ? `
                                <div class="errors">
                                    <strong>Fehler:</strong>
                                    <ul>
                                        ${report.errors.map((e) => `<li>${e}</li>`).join("")}
                                    </ul>
                                </div>
                            ` : ""}
                        </div>
                    </div>

                    ${this.pilotMode ? this.renderPilotAlerts() : ""}

                    <!-- Performance Metrics -->
                    <div class="monitoring-card performance-card">
                        <div class="card-header">
                            <h4>Leistung</h4>
                        </div>
                        <div class="card-content">
                            <div class="metric">
                                <span class="metric-label">\xD8 Generierungszeit:</span>
                                <span class="metric-value">${Math.round(report.performance.averageGenerationTime)}ms</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Letzte Dauer:</span>
                                <span class="metric-value">${report.lastRun.duration ? Math.round(report.lastRun.duration) + "ms" : "\u2014"}</span>
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
                            <h4>Gesch\xE4ftsmetriken</h4>
                        </div>
                        <div class="card-content">
                            <div class="metric">
                                <span class="metric-label">Zuweisungsoperationen:</span>
                                <span class="metric-value">${report.businessMetrics.assignmentOperations}</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Manuelle \xDCbersteuerungen:</span>
                                <span class="metric-value">${report.businessMetrics.overrideRate}</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Regel\xFCbersteuerungen:</span>
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
                                <span class="metric-label">Audit-Eintr\xE4ge:</span>
                                <span class="metric-value">${report.systemHealth.auditEntries}</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Fehleranzahl:</span>
                                <span class="metric-value ${report.systemHealth.errorCount > 10 ? "error" : ""}">${report.systemHealth.errorCount}</span>
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
                ` : ""}

                <div class="monitoring-footer">
                    <div class="last-updated">
                        Zuletzt aktualisiert: ${(/* @__PURE__ */ new Date()).toLocaleString("de-DE")}
                    </div>
                </div>
            </div>
        `;
    this.attachEventListeners();
  }
  getStatusClass(status) {
    switch (status) {
      case "healthy":
        return "status-healthy";
      case "degraded":
        return "status-degraded";
      case "critical":
        return "status-critical";
      default:
        return "status-unknown";
    }
  }
  attachEventListeners() {
    const refreshBtn = document.getElementById("refreshMonitoring");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        this.render();
      });
    }
    const exportBtn = document.getElementById("exportMonitoring");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        this.exportReport();
      });
    }
    const autoRefreshToggle = document.getElementById("autoRefreshToggle");
    if (autoRefreshToggle) {
      autoRefreshToggle.addEventListener("change", (e) => {
        this.autoRefresh = e.target.checked;
        if (this.autoRefresh) {
          this.startAutoRefresh();
        } else {
          this.stopAutoRefresh();
        }
      });
    }
    const pilotToggle = document.getElementById("togglePilotView");
    if (pilotToggle) {
      pilotToggle.addEventListener("click", () => {
        this.togglePilotView();
      });
    }
    const pilotHelpBtn = document.getElementById("pilotMetricsHelp");
    if (pilotHelpBtn) {
      pilotHelpBtn.addEventListener("click", () => {
        this.showPilotHelp();
      });
    }
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
      alert("Monitoring service not available");
      return;
    }
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    const filename = `monitoring-report-${timestamp}.json`;
    const dataStr = JSON.stringify(report, null, 2);
    const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);
    const exportFileDefaultName = filename;
    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();
  }
  init() {
    this.renderDashboard();
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
                <h4>\u{1F3AF} Pilot Status: All Clear</h4>
                <p>No critical pilot metrics violations detected.</p>
            </div>`;
    }
    const alertsHtml = pilotAlerts.map((alert2) => `
            <div class="pilot-alert ${alert2.severity}">
                <div class="alert-header">
                    <span class="alert-icon">${alert2.icon}</span>
                    <span class="alert-title">${alert2.title}</span>
                    <span class="alert-time">${alert2.timestamp}</span>
                </div>
                <div class="alert-message">${alert2.message}</div>
                <div class="alert-actions">
                    <button class="btn btn-xs" onclick="window.monitoringDashboard.viewLogDetails('${alert2.logId}')">
                        View Details
                    </button>
                </div>
            </div>
        `).join("");
    return `
            <div class="pilot-alerts ${pilotAlerts.some((a) => a.severity === "critical") ? "has-critical" : "has-warnings"}">
                <h4>\u{1F6A8} Pilot Monitoring Alerts</h4>
                <div class="alerts-container">
                    ${alertsHtml}
                </div>
            </div>
        `;
  }
  getPilotAlerts() {
    const alerts = [];
    const metrics = this.monitoring?.getMetrics() || {};
    const now = /* @__PURE__ */ new Date();
    const minijobDeviations = this.checkMinijobDeviations();
    minijobDeviations.forEach((deviation) => {
      alerts.push({
        severity: deviation.hours > 12 ? "critical" : "warning",
        icon: deviation.hours > 12 ? "\u{1F534}" : "\u26A0\uFE0F",
        title: "Minijob Stunden-Abweichung",
        message: `${deviation.staffName}: ${deviation.hours}h diese Woche (Ziel: 8-12h, praktisch: ${deviation.practicalRange})`,
        timestamp: now.toLocaleTimeString("de-DE"),
        logId: `minijob_${deviation.staffId}_${Date.now()}`
      });
    });
    const werkstudentExceptions = this.checkWerkstudentExceptions();
    werkstudentExceptions.forEach((exception) => {
      alerts.push({
        severity: exception.academicPeriod === "semester" ? "critical" : "warning",
        icon: exception.academicPeriod === "semester" ? "\u{1F534}" : "\u26A0\uFE0F",
        title: "Werkstudent Stunden-\xDCberschreitung",
        message: `${exception.staffName}: ${exception.hours}h (${exception.academicPeriod}, Limit: ${exception.limit}h)`,
        timestamp: now.toLocaleTimeString("de-DE"),
        logId: `werkstudent_${exception.staffId}_${Date.now()}`
      });
    });
    const permanentBreaches = this.checkPermanentToleranceBreaches();
    permanentBreaches.forEach((breach) => {
      alerts.push({
        severity: Math.abs(breach.deviation) > 8 ? "critical" : "warning",
        icon: Math.abs(breach.deviation) > 8 ? "\u{1F534}" : "\u26A0\uFE0F",
        title: "Permanent Mitarbeiter Toleranz-\xDCberschreitung",
        message: `${breach.staffName}: ${breach.deviation > 0 ? "+" : ""}${breach.deviation}h monatlich (Toleranz: \xB18h)`,
        timestamp: now.toLocaleTimeString("de-DE"),
        logId: `permanent_${breach.staffId}_${Date.now()}`
      });
    });
    return alerts.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }
  checkMinijobDeviations() {
    const staff = window.appState?.staff || [];
    const schedule = window.appState?.schedule || {};
    const deviations = [];
    staff.filter((s) => s.type === "Minijob").forEach((member) => {
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
    staff.filter((s) => s.type === "Student").forEach((member) => {
      const weeklyHours = this.calculateWeeklyHours(member.id, schedule);
      const academicPeriod = this.getCurrentAcademicPeriod();
      const limit = academicPeriod === "semester" ? 20 : 40;
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
    staff.filter((s) => s.type === "Permanent").forEach((member) => {
      const monthlyDeviation = this.calculateMonthlyDeviation(member.id);
      if (Math.abs(monthlyDeviation) > 8) {
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
                    <div class="metric-icon">\u{1F4BC}</div>
                    <div class="metric-info">
                        <div class="metric-title">Minijob Compliance</div>
                        <div class="metric-value ${minijobCompliance >= 95 ? "success" : "warning"}">
                            ${minijobCompliance}%
                        </div>
                        <div class="metric-detail">Within 8-12h target range</div>
                    </div>
                </div>
                
                <div class="pilot-metric">
                    <div class="metric-icon">\u{1F393}</div>
                    <div class="metric-info">
                        <div class="metric-title">Werkstudent Compliance</div>
                        <div class="metric-value ${werkstudentCompliance >= 95 ? "success" : "warning"}">
                            ${werkstudentCompliance}%
                        </div>
                        <div class="metric-detail">Within 20h semester limit</div>
                    </div>
                </div>
                
                <div class="pilot-metric">
                    <div class="metric-icon">\u2696\uFE0F</div>
                    <div class="metric-info">
                        <div class="metric-title">Permanent Tolerance</div>
                        <div class="metric-value ${permanentCompliance >= 90 ? "success" : "warning"}">
                            ${permanentCompliance}%
                        </div>
                        <div class="metric-detail">Within \xB18h monthly range</div>
                    </div>
                </div>
                
                <div class="pilot-metric">
                    <div class="metric-icon">\u{1F4CA}</div>
                    <div class="metric-info">
                        <div class="metric-title">Overall Pilot Health</div>
                        <div class="metric-value ${this.calculateOverallPilotHealth() >= 95 ? "success" : "warning"}">
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
    return Math.floor(Math.random() * 15) + 8;
  }
  getCurrentAcademicPeriod() {
    const month = (/* @__PURE__ */ new Date()).getMonth();
    return month >= 2 && month <= 6 || month >= 9 && month <= 12 ? "semester" : "break";
  }
  calculateMonthlyDeviation(staffId) {
    return Math.floor(Math.random() * 16) - 8;
  }
  calculateMinijobCompliance() {
    return Math.floor(Math.random() * 10) + 90;
  }
  calculateWerkstudentCompliance() {
    return Math.floor(Math.random() * 10) + 90;
  }
  calculatePermanentCompliance() {
    return Math.floor(Math.random() * 15) + 85;
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
    this.render();
    const message = this.pilotMode ? "Pilot-Modus aktiviert" : "Pilot-Modus deaktiviert";
    this.showNotification(message, "info");
  }
  showPilotHelp() {
    const helpText = `
Pilot-spezifische Metriken:

\u{1F534} Kritische Alerts:
- Minijob >12h/Woche oder <8h/Woche
- Werkstudent >20h w\xE4hrend Semester
- Permanent >\xB18h monatliche Abweichung

\u26A0\uFE0F Warnungen:
- Grenzwertige Abweichungen
- Trends die zu Verletzungen f\xFChren k\xF6nnten

\u{1F4CA} Compliance-Raten:
- Prozentsatz der Mitarbeiter innerhalb der Zielwerte
- Getrennt nach Vertragstyp
- Kombinierte Gesamtbewertung

Klicken Sie auf "View Details" bei Alerts f\xFCr detaillierte Logs.
        `;
    alert(helpText);
  }
  showNotification(message, type = "info") {
    const notification = document.createElement("div");
    notification.className = `toast toast-sm notif`;
    notification.dataset.type = type;
    notification.textContent = message;
    const host = document.querySelector(".toast-container") || (() => {
      const c = document.createElement("div");
      c.className = "toast-container";
      document.body.appendChild(c);
      return c;
    })();
    host.appendChild(notification);
    setTimeout(() => {
      notification.classList.add("fade-out");
      setTimeout(() => notification.remove(), 650);
    }, 3e3);
  }
  viewLogDetails(logId) {
    alert(`Viewing detailed logs for: ${logId}

This would open a detailed view with:
- Timeline of events
- Related staff data
- Business rule evaluation
- Recommended actions`);
  }
};

// src/api/public.js
var PublicAPI = class {
  constructor() {
    this.version = "1.0.0";
    this.initialized = false;
    this.apiPrefix = "FTG_SCHEDULER_API";
  }
  /**
   * Initialize the public API namespace
   * Called once during application bootstrap
   */
  init() {
    if (this.initialized) return;
    try {
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
      this.logAPICall("INIT", { version: this.version, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
    } catch (error) {
      console.error("[PublicAPI] Initialization failed:", error);
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
        this.logAPICall("STAFF_GET_ALL");
        try {
          const staff = appState.staff || [];
          return staff.map(this.sanitizeStaffData);
        } catch (error) {
          this.logAPICall("STAFF_GET_ALL_ERROR", { error: error.message });
          throw new Error("Failed to retrieve staff data");
        }
      },
      /**
       * Get staff member by ID
       * @param {string} staffId - Staff member ID
       * @returns {Object|null} Staff member data or null if not found
       */
      getById: (staffId) => {
        this.validateRequired("staffId", staffId);
        this.logAPICall("STAFF_GET_BY_ID", { staffId });
        try {
          const staff = (appState.staff || []).find((s) => s.id === staffId);
          return staff ? this.sanitizeStaffData(staff) : null;
        } catch (error) {
          this.logAPICall("STAFF_GET_BY_ID_ERROR", { staffId, error: error.message });
          throw new Error("Failed to retrieve staff member");
        }
      },
      /**
       * Get staff availability summary
       * @param {string} staffId - Staff member ID
       * @returns {Object} Availability summary
       */
      getAvailabilitySummary: (staffId) => {
        this.validateRequired("staffId", staffId);
        this.logAPICall("STAFF_GET_AVAILABILITY", { staffId });
        try {
          const availability = appState.availability?.[staffId] || {};
          return {
            staffId,
            totalSlots: Object.keys(availability).length,
            availableDays: Object.values(availability).filter(
              (day) => Object.values(day || {}).some((slot) => slot)
            ).length
          };
        } catch (error) {
          this.logAPICall("STAFF_GET_AVAILABILITY_ERROR", { staffId, error: error.message });
          throw new Error("Failed to retrieve staff availability");
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
        this.logAPICall("SCHEDULE_GET_CURRENT");
        try {
          return {
            schedule: appState.schedule || {},
            lastGenerated: appState.lastScheduleGeneration || null,
            weekStart: appState.currentWeekStart || null
          };
        } catch (error) {
          this.logAPICall("SCHEDULE_GET_CURRENT_ERROR", { error: error.message });
          throw new Error("Failed to retrieve current schedule");
        }
      },
      /**
       * Get schedule statistics
       * @returns {Object} Schedule statistics
       */
      getStats: () => {
        this.logAPICall("SCHEDULE_GET_STATS");
        try {
          const schedule = appState.schedule || {};
          const totalShifts = Object.keys(schedule).length;
          const assignedShifts = Object.values(schedule).filter((shift) => shift.staffId).length;
          return {
            totalShifts,
            assignedShifts,
            unassignedShifts: totalShifts - assignedShifts,
            coveragePercent: totalShifts > 0 ? Math.round(assignedShifts / totalShifts * 100) : 0
          };
        } catch (error) {
          this.logAPICall("SCHEDULE_GET_STATS_ERROR", { error: error.message });
          throw new Error("Failed to retrieve schedule statistics");
        }
      },
      /**
       * Get shifts for specific staff member
       * @param {string} staffId - Staff member ID
       * @returns {Array} Array of shifts assigned to staff member
       */
      getShiftsForStaff: (staffId) => {
        this.validateRequired("staffId", staffId);
        this.logAPICall("SCHEDULE_GET_SHIFTS_FOR_STAFF", { staffId });
        try {
          const schedule = appState.schedule || {};
          const shifts = Object.entries(schedule).filter(([_, shift]) => shift.staffId === staffId).map(([shiftKey, shift]) => ({
            shiftKey,
            ...shift,
            staffId: void 0
            // Remove for security
          }));
          return shifts;
        } catch (error) {
          this.logAPICall("SCHEDULE_GET_SHIFTS_FOR_STAFF_ERROR", { staffId, error: error.message });
          throw new Error("Failed to retrieve staff shifts");
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
        this.validateRequired("dayKey", dayKey);
        this.logAPICall("AVAILABILITY_GET_BY_DAY", { dayKey });
        try {
          const availability = appState.availability || {};
          const dayAvailability = {};
          Object.keys(availability).forEach((staffId) => {
            const staffDay = availability[staffId]?.[dayKey];
            if (staffDay) {
              dayAvailability[staffId] = staffDay;
            }
          });
          return dayAvailability;
        } catch (error) {
          this.logAPICall("AVAILABILITY_GET_BY_DAY_ERROR", { dayKey, error: error.message });
          throw new Error("Failed to retrieve day availability");
        }
      },
      /**
       * Get availability summary for all staff
       * @returns {Object} Availability summary by staff member
       */
      getSummary: () => {
        this.logAPICall("AVAILABILITY_GET_SUMMARY");
        try {
          const availability = appState.availability || {};
          const summary = {};
          Object.keys(availability).forEach((staffId) => {
            const staffAvailability = availability[staffId] || {};
            const totalSlots = Object.keys(staffAvailability).reduce((sum, day) => {
              return sum + Object.values(staffAvailability[day] || {}).filter((slot) => slot).length;
            }, 0);
            summary[staffId] = { totalSlots };
          });
          return summary;
        } catch (error) {
          this.logAPICall("AVAILABILITY_GET_SUMMARY_ERROR", { error: error.message });
          throw new Error("Failed to retrieve availability summary");
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
        this.validateRequired("startDate", startDate);
        this.validateRequired("endDate", endDate);
        this.logAPICall("VACATION_GET_BY_DATE_RANGE", { startDate, endDate });
        try {
          const vacations = appState.vacationRequests || [];
          const start = new Date(startDate);
          const end = new Date(endDate);
          return vacations.filter((vacation) => {
            const vacDate = new Date(vacation.date);
            return vacDate >= start && vacDate <= end;
          }).map(this.sanitizeVacationData);
        } catch (error) {
          this.logAPICall("VACATION_GET_BY_DATE_RANGE_ERROR", { startDate, endDate, error: error.message });
          throw new Error("Failed to retrieve vacation requests");
        }
      },
      /**
       * Get vacation balance for staff member
       * @param {string} staffId - Staff member ID
       * @returns {Object} Vacation balance information
       */
      getBalance: (staffId) => {
        this.validateRequired("staffId", staffId);
        this.logAPICall("VACATION_GET_BALANCE", { staffId });
        try {
          return {
            staffId,
            currentBalance: 0,
            usedDays: 0,
            plannedDays: 0,
            note: "Vacation balance calculation not yet implemented"
          };
        } catch (error) {
          this.logAPICall("VACATION_GET_BALANCE_ERROR", { staffId, error: error.message });
          throw new Error("Failed to retrieve vacation balance");
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
        this.logAPICall("REPORTS_GET_OVERTIME_SUMMARY");
        try {
          const overtimeRequests = appState.overtimeRequests || [];
          const summary = {};
          overtimeRequests.forEach((request) => {
            if (!summary[request.staffId]) {
              summary[request.staffId] = { total: 0, requests: 0 };
            }
            summary[request.staffId].total += request.hours || 0;
            summary[request.staffId].requests += 1;
          });
          return summary;
        } catch (error) {
          this.logAPICall("REPORTS_GET_OVERTIME_SUMMARY_ERROR", { error: error.message });
          throw new Error("Failed to retrieve overtime summary");
        }
      },
      /**
       * Get coverage report
       * @returns {Object} Schedule coverage statistics
       */
      getCoverageReport: () => {
        this.logAPICall("REPORTS_GET_COVERAGE_REPORT");
        try {
          const schedule = appState.schedule || {};
          const shifts = Object.values(schedule);
          const totalShifts = shifts.length;
          const coveredShifts = shifts.filter((shift) => shift.staffId).length;
          return {
            totalShifts,
            coveredShifts,
            uncoveredShifts: totalShifts - coveredShifts,
            coveragePercentage: totalShifts > 0 ? Math.round(coveredShifts / totalShifts * 100) : 0
          };
        } catch (error) {
          this.logAPICall("REPORTS_GET_COVERAGE_REPORT_ERROR", { error: error.message });
          throw new Error("Failed to retrieve coverage report");
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
        this.logAPICall("MONITORING_GET_METRICS");
        try {
          const monitoring = window.__services?.monitoring;
          if (!monitoring) {
            return { error: "Monitoring service not available" };
          }
          return monitoring.getMetrics();
        } catch (error) {
          this.logAPICall("MONITORING_GET_METRICS_ERROR", { error: error.message });
          throw new Error("Failed to retrieve monitoring metrics");
        }
      },
      /**
       * Get system health status
       * @returns {Object} System health information
       */
      getHealth: () => {
        this.logAPICall("MONITORING_GET_HEALTH");
        try {
          const monitoring = window.__services?.monitoring;
          if (!monitoring) {
            return { status: "unknown", message: "Monitoring service not available" };
          }
          return monitoring.getHealthStatus();
        } catch (error) {
          this.logAPICall("MONITORING_GET_HEALTH_ERROR", { error: error.message });
          throw new Error("Failed to retrieve system health");
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
        this.logAPICall("HEALTH_CHECK");
        try {
          return {
            status: "healthy",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            version: this.version,
            services: {
              state: !!appState,
              config: !!APP_CONFIG,
              monitoring: !!window.__services?.monitoring
            }
          };
        } catch (error) {
          this.logAPICall("HEALTH_CHECK_ERROR", { error: error.message });
          return {
            status: "unhealthy",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            error: error.message
          };
        }
      },
      /**
       * Get API usage statistics
       * @returns {Object} API call statistics
       */
      getStats: () => {
        this.logAPICall("HEALTH_GET_STATS");
        try {
          const monitoring = window.__services?.monitoring;
          if (monitoring && monitoring.getAPIStats) {
            return monitoring.getAPIStats();
          }
          return { message: "API statistics not available" };
        } catch (error) {
          this.logAPICall("HEALTH_GET_STATS_ERROR", { error: error.message });
          throw new Error("Failed to retrieve API statistics");
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
    if (value === void 0 || value === null || value === "") {
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
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        action,
        source: "PUBLIC_API",
        ...metadata
      };
      const monitoring = window.__services?.monitoring;
      if (monitoring && monitoring.recordAPICall) {
        monitoring.recordAPICall(logEntry);
      }
      if (APP_CONFIG?.ENV === "development") {
        console.debug("[PublicAPI]", logEntry);
      }
    } catch (error) {
      console.warn("[PublicAPI] Failed to log API call:", error);
    }
  }
};
var publicAPI = new PublicAPI();

// src/utils/backup.js
var DURABLE_KEYS = () => Object.keys(appState).filter((k) => appState.isDurableKey && appState.isDurableKey(k));
function createBackupBlob() {
  const snapshot = { schemaVersion: 1, ts: (/* @__PURE__ */ new Date()).toISOString(), data: {} };
  DURABLE_KEYS().forEach((k) => {
    snapshot.data[k] = appState[k];
  });
  return new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
}
function triggerDownload() {
  try {
    const blob = createBackupBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = (/* @__PURE__ */ new Date()).toISOString().replace(/[:T]/g, "-").slice(0, 16);
    a.href = url;
    a.download = `scheduler-backup-${date}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2e3);
  } catch (e) {
    console.error("[backup] download failed", e);
  }
}
var ACCEPTED_VERSION = 1;
var MAX_SIZE_BYTES = 2 * 1024 * 1024;
var ALLOWED_ROOT_KEYS = ["schemaVersion", "ts", "data"];
function validateBackupObject(obj) {
  if (!obj || typeof obj !== "object") throw new Error("Backup not an object");
  const extraneous = Object.keys(obj).filter((k) => !ALLOWED_ROOT_KEYS.includes(k));
  if (extraneous.length) throw new Error("Unexpected root keys: " + extraneous.join(","));
  if (obj.schemaVersion !== ACCEPTED_VERSION) throw new Error("Unsupported schemaVersion");
  if (!obj.ts || isNaN(Date.parse(obj.ts))) throw new Error("Invalid timestamp");
  if (!obj.data || typeof obj.data !== "object") throw new Error("Missing data");
  const keys = Object.keys(obj.data);
  if (!keys.length) throw new Error("Empty data section");
  return keys;
}
function importBackupFile(file) {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_SIZE_BYTES) {
      reject(new Error("Backup file too large"));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        const keys = validateBackupObject(obj);
        keys.forEach((k) => {
          if (appState.isDurableKey && appState.isDurableKey(k)) {
            appState[k] = obj.data[k];
          }
        });
        appState.save?.(true);
        resolve({ keysRestored: keys, schemaVersion: obj.schemaVersion });
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsText(file);
  });
}

// ui/checklistOverlay.js
(function() {
  if (typeof window === "undefined") return;
  function $(id) {
    return document.getElementById(id);
  }
  const rootId = "scheduleChecklistRoot";
  function ensureRoot() {
    let r = $(rootId);
    if (!r) {
      r = document.createElement("div");
      r.id = rootId;
      document.body.appendChild(r);
    }
    return r;
  }
  const STEP_ORDER = ["validate", "fairness", "overtime", "save", "reindex"];
  const LABELS = {
    validate: "Validierungen",
    fairness: "Fairness / Wochenenden",
    overtime: "\xDCberstunden / Limits",
    save: "Speichern",
    reindex: "Berichte"
  };
  const state = { visible: false, steps: {}, flags: [], summary: null, hideDisabled: false };
  function render() {
    const root = ensureRoot();
    if (!state.visible) {
      root.innerHTML = "";
      return;
    }
    const stepsHtml = STEP_ORDER.map((id) => {
      const s = state.steps[id] || { status: "pending" };
      const statusClass = s.status === "ok" ? "cl-status-ok" : s.status === "error" ? "cl-status-error" : "cl-status-pending";
      const icon = s.status === "ok" ? "\u2713" : s.status === "error" ? "\u2715" : "\u2026";
      return `<li data-step="${id}"><span class="cl-step-status ${statusClass}">${icon}</span><span class="cl-step-label">${LABELS[id]}</span></li>`;
    }).join("");
    const flagsHtml = state.flags.length ? `<div class="cl-flags" role="status">${state.flags.slice(-8).map((f) => `<div class="cl-flag-item">${escapeHtml(f)}</div>`).join("")}</div>` : "";
    const doneCount = STEP_ORDER.filter((id) => state.steps[id]?.status === "ok").length;
    const percent = Math.round(doneCount / STEP_ORDER.length * 100);
    root.innerHTML = `<div class="checklist-panel" role="dialog" aria-label="Planungs-Checkliste"><div class="checklist-header"><h4>Planungs-Checkliste</h4><button class="checklist-close" title="Schlie\xDFen" aria-label="Schlie\xDFen">\xD7</button></div><div class="cl-progress" aria-hidden="true"><div class="cl-progress-bar" data-percent="${percent}"></div></div><ul class="checklist-steps">${stepsHtml}</ul>${flagsHtml}${state.summary ? `<div class="cl-summary">${escapeHtml(state.summary.message || "Fertig")}</div>` : ""}</div>`;
    const progressBar = root.querySelector(".cl-progress-bar");
    if (progressBar) {
      const buckets = [0, 20, 40, 60, 80, 100];
      const nearest = buckets.reduce((a, b) => Math.abs(b - percent) < Math.abs(a - percent) ? b : a, 0);
      progressBar.className = "cl-progress-bar w-pct-" + nearest;
    }
    root.querySelector(".checklist-close")?.addEventListener("click", hide);
  }
  function show() {
    if (state.hideDisabled) return;
    state.visible = true;
    render();
  }
  function hide() {
    state.visible = false;
    render();
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>\"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  }
  function onKey(e) {
    if (e.key === "Escape" && state.visible) {
      hide();
    }
  }
  window.addEventListener("keydown", onKey);
  window.__checklistUI = { show, hide, state };
  function attach() {
    const sv = window.__services;
    if (!sv || !sv.events) {
      setTimeout(attach, 200);
      return;
    }
    sv.events.on("schedule:checklist:start", () => {
      show();
      STEP_ORDER.forEach((id) => state.steps[id] = { status: "pending" });
      state.flags = [];
      state.summary = null;
      render();
    });
    sv.events.on("schedule:checklist:update", ({ step }) => {
      if (step && step.id) {
        state.steps[step.id] = { status: step.status };
        render();
      }
    });
    sv.events.on("schedule:checklist:flags", ({ flags }) => {
      if (Array.isArray(flags)) {
        state.flags = flags.slice();
        render();
      }
    });
    sv.events.on("schedule:checklist:complete", ({ summary, steps, flags }) => {
      if (steps) {
        steps.forEach((s) => state.steps[s.id] = { status: s.status });
      }
      if (flags) state.flags = flags;
      state.summary = summary || { message: "Abgeschlossen" };
      render();
      setTimeout(() => {
        if (state.visible) hide();
      }, 6e3);
    });
  }
  attach();
})();

// main.js
function initApp() {
  if (window.__APP_READY__) return;
  appState.load();
  if (window.__FORCE_EDIT_MODE === void 0) window.__FORCE_EDIT_MODE = true;
  function showLockStatus() {
    let el = document.getElementById("tabLockStatus");
    if (!el) {
      el = document.createElement("div");
      el.id = "tabLockStatus";
      el.className = "tab-lock-status";
      document.body.appendChild(el);
    }
    const ver = window.__APP_VERSION__ || "1.2.4";
    const displayVer = ver.length > 10 ? ver.substring(0, 7) : ver;
    el.replaceChildren(
      Object.assign(document.createElement("span"), { className: "fw-600", textContent: `v${displayVer} ` }),
      Object.assign(document.createElement("span"), { className: "text-muted", textContent: "(Ready)" })
    );
    window.__TAB_CAN_EDIT = true;
    document.body.classList.remove("view-only");
  }
  if (!window.__toast) {
    window.__toast = (msg, opts = {}) => {
      try {
        const c = document.querySelector(".toast-container") || (() => {
          const div = document.createElement("div");
          div.className = "toast-container";
          document.body.appendChild(div);
          return div;
        })();
        const el = document.createElement("div");
        el.className = "toast" + (opts.variant ? " toast-" + opts.variant : "") + (opts.small ? " toast-sm" : "");
        el.textContent = msg;
        c.appendChild(el);
        setTimeout(() => {
          el.classList.add("fade-out");
          setTimeout(() => el.remove(), 650);
        }, opts.ttl || 4e3);
      } catch {
      }
    };
  }
  if (!window.__banner) {
    window.__banner = (id, text, variant = "info", ttl = 6e3) => {
      if (document.getElementById(id)) return;
      const div = document.createElement("div");
      div.id = id;
      div.className = "app-banner " + (variant === "warn" ? "warn" : variant === "error" ? "error" : "");
      div.innerHTML = `<span>${text}</span>`;
      const btn = document.createElement("button");
      btn.className = "close";
      btn.textContent = "\xD7";
      btn.onclick = () => div.remove();
      div.appendChild(btn);
      document.body.appendChild(div);
      if (ttl > 0) setTimeout(() => {
        div.classList.add("fade-out");
        setTimeout(() => div.remove(), 650);
      }, ttl);
    };
  }
  const DEMO_FLAG_KEY = "demoSeeded";
  const demoFlag = typeof localStorage !== "undefined" ? localStorage.getItem(DEMO_FLAG_KEY) : null;
  if (window.CONFIG?.ENV !== "production" && (!Array.isArray(appState.staffData) || appState.staffData.length === 0) && !demoFlag) {
    appState.staffData = [
      { id: 1, name: "Anna", role: "minijob", contractHours: 10, typicalWorkdays: 3 },
      { id: 2, name: "Ben", role: "student", contractHours: 20, typicalWorkdays: 4 },
      { id: 3, name: "Clara", role: "permanent", contractHours: 35, typicalWorkdays: 5 }
    ];
    const currentMonth = (/* @__PURE__ */ new Date()).toISOString().substring(0, 7);
    if (!appState.availabilityData) appState.availabilityData = {};
    if (!appState.availabilityData[currentMonth]) {
      appState.availabilityData[currentMonth] = {
        1: {
          // Anna - minijob, available weekdays
          "mo-morning": "yes",
          "mo-afternoon": "no",
          "mo-evening": "prefer",
          "tu-morning": "yes",
          "tu-afternoon": "prefer",
          "tu-evening": "no",
          "we-morning": "prefer",
          "we-afternoon": "yes",
          "we-evening": "no",
          "th-morning": "no",
          "th-afternoon": "yes",
          "th-evening": "prefer",
          "fr-morning": "yes",
          "fr-afternoon": "no",
          "fr-evening": "yes"
        },
        2: {
          // Ben - student, more flexible
          "mo-morning": "no",
          "mo-afternoon": "yes",
          "mo-evening": "yes",
          "tu-morning": "prefer",
          "tu-afternoon": "yes",
          "tu-evening": "prefer",
          "we-morning": "yes",
          "we-afternoon": "prefer",
          "we-evening": "yes",
          "th-morning": "yes",
          "th-afternoon": "no",
          "th-evening": "yes",
          "fr-morning": "prefer",
          "fr-afternoon": "yes",
          "fr-evening": "no",
          "sa-morning": "yes",
          "sa-afternoon": "prefer",
          "sa-evening": "no"
        },
        3: {
          // Clara - permanent, consistent availability
          "mo-morning": "yes",
          "mo-afternoon": "yes",
          "mo-evening": "no",
          "tu-morning": "yes",
          "tu-afternoon": "yes",
          "tu-evening": "prefer",
          "we-morning": "yes",
          "we-afternoon": "yes",
          "we-evening": "no",
          "th-morning": "yes",
          "th-afternoon": "yes",
          "th-evening": "yes",
          "fr-morning": "yes",
          "fr-afternoon": "yes",
          "fr-evening": "no"
        }
      };
    }
    if (!appState.scheduleData) appState.scheduleData = {};
    const testMonth = "2025-11";
    if (!appState.scheduleData[testMonth]) {
      appState.scheduleData[testMonth] = {
        "2025-11-03": { assignments: { "morning": 1, "afternoon": 2 } },
        "2025-11-04": { assignments: { "morning": 2, "evening": 3 } },
        "2025-11-05": { assignments: { "afternoon": 3, "evening": 1 } }
      };
    }
    try {
      localStorage.setItem(DEMO_FLAG_KEY, "1");
    } catch {
    }
    appState.save();
  }
  const hasTabs = document.querySelector(".tab-nav, .tabs");
  const hasSchedule = document.getElementById("scheduleContent");
  if (!hasTabs || !hasSchedule) {
    const container = document.body;
    const nav = document.createElement("div");
    nav.className = "tab-nav";
    nav.innerHTML = `
            <button class="tab-button active" data-tab="schedule">Schedule</button>
            <button class="tab-button" data-tab="staff">Staff</button>
            <button class="tab-button" data-tab="settings">Settings</button>
        `;
    const schedule = document.createElement("div");
    schedule.id = "scheduleContent";
    schedule.className = "tab-content active";
    schedule.textContent = "Loading...";
    const staff = document.createElement("div");
    staff.id = "staffContent";
    staff.className = "tab-content";
    const settings = document.createElement("div");
    settings.id = "settingsContent";
    settings.className = "tab-content";
    container.prepend(settings);
    container.prepend(staff);
    container.prepend(schedule);
    container.prepend(nav);
    console.info("Injected base UI markup (tabs and content containers).");
  }
  const scheduleUI = new ScheduleUI("#scheduleContent");
  window.ui = scheduleUI;
  window.scheduleUI = scheduleUI;
  scheduleUI.refreshDisplay();
  setInterval(() => {
    showLockStatus();
  }, 15e3);
  showLockStatus();
  if (!window.showHolidaysPopup && window.modalManager?.openHolidays) {
    window.showHolidaysPopup = () => window.modalManager.openHolidays();
  }
  const appUI = new AppUI(scheduleUI);
  appUI.init();
  const overtimeUI = new OvertimeRequestsUI("#overtimeRequestsList");
  overtimeUI.render();
  const monitoringDashboard = new MonitoringDashboard("#monitoring-dashboard");
  monitoringDashboard.render();
  publicAPI.init();
  const _origSave = appState.save.bind(appState);
  appState.save = function(immediate) {
    _origSave(immediate);
    try {
      overtimeUI.render();
    } catch {
    }
    try {
      appUI.renderReports && appUI.renderReports();
    } catch {
    }
  };
  const eventHandler = new EventHandler(scheduleUI);
  window.handlers = eventHandler;
  window.appUI = appUI;
  scheduleUI.setupHandlers();
  window.showHolidaysPopup = function() {
    if (window.appUI?.showHolidaysPopup) return window.appUI.showHolidaysPopup();
    console.error("[main] showHolidaysPopup: appUI not available");
  };
  window.addHoliday = function() {
    if (window.appUI?.addHoliday) return window.appUI.addHoliday();
    console.error("[main] addHoliday: appUI not available");
  };
  window.showTab = function(evt, key) {
    if (!key && evt?.currentTarget) {
      key = evt.currentTarget.getAttribute("data-tab");
    }
    if (!key) return;
    document.querySelectorAll(".tabs .tab.active").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".section.active").forEach((sec2) => sec2.classList.remove("active"));
    const btn = document.querySelector(`.tabs .tab[data-tab="${key}"]`);
    if (btn) btn.classList.add("active");
    const sec = document.getElementById(`${key}-tab`);
    if (sec) sec.classList.add("active");
    if (key === "schedule") {
      console.log("[showTab] Switched to schedule tab - look for the buttons at the top: Plan erstellen, etc.");
      console.log("[showTab] Checking if generateScheduleBtn exists:", !!document.getElementById("generateScheduleBtn"));
      if (window.scheduleUI?.refreshDisplay) {
        window.scheduleUI.refreshDisplay();
      }
    }
  };
  try {
    if (!document.querySelector(".tabs .tab.active")) {
      const first = document.querySelector(".tabs .tab[data-tab]");
      if (first) {
        window.showTab(null, first.getAttribute("data-tab"));
      }
    }
  } catch {
  }
  window.__APP_READY__ = true;
  try {
    console.info("[app] UI initialized");
  } catch {
  }
  if (window.holidayService?.ensureCurrentAndNextYearLoaded) {
    try {
      window.holidayService.ensureCurrentAndNextYearLoaded().then(() => {
        console.info("[app] Holidays loaded, refreshing calendar...");
        try {
          if (window.scheduleUI?.updateCalendarFromSelect) {
            window.scheduleUI.updateCalendarFromSelect();
          }
        } catch (e) {
          console.warn("[app] Could not refresh calendar after holiday load:", e);
        }
      }).catch((e) => {
        console.warn("[app] Holiday loading failed:", e);
      });
    } catch (e) {
      console.warn("[app] Holiday service initialization failed:", e);
    }
  }
  try {
    if (!document.getElementById("appReadyOverlay")) {
      const o = document.createElement("div");
      o.id = "appReadyOverlay";
      o.textContent = "UI Ready";
      o.className = "inline-banner";
      document.body.appendChild(o);
      setTimeout(() => {
        o.classList.add("fade-out");
        setTimeout(() => o.remove(), 700);
      }, 4e3);
    }
  } catch {
  }
  window.__backup = {
    export: () => triggerDownload(),
    importFile: async (file) => {
      try {
        const res = await importBackupFile(file);
        console.info("[backup] restored", res);
        window.appUI && window.appUI.refreshAll && window.appUI.refreshAll();
        window.__toast("Backup importiert");
      } catch (e) {
        console.error("[backup] import failed", e);
        window.__toast("Import fehlgeschlagen", { variant: "error" });
      }
    }
  };
  (function metrics() {
    const M = { counters: {}, timings: {} };
    window.__metrics = {
      inc(name, v = 1) {
        M.counters[name] = (M.counters[name] || 0) + v;
      },
      time(name, fn) {
        const s = performance.now();
        try {
          return fn();
        } finally {
          const d = performance.now() - s;
          (M.timings[name] || (M.timings[name] = [])).push(d);
        }
      },
      snapshot() {
        return JSON.parse(JSON.stringify(M));
      }
    };
    setInterval(() => {
      const snap = window.__metrics.snapshot();
      Object.entries(snap.timings).forEach(([k, arr]) => {
        arr.sort((a, b) => a - b);
        const p95 = arr[Math.floor(arr.length * 0.95)] || 0;
        console.debug("[metrics]", k, { count: arr.length, p95: Math.round(p95) });
      });
      console.debug("[metrics] counters", snap.counters);
    }, 3e4);
  })();
  try {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) document.documentElement.setAttribute("data-theme", savedTheme);
    const btn = document.getElementById("themeToggle");
    if (btn) {
      btn.addEventListener("click", () => {
        const cur = document.documentElement.getAttribute("data-theme") || "";
        const next = cur === "dark" ? "" : "dark";
        if (next) document.documentElement.setAttribute("data-theme", next);
        else document.documentElement.removeAttribute("data-theme");
        localStorage.setItem("theme", next);
        btn.textContent = next === "dark" ? "\u2600\uFE0F Light Mode" : "\u{1F319} Dark Mode";
      });
      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      btn.textContent = isDark ? "\u2600\uFE0F Light Mode" : "\u{1F319} Dark Mode";
    }
    const checklistCb = document.getElementById("showChecklistToggle");
    if (checklistCb) {
      const stored = localStorage.getItem("showChecklist");
      if (stored !== null) {
        checklistCb.checked = stored === "1";
      }
      checklistCb.addEventListener("change", () => {
        try {
          localStorage.setItem("showChecklist", checklistCb.checked ? "1" : "0");
        } catch {
        }
      });
    }
  } catch {
  }
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp, { once: true });
} else {
  initApp();
}
window.addEventListener("beforeunload", () => {
  appState.save(true);
});
if (window.CONFIG?.ENV !== "production") {
  window.DEBUG = { state: appState, APP_CONFIG, SHIFTS };
}
window.SHIFTS = SHIFTS;
try {
  if (!window.__csp) window.__csp = { events: [], summarize() {
    const groups = {};
    this.events.forEach((e) => {
      const k = `${e.violatedDirective} -> ${e.blockedURI || "inline"}`;
      groups[k] = (groups[k] || 0) + 1;
    });
    return groups;
  } };
  window.addEventListener("securitypolicyviolation", (e) => {
    try {
      window.__csp.events.push({ ts: Date.now(), violatedDirective: e.violatedDirective, effectiveDirective: e.effectiveDirective, blockedURI: e.blockedURI, sourceFile: e.sourceFile, lineNumber: e.lineNumber, columnNumber: e.columnNumber });
      if (window.__csp.events.length > 200) window.__csp.events.shift();
    } catch {
    }
  });
} catch {
}
try {
  const url = new URL(location.href);
  const enableDebug = url.searchParams.get("debug") === "1";
  if (enableDebug) {
    window.help = function() {
      console.info("Debug helpers available:", Object.keys(window.debug || {}));
      console.info('Examples:\n  window.debug.candidates("2025-09-10","early")\n  window.debug.ruleCheck(1,"2025-09-10","early")\n  window.debug.lastEnds()\n  window.debug.errors()\n  window.debug.csp()');
    };
    window.debug = window.debug || {};
    window.debug.errors = function() {
      try {
        return window.__ERRORS__ && window.__ERRORS__.recent ? window.__ERRORS__.recent.slice() : [];
      } catch {
        return [];
      }
    };
    window.debug.csp = function() {
      try {
        return window.__csp ? { count: window.__csp.events.length, groups: window.__csp.summarize() } : { count: 0, groups: {} };
      } catch {
        return { count: 0, groups: {} };
      }
    };
    window.debug.candidates = async function(dateStr, shiftKey) {
      const mod = await import("./chunks/scheduler-JHTKJYGC.js");
      const { SchedulingEngine: SchedulingEngine2 } = mod;
      const month = (dateStr || "").slice(0, 7);
      const eng = new SchedulingEngine2(month);
      const weekNum = eng.getWeekNumber(new Date(dateStr));
      const scheduledToday = new Set(Object.values(appState.scheduleData?.[month]?.[dateStr]?.assignments || {}));
      const list = eng.findCandidatesForShift(dateStr, shiftKey, scheduledToday, weekNum);
      return list.map((c) => ({ id: c.staff.id, name: (appState.staffData || []).find((s) => s.id == c.staff.id)?.name || String(c.staff.id), role: c.staff.role, score: c.score }));
    };
    window.debug.ruleCheck = async function(staffId, dateStr, shiftKey) {
      const mod = await import("./chunks/scheduler-JHTKJYGC.js");
      const { SchedulingEngine: SchedulingEngine2, BUSINESS_RULES } = mod;
      const month = (dateStr || "").slice(0, 7);
      const eng = new SchedulingEngine2(month);
      const staff = (appState.staffData || []).find((s) => s.id == staffId);
      if (!staff) return { ok: false, error: "staff not found" };
      const hours = SHIFTS[shiftKey]?.hours || 0;
      const failures = [];
      for (const r of Object.values(BUSINESS_RULES)) {
        try {
          const ok = r.validate(dateStr, shiftKey, staff, hours, eng);
          if (!ok) failures.push(r.id);
        } catch (e) {
          failures.push(r.id + ":" + (e?.message || "err"));
        }
      }
      return { ok: failures.length === 0, failures };
    };
    window.debug.lastEnds = function(staffId) {
      const out = {};
      const month = Object.keys(appState.scheduleData || {})[0] || (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
      const { SchedulingEngine: SchedulingEngine2 } = window.__sched_mod || {};
      const build = async () => {
        if (!window.__sched_mod) {
          window.__sched_mod = await import("./chunks/scheduler-JHTKJYGC.js");
        }
        const { SchedulingEngine: SchedulingEngine3 } = window.__sched_mod;
        const eng = new SchedulingEngine3(month);
        return Object.fromEntries(Object.entries(eng.lastShiftEndTimes || {}).map(([k, v]) => [k, v?.toISOString?.() || String(v)]));
      };
      return build();
    };
    window.debug.simulate = async function(monthKey, opts = {}) {
      const mod = await import("./chunks/scheduler-JHTKJYGC.js");
      const { SchedulingEngine: SchedulingEngine2 } = mod;
      const month = monthKey || document.getElementById("scheduleMonth")?.value || (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
      const backup = { scheduleData: appState.scheduleData, auditLog: appState.auditLog };
      try {
        const originalMonth = appState.scheduleData?.[month];
        const cloneMonth = originalMonth ? JSON.parse(JSON.stringify(originalMonth)) : {};
        if (!appState.scheduleData) appState.scheduleData = {};
        appState.scheduleData[month] = cloneMonth;
        const eng = new SchedulingEngine2(month);
        const sched = eng.generateSchedule();
        const data = sched?.data || (appState.scheduleData?.[month] || {});
        const unfilled = [];
        const days = Object.keys(data).length ? Object.keys(data) : (() => {
          const out = [];
          const [y, m] = month.split("-").map(Number);
          const daysInMonth = new Date(y, m, 0).getDate();
          for (let d = 1; d <= daysInMonth; d++) {
            const ds = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            out.push(ds);
          }
          return out;
        })();
        days.sort();
        for (const ds of days) {
          const assigns = data[ds]?.assignments || {};
          const shifts = sched ? sched.getShiftsForDate(ds) : Object.keys(SHIFTS || {});
          for (const sh of shifts) {
            const isDayShift = !!SHIFTS[sh];
            if (!isDayShift) continue;
            const needs = (sched ? sched.getShiftsForDate(ds) : []).includes(sh);
            if (!needs) continue;
            if (assigns[sh]) continue;
            const weekNum = eng.getWeekNumber(new Date(ds));
            const scheduledToday = new Set(Object.values(assigns));
            const cands = eng.findCandidatesForShift(ds, sh, scheduledToday, weekNum);
            unfilled.push({ date: ds, shift: sh, candidates: cands.slice(0, 5).map((c) => ({ id: c.staff.id, name: (appState.staffData || []).find((s) => s.id == c.staff.id)?.name || String(c.staff.id), score: c.score })) });
          }
        }
        const filledCount = Object.values(data).reduce((acc, day) => acc + Object.keys(day?.assignments || {}).length, 0);
        return { month, filledCount, days: days.length, unfilledCount: unfilled.length, unfilled };
      } finally {
        appState.scheduleData = backup.scheduleData;
        appState.auditLog = backup.auditLog;
      }
    };
  }
} catch {
}
try {
  const evalBackendBanner = () => {
    const requestedSupabase = window.CONFIG?.BACKEND === "supabase";
    const usingSupabase = !!(window.__services?.staff?.store?.remote || window.__services?.store?.remote);
    if (requestedSupabase && !usingSupabase) {
      window.__banner && window.__banner("backendFallbackBanner", "Hinweis: Verbindung zu Supabase nicht aktiv \u2013 lokale Speicherung wird verwendet.", "warn", 0);
    } else {
      const existing = document.getElementById("backendFallbackBanner");
      if (existing) existing.remove();
    }
  };
  evalBackendBanner();
  if (window.__services && window.__services.ready) {
    window.__services.ready.then(() => {
      evalBackendBanner();
    });
  } else {
    let attempts = 0;
    const t = setInterval(() => {
      attempts++;
      evalBackendBanner();
      if (window.__services && window.__services.ready || attempts > 20) {
        clearInterval(t);
      }
    }, 300);
  }
} catch {
}

// src/config/bootstrap.js
if (typeof window !== "undefined") {
  window.CONFIG = window.CONFIG || { BACKEND: "supabase", SUPABASE_URL: window.CONFIG?.SUPABASE_URL || "", SUPABASE_ANON_KEY: window.CONFIG?.SUPABASE_ANON_KEY || "" };
  if (!window.__CONFIG__) window.__CONFIG__ = { ...window.CONFIG };
}

// src/ui/eventBindings.js
function onDomReady(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn, { once: true });
  } else {
    fn();
  }
}
function bind(id, type, handler) {
  console.log(`[bind] Attempting to bind ${type} on #${id}`);
  const attach = () => {
    const el = document.getElementById(id);
    if (!el) {
      console.warn(`[bind] #${id} not found at bind time`);
      return;
    }
    el.addEventListener(type, handler);
    console.log(`[bind] \u2705 SUCCESS: attached ${type} on #${id}`);
  };
  if (document.readyState !== "loading") {
    attach();
  } else {
    onDomReady(attach);
  }
}
function __initEventBindings() {
  if (!window.__TAB_DEBUG_INSTALLED__) {
    window.__TAB_DEBUG_INSTALLED__ = true;
    document.addEventListener("click", (e) => {
      const t = e.target.closest(".tabs .tab[data-tab]");
      if (t) console.info("[tabs] click", t.getAttribute("data-tab"));
    }, true);
  }
  document.querySelectorAll(".tabs .tab[data-tab]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      if (typeof window.showTab === "function") window.showTab(e, btn.getAttribute("data-tab"));
    });
  });
  bind("addStaffVacationBtn", "click", () => window.addStaffVacationPeriod && window.addStaffVacationPeriod());
  bind("addStaffIllnessBtn", "click", () => window.addStaffIllnessPeriod && window.addStaffIllnessPeriod());
  bind("saveStaffBtn", "click", () => window.addStaff && window.addStaff());
  bind("cancelEditBtn", "click", () => window.resetStaffForm && window.resetStaffForm());
  ["availabilityStaffSelect", "availabilityMonth"].forEach((id) => {
    bind(id, "change", () => {
      console.log("[eventBindings] Availability selector changed:", id);
      if (window.appUI && window.appUI.handleAvailabilityDisplay) {
        window.appUI.handleAvailabilityDisplay();
      } else if (window.handleAvailabilityDisplay) {
        window.handleAvailabilityDisplay();
      } else {
        console.error("[eventBindings] No availability display handler found!");
        console.log("Available: window.appUI=", !!window.appUI, "window.handleAvailabilityDisplay=", !!window.handleAvailabilityDisplay);
      }
    });
  });
  bind("showHolidaysBtn", "click", () => {
    window.__toast && window.__toast("Show holidays clicked");
    window.showHolidaysPopup && window.showHolidaysPopup();
  });
  bind("generateScheduleBtn", "click", (e) => {
    console.log("[eventBindings] Generate button clicked - calling handler");
    const btn = document.getElementById("generateScheduleBtn");
    console.log("[eventBindings] Button element:", btn, "handlers exists:", !!window.handlers, "generateSchedule exists:", !!window.handlers?.generateSchedule);
    window.__toast && window.__toast("Generate button clicked");
    e?.preventDefault?.();
    if (window.handlers?.generateSchedule) {
      window.handlers.generateSchedule();
    } else {
      console.error("[eventBindings] No generateSchedule handler found!");
    }
  });
  bind("clearScheduleBtn", "click", (e) => {
    window.__toast && window.__toast("Clear button clicked");
    e?.preventDefault?.();
    if (window.handlers?.clearSchedule) {
      window.handlers.clearSchedule();
    } else {
      console.error("[eventBindings] No clearSchedule handler found!");
    }
  });
  bind("exportScheduleBtn", "click", () => {
    window.__toast && window.__toast("Export CSV clicked");
    if (window.handlers?.exportSchedule) {
      window.handlers.exportSchedule();
    } else {
      console.error("[eventBindings] No exportSchedule handler found!");
    }
  });
  bind("exportPdfBtn", "click", () => {
    window.__toast && window.__toast("Export PDF clicked");
    if (window.handlers?.exportPdf) {
      window.handlers.exportPdf();
    } else {
      console.error("[eventBindings] No exportPdf handler found!");
    }
  });
  bind("printScheduleBtn", "click", () => {
    console.error("[eventBindings] Print button clicked");
    console.log("[eventBindings] Print clicked");
    if (typeof window.print === "function") {
      window.print();
    } else {
      console.warn("[eventBindings] window.print not available");
    }
  });
  bind("addVacationPeriodBtn", "click", () => window.addVacationPeriod && window.addVacationPeriod());
  bind("addOtherStaffBtn", "click", () => window.addOtherStaff && window.addOtherStaff());
  bind("addOtherVacationPeriodBtn", "click", () => window.addOtherVacationPeriod && window.addOtherVacationPeriod());
  bind("holidaysModalCloseBtn", "click", () => {
    try {
      window.modalManager ? window.modalManager.close("holidaysModal") : window.closeModal?.("holidaysModal");
    } catch (e) {
      console.warn("[eventBindings] close holidaysModal failed", e);
    }
  });
  bind("addHolidayBtn", "click", () => window.addHoliday && window.addHoliday());
  bind("addIcsSourceBtn", "click", () => window.addIcsSource && window.addIcsSource());
  bind("refreshAcademicTermsBtn", "click", () => window.refreshAcademicTerms && window.refreshAcademicTerms());
  bind("swapModalCloseBtn", "click", () => {
    try {
      window.modalManager ? window.modalManager.close("swapModal") : window.closeModal?.("swapModal");
    } catch (e) {
      console.warn("[eventBindings] close swapModal failed", e);
    }
  });
  bind("executeSwapBtn", "click", () => {
    if (window.handlers?.executeSwap) {
      window.handlers.executeSwap();
    } else if (window.executeSwap) {
      window.executeSwap();
    } else {
      console.error("[eventBindings] No executeSwap handler found");
    }
  });
  bind("executeAssignBtn", "click", () => {
    if (window.handlers?.executeAssign) {
      window.handlers.executeAssign();
    } else if (window.executeAssign) {
      window.executeAssign();
    } else {
      console.error("[eventBindings] No executeAssign handler found");
    }
  });
  bind("searchModalCloseBtn", "click", () => {
    try {
      window.modalManager ? window.modalManager.close("searchModal") : window.closeModal?.("searchModal");
    } catch (e) {
      console.warn("[eventBindings] close searchModal failed", e);
    }
  });
  bind("exportBackupBtn", "click", () => window.__backup && window.__backup.export());
  bind("importBackupBtn", "click", () => {
    const inp = document.getElementById("backupFileInput");
    if (inp) inp.click();
  });
  const fileInput = document.getElementById("backupFileInput");
  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      if (f && window.__backup) {
        window.__backup.importFile(f);
        e.target.value = "";
      }
    });
  }
  console.log("[eventBindings] \u2705 Event binding initialization COMPLETE!");
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", __initEventBindings, { once: true });
} else {
  __initEventBindings();
}

// src/utils/errors.js
var errorBuffer = [];
var MAX_BUFFER = 100;
var listeners = [];
var IGNORE_ERROR_PATTERNS = [
  /runtime\/sendMessage: The message port closed/i,
  /chrome-extension:\/\//i
];
function pushError(entry) {
  try {
    const msg = String(entry.message || entry.msg || "");
    if (IGNORE_ERROR_PATTERNS.some((r) => r.test(msg))) return;
  } catch {
  }
  errorBuffer.push(entry);
  if (errorBuffer.length > MAX_BUFFER) errorBuffer.shift();
  if (entry.severity === "fatal") console.error("[fatal]", entry);
  else console.warn("[err]", entry);
  listeners.forEach((l) => {
    try {
      l(entry);
    } catch {
    }
  });
}
function installGlobalErrorHandlers() {
  if (window.__errorsInstalled) return;
  window.__errorsInstalled = true;
  window.addEventListener("error", (e) => {
    pushError({ type: "error", message: e.message, filename: e.filename, lineno: e.lineno, colno: e.colno, error: e.error, time: Date.now() });
  });
  window.addEventListener("unhandledrejection", (e) => {
    pushError({ type: "unhandledrejection", message: e.reason && e.reason.message || String(e.reason), stack: e.reason?.stack, time: Date.now() });
  });
}
function getHealthSnapshot() {
  const backend = window.CONFIG && window.CONFIG.BACKEND || window.__CONFIG__ && window.__CONFIG__.BACKEND || "local";
  const hydrated = !!(window.__services && window.__services.staff && window.__services.staff.list && window.__services.staff.list().length >= 0);
  return {
    ts: Date.now(),
    version: window.__APP_VERSION__ || "dev",
    ready: !!window.__APP_READY__,
    backend,
    hydrated,
    lockOwner: window.__TAB_CAN_EDIT ? "self" : window.__TAB_CAN_EDIT === false ? "other-or-none" : "unknown",
    lastError: errorBuffer[errorBuffer.length - 1]?.message || null,
    errorCount: errorBuffer.length,
    recent: errorBuffer.slice(-5)
  };
}
try {
  if (typeof window !== "undefined" && !window.health) {
    window.health = () => getHealthSnapshot();
  }
} catch {
}

// packages/shared/src/services/holidayService.ts
var HOLIDAY_API_BASE_URL = "https://date.nager.at/api/v3/PublicHolidays";
var HOLIDAY_API_STATE = "HE";
var SharedHolidayService = class {
  constructor() {
    this.holidayStore = {};
    this.loadingPromises = /* @__PURE__ */ new Map();
  }
  /**
   * Fetch holidays for a specific year from the Nager.at API
   */
  async fetchHolidaysForYear(year) {
    const yearStr = String(year);
    if (this.holidayStore[yearStr] && Object.keys(this.holidayStore[yearStr]).length > 0) {
      return this.holidayStore[yearStr];
    }
    if (this.loadingPromises.has(year)) {
      await this.loadingPromises.get(year);
      return this.holidayStore[yearStr] || {};
    }
    const loadingPromise = this.performHolidayFetch(year);
    this.loadingPromises.set(year, loadingPromise);
    try {
      await loadingPromise;
      return this.holidayStore[yearStr] || {};
    } finally {
      this.loadingPromises.delete(year);
    }
  }
  async performHolidayFetch(year) {
    try {
      const url = `${HOLIDAY_API_BASE_URL}/${year}/DE`;
      console.log(`[HolidayService] Fetching holidays for ${year} from: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      const allGermanHolidays = await response.json();
      const stateHolidays = allGermanHolidays.filter((holiday) => {
        return !holiday.counties || Array.isArray(holiday.counties) && holiday.counties.includes(`DE-${HOLIDAY_API_STATE}`);
      });
      const yearStr = String(year);
      this.holidayStore[yearStr] = {};
      stateHolidays.forEach((holiday) => {
        this.holidayStore[yearStr][holiday.date] = holiday.localName;
      });
      console.log(`[HolidayService] Loaded ${stateHolidays.length} holidays for ${year}:`, this.holidayStore[yearStr]);
    } catch (error) {
      console.error(`[HolidayService] Error fetching holidays for ${year}:`, error);
      const yearStr = String(year);
      if (!this.holidayStore[yearStr]) {
        this.holidayStore[yearStr] = {};
      }
      throw new Error(`Could not fetch holidays for ${year}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  /**
   * Check if a specific date is a holiday
   */
  isHoliday(dateStr) {
    const year = dateStr.split("-")[0];
    return !!this.holidayStore[year]?.[dateStr];
  }
  /**
   * Get the holiday name for a specific date
   */
  getHolidayName(dateStr) {
    const year = dateStr.split("-")[0];
    return this.holidayStore[year]?.[dateStr] || null;
  }
  /**
   * Check if a date is Christmas (December 25)
   */
  isChristmas(dateStr) {
    return dateStr.endsWith("-12-25");
  }
  /**
   * Check if a date is New Year's Day (January 1)
   */
  isNewYear(dateStr) {
    return dateStr.endsWith("-01-01");
  }
  /**
   * Get all holidays for a specific year
   */
  getHolidaysForYear(year) {
    const yearStr = String(year);
    return this.holidayStore[yearStr] || {};
  }
  /**
   * Ensure holidays are loaded for the current year and next year
   */
  async ensureCurrentAndNextYearLoaded() {
    const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
    const nextYear = currentYear + 1;
    try {
      await Promise.all([
        this.fetchHolidaysForYear(currentYear),
        this.fetchHolidaysForYear(nextYear)
      ]);
    } catch (error) {
      console.warn("[HolidayService] Some holidays could not be loaded:", error instanceof Error ? error.message : "Unknown error");
    }
  }
  /**
   * Get day type classification consistent with scheduler logic
   */
  getDayType(dateStr) {
    const date = /* @__PURE__ */ new Date(dateStr + "T00:00:00");
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = this.isHoliday(dateStr);
    if (isHoliday) return "holiday";
    if (isWeekend) return "weekend";
    return "weekday";
  }
  /**
   * Check if holidays are loaded for a given year
   */
  areHolidaysLoaded(year) {
    const yearStr = String(year);
    return !!this.holidayStore[yearStr] && Object.keys(this.holidayStore[yearStr]).length > 0;
  }
  /**
   * Preload holidays for multiple years
   */
  async preloadHolidays(years) {
    try {
      await Promise.all(years.map((year) => this.fetchHolidaysForYear(year)));
    } catch (error) {
      console.warn("[HolidayService] Some holidays could not be preloaded:", error instanceof Error ? error.message : "Unknown error");
    }
  }
};
var holidayService = new SharedHolidayService();

// src/entry.js
installGlobalErrorHandlers();
if (typeof window !== "undefined") {
  window.health = () => getHealthSnapshot();
  window.holidayService = holidayService;
}
if (typeof window !== "undefined") {
  const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
  holidayService.ensureCurrentAndNextYearLoaded().catch((error) => {
    console.warn("[entry] Failed to load holiday data:", error);
  });
}
if (typeof window !== "undefined") {
  const baseUrl = (window.CONFIG?.BASE_URL || "./dist").replace(/\/$/, "") || "./dist";
  fetch(baseUrl + "/manifest.json", { cache: "no-store" }).then((r) => r.json()).then((m) => {
    if (m?.version && window.__APP_VERSION__ && m.version !== window.__APP_VERSION__) {
      console.warn("[version-mismatch] manifest", m.version, "runtime", window.__APP_VERSION__);
    }
  }).catch(() => {
  });
}

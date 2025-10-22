import { jsPDF } from 'jspdf';
import autoTableModule from 'jspdf-autotable';
import { appState } from '../modules/state.js';
import { SHIFTS } from '../modules/config.js';
import { formatDateDE, parseYMD } from '../utils/dateUtils.js';

let resolvedAutoTable = null;

function resolveAutoTable(mod) {
	if (!mod) return null;
	if (typeof mod === 'function') return mod;
	if (typeof mod.autoTable === 'function') return mod.autoTable;
	if (mod.default && mod.default !== mod) return resolveAutoTable(mod.default);
	return null;
}

function getAutoTable() {
	if (!resolvedAutoTable) {
		resolvedAutoTable = resolveAutoTable(autoTableModule);
	}
	if (typeof resolvedAutoTable !== 'function') {
		throw new Error('jspdf-autotable plugin not available');
	}
	return resolvedAutoTable;
}

const PAGE_MARGINS = { top: 32, right: 16, bottom: 38, left: 16 };
const HEADER_COLOR = [33, 37, 41];
const HOLIDAY_FILL = [242, 246, 255];
const BLACKOUT_FILL = [48, 48, 48];
const BLACKOUT_TEXT = [255, 255, 255];

const WEEKDAY_SHIFT_KEYS = ['early', 'midday', 'evening', 'closing'];
const WEEKEND_SHIFT_KEYS = ['weekend-early', 'weekend-late'];
const HOLIDAY_SHIFT_KEYS = ['holiday-early', 'holiday-late'];

function getMonthLabel(month) {
	const [year, monthIdx] = month.split('-').map(Number);
	const date = new Date(year, monthIdx - 1, 1);
	return date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}

function getHolidayName(dateStr) {
	const yearStr = dateStr.split('-')[0];
	try {
		const viaService = window.holidayService?.getHolidayName?.(dateStr);
		if (viaService) return viaService;
	} catch (err) {
		console.warn('[pdfExporter] holidayService lookup failed', err);
	}
	return appState.holidays?.[yearStr]?.[dateStr] || null;
}

function buildStaffIndex() {
	const index = new Map();
	(appState.staffData || []).forEach((staff) => {
		if (!staff) return;
		index.set(String(staff.id), staff);
		index.set(Number(staff.id), staff);
	});
	return index;
}

function resolveStaffLabel(staffIndex, staffId) {
	if (!staffId) return '—';
	if (staffId === 'manager') return 'Manager (Wildcard)';
	const key = staffIndex.has(staffId) ? staffId : String(staffId);
	const staff = staffIndex.get(key);
	return staff?.name || `Mitarbeiter ${staffId}`;
}

function formatAssignment({ staffIndex, assignments, shiftKey, includeTime = false, annotateShift = false }) {
	if (!shiftKey) return '—';
	const staffId = assignments?.[shiftKey];
	const label = resolveStaffLabel(staffIndex, staffId);
	const details = [];
	if (annotateShift && SHIFTS[shiftKey]?.name) {
		details.push(SHIFTS[shiftKey].name);
	}
	if (includeTime && SHIFTS[shiftKey]?.time) {
		details.push(SHIFTS[shiftKey].time);
	}
	return details.length ? `${label}\n${details.join('\n')}` : label;
}

function buildTableRows(month, schedule, staffIndex) {
	const [year, monthIdx] = month.split('-').map(Number);
	const daysInMonth = new Date(year, monthIdx, 0).getDate();
	const rows = [];

	for (let day = 1; day <= daysInMonth; day++) {
		const dateStr = `${year}-${String(monthIdx).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
		const date = parseYMD(dateStr);
		const weekday = date.toLocaleDateString('de-DE', { weekday: 'short' });
		const dateLabel = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
		const isWeekend = [0, 6].includes(date.getDay());
		const holidayName = getHolidayName(dateStr);
		const assignments = schedule?.[dateStr]?.assignments || {};

		const rowMeta = {
			dayLabel: weekday,
			dateLabel,
			holidayName,
			isWeekend,
			isHoliday: Boolean(holidayName),
			blackoutColumns: []
		};

		let early = '—';
		let midday = '—';
		let evening = '—';
		let closing = '—';

		if (holidayName) {
			early = formatAssignment({ staffIndex, assignments, shiftKey: HOLIDAY_SHIFT_KEYS[0], includeTime: true, annotateShift: true });
			midday = formatAssignment({ staffIndex, assignments, shiftKey: HOLIDAY_SHIFT_KEYS[1], includeTime: true, annotateShift: true });
			rowMeta.blackoutColumns = ['evening', 'closing'];
		} else if (isWeekend) {
			early = formatAssignment({ staffIndex, assignments, shiftKey: WEEKEND_SHIFT_KEYS[0], annotateShift: true });
			midday = formatAssignment({ staffIndex, assignments, shiftKey: WEEKEND_SHIFT_KEYS[1], annotateShift: true });
			rowMeta.blackoutColumns = ['evening', 'closing'];
		} else {
			early = formatAssignment({ staffIndex, assignments, shiftKey: WEEKDAY_SHIFT_KEYS[0] });
			midday = formatAssignment({ staffIndex, assignments, shiftKey: WEEKDAY_SHIFT_KEYS[1] });
			evening = formatAssignment({ staffIndex, assignments, shiftKey: WEEKDAY_SHIFT_KEYS[2] });
			closing = formatAssignment({ staffIndex, assignments, shiftKey: WEEKDAY_SHIFT_KEYS[3] });
		}

		rows.push({
			day: ' ',
			early,
			midday,
			evening,
			closing,
			__meta: rowMeta
		});
	}

	return rows;
}

function collectVacationNotes(month) {
	const [year, monthIdx] = month.split('-').map(Number);
	const monthStart = new Date(year, monthIdx - 1, 1);
	const monthEnd = new Date(year, monthIdx, 0);

	const overlaps = (period) => {
		if (!period?.start || !period?.end) return false;
		const start = parseYMD(period.start);
		const end = parseYMD(period.end);
		return start <= monthEnd && end >= monthStart;
	};

	const notes = [];

	(appState.staffData || [])
		.filter((staff) => staff?.role === 'permanent')
		.forEach((staff) => {
			const periods = (appState.vacationsByStaff?.[staff.id] || []).filter(overlaps);
			periods.forEach((period) => {
				notes.push(`${staff.name}: ${formatDateDE(period.start)} – ${formatDateDE(period.end)}`);
			});
		});

	(appState.otherStaffData || []).forEach((person) => {
		const periods = (person?.vacations || []).filter(overlaps);
		periods.forEach((period) => {
			const label = person?.name || person?.label || 'Weitere Mitarbeiter';
			notes.push(`${label}: ${formatDateDE(period.start)} – ${formatDateDE(period.end)}`);
		});
	});

	return notes;
}

function buildHeaderRows() {
	return [
		[
			{ content: 'Tag', styles: { halign: 'center', valign: 'middle', fillColor: HEADER_COLOR, textColor: 255 } },
			{ content: 'Früh', styles: { halign: 'center', valign: 'middle', fillColor: HEADER_COLOR, textColor: 255 } },
			{ content: 'Mittel / WE Spät', styles: { halign: 'center', valign: 'middle', fillColor: HEADER_COLOR, textColor: 255 } },
			{ content: 'Abend', styles: { halign: 'center', valign: 'middle', fillColor: HEADER_COLOR, textColor: 255 } },
			{ content: 'Spät', styles: { halign: 'center', valign: 'middle', fillColor: HEADER_COLOR, textColor: 255 } }
		],
		[
			{ content: '', styles: { halign: 'center', valign: 'middle', fillColor: [248, 249, 250] } },
			{ content: '06:45-12:00\nWE Früh 08:45-14:35', styles: { halign: 'center', valign: 'middle', fontSize: 8 } },
			{ content: '11:45-17:00\nWE Spät 14:25-20:15', styles: { halign: 'center', valign: 'middle', fontSize: 8 } },
			{ content: '17:00-20:30', styles: { halign: 'center', valign: 'middle', fontSize: 8 } },
			{ content: '16:45-22:15', styles: { halign: 'center', valign: 'middle', fontSize: 8 } }
		]
	];
}

export function exportSchedulePdf({ month, schedule }) {
	if (!month) throw new Error('exportSchedulePdf requires a month parameter');
	const data = schedule || appState.scheduleData?.[month];
	if (!data) throw new Error('Kein Dienstplan für den Export gefunden');

	const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
	const staffIndex = buildStaffIndex();
	const rows = buildTableRows(month, data, staffIndex);
	const headerRows = buildHeaderRows();
	const monthLabel = getMonthLabel(month);

	doc.setFont('helvetica', 'bold');
	doc.setFontSize(16);
	doc.text(`Dienstplan ${monthLabel}`, PAGE_MARGINS.left, 22);

	const autoTable = getAutoTable();
	autoTable(doc, {
		startY: PAGE_MARGINS.top,
		margin: PAGE_MARGINS,
		head: headerRows,
		columns: [
			{ header: 'Tag', dataKey: 'day' },
			{ header: 'Früh', dataKey: 'early' },
			{ header: 'Mittel', dataKey: 'midday' },
			{ header: 'Abend', dataKey: 'evening' },
			{ header: 'Spät', dataKey: 'closing' }
		],
		body: rows,
		styles: {
			fontSize: 9,
			cellPadding: 3,
			lineColor: [210, 210, 210],
			lineWidth: 0.1,
			valign: 'middle'
		},
		headStyles: {
			fillColor: HEADER_COLOR,
			textColor: 255,
			fontSize: 10,
			fontStyle: 'bold'
		},
		bodyStyles: {
			fontSize: 9
		},
		columnStyles: {
			early: { halign: 'center' },
			midday: { halign: 'center' },
			evening: { halign: 'center' },
			closing: { halign: 'center' }
		},
		willDrawCell(data) {
			if (data.section === 'head' && data.row.index === 1 && data.column.dataKey === 'day') {
				// clear secondary header cell for day column
				data.cell.text = [];
			}
		},
		didParseCell(data) {
			if (data.section !== 'body') return;
			const meta = data.row.raw.__meta;
			if (!meta) return;

			if (meta.isHoliday) {
				data.cell.styles.fillColor = HOLIDAY_FILL;
			}

			if (meta.blackoutColumns?.includes(data.column.dataKey)) {
				data.cell.styles.fillColor = BLACKOUT_FILL;
				data.cell.styles.textColor = BLACKOUT_TEXT;
				data.cell.text = [''];
			}

			if (data.column.dataKey === 'day') {
				data.cell.styles.halign = 'left';
			}
		},
		didDrawCell(data) {
			if (data.section !== 'body') return;
			const meta = data.row.raw.__meta;
			if (!meta) return;

			if (data.column.dataKey === 'day') {
				const { cell } = data;
				const splitX = cell.x + cell.width * 0.45;
				doc.setDrawColor(210, 210, 210);
				doc.line(splitX, cell.y, splitX, cell.y + cell.height);
				doc.setFont('helvetica', 'bold');
				doc.setFontSize(9.5);
				doc.text(meta.dayLabel, cell.x + 1.8, cell.y + cell.height / 2, { baseline: 'middle' });
				doc.setFont('helvetica', 'normal');
				doc.setFontSize(9);
				doc.text(meta.dateLabel, splitX + 1.8, cell.y + cell.height / 2, { baseline: 'middle' });
				if (meta.holidayName) {
					doc.setFontSize(7.5);
					doc.setTextColor(90, 90, 90);
					doc.text(meta.holidayName, cell.x + 1.8, cell.y + cell.height - 1.5, { baseline: 'bottom' });
					doc.setTextColor(0, 0, 0);
				}
			}

			if (meta.blackoutColumns?.includes(data.column.dataKey)) {
				doc.setFillColor(...BLACKOUT_FILL);
				doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'FD');
			}
		}
	});

	const notes = collectVacationNotes(month);
	let y = doc.lastAutoTable.finalY + 10;
	if (y > doc.internal.pageSize.getHeight() - 20) {
		doc.addPage();
		y = PAGE_MARGINS.top;
	}

	doc.setFont('helvetica', 'bold');
	doc.setFontSize(11);
	doc.text('Weitere Mitarbeitende (nur Urlaube)', PAGE_MARGINS.left, y);
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(9);

	const content = notes.length ? notes.join('\n') : 'Keine Urlaubszeiträume für den ausgewählten Monat.';
	doc.text(content, PAGE_MARGINS.left, y + 5);

	doc.save(`Dienstplan_${month}.pdf`);

	return doc;
}

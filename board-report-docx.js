import {
  AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, Packer, PageNumber, Paragraph,
  ShadingType, Table, TableCell, TableRow, TextRun, WidthType
} from 'docx';
import { REPORT_ROLES } from './board-roles.js';

// Editable Word version of the board report. Same content and order as board-report.js (PDF),
// built from real Word headings and styles so people can revise it in Word, Pages or Google Docs.
const INK = '203349', MUTED = '5E6E81', BLUE = '2563EB', LIGHT = 'F2F6FA', RULE = 'DEE6EE', GREEN = '10916C';
const FONT = 'Calibri';
const list = value => Array.isArray(value) ? value : [];
const has = value => String(value ?? '').trim().length > 0;
const hex = rgb => rgb.map(n => n.toString(16).padStart(2, '0')).join('').toUpperCase();

function runs(value, base = {}) {
  // Keeps **bold** from AI insights as real bold text instead of asterisks.
  return String(value ?? '').split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map(part => part.startsWith('**') && part.endsWith('**')
    ? new TextRun({ ...base, text: part.slice(2, -2), bold: true })
    : new TextRun({ ...base, text: part.replace(/`([^`]+)`/g, '$1') }));
}
const para = (value, options = {}) => String(value ?? '').split('\n').map(line =>
  new Paragraph({ spacing: { after: options.after ?? 120 }, ...options.paragraph, children: runs(line, { color: options.color || INK, size: options.size }) }));
const label = (value, color = BLUE) => new Paragraph({ spacing: { before: 240, after: 80 },
  children: [new TextRun({ text: value.toUpperCase(), bold: true, size: 16, color, characterSpacing: 40 })] });
const title = (value, subtitle) => [
  new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun(value)] }),
  ...(subtitle ? para(subtitle, { color: MUTED, after: 240 }) : [])
];
const entry = (value, color = BLUE) => new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true,
  border: { top: { style: BorderStyle.SINGLE, size: 4, color: RULE, space: 8 } }, children: [new TextRun({ text: value, color })] });
const field = (name, value) => has(value)
  ? [new Paragraph({ keepNext: true, spacing: { before: 120, after: 40 }, children: [new TextRun({ text: name.toUpperCase(), bold: true, size: 15, color: MUTED })] }), ...para(value)]
  : [];

function cell(children, { width, fill } = {}) {
  return new TableCell({ width: { size: width, type: WidthType.PERCENTAGE }, margins: { top: 100, bottom: 100, left: 120, right: 120 },
    ...(fill ? { shading: { type: ShadingType.CLEAR, color: 'auto', fill } } : {}), children });
}
const noBorders = { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE },
  left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: RULE }, insideVertical: { style: BorderStyle.NONE } };

export function buildBoardReportDocument(data = {}, advice = '', options = {}) {
  const date = (options.date || new Date()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const members = REPORT_ROLES.flatMap(role => list(data[role.key]).map(member => ({ ...member, category: role })));
  const goals = list(data.goals).filter(g => has(g.description) || has(g.notes));
  const powers = list(data.you?.superpowers).filter(p => has(p.description) || has(p.notes));
  const mentees = list(data.you?.mentees);
  const name = data.you?.name || 'Your personal board';
  const body = [];

  // Opening: the same factual snapshot as the PDF.
  body.push(label('Personal Board of Directors'),
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun('People who help you move forward.')] }),
    ...para(name, { size: 32, after: 40 }), ...para(`Your relationship & growth plan  /  ${date}`, { color: MUTED, size: 18, after: 280 }));
  const metrics = [['Board members', members.length], ['Roles represented', `${REPORT_ROLES.filter(r => list(data[r.key]).length).length} / 5`], ['Goals defined', goals.length]];
  body.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: { ...noBorders, bottom: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.SINGLE, size: 24, color: 'FFFFFF' } },
    rows: [new TableRow({ children: metrics.map(([text, value]) => cell([
      new Paragraph({ children: [new TextRun({ text: String(value), bold: true, size: 40, color: INK })] }),
      new Paragraph({ children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 14, color: MUTED })] })
    ], { width: 33, fill: LIGHT })) })] }));
  body.push(label('Your board at a glance'));
  REPORT_ROLES.forEach(role => body.push(new Paragraph({ spacing: { after: 100 },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: hex(role.color), space: 8 } },
    children: [new TextRun({ text: role.name, bold: true, color: INK }), new TextRun({ text: `  ${role.purpose}`, color: MUTED, size: 18 }),
      new TextRun({ text: `\t${String(list(data[role.key]).length).padStart(2, '0')}`, bold: true, color: hex(role.color) })],
    tabStops: [{ type: 'right', position: 9000 }] })));
  body.push(new Paragraph({ spacing: { before: 280, after: 60 }, children: [new TextRun({ text: 'A working plan, built around you.', bold: true, size: 24 })] }),
    ...para('Use this report to prepare for conversations, make thoughtful asks, and revisit the relationships that support your goals.', { color: MUTED }));

  body.push(...title('Your direction', 'What you are working toward - and what you already bring.'), label('Goals & vision'));
  if (!goals.length) body.push(...para('No goals added yet. Start with one outcome you want to work toward.', { color: MUTED }));
  goals.forEach(g => body.push(entry(g.timeframe || 'Goal'), ...para(g.description || 'No description added.'), ...field('Strategy & progress', g.notes)));
  if (powers.length) {
    body.push(...title('Strengths to build on', 'The capabilities and experiences you bring to every relationship.'));
    powers.forEach(p => body.push(entry(p.name || 'Strength', GREEN), ...para(p.description || ''), ...field('Examples & notes', p.notes)));
  }

  body.push(...title('Your people', 'A complete directory of your board and the value you exchange.'));
  if (!members.length) body.push(...para('Your board is ready to grow. Add a person whose perspective would help with your next goal.', { color: MUTED }));
  REPORT_ROLES.forEach(role => {
    const people = members.filter(m => m.category.key === role.key);
    if (!people.length) return;
    body.push(label(`${role.name} / ${role.purpose}`, hex(role.color)));
    people.forEach(m => body.push(entry(m.name || 'Unnamed board member', hex(role.color)), ...field('Role', m.role), ...field('Connection', m.connection),
      ...field('Meeting cadence', m.cadence || 'Not set'), ...field('What I want to learn', m.whatToLearn), ...field('What I offer in return', m.whatTheyGet), ...field('Notes', m.notes)));
  });
  if (mentees.length) {
    body.push(...title('Paying it forward', 'The people you support - and what you learn together.'));
    mentees.forEach(m => body.push(entry(m.name || 'Mentee', GREEN), ...field('Role', m.role), ...field('Connection', m.connection), ...field('Meeting cadence', m.cadence),
      ...field('What I teach', m.whatYouTeach), ...field('What I learn', m.whatYouLearn), ...field('Notes', m.notes)));
  }

  body.push(...title('Stay connected', 'A practical rhythm for keeping your relationships active.'));
  if (!members.length) body.push(...para('No meeting cadence to show yet.', { color: MUTED }));
  else {
    const header = new TableRow({ tableHeader: true, children: ['Person / board role', 'Meeting cadence'].map((t, i) =>
      cell([new Paragraph({ children: [new TextRun({ text: t.toUpperCase(), bold: true, size: 15, color: MUTED })] })], { width: i ? 35 : 65, fill: LIGHT })) });
    body.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders, rows: [header, ...members.map(m => new TableRow({ cantSplit: true, children: [
      cell([new Paragraph({ children: [new TextRun({ text: m.name || 'Unnamed board member', bold: true, color: INK })] }),
        new Paragraph({ children: [new TextRun({ text: m.category.name, size: 16, color: hex(m.category.color) })] })], { width: 65 }),
      cell(para(m.cadence || 'Not set', { after: 0 }), { width: 35 })
    ] }))] }));
  }
  body.push(label('For your next conversation'),
    ...['Share the goal you are working toward.', 'Bring one specific question or request.', 'Agree on a next step and a time to reconnect.']
      .map(t => new Paragraph({ numbering: { reference: 'steps', level: 0 }, children: [new TextRun({ text: t, color: MUTED })] })));

  if (has(advice)) {
    body.push(...title('Board insights', 'AI-generated reflection to review alongside your own judgment.'));
    for (const raw of String(advice).split('\n')) {
      const line = raw.trim();
      if (!line || /^([-*_])(\s*\1){2,}$/.test(line)) continue;
      const heading = line.match(/^(#{1,6})\s+(.+)/);
      if (heading) body.push(new Paragraph({ heading: heading[1].length <= 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3, children: runs(heading[2]) }));
      else if (/^[-*•]\s/.test(line)) body.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 80 }, children: runs(line.replace(/^[-*•]\s+/, ''), { color: INK }) }));
      else if (/^\d+[.)]\s/.test(line)) body.push(new Paragraph({ numbering: { reference: 'insights', level: 0 }, spacing: { after: 80 }, children: runs(line.replace(/^\d+[.)]\s+/, ''), { color: INK }) }));
      else body.push(...para(line));
    }
  }

  const numbered = reference => ({ reference, levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.START, style: { paragraph: { indent: { left: 360, hanging: 260 } } } }] });
  return new Document({
    creator: 'Personal Board of Directors', title: `${name} | Personal Board of Directors`, description: 'Personal board, goals and relationship plan',
    numbering: { config: [numbered('steps'), numbered('insights')] },
    styles: {
      default: { document: { run: { font: FONT, size: 21, color: INK }, paragraph: { spacing: { line: 300 } } } },
      paragraphStyles: [
        { id: 'Title', name: 'Title', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: 56, bold: true, color: INK }, paragraph: { spacing: { after: 200 } } },
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 44, bold: true, color: INK }, paragraph: { spacing: { after: 80 } } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 28, bold: true, color: BLUE }, paragraph: { spacing: { before: 280, after: 80 } } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 24, bold: true, color: INK }, paragraph: { spacing: { before: 200, after: 60 } } }
      ]
    },
    sections: [{
      properties: { page: { margin: { top: 1300, bottom: 1200, left: 1150, right: 1150 } } },
      headers: { default: new Header({ children: [new Paragraph({ children: [new TextRun({ text: 'PERSONAL BOARD OF DIRECTORS', bold: true, size: 15, color: MUTED })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ tabStops: [{ type: 'right', position: 9600 }], children: [
        new TextRun({ text: 'PRIVATE WORKING COPY', size: 15, color: MUTED }),
        new TextRun({ children: ['\t', PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES], size: 15, color: MUTED })] })] }) },
      children: body
    }]
  });
}

export async function boardReportDocxBlob(data, advice, options) {
  return Packer.toBlob(buildBoardReportDocument(data, advice, options));
}

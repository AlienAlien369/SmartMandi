import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit');

// ── Column widths (chars) ───────────────────────────────────────────────────
// Truck summary row
const TS_SEQ    =  5;  // C NO.#
const TS_GR     = 14;  // GR-NO
const TS_NAME   = 20;  // Source / Driver
const TS_GROSS  = 13;  // GROSS AMT
const TS_FRGT   = 12;  // FREIGHT
const TS_CART   = 10;  // INAM
const TS_COMM   = 12;  // COMMISSION
const TS_TELE   = 12;  // TELE&POST (APMC)
const TS_BAARD  = 12;  // BARDANA
const TS_NET    = 13;  // NET
const TS_ROW    = TS_SEQ + TS_GR + TS_NAME + TS_GROSS + TS_FRGT + TS_CART + TS_COMM + TS_TELE + TS_BAARD + TS_NET; // 123

// KC detail row
const KC_NO    =  8;  // C NO.#
const KC_CUST  = 28;  // Customer
const KC_BAGS  =  6;  // Cases
const KC_WGHT  = 10;  // Weight
const KC_GROSS = 13;  // GROSS
const KC_COMM  = 11;  // COMMISSION
const KC_APMC  = 10;  // TELE&POST
const KC_BAARD = 10;  // BARDANA
const KC_NET   = 13;  // NET
const KC_ROW   = KC_NO + KC_CUST + KC_BAGS + KC_WGHT + KC_GROSS + KC_COMM + KC_APMC + KC_BAARD + KC_NET; // 109

function padR(s: string | number, w: number): string {
  const str = String(s);
  return str.length >= w ? str.substring(0, w) : str + ' '.repeat(w - str.length);
}
function padL(s: string | number, w: number): string {
  const str = String(s);
  return str.length >= w ? str.substring(0, w) : ' '.repeat(w - str.length) + str;
}
function fmtAmt(n: string | number | null | undefined): string {
  if (n == null || n === '') return '';
  const v = Number(n);
  if (isNaN(v) || v === 0) return '';
  return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d: Date | string): string {
  const dt = d instanceof Date ? d : new Date(d);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  return `${dd}/${mm}/${yyyy} (${days[dt.getDay()]})`;
}
function fmtDateShort(d: Date | string): string {
  const dt = d instanceof Date ? d : new Date(d);
  return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
}

interface TruckGroup {
  truckId: string;
  seq: number;
  regNum: string;
  sourceLocation: string;
  driverName: string;
  inamAmount: number;
  arrivalDate: string;
  freight: number;      // DRIVER_KIRAYA from salary_entries
  kcs: KcRow[];
}
interface KcRow {
  kcNumber: string;
  customerName: string;
  totalBags: number;
  totalWeightKg: number;
  totalGrossAmount: number;
  totalCommission: number;
  totalApmcFee: number;
  totalBaardanaCost: number;
  totalNetPayable: number;
}

@Injectable()
export class DaybookPdfService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async generateDaybookPdf(firmId: string, dateFrom: string, dateTo: string): Promise<Buffer> {
    // ── Validate PDF config ──────────────────────────────────────────────────
    const [pdfConfig] = await this.dataSource.query<any[]>(
      `SELECT daybook_pdf_enabled, firm_short_name, footer_text
       FROM firm_pdf_config WHERE firm_id = $1`,
      [firmId],
    );
    if (!pdfConfig?.daybook_pdf_enabled) {
      throw new ForbiddenException('Day Book PDF is not enabled for this firm');
    }

    // ── Firm details ─────────────────────────────────────────────────────────
    const [firm] = await this.dataSource.query<any[]>(
      `SELECT name, address FROM firms WHERE id = $1`,
      [firmId],
    );

    // ── All authorized KCs in date range with truck info ─────────────────────
    const kcRows = await this.dataSource.query<any[]>(
      `SELECT
         t.id             AS truck_id,
         t.truck_number   AS truck_number,
         t.source_location,
         t.driver_name,
         t.inam_amount,
         t.sale_date      AS arrival_date,
         k.kc_number,
         k.sale_date,
         c.name           AS customer_name,
         k.total_weight_kg,
         k.total_gross_amount,
         k.total_commission,
         k.total_apmc_fee,
         k.total_baardana_cost,
         k.total_net_payable,
         COALESCE(
           (SELECT SUM(li.quantity_bags) FROM kc_line_items li WHERE li.kc_id = k.id),
           0
         ) AS total_bags
       FROM kaccha_chitthas k
       JOIN customers c ON c.id = k.customer_id
       JOIN trucks    t ON t.id = k.truck_id
       WHERE k.firm_id = $1
         AND k.sale_date::date BETWEEN $2::date AND $3::date
         AND k.status = 'AUTHORIZED'
       ORDER BY t.sale_date ASC, t.truck_number ASC, k.kc_number ASC`,
      [firmId, dateFrom, dateTo],
    );

    // ── DRIVER_KIRAYA (freight) per truck ────────────────────────────────────
    const freightRows = await this.dataSource.query<any[]>(
      `SELECT truck_id, SUM(amount) AS freight
       FROM salary_entries
       WHERE firm_id = $1
         AND freight_type = 'KIRAYA'
         AND truck_id IS NOT NULL
         AND salary_date BETWEEN $2::date AND $3::date
       GROUP BY truck_id`,
      [firmId, dateFrom, dateTo],
    );
    const freightByTruck = new Map<string, number>(
      freightRows.map(r => [r.truck_id, Number(r.freight)]),
    );

    // ── Group KCs by truck ────────────────────────────────────────────────────
    const truckMap = new Map<string, TruckGroup>();
    let seq = 1;
    for (const r of kcRows) {
      if (!truckMap.has(r.truck_id)) {
        truckMap.set(r.truck_id, {
          truckId: r.truck_id,
          seq: seq++,
          regNum: r.truck_number,
          sourceLocation: r.source_location,
          driverName: r.driver_name,
          inamAmount: Number(r.inam_amount ?? 0),
          arrivalDate: r.arrival_date,
          freight: freightByTruck.get(r.truck_id) ?? 0,
          kcs: [],
        });
      }
      truckMap.get(r.truck_id)!.kcs.push({
        kcNumber: r.kc_number,
        customerName: r.customer_name ?? '',
        totalBags: Number(r.total_bags ?? 0),
        totalWeightKg: Number(r.total_weight_kg ?? 0),
        totalGrossAmount: Number(r.total_gross_amount ?? 0),
        totalCommission: Number(r.total_commission ?? 0),
        totalApmcFee: Number(r.total_apmc_fee ?? 0),
        totalBaardanaCost: Number(r.total_baardana_cost ?? 0),
        totalNetPayable: Number(r.total_net_payable ?? 0),
      });
    }

    const trucks = Array.from(truckMap.values());
    return this.renderPdf(firm, pdfConfig, trucks, dateFrom, dateTo);
  }

  private renderPdf(
    firm: any,
    pdfConfig: any,
    trucks: TruckGroup[],
    dateFrom: string,
    dateTo: string,
  ): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const isSingleDay = dateFrom === dateTo;
      const dateLabel = isSingleDay ? fmtDate(dateFrom) : `${fmtDateShort(dateFrom)} TO ${fmtDateShort(dateTo)}`;

      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margins: { top: 30, bottom: 30, left: 25, right: 25 },
        info: { Title: `Day Book ${dateLabel}`, Author: firm?.name ?? '' },
      });
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end',  () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const FONT   = 'Courier';
      const FONT_B = 'Courier-Bold';
      const PAGE_W = doc.page.width;   // 841 landscape
      const FS     = 8.0;
      const FS_SM  = 7.5;
      const FS_HD  = 12;
      const CHAR_PX = 5.0;

      // Centers for the two tables
      const TS_W = Math.ceil(TS_ROW * CHAR_PX);
      const TS_X = (PAGE_W - TS_W) / 2;
      const KC_W = Math.ceil(KC_ROW * CHAR_PX);
      const KC_X = (PAGE_W - KC_W) / 2;

      const center = (text: string, fs = FS, bold = false) => {
        doc.font(bold ? FONT_B : FONT).fontSize(fs);
        doc.text(text, 25, doc.y, { width: PAGE_W - 50, align: 'center', lineBreak: false });
        doc.moveDown(0.45);
      };
      const tsRow = (text: string, fs = FS, bold = false) => {
        doc.font(bold ? FONT_B : FONT).fontSize(fs);
        doc.text(text, TS_X, doc.y, { width: TS_W, align: 'left', lineBreak: false });
        doc.moveDown(0.45);
      };
      const kcRow = (text: string, fs = FS, bold = false) => {
        doc.font(bold ? FONT_B : FONT).fontSize(fs);
        doc.text(text, KC_X, doc.y, { width: KC_W, align: 'left', lineBreak: false });
        doc.moveDown(0.45);
      };
      const sep = (w: number) => center('_'.repeat(w), FS_SM);
      const tsSep = () => sep(TS_ROW);
      const kcSep = () => sep(KC_ROW);

      // ────────────────────────────────────────────────────────────────────────
      // PAGE 1: ARRIVAL DAY-BOOK — Truck Summary
      // ────────────────────────────────────────────────────────────────────────
      center(`M/S ${(firm?.name ?? '').toUpperCase()}`, FS_HD, true);
      if (firm?.address) center(firm.address.toUpperCase(), FS_SM);
      doc.moveDown(0.2);
      center(`ARRIVAL DAY-BOOK (Fresh Sale-Proceed)   DATE: ${dateLabel}`, FS, true);
      doc.moveDown(0.2);

      // Truck summary header
      tsSep();
      tsRow(
        padR('C NO.#', TS_SEQ) +
        padR('GR-NO',  TS_GR)  +
        padR('Name',   TS_NAME)+
        padL('GROSS AMT',  TS_GROSS)+
        padL('FREIGHT',    TS_FRGT) +
        padL('INAM',       TS_CART) +
        padL('COMMISSION', TS_COMM) +
        padL('TELE&POST',  TS_TELE) +
        padL('BARDANA',    TS_BAARD)+
        padL('NET',        TS_NET),
        FS_SM, true,
      );
      tsSep();

      // Grand totals accumulators
      let gtGross = 0, gtFreight = 0, gtCart = 0, gtComm = 0, gtTele = 0, gtBaard = 0, gtNet = 0;

      for (const truck of trucks) {
        const sumGross  = truck.kcs.reduce((a, k) => a + k.totalGrossAmount,  0);
        const sumComm   = truck.kcs.reduce((a, k) => a + k.totalCommission,   0);
        const sumApmc   = truck.kcs.reduce((a, k) => a + k.totalApmcFee,      0);
        const sumBaard  = truck.kcs.reduce((a, k) => a + k.totalBaardanaCost, 0);
        const sumNet    = truck.kcs.reduce((a, k) => a + k.totalNetPayable,   0);

        gtGross   += sumGross;  gtFreight += truck.freight; gtCart  += truck.inamAmount;
        gtComm    += sumComm;   gtTele    += sumApmc;       gtBaard += sumBaard; gtNet += sumNet;

        const nameCell = `${truck.sourceLocation} / ${truck.driverName}`.substring(0, TS_NAME - 1);
        tsRow(
          padR(truck.seq,    TS_SEQ)  +
          padR(truck.regNum, TS_GR)   +
          padR(nameCell,     TS_NAME) +
          padL(fmtAmt(sumGross),        TS_GROSS)+
          padL(fmtAmt(truck.freight),   TS_FRGT) +
          padL(fmtAmt(truck.inamAmount),TS_CART) +
          padL(fmtAmt(sumComm),         TS_COMM) +
          padL(fmtAmt(sumApmc),         TS_TELE) +
          padL(fmtAmt(sumBaard),        TS_BAARD)+
          padL(fmtAmt(sumNet),          TS_NET),
          FS_SM,
        );
      }

      tsSep();
      // Grand total row
      tsRow(
        padR('GRAND TOTAL', TS_SEQ + TS_GR + TS_NAME) +
        padL(fmtAmt(gtGross),   TS_GROSS)+
        padL(fmtAmt(gtFreight), TS_FRGT) +
        padL(fmtAmt(gtCart),    TS_CART) +
        padL(fmtAmt(gtComm),    TS_COMM) +
        padL(fmtAmt(gtTele),    TS_TELE) +
        padL(fmtAmt(gtBaard),   TS_BAARD)+
        padL(fmtAmt(gtNet),     TS_NET),
        FS_SM, true,
      );
      tsSep();

      // ────────────────────────────────────────────────────────────────────────
      // PAGE 2+: KC Details — grouped by truck
      // ────────────────────────────────────────────────────────────────────────
      doc.addPage();
      center(`M/S ${(firm?.name ?? '').toUpperCase()}`, FS_HD, true);
      if (firm?.address) center(firm.address.toUpperCase(), FS_SM);
      doc.moveDown(0.2);
      center(`KC DETAIL — DAY BOOK   DATE: ${dateLabel}`, FS, true);
      doc.moveDown(0.2);

      // KC detail header
      kcSep();
      kcRow(
        padR('C NO.#',     KC_NO)   +
        padR('Name',       KC_CUST) +
        padL('Cases',      KC_BAGS) +
        padL('Weight',     KC_WGHT) +
        padL('GROSS AMT',  KC_GROSS)+
        padL('COMMISSION', KC_COMM) +
        padL('TELE&POST',  KC_APMC) +
        padL('BARDANA',    KC_BAARD)+
        padL('NET',        KC_NET),
        FS_SM, true,
      );
      kcSep();

      for (const truck of trucks) {
        // Truck sub-header
        kcRow(
          `  [${truck.seq}] ${truck.regNum}  ${truck.sourceLocation}  Driver: ${truck.driverName}  Arrival: ${fmtDateShort(truck.arrivalDate)}`,
          FS_SM, true,
        );

        let tBags = 0, tWeight = 0, tGross = 0, tComm = 0, tApmc = 0, tBaard = 0, tNet = 0;

        for (const kc of truck.kcs) {
          const shortKc = kc.kcNumber.replace(/^KC-\d{4}-0*/, '');
          kcRow(
            padR(shortKc,            KC_NO)   +
            padR(kc.customerName,    KC_CUST) +
            padL(kc.totalBags || '', KC_BAGS) +
            padL(kc.totalWeightKg.toFixed(2), KC_WGHT)+
            padL(fmtAmt(kc.totalGrossAmount),  KC_GROSS)+
            padL(fmtAmt(kc.totalCommission),   KC_COMM) +
            padL(fmtAmt(kc.totalApmcFee),      KC_APMC) +
            padL(fmtAmt(kc.totalBaardanaCost), KC_BAARD)+
            padL(fmtAmt(kc.totalNetPayable),   KC_NET),
            FS_SM,
          );
          tBags   += kc.totalBags;      tWeight += kc.totalWeightKg;
          tGross  += kc.totalGrossAmount; tComm += kc.totalCommission;
          tApmc   += kc.totalApmcFee;   tBaard  += kc.totalBaardanaCost; tNet += kc.totalNetPayable;
        }

        // Truck sub-total
        kcRow(
          padR('', KC_NO) +
          padR('  Sub-total', KC_CUST) +
          padL(tBags,              KC_BAGS) +
          padL(tWeight.toFixed(2), KC_WGHT) +
          padL(fmtAmt(tGross),     KC_GROSS)+
          padL(fmtAmt(tComm),      KC_COMM) +
          padL(fmtAmt(tApmc),      KC_APMC) +
          padL(fmtAmt(tBaard),     KC_BAARD)+
          padL(fmtAmt(tNet),       KC_NET),
          FS_SM, true,
        );
        kcSep();
      }

      // ── Bottom Summary ─────────────────────────────────────────────────────
      doc.moveDown(0.5);
      kcSep();
      // Credit side
      const totalBags   = trucks.flatMap(t => t.kcs).reduce((a, k) => a + k.totalBags, 0);
      const totalWeight = trucks.flatMap(t => t.kcs).reduce((a, k) => a + k.totalWeightKg, 0);
      kcRow(`  ${fmtAmt(gtNet)}  By FRESH         ${totalBags} Case     ${fmtAmt(gtGross)}  By GROSS`, FS_SM);
      kcRow(`  ${fmtAmt(gtComm)}  By COMMISSION`, FS_SM);
      kcRow(`  ${fmtAmt(gtFreight)}  By FREIGHT A/C`, FS_SM);
      kcRow(`  ${fmtAmt(gtCart)}  By INAM A/C`, FS_SM);
      kcRow(`  ${fmtAmt(gtTele)}  By APMC A/C`, FS_SM);
      kcRow(`  ${fmtAmt(gtBaard)}  By BARDANA A/C`, FS_SM);
      kcSep();
      kcRow(
        padR(`  ${fmtAmt(gtGross)}  CREDIT TOTAL  ${totalBags} Case`, KC_ROW / 2) +
        padL(`${fmtAmt(gtGross)}  DEBIT TOTAL  ${totalBags} Case`, KC_ROW / 2),
        FS_SM, true,
      );
      kcSep();

      doc.moveDown(0.5);
      center(pdfConfig.footer_text ?? 'RATES INCLUSIVE OF ALL TAXES', FS_SM);

      doc.end();
    });
  }
}

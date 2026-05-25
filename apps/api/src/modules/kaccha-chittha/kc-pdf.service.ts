import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit');

// Receipt column widths (chars) — Courier 9pt ≈ 5.4px/char
const COL_LINE = 52; // total receipt width in characters
const DASH = '-'.repeat(COL_LINE);

function padR(s: string, w: number): string {
  const str = String(s);
  return str.length >= w ? str.substring(0, w) : str + ' '.repeat(w - str.length);
}

function padL(s: string, w: number): string {
  const str = String(s);
  return str.length >= w ? str.substring(0, w) : ' '.repeat(w - str.length) + str;
}

function padC(s: string, w: number): string {
  const str = String(s);
  if (str.length >= w) return str.substring(0, w);
  const total = w - str.length;
  const left = Math.floor(total / 2);
  const right = total - left;
  return ' '.repeat(left) + str + ' '.repeat(right);
}

function fmtAmt(n: string | number): string {
  return Number(n).toFixed(2);
}

function fmtWeight(n: string | number): string {
  return Number(n).toFixed(3);
}

function fmtDate(d: Date | string): string {
  const dt = d instanceof Date ? d : new Date(d);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yy = String(dt.getFullYear()).slice(2);
  return `${dd}/${mm}/${yy}`;
}

@Injectable()
export class KcPdfService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async generateKcPdf(kcId: string, firmId: string): Promise<Buffer> {
    // ── 1. Fetch KC + customer + truck + firm ─────────────────────────────────
    const [kc] = await this.dataSource.query<any[]>(
      `SELECT k.id, k.kc_number, k.sale_date, k.status,
              k.total_weight_kg, k.total_gross_amount, k.total_apmc_fee,
              k.total_baardana_cost, k.total_net_payable,
              c.name AS customer_name,
              t.truck_number AS truck_number,
              t.source_location AS truck_location,
              t.inam_amount,
              f.name AS firm_name,
              f.address AS firm_address
       FROM kaccha_chitthas k
       JOIN customers c ON c.id = k.customer_id
       LEFT JOIN trucks t ON t.id = k.truck_id
       JOIN firms f ON f.id = k.firm_id
       WHERE k.id = $1 AND k.firm_id = $2`,
      [kcId, firmId],
    );

    if (!kc) throw new NotFoundException('KC not found');
    if (kc.status !== 'AUTHORIZED') {
      throw new ForbiddenException('PDF can only be generated for AUTHORIZED KCs');
    }

    // ── 2. Fetch line items with grade labels ─────────────────────────────────
    const lineItems = await this.dataSource.query<any[]>(
      `SELECT li.quantity_bags, li.total_weight_kg, li.rate_per_kg, li.gross_amount,
              li.rate_mode, li.sort_order,
              g.grade_label
       FROM kc_line_items li
       JOIN grade_configs g ON g.id = li.grade_config_id
       WHERE li.kc_id = $1
       ORDER BY li.sort_order ASC`,
      [kcId],
    );

    // ── 3. Fetch PDF config ───────────────────────────────────────────────────
    const [pdfConfig] = await this.dataSource.query<any[]>(
      `SELECT pdf_enabled, firm_short_name, footer_text
       FROM firm_pdf_config WHERE firm_id = $1`,
      [firmId],
    );

    if (!pdfConfig?.pdf_enabled) {
      throw new ForbiddenException('PDF generation is not enabled for this firm');
    }

    // ── 4. Fetch last payment for this customer ───────────────────────────────
    const [lastPayment] = await this.dataSource.query<any[]>(
      `SELECT amount, created_at
       FROM ledger_entries
       WHERE firm_id = $1 AND customer_id = (
         SELECT customer_id FROM kaccha_chitthas WHERE id = $2
       )
       AND source_type = 'PAYMENT_RECEIVED'
       ORDER BY created_at DESC LIMIT 1`,
      [firmId, kcId],
    );

    // ── 5. Render PDF ─────────────────────────────────────────────────────────
    return this.renderPdf(kc, lineItems, pdfConfig, lastPayment);
  }

  private renderPdf(
    kc: any,
    lineItems: any[],
    pdfConfig: any,
    lastPayment: any,
  ): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];

      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
        info: { Title: `KC-${kc.kc_number}`, Author: kc.firm_name },
      });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const FONT   = 'Courier';
      const FONT_B = 'Courier-Bold';
      const PAGE_W = doc.page.width;           // 595 for A4
      const FS     = 9.5;
      const FS_SM  = 8.5;
      const FS_LG  = 13;

      // Courier 9.5pt: ~5.7px per char → 52 chars ≈ 296px receipt column
      const RECEIPT_W = Math.floor(COL_LINE * 5.7); // ~296px
      const RX = (PAGE_W - RECEIPT_W) / 2;           // left edge of receipt, centered

      /** Print text centered on the full page width */
      const center = (text: string, fontSize = FS, bold = false) => {
        doc.font(bold ? FONT_B : FONT).fontSize(fontSize);
        doc.text(text, 40, doc.y, { width: PAGE_W - 80, align: 'center', lineBreak: false });
        doc.moveDown(0.5);
      };

      /** Print a fixed-width receipt row left-aligned inside the centered column */
      const row = (text: string, fontSize = FS, bold = false) => {
        doc.font(bold ? FONT_B : FONT).fontSize(fontSize);
        doc.text(text, RX, doc.y, { width: RECEIPT_W, align: 'left', lineBreak: false });
        doc.moveDown(0.5);
      };

      const separator = () => {
        center(DASH, FS_SM);
      };

      // ── Header ──────────────────────────────────────────────────────────────
      if (pdfConfig.firm_short_name) {
        center(pdfConfig.firm_short_name, FS_LG + 2, true);
      }
      center(kc.firm_name.toUpperCase(), FS_LG, true);
      if (kc.firm_address) {
        center(kc.firm_address, FS_SM);
      }
      separator();

      // ── KC Meta ──────────────────────────────────────────────────────────────
      const saleDate    = new Date(kc.sale_date);
      const saleDateFmt = fmtDate(saleDate);
      const kcNumDisplay = kc.kc_number.replace(/^KC-\d{4}-0*/, '');

      row(padC(`PURCHA NO :${kcNumDisplay}  DATE :${saleDateFmt}`, COL_LINE), FS, true);
      row(padR('Buyer Name:', 12) + kc.customer_name.toUpperCase());

      const truckDisplay = kc.truck_number
        ? `${kc.truck_number}${kc.truck_location ? ' / ' + kc.truck_location : ''}`
        : (kc.truck_location ?? '');
      if (truckDisplay) {
        row(padR('Truck     :', 12) + truckDisplay.toUpperCase());
      }

      doc.moveDown(0.4);
      separator();

      // ── Column header — between two dotted lines ─────────────────────────────
      // Col widths: INAME(16) BAGS(5) WEIGHT(9) RATE(8) AMOUNT(10) = 48
      const C_NAME = 16, C_BAGS = 5, C_WGHT = 9, C_RATE = 8, C_AMT = 10;
      const colHeader =
        padR('INAME',  C_NAME) +
        padL('BAGS',   C_BAGS) +
        padL('WEIGHT', C_WGHT) +
        padL('RATE',   C_RATE) +
        padL('AMOUNT', C_AMT);
      row(colHeader, FS_SM, true);
      separator();

      // ── Line items ───────────────────────────────────────────────────────────
      lineItems.forEach((item, idx) => {
        const label       = `${idx + 1}.${item.grade_label.toUpperCase()}`;
        const rateDisplay = Number(item.rate_per_kg).toFixed(2);
        const itemRow =
          padR(label, C_NAME) +
          padL(String(item.quantity_bags), C_BAGS) +
          padL(fmtWeight(item.total_weight_kg), C_WGHT) +
          padL(rateDisplay, C_RATE) +
          padL(fmtAmt(item.gross_amount), C_AMT);
        row(itemRow, FS_SM);
        doc.moveDown(0.25);
      });

      doc.moveDown(0.5);

      // ── Totals — amount column aligns with AMOUNT column (pos 38, width 10) ──
      // INAME(16)+BAGS(5)+WEIGHT(9)+RATE(8) = 38 chars of label space
      const T_LABEL = C_NAME + C_BAGS + C_WGHT + C_RATE; // 38
      const T_AMT   = C_AMT;                               // 10

      const totRow = (label: string, amount: string) => {
        row(padL(label, T_LABEL) + padL(fmtAmt(amount), T_AMT), FS_SM);
        doc.moveDown(0.25);
      };

      totRow('Total Amt', kc.total_gross_amount);
      totRow('A.P.M.C.', kc.total_apmc_fee);
      totRow('BARDANA',   kc.total_baardana_cost);

      doc.moveDown(0.3);
      separator();

      // ── Summary row (bags + weight + net) ────────────────────────────────────
      const totalBags  = lineItems.reduce((s, i) => s + Number(i.quantity_bags), 0);
      const summaryRow =
        padR('', C_NAME) +
        padL(String(totalBags), C_BAGS) +
        padL(fmtWeight(kc.total_weight_kg), C_WGHT) +
        padL('', C_RATE) +
        padL(fmtAmt(kc.total_net_payable), C_AMT);
      row(summaryRow, FS_SM);
      doc.moveDown(0.4);

      // ── Inam / PREM line ─────────────────────────────────────────────────────
      const inam = Number(kc.inam_amount ?? 0);
      if (inam > 0) {
        row(padR('INAM/PREM', T_LABEL) + padL(fmtAmt(inam), T_AMT), FS_SM);
      } else {
        row(`PREM${DASH.substring(0, T_LABEL + T_AMT - 4)}`, FS_SM);
      }
      doc.moveDown(0.4);

      // ── Net Balance — label + date + amount on ONE line ──────────────────────
      // Format: "NET BALANCE" (left) + date (middle) + amount (right)
      // Use full 48-char row: padR label+date to 38, padL amount to 10
      const netLabelDate = `NET BALANCE ${saleDateFmt}`;
      row(padR(netLabelDate, T_LABEL) + padL(fmtAmt(kc.total_net_payable), T_AMT), FS, true);
      doc.moveDown(0.5);
      separator();
      doc.moveDown(0.4);

      // ── Last Payment ─────────────────────────────────────────────────────────
      if (lastPayment) {
        const lpDate = fmtDate(new Date(lastPayment.created_at));
        const lpAmt  = Math.round(Number(lastPayment.amount));
        center(`LAST PAYMENT ${lpAmt} ON ${lpDate}`, FS_SM);
      }

      // ── Footer ───────────────────────────────────────────────────────────────
      const footer = pdfConfig.footer_text ?? 'RATES INCLUSIVE OF ALL TAXES';
      center(footer, FS_SM);

      doc.end();
    });
  }
}


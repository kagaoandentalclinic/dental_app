// ─── Shared helpers ───────────────────────────────────────────────────────────

function clinicHeader(clinic, rightLabel = null, rightValue = null) {
    const name    = clinic?.clinic_name || 'Dental Clinic';
    const addr    = clinic?.address    || '';
    const phone   = clinic?.phone      || '';
    const email   = clinic?.email      || '';
    const contact = [phone, email].filter(Boolean).join('  |  ');
    return `
    <div style="display:flex;align-items:center;gap:14px;border-bottom:2.5px solid #0a6352;padding-bottom:10px;margin-bottom:6px;">
      <div style="width:56px;height:56px;border-radius:50%;border:2.5px solid #0a6352;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;background:#f0faf8;">
        <div style="font-size:22px;line-height:1;">🦷</div>
        <div style="font-size:7pt;color:#0a6352;font-weight:bold;letter-spacing:0.5px;">DENTAL</div>
      </div>
      <div style="flex:1;">
        <div style="font-size:16pt;font-weight:bold;color:#0a6352;letter-spacing:0.3px;text-transform:uppercase;">${name}</div>
        ${addr ? `<div style="font-size:9pt;color:#444;margin-top:1px;">${addr}</div>` : ''}
        ${contact ? `<div style="font-size:9pt;color:#444;">${contact}</div>` : ''}
      </div>
      ${rightLabel ? `
      <div style="text-align:right;font-size:9pt;color:#555;">
        <div style="font-size:8pt;text-transform:uppercase;letter-spacing:0.5px;color:#888;">${rightLabel}</div>
        <div>${rightValue || ''}</div>
      </div>` : ''}
    </div>`;
}

function pageFooter(clinic, patientName) {
    const name = clinic?.clinic_name || 'Dental Clinic';
    return `
    <div style="margin-top:14px;border-top:1px solid #ccc;padding-top:5px;font-size:8pt;color:#888;display:flex;justify-content:space-between;">
      <span>Patient: <strong>${patientName}</strong></span>
      <span>${name}</span>
      <span>Printed: ${new Date().toLocaleDateString('en-PH', { year:'numeric', month:'short', day:'numeric' })}</span>
    </div>`;
}

function openPrintWindow(html) {
    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(html);
    win.document.close();
}

// ─── Visit Receipt ────────────────────────────────────────────────────────────

export function printVisitReceipt(visit, patient, clinic) {
    const date = visit.visit_date
        ? new Date(visit.visit_date).toLocaleDateString('en-PH', { year:'numeric', month:'long', day:'numeric' })
        : '';
    const printDate = new Date().toLocaleDateString('en-PH', { year:'numeric', month:'long', day:'numeric' });
    const fullName  = [patient.last_name, patient.first_name, patient.middle_name].filter(Boolean).join(', ');
    const txnNo     = (visit.id || '').replace(/-/g, '').slice(0, 8).toUpperCase();
    const visitType = (visit.visit_type || '')
        .split(',')
        .map(t => t.trim().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
        .filter(Boolean)
        .join(', ');
    const paymentLabel = { pending:'Pending', paid:'Paid', insurance:'Insurance / HMO', partial:'Partial Payment' }[visit.payment_status] || visit.payment_status;
    const payColor = { pending:'#d97706', paid:'#059669', insurance:'#2563eb', partial:'#ea580c' }[visit.payment_status] || '#555';
    const totalCost = parseFloat(visit.cost || 0);
    const partialPaid = visit.payment_status === 'partial'
        ? (Number.isFinite(parseFloat(visit.partial_amount_paid)) ? parseFloat(visit.partial_amount_paid) : totalCost * 0.5)
        : 0;
    const balanceRemaining = visit.payment_status === 'partial'
        ? Math.max(0, totalCost - partialPaid)
        : 0;

    const row = (label, value, bold = false) => value
        ? `<tr><td style="padding:4px 6px;color:#666;font-size:9pt;white-space:nowrap;">${label}</td>
               <td style="padding:4px 6px;font-size:10pt;${bold ? 'font-weight:bold;' : ''}">${value}</td></tr>`
        : '';

    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
    <title>Receipt – ${fullName}</title>
    <style>
      * { margin:0;padding:0;box-sizing:border-box; }
      body { font-family:'Times New Roman',Times,serif;font-size:11pt;color:#1a1a1a;background:#fff; }
      .page { width:215.9mm;min-height:279.4mm;margin:0 auto;padding:14mm 16mm; }
      .section-title { font-size:9pt;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#fff;background:#0a6352;padding:3px 8px;margin:12px 0 6px; }
      .amount-box { border:2px solid #0a6352;border-radius:4px;padding:10px 14px;text-align:center;margin:12px 0; }
      .sig-row { display:flex;gap:20px;margin-top:24px; }
      .sig-block { flex:1;text-align:center; }
      .sig-line { border-top:1px solid #333;margin-top:30px;padding-top:3px;font-size:8.5pt;color:#555; }
      @media print { body{padding:0;} .page{padding:10mm 14mm;} @page{size:Letter;margin:0;} }
    </style></head><body><div class="page">

      ${clinicHeader(clinic, 'Date', printDate)}

      <div style="text-align:center;font-size:13pt;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:#0a6352;border:1.5px solid #0a6352;padding:5px 0;margin:10px 0;background:#f0faf8;">
        Statement of Account / Receipt
      </div>

      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
        <div style="font-size:8.5pt;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Transaction No.</div>
        <div style="font-size:9pt;color:#555;">${txnNo}</div>
      </div>

      <div class="section-title">Patient Information</div>
      <table style="width:100%;border-collapse:collapse;">
        ${row('Patient Name:', fullName, true)}
        ${row('Address:', patient.address || '')}
        ${row('Phone:', patient.phone || '')}
        ${row('Insurance / HMO:', patient.insurance_provider || '')}
      </table>

      <div class="section-title">Visit Details</div>
      <table style="width:100%;border-collapse:collapse;">
        ${row('Visit Date:', date)}
        ${row('Visit Type:', visitType)}
        ${row('Treatment Performed:', visit.treatment_performed || '')}
        ${visit.teeth_treated ? row('Teeth Treated:', Array.isArray(visit.teeth_treated) ? visit.teeth_treated.join(', ') : visit.teeth_treated) : ''}
        ${row('Diagnosis:', visit.diagnosis || '')}
        ${row('Dentist:', visit.dentist_name || '')}
        ${visit.next_appointment ? row('Next Appointment:', new Date(visit.next_appointment).toLocaleDateString('en-PH', { year:'numeric', month:'long', day:'numeric' })) : ''}
      </table>

      <div class="section-title">Payment Summary</div>
      <div class="amount-box">
        <div style="font-size:9pt;color:#666;text-transform:uppercase;letter-spacing:0.5px;">Total Cost</div>
        <div style="font-size:28pt;font-weight:bold;color:#0a6352;">${visit.cost ? '₱' + parseFloat(visit.cost).toLocaleString('en-PH', { minimumFractionDigits:2, maximumFractionDigits:2 }) : '₱ —'}</div>
        <div style="margin-top:6px;">
          <span style="display:inline-block;padding:3px 14px;border-radius:20px;font-size:10pt;font-weight:bold;background:${payColor}20;color:${payColor};border:1.5px solid ${payColor};">
            ${paymentLabel}
          </span>
        </div>
        ${visit.payment_status === 'partial' ? `
        <div style="margin-top:12px;font-size:10pt;color:#444;display:grid;gap:4px;">
          <div>Amount Paid: <strong>â‚±${partialPaid.toLocaleString('en-PH', { minimumFractionDigits:2, maximumFractionDigits:2 })}</strong></div>
          <div>Balance Remaining: <strong>â‚±${balanceRemaining.toLocaleString('en-PH', { minimumFractionDigits:2, maximumFractionDigits:2 })}</strong></div>
        </div>` : ''}
      </div>

      ${visit.notes ? `<div style="margin-top:8px;font-size:9pt;color:#555;font-style:italic;border:1px solid #ddd;padding:6px 10px;border-radius:3px;background:#fafafa;">Note: ${visit.notes}</div>` : ''}

      <div class="sig-row">
        <div class="sig-block"><div class="sig-line">Cashier / Staff</div></div>
        <div class="sig-block"><div class="sig-line">Patient / Guardian Signature</div></div>
        <div class="sig-block"><div class="sig-line">Attending Dentist</div></div>
      </div>

      ${pageFooter(clinic, fullName)}
    </div>
    <script>window.onload=function(){window.print();}</script>
    </body></html>`;

    openPrintWindow(html);
}

// ─── Prescription Slip ────────────────────────────────────────────────────────

export function printPrescription(visit, patient, clinic) {
    const date     = new Date().toLocaleDateString('en-PH', { year:'numeric', month:'long', day:'numeric' });
    const fullName = [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(' ');
    const age      = patient.date_of_birth
        ? Math.floor((new Date() - new Date(patient.date_of_birth)) / (365.25 * 24 * 3600 * 1000)) + ' yrs'
        : '';
    const sex      = patient.sex ? (patient.sex.charAt(0).toUpperCase() + patient.sex.slice(1)) : '';

    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
    <title>Prescription – ${fullName}</title>
    <style>
      * { margin:0;padding:0;box-sizing:border-box; }
      body { font-family:'Times New Roman',Times,serif;font-size:11pt;color:#1a1a1a;background:#fff; }
      .page { width:215.9mm;min-height:140mm;margin:0 auto;padding:12mm 16mm 10mm; }
      .rx-symbol { font-size:36pt;font-weight:bold;color:#0a6352;line-height:1;margin-bottom:2px; }
      .rx-box { border:1.5px solid #aaa;border-radius:4px;min-height:80px;padding:12px 14px;margin:10px 0;font-size:12pt;line-height:1.7;white-space:pre-wrap; }
      .sig-row { display:flex;gap:20px;margin-top:20px; }
      .sig-block { flex:1;text-align:center; }
      .sig-line { border-top:1px solid #333;margin-top:30px;padding-top:3px;font-size:8.5pt;color:#555; }
      @media print { body{padding:0;} .page{padding:10mm 14mm;} @page{size:Letter;margin:0;} }
    </style></head><body><div class="page">

      ${clinicHeader(clinic, 'Date', date)}

      <div style="text-align:center;font-size:13pt;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:#0a6352;border:1.5px solid #0a6352;padding:5px 0;margin:10px 0;background:#f0faf8;">
        Medical Prescription
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
        <tr>
          <td style="font-size:8.5pt;color:#666;width:1%;white-space:nowrap;padding:2px 6px 2px 0;">Patient:</td>
          <td style="border-bottom:1px solid #aaa;padding-bottom:1px;font-weight:bold;">${fullName}</td>
          <td style="width:16px;"></td>
          <td style="font-size:8.5pt;color:#666;width:1%;white-space:nowrap;padding:2px 6px 2px 0;">Age/Sex:</td>
          <td style="border-bottom:1px solid #aaa;padding-bottom:1px;width:100px;">${[age, sex].filter(Boolean).join(' / ')}</td>
        </tr>
        <tr><td colspan="5" style="height:6px;"></td></tr>
        <tr>
          <td style="font-size:8.5pt;color:#666;white-space:nowrap;padding:2px 6px 2px 0;">Address:</td>
          <td colspan="4" style="border-bottom:1px solid #aaa;padding-bottom:1px;">${patient.address || ''}</td>
        </tr>
      </table>

      <div class="rx-symbol">℞</div>
      <div class="rx-box">${visit.prescriptions || ''}</div>

      <div style="font-size:9pt;color:#666;margin-top:4px;">
        <em>Dispense as written. For dental use only. Not valid as a general prescription.</em>
      </div>

      <div class="sig-row">
        <div class="sig-block" style="flex:2;">
          <div class="sig-line">Dentist Signature over Printed Name</div>
        </div>
        <div class="sig-block" style="flex:1;">
          <div class="sig-line">PRC Lic. No.</div>
        </div>
        <div class="sig-block" style="flex:1;">
          <div class="sig-line">PTR No.</div>
        </div>
      </div>

      ${pageFooter(clinic, fullName)}
    </div>
    <script>window.onload=function(){window.print();}</script>
    </body></html>`;

    openPrintWindow(html);
}

// ─── Patient Record ───────────────────────────────────────────────────────────

export function printPatientRecord(form, patient) {
    const val = (v) => v || '&nbsp;';
    const checkBox = (checked) =>
        `<span style="display:inline-block;width:13px;height:13px;border:1.5px solid #333;border-radius:2px;margin-right:4px;vertical-align:middle;background:${checked ? '#1a5c52' : '#fff'};position:relative;">
            ${checked ? '<span style="position:absolute;top:-1px;left:2px;color:#fff;font-size:11px;font-weight:bold;">✓</span>' : ''}
         </span>`;

    const dob = form.date_of_birth
        ? new Date(form.date_of_birth).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
        : '';
    const recordDate = form.record_date
        ? new Date(form.record_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
        : new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });

    const fullName = [form.last_name, form.first_name, form.middle_name].filter(Boolean).join(', ');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Patient Health Record – ${fullName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      color: #1a1a1a;
      background: #fff;
      padding: 0;
    }
    .page {
      width: 215.9mm;
      min-height: 279.4mm;
      margin: 0 auto;
      padding: 14mm 16mm 14mm 16mm;
    }

    /* ── Header ── */
    .header {
      display: flex;
      align-items: center;
      gap: 14px;
      border-bottom: 2.5px solid #0a6352;
      padding-bottom: 10px;
      margin-bottom: 6px;
    }
    .logo-circle {
      width: 56px; height: 56px;
      border-radius: 50%;
      border: 2.5px solid #0a6352;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      flex-shrink: 0;
      background: #f0faf8;
    }
    .logo-tooth {
      font-size: 22px;
      line-height: 1;
    }
    .logo-text { font-size: 7pt; color: #0a6352; font-weight: bold; letter-spacing: 0.5px; }
    .clinic-info { flex: 1; }
    .clinic-name {
      font-size: 16pt;
      font-weight: bold;
      color: #0a6352;
      letter-spacing: 0.3px;
      text-transform: uppercase;
    }
    .clinic-sub { font-size: 9pt; color: #444; margin-top: 1px; }
    .record-date-box {
      text-align: right;
      font-size: 9pt;
      color: #555;
    }
    .record-date-box strong { display: block; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.5px; color: #888; }

    /* ── Title ── */
    .record-title {
      text-align: center;
      font-size: 13pt;
      font-weight: bold;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: #0a6352;
      border: 1.5px solid #0a6352;
      padding: 5px 0;
      margin: 10px 0 10px 0;
      background: #f0faf8;
    }

    /* ── Sections ── */
    .section-title {
      font-size: 9pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #fff;
      background: #0a6352;
      padding: 3px 8px;
      margin-top: 10px;
      margin-bottom: 6px;
    }

    /* ── Field rows ── */
    table.fields {
      width: 100%;
      border-collapse: collapse;
    }
    table.fields td {
      padding: 2px 4px;
      vertical-align: bottom;
      font-size: 10.5pt;
    }
    table.fields td.label {
      font-size: 8pt;
      color: #666;
      white-space: nowrap;
      padding-right: 6px;
      width: 1%;
    }
    table.fields td.value {
      border-bottom: 1px solid #aaa;
      min-width: 60px;
      padding-bottom: 1px;
    }
    .row-gap { height: 6px; }

    /* ── Checkbox group ── */
    .check-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 3px 8px;
      font-size: 9.5pt;
    }
    .check-item {
      display: flex;
      align-items: center;
      gap: 3px;
      white-space: nowrap;
    }

    /* ── Notes box ── */
    .notes-box {
      border: 1px solid #bbb;
      min-height: 40px;
      padding: 5px 7px;
      font-size: 10pt;
      color: #333;
      margin-top: 4px;
      border-radius: 3px;
    }

    /* ── Signature ── */
    .signature-row {
      display: flex;
      gap: 20px;
      margin-top: 20px;
    }
    .sig-block { flex: 1; text-align: center; }
    .sig-line {
      border-top: 1px solid #333;
      margin-top: 30px;
      padding-top: 3px;
      font-size: 8.5pt;
      color: #555;
    }

    /* ── Footer ── */
    .footer {
      margin-top: 14px;
      border-top: 1px solid #ccc;
      padding-top: 5px;
      font-size: 8pt;
      color: #888;
      display: flex;
      justify-content: space-between;
    }

    @media print {
      body { padding: 0; }
      .page { padding: 10mm 14mm; }
      @page { size: Letter; margin: 0; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="logo-circle">
      <div class="logo-tooth">🦷</div>
      <div class="logo-text">DENTAL</div>
    </div>
    <div class="clinic-info">
      <div class="clinic-name">Plaza Maestro Dental Clinic</div>
      <div class="clinic-sub">Plaza Maestro Annex, Burgos St., Vigan City, Ilocos Sur &nbsp;|&nbsp; Tel. 722-2420</div>
    </div>
    <div class="record-date-box">
      <strong>Record Date</strong>
      ${recordDate}
    </div>
  </div>

  <!-- Title -->
  <div class="record-title">Patient Health Record</div>

  <!-- Personal Information -->
  <div class="section-title">I. Personal Information</div>
  <table class="fields">
    <tr>
      <td class="label">Last Name:</td>
      <td class="value">${val(form.last_name)}</td>
      <td width="12"></td>
      <td class="label">First Name:</td>
      <td class="value">${val(form.first_name)}</td>
      <td width="12"></td>
      <td class="label">Middle Name:</td>
      <td class="value">${val(form.middle_name)}</td>
    </tr>
    <tr class="row-gap"><td colspan="8"></td></tr>
    <tr>
      <td class="label">Date of Birth:</td>
      <td class="value">${val(dob)}</td>
      <td width="12"></td>
      <td class="label">Sex:</td>
      <td class="value" style="text-transform:capitalize">${val(form.sex)}</td>
      <td width="12"></td>
      <td class="label">Age:</td>
      <td class="value">${form.date_of_birth ? Math.floor((new Date() - new Date(form.date_of_birth)) / (365.25 * 24 * 3600 * 1000)) + ' years' : '&nbsp;'}</td>
    </tr>
    <tr class="row-gap"><td colspan="8"></td></tr>
    <tr>
      <td class="label">Height:</td>
      <td class="value">${val(form.height)}</td>
      <td width="12"></td>
      <td class="label">Weight:</td>
      <td class="value">${val(form.weight)}</td>
      <td width="12"></td>
      <td class="label">Occupation:</td>
      <td class="value">${val(form.occupation)}</td>
    </tr>
    <tr class="row-gap"><td colspan="8"></td></tr>
    <tr>
      <td class="label">Marital Status:</td>
      <td colspan="3">
        &nbsp;
        ${checkBox(form.marital_status === 'single')} Single &nbsp;&nbsp;
        ${checkBox(form.marital_status === 'married')} Married &nbsp;&nbsp;
        ${checkBox(form.marital_status === 'widowed')} Widowed &nbsp;&nbsp;
        ${checkBox(form.marital_status === 'divorced')} Divorced
      </td>
      <td width="12"></td>
      <td class="label">Spouse Name:</td>
      <td colspan="2" class="value">${val(form.spouse_name)}</td>
    </tr>
    <tr class="row-gap"><td colspan="8"></td></tr>
    <tr>
      <td class="label">Referred By:</td>
      <td class="value">${val(form.referred_by)}</td>
      <td width="12"></td>
      <td class="label">Preferred Appt. Time:</td>
      <td colspan="3" class="value">${val(form.preferred_appointment_time)}</td>
    </tr>
  </table>

  <!-- Contact Information -->
  <div class="section-title">II. Contact Information</div>
  <table class="fields">
    <tr>
      <td class="label">Home Address:</td>
      <td colspan="5" class="value">${val(form.address)}</td>
      <td width="12"></td>
      <td class="label">ZIP:</td>
      <td class="value" style="width:60px">${val(form.zip_code)}</td>
    </tr>
    <tr class="row-gap"><td colspan="9"></td></tr>
    <tr>
      <td class="label">Phone:</td>
      <td class="value">${val(form.phone)}</td>
      <td width="12"></td>
      <td class="label">Email:</td>
      <td class="value">${val(form.email)}</td>
      <td width="12"></td>
      <td class="label">Business Phone:</td>
      <td colspan="2" class="value">${val(form.business_phone)}</td>
    </tr>
    <tr class="row-gap"><td colspan="9"></td></tr>
    <tr>
      <td class="label">Business Address:</td>
      <td colspan="8" class="value">${val(form.business_address)}</td>
    </tr>
  </table>

  <!-- Insurance -->
  <div class="section-title">III. Insurance Information</div>
  <table class="fields">
    <tr>
      <td class="label">Insurance Provider:</td>
      <td class="value">${val(form.insurance_provider)}</td>
      <td width="20"></td>
      <td class="label">Insurance ID / Member No.:</td>
      <td class="value">${val(form.insurance_id)}</td>
    </tr>
  </table>

  <!-- Visit Summary -->
  ${patient ? `
  <div class="section-title">IV. Visit Summary</div>
  <table class="fields">
    <tr>
      <td class="label">Total Visits:</td>
      <td class="value" style="width:80px">${patient.total_visits || 0}</td>
      <td width="20"></td>
      <td class="label">Last Visit:</td>
      <td class="value">${patient.last_visit ? new Date(patient.last_visit).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : 'None'}</td>
      <td width="20"></td>
      <td class="label">Active Dental Issues:</td>
      <td class="value">${patient.dental_issues || 0}</td>
    </tr>
  </table>` : ''}

  <!-- Notes -->
  <div class="section-title">${patient ? 'V' : 'IV'}. Remarks / Notes</div>
  <div class="notes-box">${form.notes || ''}</div>

  <!-- Declaration -->
  <div style="margin-top:12px; font-size:9pt; color:#555; font-style:italic; border:1px solid #ddd; padding:6px 10px; border-radius:3px; background:#fafafa;">
    I hereby certify that the information provided above is true and correct to the best of my knowledge.
    I authorize Plaza Maestro Dental Clinic to use this information for the purpose of my dental treatment and care.
  </div>

  <!-- Signatures -->
  <div class="signature-row">
    <div class="sig-block">
      <div class="sig-line">Patient / Guardian Signature over Printed Name</div>
    </div>
    <div class="sig-block">
      <div class="sig-line">Date Signed</div>
    </div>
    <div class="sig-block">
      <div class="sig-line">Attending Dentist</div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <span>Patient: <strong>${fullName}</strong></span>
    <span>Plaza Maestro Dental Clinic &nbsp;·&nbsp; Vigan City, Ilocos Sur</span>
    <span>Printed: ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
  </div>

</div>
<script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;

    openPrintWindow(html);
}

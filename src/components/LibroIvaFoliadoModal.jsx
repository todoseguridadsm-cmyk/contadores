import React, { useState } from 'react';
import { Printer, FileSpreadsheet, X, ShieldCheck, BookOpen, Layers } from 'lucide-react';
import * as XLSX from 'xlsx';
import { formatearFechaDDMMYYYY } from '../utils/calculos';

export default function LibroIvaFoliadoModal({ cliente, ventasLista = [], comprasLista = [], onClose }) {
  const [tipoLibro, setTipoLibro] = useState('compras'); // 'compras' | 'ventas'
  const [folioInicial, setFolioInicial] = useState(101);
  const [filtroPeriodo, setFiltroPeriodo] = useState('TODO'); // 'TODO' | 'S1' | 'S2' | mes num
  const [filasPorFolio, setFilasPorFolio] = useState(25);

  const listaCompleta = tipoLibro === 'compras' ? comprasLista : ventasLista;

  // Filtrar por período si se requiere
  const listaFiltrada = listaCompleta.filter(comp => {
    if (filtroPeriodo === 'TODO') return true;
    const fechaNorm = formatearFechaDDMMYYYY(comp.fecha);
    const partes = fechaNorm.split('/');
    if (partes.length < 2) return true;
    const mesNum = parseInt(partes[1], 10);
    if (filtroPeriodo === 'S1') return mesNum >= 1 && mesNum <= 6;
    if (filtroPeriodo === 'S2') return mesNum >= 7 && mesNum <= 12;
    return String(mesNum) === String(filtroPeriodo);
  });

  // Dividir la lista en páginas/folios (paginación legal foliada)
  const paginas = [];
  for (let i = 0; i < listaFiltrada.length; i += filasPorFolio) {
    paginas.push(listaFiltrada.slice(i, i + filasPorFolio));
  }
  if (paginas.length === 0) paginas.push([]);

  const formatMoney = (amount) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(amount) || 0);

  const handleExportarExcelFoliado = () => {
    const filasExcel = [];

    paginas.forEach((pag, pIdx) => {
      const numFolio = Number(folioInicial) + pIdx;
      // Encabezado del Folio
      filasExcel.push({
        Fecha: `LIBRO DE IVA ${tipoLibro.toUpperCase()} CONFORME A LEY`,
        Comprobante: `CONTRIBUYENTE: ${cliente.nombre}`,
        Contraparte: `CUIT: ${cliente.cuit}`,
        CUIT: '',
        Neto: `FOLIO N° ${numFolio}`,
        NoGravado: '',
        IVA21: '',
        IVA105: '',
        Perc: '',
        Total: ''
      });

      filasExcel.push({
        Fecha: 'FECHA',
        Comprobante: 'TIPO Y N° COMPROBANTE',
        Contraparte: 'RAZÓN SOCIAL',
        CUIT: 'CUIT',
        Neto: 'NETO GRAVADO',
        NoGravado: 'NO GRAV/EXENTO',
        IVA21: 'IVA 21%',
        IVA105: 'IVA 10.5%',
        Perc: 'PERCEPCIONES',
        Total: 'TOTAL'
      });

      let subNeto = 0, subNoGrav = 0, subIva21 = 0, subIva105 = 0, subPerc = 0, subTotal = 0;

      pag.forEach(comp => {
        const fNorm = formatearFechaDDMMYYYY(comp.fecha);
        const n = Number(comp.neto || 0);
        const ng = Number((comp.noGravado || 0) + (comp.exento || 0));
        const i21 = Number(comp.iva21 || 0);
        const i105 = Number(comp.iva105 || 0);
        const prc = Number((comp.percNac || 0) + (comp.percIIBB || 0) + (comp.percMun || 0));
        const tot = Number(comp.total || 0);

        subNeto += n;
        subNoGrav += ng;
        subIva21 += i21;
        subIva105 += i105;
        subPerc += prc;
        subTotal += tot;

        filasExcel.push({
          Fecha: fNorm,
          Comprobante: `${comp.tipoComp || ''} ${comp.puntoVenta || ''}-${comp.numero || ''}`.trim(),
          Contraparte: comp.razon_social || '',
          CUIT: comp.cuit || '',
          Neto: n,
          NoGravado: ng,
          IVA21: i21,
          IVA105: i105,
          Perc: prc,
          Total: tot
        });
      });

      filasExcel.push({
        Fecha: `SUBTOTAL FOLIO N° ${numFolio}`,
        Comprobante: '',
        Contraparte: '',
        CUIT: '',
        Neto: subNeto,
        NoGravado: subNoGrav,
        IVA21: subIva21,
        IVA105: subIva105,
        Perc: subPerc,
        Total: subTotal
      });

      filasExcel.push({}); // Fila vacía entre folios
    });

    const ws = XLSX.utils.json_to_sheet(filasExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Libro_IVA_${tipoLibro}`);
    const limpia = (cliente.nombre || 'Cliente').replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.writeFile(wb, `Libro_IVA_Foliado_${limpia}_${tipoLibro}.xlsx`);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      background: 'rgba(0,0,0,0.75)', zIndex: 9999, overflowY: 'auto', padding: '1rem'
    }}>
      {/* Controles en pantalla (se ocultan al imprimir gracias a la clase no-print) */}
      <div className="card no-print" style={{ maxWidth: '1050px', margin: '0 auto 1rem auto', background: 'var(--bg-surface)', border: '2px solid var(--primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <BookOpen style={{ color: 'var(--primary)' }} /> Libro IVA Conforme a Ley (Foliado e Inspección)
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
              Genera hojas foliadas correlativamente con datos del contribuyente al encabezado, fechas normalizadas DD/MM/YYYY y subtotales por folio.
            </p>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={22} /></button>
        </div>

        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', marginTop: '1.25rem', alignItems: 'center' }}>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>TIPO DE LIBRO:</label>
            <select className="input-field" value={tipoLibro} onChange={e => setTipoLibro(e.target.value)} style={{ fontWeight: 700 }}>
              <option value="compras">Libro IVA Compras</option>
              <option value="ventas">Libro IVA Ventas</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>PERÍODO LEGAL:</label>
            <select className="input-field" value={filtroPeriodo} onChange={e => setFiltroPeriodo(e.target.value)}>
              <option value="TODO">Todo el Año / Todas las cargas</option>
              <option value="S1">1° Semestre (Enero - Junio)</option>
              <option value="S2">2° Semestre (Julio - Diciembre)</option>
              <option value="1">Enero</option>
              <option value="2">Febrero</option>
              <option value="3">Marzo</option>
              <option value="4">Abril</option>
              <option value="5">Mayo</option>
              <option value="6">Junio</option>
              <option value="7">Julio</option>
              <option value="8">Agosto</option>
              <option value="9">Septiembre</option>
              <option value="10">Octubre</option>
              <option value="11">Noviembre</option>
              <option value="12">Diciembre</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>N° FOLIO INICIAL:</label>
            <input
              type="number"
              className="input-field"
              value={folioInicial}
              onChange={e => setFolioInicial(Number(e.target.value))}
              style={{ width: '100px', fontWeight: 700 }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>FILAS POR FOLIO:</label>
            <input
              type="number"
              className="input-field"
              value={filasPorFolio}
              onChange={e => setFilasPorFolio(Math.max(10, Number(e.target.value)))}
              style={{ width: '90px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginLeft: 'auto' }}>
            <button className="btn btn-secondary" onClick={handleExportarExcelFoliado}>
              <FileSpreadsheet size={18} style={{ color: 'var(--success)' }} /> Descargar Excel Legal
            </button>
            <button className="btn btn-primary" onClick={() => window.print()}>
              <Printer size={18} /> Imprimir Libro Foliado
            </button>
          </div>
        </div>
      </div>

      {/* Páginas del Libro Foliado (Estilo Imprimible Oficial) */}
      <div style={{ maxWidth: '1050px', margin: '0 auto' }}>
        {paginas.map((pagina, idx) => {
          const numeroFolio = Number(folioInicial) + idx;
          let subNeto = 0, subNoGrav = 0, subIva21 = 0, subIva105 = 0, subPerc = 0, subTotal = 0;

          return (
            <div
              key={idx}
              className="folio-legal-page"
              style={{
                background: '#fff',
                color: '#000',
                padding: '2rem',
                borderRadius: '8px',
                marginBottom: '2rem',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                pageBreakAfter: 'always'
              }}
            >
              {/* Encabezado Legal del Contribuyente y Folio */}
              <div style={{ borderBottom: '2px solid #000', paddingBottom: '0.75rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 900, textTransform: 'uppercase', margin: 0, color: '#000' }}>
                    LIBRO DE IVA {tipoLibro.toUpperCase()} — CONFORME A LEY
                  </h3>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', fontWeight: 700 }}>
                    CONTRIBUYENTE: {cliente.nombre} | CUIT: {cliente.cuit}
                  </p>
                </div>
                <div style={{ textAlign: 'right', border: '2px solid #000', padding: '0.35rem 0.75rem', fontWeight: 900, fontSize: '0.95rem' }}>
                  FOLIO N° {String(numeroFolio).padStart(4, '0')}
                  <div style={{ fontSize: '0.72rem', fontWeight: 600 }}>Hoja {idx + 1} de {paginas.length}</div>
                </div>
              </div>

              {/* Tabla Legal del Folio */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'right' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #000' }}>
                    <th style={{ padding: '0.45rem', textAlign: 'left', border: '1px solid #cbd5e1' }}>FECHA</th>
                    <th style={{ padding: '0.45rem', textAlign: 'left', border: '1px solid #cbd5e1' }}>COMPROBANTE</th>
                    <th style={{ padding: '0.45rem', textAlign: 'left', border: '1px solid #cbd5e1' }}>RAZÓN SOCIAL</th>
                    <th style={{ padding: '0.45rem', border: '1px solid #cbd5e1' }}>NETO GRAVADO</th>
                    <th style={{ padding: '0.45rem', border: '1px solid #cbd5e1' }}>EXENTO/NO GRAV</th>
                    <th style={{ padding: '0.45rem', border: '1px solid #cbd5e1' }}>IVA 21%</th>
                    <th style={{ padding: '0.45rem', border: '1px solid #cbd5e1' }}>IVA 10.5%</th>
                    <th style={{ padding: '0.45rem', border: '1px solid #cbd5e1' }}>PERCEPCIONES</th>
                    <th style={{ padding: '0.45rem', border: '1px solid #cbd5e1' }}>TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {pagina.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ padding: '2rem', textAlign: 'center', fontStyle: 'italic' }}>Sin comprobantes para este período</td>
                    </tr>
                  ) : (
                    pagina.map((comp, cIdx) => {
                      const fNorm = formatearFechaDDMMYYYY(comp.fecha);
                      const n = Number(comp.neto || 0);
                      const ng = Number((comp.noGravado || 0) + (comp.exento || 0));
                      const i21 = Number(comp.iva21 || 0);
                      const i105 = Number(comp.iva105 || 0);
                      const prc = Number((comp.percNac || 0) + (comp.percIIBB || 0) + (comp.percMun || 0));
                      const tot = Number(comp.total || 0);

                      subNeto += n; subNoGrav += ng; subIva21 += i21; subIva105 += i105; subPerc += prc; subTotal += tot;

                      return (
                        <tr key={cIdx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '0.4rem', textAlign: 'left', border: '1px solid #e2e8f0', whiteSpace: 'nowrap', fontWeight: 600 }}>
                            {fNorm}
                          </td>
                          <td style={{ padding: '0.4rem', textAlign: 'left', border: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                            {comp.tipoComp} {comp.puntoVenta}-{comp.numero}
                          </td>
                          <td style={{ padding: '0.4rem', textAlign: 'left', border: '1px solid #e2e8f0', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {comp.razon_social}
                          </td>
                          <td style={{ padding: '0.4rem', border: '1px solid #e2e8f0' }}>{formatMoney(n)}</td>
                          <td style={{ padding: '0.4rem', border: '1px solid #e2e8f0' }}>{formatMoney(ng)}</td>
                          <td style={{ padding: '0.4rem', border: '1px solid #e2e8f0' }}>{formatMoney(i21)}</td>
                          <td style={{ padding: '0.4rem', border: '1px solid #e2e8f0' }}>{formatMoney(i105)}</td>
                          <td style={{ padding: '0.4rem', border: '1px solid #e2e8f0' }}>{formatMoney(prc)}</td>
                          <td style={{ padding: '0.4rem', border: '1px solid #e2e8f0', fontWeight: 700 }}>{formatMoney(tot)}</td>
                        </tr>
                      );
                    })
                  )}

                  {/* Fila Subtotal del Folio */}
                  <tr style={{ background: '#f8fafc', fontWeight: 800, borderTop: '2px solid #000' }}>
                    <td colSpan="3" style={{ padding: '0.5rem', textAlign: 'left', border: '1px solid #cbd5e1' }}>
                      TRANSPORTE / SUBTOTAL FOLIO N° {String(numeroFolio).padStart(4, '0')}
                    </td>
                    <td style={{ padding: '0.5rem', border: '1px solid #cbd5e1' }}>{formatMoney(subNeto)}</td>
                    <td style={{ padding: '0.5rem', border: '1px solid #cbd5e1' }}>{formatMoney(subNoGrav)}</td>
                    <td style={{ padding: '0.5rem', border: '1px solid #cbd5e1' }}>{formatMoney(subIva21)}</td>
                    <td style={{ padding: '0.5rem', border: '1px solid #cbd5e1' }}>{formatMoney(subIva105)}</td>
                    <td style={{ padding: '0.5rem', border: '1px solid #cbd5e1' }}>{formatMoney(subPerc)}</td>
                    <td style={{ padding: '0.5rem', border: '1px solid #cbd5e1', color: '#000' }}>{formatMoney(subTotal)}</td>
                  </tr>
                </tbody>
              </table>

              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b', borderTop: '1px solid #cbd5e1', paddingTop: '0.5rem' }}>
                <span>Libro IVA Legal conforme a normativa vigente</span>
                <span>Firma y Sello Contador / Responsable: _______________________</span>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .no-print {
            display: none !important;
          }
          .folio-legal-page, .folio-legal-page * {
            visibility: visible;
          }
          .folio-legal-page {
            position: relative;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 1.5cm;
            box-shadow: none !important;
            border-radius: 0 !important;
            page-break-after: always;
          }
        }
      `}</style>
    </div>
  );
}

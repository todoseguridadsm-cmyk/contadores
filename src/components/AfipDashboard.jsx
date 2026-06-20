import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Calculator, DollarSign, TrendingUp, TrendingDown, FileText } from 'lucide-react';

export default function AfipDashboard() {
  const [data, setData] = useState({
    ventas: { neto: 0, iva: 0 },
    devVentas: { neto: 0, iva: 0 },
    compras: { neto: 0, iva: 0 },
    devCompras: { neto: 0, iva: 0 },
    saldoAnterior: 0
  });

  const [loading, setLoading] = useState(false);

  // Helper to safely parse numbers from Excel strings (e.g., "1.234,56" -> 1234.56)
  const parseNum = (val) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    // Remove dots for thousands, replace comma with dot for decimals
    const cleanStr = String(val).replace(/\./g, '').replace(/,/g, '.');
    const parsed = parseFloat(cleanStr);
    return isNaN(parsed) ? 0 : parsed;
  };

  const isNotaCredito = (tipoStr) => {
    const s = String(tipoStr).toLowerCase();
    return s.includes('nota de crédito') || s.includes('nota de credito');
  };

  const handleUploadEmitidos = (e) => {
    processExcel(e.target.files[0], 'EMITIDOS');
  };

  const handleUploadRecibidos = (e) => {
    processExcel(e.target.files[0], 'RECIBIDOS');
  };

  const processExcel = (file, mode) => {
    if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const wsname = workbook.SheetNames[0];
        const ws = workbook.Sheets[wsname];
        // Skip the first row if it's a title, usually row 1 is titles, row 2 is headers in AFIP
        const rows = XLSX.utils.sheet_to_json(ws, { range: 1 }); 
        
        let netoVentas = 0, ivaVentas = 0;
        let netoDevVentas = 0, ivaDevVentas = 0;
        
        let netoCompras = 0, ivaCompras = 0;
        let netoDevCompras = 0, ivaDevCompras = 0;

        // Try standard headers or array indexes
        // Column names usually: "Tipo", "Imp. Neto Gravado", "IVA"
        rows.forEach(row => {
          const tipo = row['Tipo'] || row['Tipo Comprobante'] || row['Tipo de Comprobante'] || '';
          const neto = parseNum(row['Imp. Neto Gravado'] || row['Neto Gravado'] || 0);
          const iva = parseNum(row['IVA'] || row['Importe IVA'] || 0);

          if (mode === 'EMITIDOS') {
            if (isNotaCredito(tipo)) {
              netoDevVentas += neto;
              ivaDevVentas += iva;
            } else {
              netoVentas += neto;
              ivaVentas += iva;
            }
          } else {
            if (isNotaCredito(tipo)) {
              netoDevCompras += neto;
              ivaDevCompras += iva;
            } else {
              netoCompras += neto;
              ivaCompras += iva;
            }
          }
        });

        setData(prev => {
          if (mode === 'EMITIDOS') {
            return {
              ...prev,
              ventas: { neto: netoVentas, iva: ivaVentas },
              devVentas: { neto: netoDevVentas, iva: ivaDevVentas }
            };
          } else {
            return {
              ...prev,
              compras: { neto: netoCompras, iva: ivaCompras },
              devCompras: { neto: netoDevCompras, iva: ivaDevCompras }
            };
          }
        });

      } catch (err) {
        console.error(err);
        alert('Error al procesar el archivo Excel. Asegurate de que sea el formato exportado por AFIP.');
      }
      setLoading(false);
    };
    reader.readAsBinaryString(file);
    e.target.value = null; // reset
  };

  const handleManualChange = (category, field, val) => {
    setData({
      ...data,
      [category]: {
        ...data[category],
        [field]: parseFloat(val) || 0
      }
    });
  };

  // CALCULOS FINALES
  const vTotal = data.ventas.neto + data.ventas.iva;
  const dvTotal = data.devVentas.neto + data.devVentas.iva;
  const cTotal = data.compras.neto + data.compras.iva;
  const dcTotal = data.devCompras.neto + data.devCompras.iva;

  const debitoFiscal = data.ventas.iva + data.devCompras.iva; // IVA Ventas + IVA NC Compras
  const creditoFiscal = data.compras.iva + data.devVentas.iva; // IVA Compras + IVA NC Ventas
  
  const ivaMes = debitoFiscal - creditoFiscal;
  const saldoFinal = ivaMes - data.saldoAnterior;

  const fmt = (num) => '$' + (num || 0).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2});

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <Calculator className="text-blue-600" size={32} />
            Dashboard Contable / AFIP
          </h2>
          <p className="text-slate-500 mt-1">Carga manual o mediante importación del Excel "Mis Comprobantes" de AFIP.</p>
        </div>
        <div className="flex gap-3">
          <label className="bg-sky-600 hover:bg-sky-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2 cursor-pointer text-sm">
            <Upload size={18} /> Excel Emitidos (Ventas)
            <input type="file" accept=".xls,.xlsx" className="hidden" onChange={handleUploadEmitidos} />
          </label>
          <label className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2 cursor-pointer text-sm">
            <Upload size={18} /> Excel Recibidos (Compras)
            <input type="file" accept=".xls,.xlsx" className="hidden" onChange={handleUploadRecibidos} />
          </label>
        </div>
      </header>

      {loading && <div className="p-4 bg-blue-50 text-blue-600 rounded-lg animate-pulse font-bold">Procesando archivo...</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* BLOQUE VENTAS */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><TrendingUp className="text-emerald-500"/> Ingresos (Operaciones de Ventas)</h3>
          
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="font-bold text-slate-700">1) Ventas Totales (Facturas)</span>
              <span className="text-xl font-black text-emerald-600">{fmt(vTotal)}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500">Neto Gravado</label>
                <input type="number" value={data.ventas.neto} onChange={e => handleManualChange('ventas', 'neto', e.target.value)} className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-sm outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Débito Fiscal (IVA Ventas)</label>
                <input type="number" value={data.ventas.iva} onChange={e => handleManualChange('ventas', 'iva', e.target.value)} className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-sm outline-none focus:border-blue-500" />
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-red-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="font-bold text-slate-700">4) Devolución de Ventas (NC Emitidas)</span>
              <span className="text-xl font-black text-red-500">-{fmt(dvTotal)}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500">Neto Gravado</label>
                <input type="number" value={data.devVentas.neto} onChange={e => handleManualChange('devVentas', 'neto', e.target.value)} className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-sm outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Crédito Fiscal (IVA Dev. Ventas)</label>
                <input type="number" value={data.devVentas.iva} onChange={e => handleManualChange('devVentas', 'iva', e.target.value)} className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-sm outline-none focus:border-blue-500" />
              </div>
            </div>
          </div>
        </div>

        {/* BLOQUE COMPRAS */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><TrendingDown className="text-orange-500"/> Egresos (Operaciones de Compras)</h3>
          
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-blue-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="font-bold text-slate-700">2) Compras Totales (Facturas Recibidas)</span>
              <span className="text-xl font-black text-blue-600">{fmt(cTotal)}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500">Neto Gravado</label>
                <input type="number" value={data.compras.neto} onChange={e => handleManualChange('compras', 'neto', e.target.value)} className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-sm outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Crédito Fiscal (IVA Compras)</label>
                <input type="number" value={data.compras.iva} onChange={e => handleManualChange('compras', 'iva', e.target.value)} className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-sm outline-none focus:border-blue-500" />
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-orange-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="font-bold text-slate-700">3) Devolución de Compras (NC Recibidas)</span>
              <span className="text-xl font-black text-orange-500">-{fmt(dcTotal)}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500">Neto Gravado</label>
                <input type="number" value={data.devCompras.neto} onChange={e => handleManualChange('devCompras', 'neto', e.target.value)} className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-sm outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Débito Fiscal (IVA Dev. Compras)</label>
                <input type="number" value={data.devCompras.iva} onChange={e => handleManualChange('devCompras', 'iva', e.target.value)} className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-sm outline-none focus:border-blue-500" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RESULTADO IVA MES */}
      <div className="mt-8 bg-slate-900 text-white rounded-3xl p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <DollarSign size={150} />
        </div>
        <h3 className="text-2xl font-bold mb-6 flex items-center gap-3"><FileText /> Posición de IVA Mensual</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
            <div className="text-slate-400 text-sm font-bold mb-1 uppercase tracking-wider">Débito Fiscal Total</div>
            <div className="text-2xl font-black text-red-400">{fmt(debitoFiscal)}</div>
            <div className="text-[10px] text-slate-500 mt-2">IVA Ventas + IVA Dev Compras</div>
          </div>
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
            <div className="text-slate-400 text-sm font-bold mb-1 uppercase tracking-wider">Crédito Fiscal Total</div>
            <div className="text-2xl font-black text-emerald-400">{fmt(creditoFiscal)}</div>
            <div className="text-[10px] text-slate-500 mt-2">IVA Compras + IVA Dev Ventas</div>
          </div>
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
            <div className="text-slate-400 text-sm font-bold mb-1 uppercase tracking-wider">IVA Del Mes</div>
            <div className={`text-2xl font-black ${ivaMes > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{fmt(Math.abs(ivaMes))}</div>
            <div className="text-[10px] text-slate-500 mt-2">{ivaMes > 0 ? 'A PAGAR' : 'A FAVOR'}</div>
          </div>
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
            <div className="text-slate-400 text-sm font-bold mb-1 uppercase tracking-wider">Saldo Anterior</div>
            <input type="number" value={data.saldoAnterior} onChange={e => setData({...data, saldoAnterior: parseFloat(e.target.value) || 0})} className="w-full bg-slate-900 border border-slate-600 px-3 py-1.5 rounded-lg text-lg font-bold text-white outline-none focus:border-blue-500" />
            <div className="text-[10px] text-slate-500 mt-2">Ingresar manual (Favor + / Pagar -)</div>
          </div>
          <div className="bg-blue-600/20 p-4 rounded-xl border border-blue-500/30 relative z-10">
            <div className="text-blue-300 text-sm font-bold mb-1 uppercase tracking-wider">Saldo a Pagar/Favor</div>
            <div className={`text-3xl font-black ${saldoFinal > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {fmt(Math.abs(saldoFinal))}
            </div>
            <div className="text-xs font-bold mt-2">
              {saldoFinal > 0 ? '🚨 A PAGAR A AFIP' : '✅ SALDO A FAVOR'}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

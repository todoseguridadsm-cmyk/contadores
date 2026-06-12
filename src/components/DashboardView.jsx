import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, ArrowRight, Database, Save, List, ShieldCheck } from 'lucide-react';
import ExcelUploader from './ExcelUploader';
import { procesarComprobantes, calcularSaldos } from '../utils/calculos';
import { exportarDashboardExcel } from '../utils/exportacion';
import { exportarTxtAfip } from '../utils/exportacionTxt';
import { supabase } from '../lib/supabase';

export default function DashboardView() {
  const [clientes, setClientes] = useState([]);
  const [selectedClienteId, setSelectedClienteId] = useState('');
  const [clienteActivo, setClienteActivo] = useState(null);

  const [ventasStats, setVentasStats] = useState({ totalNetoGravado: 0, totalIVA: 0, cantidadComprobantes: 0, lista: [] });
  const [comprasStats, setComprasStats] = useState({ totalNetoGravado: 0, totalIVA: 0, cantidadComprobantes: 0, lista: [] });
  const [saldoAnterior, setSaldoAnterior] = useState(0);

  useEffect(() => {
    fetchClientes();
  }, []);

  const fetchClientes = async () => {
    try {
      if(!import.meta.env.VITE_SUPABASE_URL) return;
      const { data, error } = await supabase.from('clientes').select('*');
      if (!error) setClientes(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleClienteChange = (e) => {
    const id = e.target.value;
    setSelectedClienteId(id);
    
    if (id) {
      const cliente = clientes.find(c => c.id == id);
      setClienteActivo(cliente);
      
      if (cliente.ventas_json) setVentasStats(cliente.ventas_json);
      else setVentasStats({ totalNetoGravado: 0, totalIVA: 0, cantidadComprobantes: 0, lista: [] });

      if (cliente.compras_json) setComprasStats(cliente.compras_json);
      else setComprasStats({ totalNetoGravado: 0, totalIVA: 0, cantidadComprobantes: 0, lista: [] });

      if (cliente.saldo_acumulado !== undefined && cliente.saldo_acumulado !== null) {
        setSaldoAnterior(Number(cliente.saldo_acumulado));
      } else {
        setSaldoAnterior(0);
      }
    } else {
      setClienteActivo(null);
      setVentasStats({ totalNetoGravado: 0, totalIVA: 0, cantidadComprobantes: 0, lista: [] });
      setComprasStats({ totalNetoGravado: 0, totalIVA: 0, cantidadComprobantes: 0, lista: [] });
      setSaldoAnterior(0);
    }
  };

  const handleExportarExcel = () => {
    if (!clienteActivo) return alert("Selecciona un cliente para exportar.");
    const resultadoMensual = calcularSaldos(ventasStats, comprasStats, saldoAnterior);
    exportarDashboardExcel(ventasStats, comprasStats, resultadoMensual, `${clienteActivo.nombre}_LibroIVA`);
  };

  const handleExportarTxt = () => {
    if (!clienteActivo) return alert("Selecciona un cliente para exportar.");
    exportarTxtAfip(ventasStats.lista, comprasStats.lista, clienteActivo.nombre);
  };

  const handleGuardarSaldo = async () => {
    if (!clienteActivo) return;
    const resultadoMensual = calcularSaldos(ventasStats, comprasStats, saldoAnterior);
    const nuevoSaldo = resultadoMensual.nuevoSaldoAFavor || 0;
    
    try {
      const { error } = await supabase
        .from('clientes')
        .update({ saldo_acumulado: nuevoSaldo })
        .eq('id', clienteActivo.id);
        
      if (error) {
        if (error.message.includes('column "saldo_acumulado" of relation "clientes" does not exist')) {
          alert('Debes agregar la columna saldo_acumulado en Supabase. Corre el código SQL que te pasé en el chat.');
        } else {
          throw error;
        }
      } else {
        alert(`¡Mes cerrado exitosamente! Se guardó un Saldo a Favor Técnico de $${nuevoSaldo} para el próximo mes.`);
        fetchClientes();
      }
    } catch (e) {
      console.error(e);
      alert('Error guardando el saldo en la base de datos.');
    }
  };

  const handleExcelLoaded = (data, tipo) => {
    const resumen = procesarComprobantes(data);
    if (tipo === 'ventas') {
      setVentasStats(resumen);
    } else {
      setComprasStats(resumen);
    }
  };

  const resultadoMensual = calcularSaldos(ventasStats, comprasStats, saldoAnterior);
  const formatMoney = (amount) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);

  const renderTablaDetalle = (lista, titulo, colorClass) => {
    if (!lista || lista.length === 0) return null;
    return (
      <div className="card" style={{ marginTop: '2rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: `var(--${colorClass})` }}>
          <List size={20} /> Libro IVA: {titulo} ({lista.length} comprobantes)
        </h3>
        <div style={{ overflowX: 'auto', maxHeight: '500px', overflowY: 'auto' }}>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-main)', zIndex: 1, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.75rem' }}>Fecha</th>
                <th style={{ padding: '0.75rem' }}>Nro Comprob.</th>
                <th style={{ padding: '0.75rem' }}>Razón Social</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Neto Gravado</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>No Grav/Exento</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>IVA 21%</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>IVA 10,5%</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Perc. Nac.</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Perc. IIBB/Mun.</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', background: 'var(--bg-secondary)' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }} className="hover-row">
                  <td style={{ padding: '0.75rem' }}>{item.fecha}</td>
                  <td style={{ padding: '0.75rem', whiteSpace: 'nowrap' }}>{item.tipoComp} {item.puntoVenta}-{item.numero}</td>
                  <td style={{ padding: '0.75rem' }}>{item.razon_social}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatMoney(item.neto)}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--text-muted)' }}>{formatMoney((item.noGravado || 0) + (item.exento || 0))}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--primary)' }}>{formatMoney(item.iva21 || 0)}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--primary)' }}>{formatMoney(item.iva105 || 0)}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--success)' }}>{formatMoney(item.percNac || 0)}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--warning)' }}>{formatMoney((item.percIIBB || 0) + (item.percMun || 0))}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600, background: 'var(--bg-secondary)' }}>{formatMoney(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="content-area">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Libro IVA Digital</h1>
          <p className="page-subtitle">Saldos separados por Técnico y Libre Disponibilidad.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn" onClick={handleExportarTxt} disabled={!clienteActivo} style={{ background: '#28a745', color: 'white', border: 'none', fontWeight: 'bold' }}>
            Descargar TXTs AFIP
          </button>
          <button className="btn btn-secondary" onClick={handleExportarExcel} disabled={!clienteActivo}>
            Exportar a Excel
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--primary-glow)', border: '1px solid var(--primary)' }}>
        <Database className="primary-text" size={32} />
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--text-main)', fontWeight: 600 }}>Seleccionar Cliente (Sincronizado)</label>
          <select className="input-field" value={selectedClienteId} onChange={handleClienteChange} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', maxWidth: '400px' }}>
            <option value="">-- Elige un cliente para ver su resumen --</option>
            {clientes.map(c => (
              <option key={c.id} value={c.id}>{c.nombre} {c.ultima_sincronizacion !== 'Nunca' ? '(Sincronizado)' : '(Sin datos)'}</option>
            ))}
          </select>
        </div>
        {clienteActivo && clienteActivo.ultima_sincronizacion === 'Nunca' && (
          <span style={{ color: 'var(--warning)', fontWeight: 500, fontSize: '0.85rem' }}>
            ⚠️ Este cliente no ha sido sincronizado. Ve a la pestaña Clientes y usa el botón Sincronizar AFIP.
          </span>
        )}
      </div>

      <div className="metrics-grid">
        <div className="card metric-card">
          <div className="metric-header">
            <div className="metric-icon success-bg">
              <TrendingUp className="success-text" size={24} />
            </div>
            <span className="metric-label">Ventas Totales (Neto)</span>
          </div>
          <h3 className="metric-value">{formatMoney(ventasStats.totalNetoGravado)}</h3>
          <p className="metric-trend neutral">{ventasStats.cantidadComprobantes} comprobantes emitidos</p>
        </div>
        
        <div className="card metric-card">
          <div className="metric-header">
            <div className="metric-icon danger-bg">
              <TrendingDown className="danger-text" size={24} />
            </div>
            <span className="metric-label">Compras Totales (Neto)</span>
          </div>
          <h3 className="metric-value">{formatMoney(comprasStats.totalNetoGravado)}</h3>
          <p className="metric-trend neutral">{comprasStats.cantidadComprobantes} comprobantes recibidos</p>
        </div>

        <div className="card metric-card highlight-card" style={{ background: 'linear-gradient(135deg, var(--warning) 0%, #e6a800 100%)' }}>
          <div className="metric-header">
            <span className="metric-label text-white">Libre Disponibilidad (Percepciones)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <span className="text-white" style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
              {formatMoney(resultadoMensual.percepcionesNacionales + resultadoMensual.percepcionesIIBB + resultadoMensual.percepcionesMunicipales)}
            </span>
          </div>
          <p className="text-white-50" style={{ marginTop: '0.5rem' }}>Sirve para cancelar VEP o IIBB</p>
        </div>

        <div className="card metric-card highlight-card">
          <div className="metric-header">
            <span className="metric-label text-white">Saldo Anterior TÉCNICO (Arrastre)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <span className="text-white" style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>$</span>
            <input 
              type="number" 
              className="input-field" 
              value={saldoAnterior} 
              onChange={(e) => setSaldoAnterior(Number(e.target.value))}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', fontSize: '1.5rem', fontWeight: 'bold', padding: '0.25rem', width: '100%' }}
            />
          </div>
          <p className="text-white-50" style={{ marginTop: '0.5rem' }}>Solo aplicable a Débitos Fiscales</p>
        </div>
      </div>

      <div className="charts-area">
        <div className="card full-width" style={{ border: '2px solid var(--primary)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><ShieldCheck className="primary-text"/> Auditoría y Declaración de IVA</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.5fr', gap: '1rem', marginTop: '1rem' }}>
            <div style={{ padding: '1rem', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Débito Fiscal (IVA Ventas)</p>
              <h4 style={{ fontSize: '1.25rem', color: 'var(--success)' }}>{formatMoney(resultadoMensual.ivaVentas)}</h4>
            </div>
            
            <div style={{ padding: '1rem', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Crédito Fiscal (IVA Compras)</p>
              <h4 style={{ fontSize: '1.25rem', color: 'var(--danger)' }}>- {formatMoney(resultadoMensual.ivaCompras)}</h4>
            </div>

            <div style={{ padding: '1rem', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Posición Técnica</p>
              <h4 style={{ fontSize: '1.25rem' }}>{formatMoney(resultadoMensual.saldoTecnicoPuro)}</h4>
            </div>
            
            <div style={{ padding: '1.5rem', background: 'var(--primary-glow)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.25rem', fontWeight: 600 }}>TOTAL A TRANSFERIR (VEP)</p>
              <h2 style={{ fontSize: '2rem', color: 'var(--primary)' }}>{formatMoney(resultadoMensual.saldoPagar)}</h2>
              
              {resultadoMensual.nuevoSaldoAFavor > 0 && (
                <p className="success-text" style={{ fontWeight: 600, marginTop: '0.5rem', fontSize: '0.85rem' }}>
                  + {formatMoney(resultadoMensual.nuevoSaldoAFavor)} a Favor (Técnico)
                </p>
              )}
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button className="btn btn-primary" style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }} onClick={handleGuardarSaldo} disabled={!clienteActivo}>
              <Save size={18} /> Cerrar Mes y Guardar Saldo Técnico
            </button>
          </div>
        </div>
      </div>

      {renderTablaDetalle(ventasStats.lista, 'Ventas Emitidas', 'success')}
      {renderTablaDetalle(comprasStats.lista, 'Compras Recibidas', 'danger')}

      {/* Zona Manual Ocultable */}
      <details style={{ marginTop: '2rem', cursor: 'pointer' }}>
        <summary style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Alternativa: Carga Manual de Excel</summary>
        <div className="grid grid-cols-4 gap-6" style={{ marginTop: '1rem' }}>
          <div style={{ gridColumn: 'span 2 / span 2' }}>
            <ExcelUploader title="Arrastra Excel VENTAS" type="ventas" onDataLoaded={handleExcelLoaded} />
          </div>
          <div style={{ gridColumn: 'span 2 / span 2' }}>
            <ExcelUploader title="Arrastra Excel COMPRAS" type="compras" onDataLoaded={handleExcelLoaded} />
          </div>
        </div>
      </details>

      <style>{`
        .hover-row:hover { background: var(--bg-hover) !important; }
      `}</style>
    </div>
  );
}

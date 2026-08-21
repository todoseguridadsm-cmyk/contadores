import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, ArrowRight, Database, Save, List, ShieldCheck, BookOpen } from 'lucide-react';
import ExcelUploader from './ExcelUploader';
import { procesarComprobantes, calcularSaldos, formatearFechaDDMMYYYY } from '../utils/calculos';
import { exportarDashboardExcel } from '../utils/exportacion';
import { exportarTxtAfip } from '../utils/exportacionTxt';
import { supabase } from '../lib/supabase';
import { CATEGORIAS_INFO, getCategoriaCliente, obtenerCodigo3DCliente } from './ClientesView';
import LibroIvaFoliadoModal from './LibroIvaFoliadoModal';

export default function DashboardView() {
  const [clientes, setClientes] = useState([]);
  const [selectedClienteId, setSelectedClienteId] = useState('');
  const [clienteActivo, setClienteActivo] = useState(null);

  const [filtroCategoria, setFiltroCategoria] = useState('TODOS');
  const [searchTerm, setSearchTerm] = useState('');
  const [ordenClientes, setOrdenClientes] = useState('alfabetico'); // 'alfabetico' | 'numerico'
  const [isFoliadoModalOpen, setIsFoliadoModalOpen] = useState(false);

  const [mesSeleccionado, setMesSeleccionado] = useState(String(new Date().getMonth() + 1));
  const [anioSeleccionado, setAnioSeleccionado] = useState(String(new Date().getFullYear()));
  const [guardandoAnual, setGuardandoAnual] = useState(false);

  const [ventasStats, setVentasStats] = useState({ totalNetoGravado: 0, totalIVA: 0, cantidadComprobantes: 0, lista: [] });
  const [comprasStats, setComprasStats] = useState({ totalNetoGravado: 0, totalIVA: 0, cantidadComprobantes: 0, lista: [] });
  const [saldoAnterior, setSaldoAnterior] = useState(0);

  const getMesAnio = (fechaStr) => {
    if (!fechaStr) return { mes: null, anio: null };
    const f = formatearFechaDDMMYYYY(fechaStr);
    if (!f) return { mes: null, anio: null };
    const p = f.split('/');
    if (p.length === 3) return { mes: p[1], anio: p[2] };
    return { mes: null, anio: null };
  };

  const listaVentasFiltrada = (ventasStats?.lista || []).filter(item => {
    const { mes, anio } = getMesAnio(item.fecha);
    return mes === mesSeleccionado && anio === anioSeleccionado;
  });

  const listaComprasFiltrada = (comprasStats?.lista || []).filter(item => {
    const { mes, anio } = getMesAnio(item.fecha);
    return mes === mesSeleccionado && anio === anioSeleccionado;
  });

  const ventasMensuales = procesarComprobantes(listaVentasFiltrada);
  const comprasMensuales = procesarComprobantes(listaComprasFiltrada);

  const handleGuardarEnResumenAnual = async () => {
    if (!clienteActivo) return;
    setGuardandoAnual(true);
    
    // 1. Calcular y guardar el saldo técnico para el próximo mes
    const resultadoMensual = calcularSaldos(ventasMensuales, comprasMensuales, saldoAnterior);
    const nuevoSaldo = resultadoMensual.nuevoSaldoAFavor || 0;
    
    try {
      const { error: saldoError } = await supabase
        .from('clientes')
        .update({ saldo_acumulado: nuevoSaldo })
        .eq('id', clienteActivo.id);
        
      if (saldoError && saldoError.message.includes('column "saldo_acumulado"')) {
        alert('Debes agregar la columna saldo_acumulado en Supabase.');
      }
    } catch (e) {
      console.error("Error guardando saldo", e);
    }

    // 2. Archivar las estadísticas del mes en la nube (Resumen Anual)
    try {
      const historialAnual = clienteActivo.historial_anual || (clienteActivo.ventas_json && clienteActivo.ventas_json.historial_anual) || {};
      const anioObj = historialAnual[anioSeleccionado] || {};
      anioObj[mesSeleccionado] = {
        mes: mesSeleccionado,
        anio: anioSeleccionado,
        ventasNeto: Number(ventasMensuales.totalNetoGravado || 0),
        comprasNeto: Number(comprasMensuales.totalNetoGravado || 0),
        ventasIva: Number(ventasMensuales.totalIVA || 0),
        comprasIva: Number(comprasMensuales.totalIVA || 0),
        ventasTotal: Number(ventasMensuales.totalGeneral || 0),
        comprasTotal: Number(comprasMensuales.totalGeneral || 0),
        fechaGuardado: new Date().toLocaleDateString('es-AR')
      };
      historialAnual[anioSeleccionado] = anioObj;

      try {
        await supabase
          .from('clientes')
          .update({ historial_anual: historialAnual })
          .eq('id', clienteActivo.id);
      } catch (e) {}

      const ventasData = { ...ventasStats, historial_anual: historialAnual };
      await supabase
        .from('clientes')
        .update({ ventas_json: ventasData })
        .eq('id', clienteActivo.id);

      alert(`¡Mes archivado exitosamente!\n\nSe guardaron las estadísticas en el Resumen Anual y se arrastró un Saldo a Favor Técnico de $${nuevoSaldo.toFixed(2)} para el próximo mes.`);
      
      fetchClientes();
    } catch (error) {
      console.error(error);
      alert('Error guardando los datos en la nube.');
    } finally {
      setGuardandoAnual(false);
    }
  };

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
      else setVentasStats({ totalNetoGravado: 0, totalNetoGravado_NC: 0, totalIVA: 0, totalIVA_NC: 0, cantidadComprobantes: 0, lista: [] });

      if (cliente.compras_json) setComprasStats(cliente.compras_json);
      else setComprasStats({ totalNetoGravado: 0, totalNetoGravado_NC: 0, totalIVA: 0, totalIVA_NC: 0, cantidadComprobantes: 0, lista: [] });

      if (cliente.saldo_acumulado !== undefined && cliente.saldo_acumulado !== null) {
        setSaldoAnterior(Number(Number(cliente.saldo_acumulado).toFixed(2)));
      } else {
        setSaldoAnterior(0);
      }
    } else {
      setClienteActivo(null);
      setVentasStats({ totalNetoGravado: 0, totalNetoGravado_NC: 0, totalIVA: 0, totalIVA_NC: 0, cantidadComprobantes: 0, lista: [] });
      setComprasStats({ totalNetoGravado: 0, totalNetoGravado_NC: 0, totalIVA: 0, totalIVA_NC: 0, cantidadComprobantes: 0, lista: [] });
      setSaldoAnterior(0);
    }
  };

  const handleExportarExcel = () => {
    if (!clienteActivo) return alert("Selecciona un cliente para exportar.");
    const resultadoMensual = calcularSaldos(ventasMensuales, comprasMensuales, saldoAnterior);
    exportarDashboardExcel(ventasMensuales, comprasMensuales, resultadoMensual, `${clienteActivo.nombre}_LibroIVA`);
  };

  const handleExportarTxt = () => {
    if (!clienteActivo) return alert("Selecciona un cliente para exportar.");
    exportarTxtAfip(ventasStats.lista, comprasStats.lista, clienteActivo.nombre);
  };

  const handleExcelLoaded = (data, tipo) => {
    const resumen = procesarComprobantes(data);
    if (tipo === 'ventas') {
      setVentasStats(resumen);
    } else {
      setComprasStats(resumen);
    }
  };

  const formatMoney = (amount) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(amount) || 0);

  const obtenerDesglose = (stats) => {
    const res = {
      facturas: { cantidad: 0, neto: 0, iva: 0, noGravado: 0, exento: 0, percepciones: 0, total: 0 },
      nc: { cantidad: 0, neto: 0, iva: 0, noGravado: 0, exento: 0, percepciones: 0, total: 0 }
    };
    if (!stats) return res;

    if (Array.isArray(stats.lista) && stats.lista.length > 0) {
      stats.lista.forEach(item => {
        const t = String(item.tipoComp || '').toLowerCase();
        const isNC = t.includes('nota de cr') || t.includes('nc') || t.includes('nota crédito');
        const neto = Math.abs(Number(item.neto) || 0);
        const iva = Math.abs(Number(item.iva) || 0);
        const noGrav = Math.abs(Number(item.noGravado) || 0);
        const exen = Math.abs(Number(item.exento) || 0);
        const perc = Math.abs((Number(item.percNac)||0) + (Number(item.percIIBB)||0) + (Number(item.percMun)||0) + (Number(item.impInt)||0));
        const total = Math.abs(Number(item.total) || (neto + iva + noGrav + exen + perc));

        if (isNC) {
          res.nc.cantidad++;
          res.nc.neto += neto;
          res.nc.iva += iva;
          res.nc.noGravado += noGrav;
          res.nc.exento += exen;
          res.nc.percepciones += perc;
          res.nc.total += total;
        } else {
          res.facturas.cantidad++;
          res.facturas.neto += neto;
          res.facturas.iva += iva;
          res.facturas.noGravado += noGrav;
          res.facturas.exento += exen;
          res.facturas.percepciones += perc;
          res.facturas.total += total;
        }
      });
    } else {
      res.facturas = {
        cantidad: Number(stats.cantidadComprobantes) || 0,
        neto: Number(stats.totalNetoGravado) || 0,
        iva: Number(stats.totalIVA) || 0,
        noGravado: Number(stats.totalNoGravado) || 0,
        exento: Number(stats.totalExento) || 0,
        percepciones: (Number(stats.totalPercepcionesNacionales)||0) + (Number(stats.totalPercepcionesIIBB)||0) + (Number(stats.totalPercepcionesMunicipales)||0) + (Number(stats.totalImpuestosInternos)||0),
        total: Number(stats.totalGeneral) || ((Number(stats.totalNetoGravado)||0) + (Number(stats.totalIVA)||0))
      };
      res.nc = {
        cantidad: 0,
        neto: Number(stats.totalNetoGravado_NC) || 0,
        iva: Number(stats.totalIVA_NC) || 0,
        noGravado: 0,
        exento: 0,
        percepciones: 0,
        total: (Number(stats.totalNetoGravado_NC)||0) + (Number(stats.totalIVA_NC)||0)
      };
    }
    return res;
  };

  const desgloseVentas = obtenerDesglose(ventasMensuales);
  const desgloseCompras = obtenerDesglose(comprasMensuales);

  const renderPanelContable = ({ numero, titulo, icon: Icon, colorClass, datos, tipoIva, esDevolucion = false }) => {
    const total = datos?.total || 0;
    const neto = datos?.neto || 0;
    const iva = datos?.iva || 0;
    const noGravEx = (datos?.noGravado || 0) + (datos?.exento || 0);
    const percepciones = datos?.percepciones || 0;
    const cantidad = datos?.cantidad || 0;

    return (
      <div className="card" style={{ 
        display: 'flex', flexDirection: 'column', gap: '1rem', 
        border: '1px solid var(--border-color)',
        borderTop: `4px solid var(--${colorClass})`,
        background: 'var(--bg-surface)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Cabecera del Panel */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ 
              padding: '0.5rem', borderRadius: '8px', 
              background: `var(--${colorClass}-bg, rgba(255,255,255,0.05))` 
            }}>
              <Icon className={`${colorClass}-text`} style={{ color: `var(--${colorClass})` }} size={22} />
            </div>
            <div>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {numero}) {titulo}
              </span>
            </div>
          </div>
          <span style={{ 
            fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.6rem', 
            borderRadius: '12px', background: 'var(--bg-main)', color: 'var(--text-muted)',
            border: '1px solid var(--border-color)'
          }}>
            {cantidad} comp.
          </span>
        </div>

        {/* Total Bruto Principal */}
        <div style={{ padding: '0.25rem 0', textAlign: 'left' }}>
          <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
            {esDevolucion ? 'TOTAL DEVUELTO (NC)' : 'TOTAL BRUTO COMPROBANTES'}
          </span>
          <h3 style={{ 
            fontSize: '1.65rem', fontWeight: 800, margin: '0.25rem 0 0', 
            color: esDevolucion ? `var(--${colorClass})` : 'var(--text-main)' 
          }}>
            {esDevolucion && total > 0 ? '-' : ''}{formatMoney(total)}
          </h3>
        </div>

        {/* Grilla Detallada de Desglose (Neto, IVA, No Gravado, Percepciones) */}
        <div style={{ 
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', 
          background: 'var(--bg-main)', padding: '0.85rem', borderRadius: '8px',
          border: '1px solid var(--border-light)', fontSize: '0.85rem'
        }}>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600 }}>NETO GRAVADO</div>
            <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem', marginTop: '0.15rem' }}>
              {esDevolucion && neto > 0 ? '-' : ''}{formatMoney(neto)}
            </div>
          </div>

          <div>
            <div style={{ color: `var(--${colorClass})`, fontSize: '0.72rem', fontWeight: 700 }}>{tipoIva}</div>
            <div style={{ fontWeight: 700, color: `var(--${colorClass})`, fontSize: '0.95rem', marginTop: '0.15rem' }}>
              {esDevolucion && iva > 0 ? '-' : ''}{formatMoney(iva)}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.5rem' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>No Gravado / Exento</div>
            <div style={{ fontWeight: 600, color: 'var(--text-muted)' }}>
              {formatMoney(noGravEx)}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.5rem' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Percepciones / Otros</div>
            <div style={{ fontWeight: 600, color: 'var(--text-muted)' }}>
              {formatMoney(percepciones)}
            </div>
          </div>
        </div>
      </div>
    );
  };


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
                  <td style={{ padding: '0.75rem', whiteSpace: 'nowrap', fontWeight: 600 }}>{formatearFechaDDMMYYYY(item.fecha)}</td>
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
            Descargar TXTs AFIP (Todo)
          </button>
          <button className="btn btn-secondary" onClick={handleExportarExcel} disabled={!clienteActivo}>
            Exportar a Excel
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', background: 'var(--primary-glow)', border: '1px solid var(--primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              FILTRAR CLIENTES POR TIPO:
            </span>
            <button 
              className={`btn ${filtroCategoria === 'TODOS' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFiltroCategoria('TODOS')}
              style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
            >
              Todos ({clientes.length})
            </button>
            {Object.keys(CATEGORIAS_INFO).map(catKey => {
              const count = clientes.filter(c => getCategoriaCliente(c) === catKey).length;
              return (
                <button
                  key={catKey}
                  onClick={() => setFiltroCategoria(catKey)}
                  style={{
                    padding: '0.3rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: `1px solid ${CATEGORIAS_INFO[catKey].color}`,
                    background: filtroCategoria === catKey ? CATEGORIAS_INFO[catKey].color : CATEGORIAS_INFO[catKey].bg,
                    color: filtroCategoria === catKey ? '#fff' : CATEGORIAS_INFO[catKey].color
                  }}
                >
                  Tipo {catKey} ({count})
                </button>
              );
            })}
          </div>

          <div style={{ width: '250px' }}>
            <input
              type="text"
              className="input-field"
              placeholder="Filtrar por nombre o CUIT..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ width: '100%', fontSize: '0.85rem' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <Database className="primary-text" size={32} />
          <div style={{ flex: 1, minWidth: '280px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.3rem' }}>
              <label style={{ color: 'var(--text-main)', fontWeight: 700, fontSize: '0.88rem' }}>
                Seleccionar Cliente ({clientes.filter(cliente => {
                  const cat = getCategoriaCliente(cliente);
                  const coincideCategoria = filtroCategoria === 'TODOS' || cat === filtroCategoria;
                  
                  const cleanSearch = searchTerm.trim().toLowerCase().replace(/\D/g, '');
                  const cleanCuit = (cliente.cuit || '').replace(/\D/g, '');
                  
                  const coincideTexto = !searchTerm || 
                    (cliente.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                    (cleanSearch && cleanCuit.includes(cleanSearch)) ||
                    cliente.cuit?.includes(searchTerm) ||
                    cliente.id?.toString() === searchTerm ||
                    obtenerCodigo3DCliente(cliente).includes(searchTerm);
                    
                  return coincideCategoria && coincideTexto;
                }).length} disponibles)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Orden:</span>
                <select
                  className="input-field"
                  value={ordenClientes}
                  onChange={e => setOrdenClientes(e.target.value)}
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.78rem', fontWeight: 700 }}
                >
                  <option value="alfabetico">Alfabético (A - Z)</option>
                  <option value="numerico">Numérico (#001 - #999)</option>
                </select>
              </div>
            </div>
            <select className="input-field" value={selectedClienteId} onChange={handleClienteChange} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', width: '100%', maxWidth: '560px', fontWeight: 600 }}>
              <option value="">-- Elige un cliente para ver su Libro IVA --</option>
              {clientes.filter(cliente => {
                const cat = getCategoriaCliente(cliente);
                const coincideCategoria = filtroCategoria === 'TODOS' || cat === filtroCategoria;
                
                const cleanSearch = searchTerm.trim().toLowerCase().replace(/\D/g, '');
                const cleanCuit = (cliente.cuit || '').replace(/\D/g, '');
                
                const coincideTexto = !searchTerm || 
                  (cliente.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                  (cleanSearch && cleanCuit.includes(cleanSearch)) ||
                  cliente.cuit?.includes(searchTerm) ||
                  cliente.id?.toString() === searchTerm ||
                  obtenerCodigo3DCliente(cliente).includes(searchTerm);
                  
                return coincideCategoria && coincideTexto;
              })
              .sort((a, b) => {
                if (ordenClientes === 'numerico') {
                  const codA = obtenerCodigo3DCliente(a);
                  const codB = obtenerCodigo3DCliente(b);
                  return codA.localeCompare(codB);
                }
                return (a.nombre || '').localeCompare(b.nombre || '');
              })
              .map(c => {
                const cat = getCategoriaCliente(c);
                const cod3d = obtenerCodigo3DCliente(c);
                return (
                  <option key={c.id} value={c.id}>
                    #{cod3d} - [Tipo {cat}] {c.nombre} {c.ultima_sincronizacion !== 'Nunca' ? '(Sincronizado)' : '(Sin datos)'}
                  </option>
                );
              })}
            </select>
          </div>
          {clienteActivo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Tipo / Categoría:</span>
              <select
                value={getCategoriaCliente(clienteActivo)}
                onChange={async (e) => {
                  const nuevaCat = e.target.value;
                  localStorage.setItem(`cliente_cat_${clienteActivo.id}`, nuevaCat);
                  setClientes(prev => prev.map(c => c.id === clienteActivo.id ? { ...c, categoria: nuevaCat } : c));
                  setClienteActivo({ ...clienteActivo, categoria: nuevaCat });
                  try {
                    await supabase.from('clientes').update({ categoria: nuevaCat }).eq('id', clienteActivo.id);
                  } catch (err) {}
                }}
                style={{
                  padding: '0.4rem 0.75rem',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  background: CATEGORIAS_INFO[getCategoriaCliente(clienteActivo)]?.bg || 'var(--bg-main)',
                  color: CATEGORIAS_INFO[getCategoriaCliente(clienteActivo)]?.color || 'var(--text-main)',
                  border: `1px solid ${CATEGORIAS_INFO[getCategoriaCliente(clienteActivo)]?.color}`,
                  cursor: 'pointer'
                }}
              >
                <option value="A">Tipo A - Gran Contribuyente</option>
                <option value="B">Tipo B - Resp. Inscripto</option>
                <option value="C">Tipo C - Monotributo</option>
                <option value="D">Tipo D - Exento</option>
                <option value="E">Tipo E - Observación</option>
              </select>

              <button
                className="btn btn-primary"
                onClick={() => setIsFoliadoModalOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.85rem',
                  fontWeight: 700
                }}
              >
                <BookOpen size={16} /> Libro IVA Foliado (Ley / Inspección)
              </button>
            </div>
          )}
          {clienteActivo && clienteActivo.ultima_sincronizacion === 'Nunca' && (
            <span style={{ color: 'var(--warning)', fontWeight: 500, fontSize: '0.85rem' }}>
              ⚠️ Este cliente no ha sido sincronizado.
            </span>
          )}
        </div>
      </div>

      {/* Tarjeta para Archivar en Resumen Anual en la Nube */}
      {clienteActivo && (
        <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Save size={24} style={{ color: 'var(--primary)' }} />
            <div>
              <h3 style={{ fontSize: '0.95rem', marginBottom: '0.2rem', color: 'var(--text-main)' }}>Archivar en Resumen Anualizado en la Nube</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Guarda los totales del mes en Supabase (Ventas Netas: {formatMoney(ventasMensuales.totalNetoGravado)} | Compras Netas: {formatMoney(comprasMensuales.totalNetoGravado)}) para ver la evolución anual.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <select
              className="input-field notranslate"
              translate="no"
              value={mesSeleccionado}
              onChange={e => setMesSeleccionado(e.target.value)}
              style={{ width: '135px', fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}
            >
              <option className="notranslate" translate="no" value="1">Enero</option>
              <option className="notranslate" translate="no" value="2">Febrero</option>
              <option className="notranslate" translate="no" value="3">Marzo</option>
              <option className="notranslate" translate="no" value="4">Abril</option>
              <option className="notranslate" translate="no" value="5">Mayo</option>
              <option className="notranslate" translate="no" value="6">Junio</option>
              <option className="notranslate" translate="no" value="7">Julio</option>
              <option className="notranslate" translate="no" value="8">Agosto</option>
              <option className="notranslate" translate="no" value="9">Septiembre</option>
              <option className="notranslate" translate="no" value="10">Octubre</option>
              <option className="notranslate" translate="no" value="11">Noviembre</option>
              <option className="notranslate" translate="no" value="12">Diciembre</option>
            </select>
            <select
              className="input-field"
              value={anioSeleccionado}
              onChange={e => setAnioSeleccionado(e.target.value)}
              style={{ width: '95px', fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}
            >
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
            </select>
              <button className="btn btn-primary" onClick={handleGuardarEnResumenAnual} disabled={guardandoAnual || !clienteActivo} style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Save size={16} /> {guardandoAnual ? 'Procesando...' : 'Archivar y Cerrar Mes'}
              </button>
          </div>
        </div>
      )}

      {/* 4 Paneles Principales de Libro IVA (Facturas y Notas de Crédito con Desglose Completo) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {renderPanelContable({
          numero: 1,
          titulo: 'Ventas Totales (Facturas & ND)',
          icon: TrendingUp,
          colorClass: 'success',
          datos: desgloseVentas.facturas,
          tipoIva: 'IVA DÉBITO FISCAL'
        })}

        {renderPanelContable({
          numero: 2,
          titulo: 'Compras Totales (Facturas & ND)',
          icon: TrendingDown,
          colorClass: 'primary',
          datos: desgloseCompras.facturas,
          tipoIva: 'IVA CRÉDITO FISCAL'
        })}

        {renderPanelContable({
          numero: 3,
          titulo: 'Dev. de Ventas (NC Emitidas)',
          icon: TrendingDown,
          colorClass: 'danger',
          datos: desgloseVentas.nc,
          tipoIva: 'CRÉDITO RESTITUIDO',
          esDevolucion: true
        })}

        {renderPanelContable({
          numero: 4,
          titulo: 'Dev. de Compras (NC Recibidas)',
          icon: TrendingUp,
          colorClass: 'warning',
          datos: desgloseCompras.nc,
          tipoIva: 'DÉBITO RESTITUIDO',
          esDevolucion: true
        })}
      </div>

      {/* Tarjetas complementarias de saldo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card highlight-card" style={{ background: 'linear-gradient(135deg, var(--warning) 0%, #e6a800 100%)', padding: '1.5rem', borderRadius: 'var(--radius-md)' }}>
          <div className="metric-header">
            <span className="metric-label text-white" style={{ fontWeight: 'bold' }}>Libre Disponibilidad (Percepciones)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
            <span className="text-white" style={{ fontSize: '1.75rem', fontWeight: 'bold' }}>
              {formatMoney((ventasMensuales.totalPercepcionesNacionales || 0) + (ventasMensuales.totalPercepcionesIIBB || 0) + (ventasMensuales.totalPercepcionesMunicipales || 0))}
            </span>
          </div>
          <p className="text-white-50" style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>Sirve para cancelar VEP o IIBB</p>
        </div>

        <div className="card highlight-card" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', padding: '1.5rem', borderRadius: 'var(--radius-md)' }}>
          <div className="metric-header">
            <span className="metric-label text-white" style={{ fontWeight: 'bold' }}>Saldo Anterior TÉCNICO (Arrastre)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
            <span className="text-white" style={{ fontSize: '1.75rem', fontWeight: 'bold' }}>$</span>
            <input 
              type="number" 
              className="input-field" 
              value={saldoAnterior} 
              onChange={(e) => setSaldoAnterior(Number(e.target.value))}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', fontSize: '1.5rem', fontWeight: 'bold', padding: '0.25rem', width: '100%', borderRadius: '6px' }}
            />
          </div>
          <p className="text-white-50" style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>Solo aplicable a Débitos Fiscales</p>
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
                    {/* Bottom panel actions removed to simplify UI */}
          </div>
        </div>

      {renderTablaDetalle(ventasMensuales.lista, 'Ventas Emitidas', 'success')}
      {renderTablaDetalle(comprasMensuales.lista, 'Compras Recibidas', 'danger')}

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

      {isFoliadoModalOpen && clienteActivo && (
        <LibroIvaFoliadoModal
          cliente={clienteActivo}
          ventasLista={ventasMensuales.lista}
          comprasLista={comprasMensuales.lista}
          onClose={() => setIsFoliadoModalOpen(false)}
        />
      )}

      <style>{`
        .hover-row:hover { background: var(--bg-hover) !important; }
      `}</style>
    </div>
  );
}

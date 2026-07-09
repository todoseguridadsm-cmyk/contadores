export function procesarComprobantes(comprobantes) {
  let resumen = {
    totalNetoGravado: 0,
    totalNetoGravado_NC: 0,
    totalNoGravado: 0,
    totalExento: 0,
    totalIVA: 0,
    totalIVA_NC: 0,
    totalPercepcionesNacionales: 0,
    totalPercepcionesIIBB: 0,
    totalPercepcionesMunicipales: 0,
    totalImpuestosInternos: 0,
    totalGeneral: 0,
    cantidadComprobantes: comprobantes.length,
    lista: []
  };

  comprobantes.forEach(comp => {
    const parseImporte = (val) => {
      if (!val) return 0;
      if (typeof val === 'number') return val;
      return parseFloat(val.toString().replace(/\./g, '').replace(',', '.')) || 0;
    };

    const neto = parseImporte(comp['Importe Neto Gravado'] || comp['Imp. Neto Gravado Total']);
    const noGravado = parseImporte(comp['Importe No Gravado'] || comp['Conceptos No Gravados'] || comp['Imp. Tot. Conc. No Gravados']);
    const exento = parseImporte(comp['Importe Exento'] || comp['Imp. Op. Exentas']);
    const totalIva = parseImporte(comp['IVA'] || comp['Total IVA']);
    const total = parseImporte(comp['Importe Total'] || comp['Imp. Total']);
    
    // Identificar Notas de Crédito
    const tipoComp = String(comp['Tipo'] || comp['Tipo de Comprobante'] || comp['Tipo Comprobante'] || comp['Comprobante'] || '').toLowerCase();
    const isNC = tipoComp.includes('nota de cr') || tipoComp.includes('nc ') || tipoComp === 'nc' || tipoComp.includes('n.c') || tipoComp.includes('nota crédito');


    // Percepciones
    const percNac = parseImporte(comp['Percepciones Nacionales']);
    const percIIBB = parseImporte(comp['Percepciones Ingresos Brutos'] || comp['Percepciones IIBB']);
    const percMuni = parseImporte(comp['Percepciones Impuestos Municipales']);
    const impInt = parseImporte(comp['Impuestos Internos']);

    if (isNC) {
      resumen.totalIVA_NC += Math.abs(totalIva);
      // Las NC se separan en variables propias en lugar de restarlas del total
      resumen.totalNetoGravado_NC += Math.abs(neto);
      // Se siguen restando de los informativos globales para no desvirtuar el total global si es necesario
      resumen.totalNoGravado -= Math.abs(noGravado);
      resumen.totalExento -= Math.abs(exento);
    } else {
      resumen.totalIVA += totalIva;
      resumen.totalNetoGravado += neto;
      resumen.totalNoGravado += noGravado;
      resumen.totalExento += exento;
    }
    
    resumen.totalGeneral += total;
    resumen.totalPercepcionesNacionales += percNac;
    resumen.totalPercepcionesIIBB += percIIBB;
    resumen.totalPercepcionesMunicipales += percMuni;
    resumen.totalImpuestosInternos += impInt;

    resumen.lista.push({
      fecha: comp['Fecha'] || comp['Fecha de Emisión'] || '',
      tipoComp: comp['Tipo'] || comp['Tipo de Comprobante'] || comp['Tipo Comprobante'] || '',
      puntoVenta: comp['Punto de Venta'] || '',
      numero: comp['Número'] || comp['Número Desde'] || '',
      cuit: comp['Nro. Doc. Receptor'] || comp['Nro. Doc. Emisor'] || comp['CUIT'] || '',
      razon_social: comp['Denominación Receptor'] || comp['Denominación Emisor'] || comp['Razón Social'] || '',
      neto,
      noGravado,
      exento,
      percNac,
      percIIBB,
      percMun: percMuni,
      impInt,
      iva: totalIva,
      total
    });
  });

  return resumen;
}

export function calcularSaldos(resumenVentas, resumenCompras, saldoAnteriorArrastre = 0) {
  // AFIP cruza las Notas de Crédito (Restitución):
  // - NC de Compras (Crédito a Restituir) -> Suma al Débito Fiscal
  // - NC de Ventas (Débito a Restituir) -> Suma al Crédito Fiscal
  const ivaVentas = (resumenVentas.totalIVA || 0) + (resumenCompras.totalIVA_NC || 0);
  const ivaCompras = (resumenCompras.totalIVA || 0) + (resumenVentas.totalIVA_NC || 0);
  
  // Saldo Técnico
  // Positivo = Débito mayor al Crédito (A pagar IVA puro)
  // Negativo = Crédito mayor al Débito (Nuevo Saldo Técnico a Favor)
  const posicionMensual = ivaVentas - ivaCompras; 
  
  // Aplicamos el arrastre del mes anterior a la posición mensual.
  const saldoTecnicoPuro = posicionMensual - saldoAnteriorArrastre; 
  
  // Percepciones = Libre Disponibilidad (Dinero Real)
  // Extraemos las percepciones sufridas en las compras.
  const percepcionesNacionales = resumenCompras.totalPercepcionesNacionales || 0;
  const percepcionesIIBB = resumenCompras.totalPercepcionesIIBB || 0;
  const percepcionesMunicipales = resumenCompras.totalPercepcionesMunicipales || 0;

  // Informativos
  const noGravadoVentas = resumenVentas.totalNoGravado || 0;
  const exentoVentas = resumenVentas.totalExento || 0;
  const noGravadoCompras = resumenCompras.totalNoGravado || 0;
  const exentoCompras = resumenCompras.totalExento || 0;

  let ivaAPagar = saldoTecnicoPuro > 0 ? saldoTecnicoPuro : 0;
  let nuevoSaldoAFavorTecnico = saldoTecnicoPuro < 0 ? Math.abs(saldoTecnicoPuro) : 0;
  
  // El IVA a Pagar se cancela primero con las Percepciones Nacionales de Libre Disponibilidad
  let totalAPagarFinal = ivaAPagar - percepcionesNacionales;
  let libreDisponibilidadRestante = 0;
  
  if (totalAPagarFinal < 0) {
    libreDisponibilidadRestante = Math.abs(totalAPagarFinal);
    totalAPagarFinal = 0;
  }

  return {
    ivaVentas,
    ivaCompras,
    posicionMensual,
    saldoAnterior: saldoAnteriorArrastre,
    saldoTecnicoPuro,
    
    // Percepciones
    percepcionesNacionales,
    percepcionesIIBB,
    percepcionesMunicipales,
    
    // Libre Disponibilidad
    libreDisponibilidadUsada: ivaAPagar - totalAPagarFinal,
    libreDisponibilidadRestante,
    
    // Resultados Finales
    saldoPagar: totalAPagarFinal, // Lo que hay que transferir (VEP)
    nuevoSaldoAFavor: nuevoSaldoAFavorTecnico, // Queda para el mes que viene (Arrastre Técnico)
    
    // Informativos (No Gravado)
    noGravadoVentas,
    exentoVentas,
    noGravadoCompras,
    exentoCompras
  };
}

/**
 * Normaliza cualquier formato de fecha ("2026-06-05", "9 de junio de 2026", "13/06/2026")
 * al formato estándar argentino DD/MM/YYYY
 */
export function formatearFechaDDMMYYYY(fechaStr) {
  if (!fechaStr) return '';
  const str = String(fechaStr).trim();

  // 1. Ya en formato DD/MM/YYYY o D/M/YYYY
  const mBarra = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (mBarra) {
    const dia = mBarra[1].padStart(2, '0');
    const mes = mBarra[2].padStart(2, '0');
    let anio = mBarra[3];
    if (anio.length === 2) anio = '20' + anio;
    return `${dia}/${mes}/${anio}`;
  }

  // 2. Formato ISO YYYY-MM-DD o YYYY/MM/DD
  const mIso = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (mIso) {
    const dia = mIso[3].padStart(2, '0');
    const mes = mIso[2].padStart(2, '0');
    const anio = mIso[1];
    return `${dia}/${mes}/${anio}`;
  }

  // 3. Formato texto "9 de junio de 2026" o "09 de Junio del 2026"
  const mesesNombres = {
    'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04', 'mayo': '05', 'junio': '06',
    'julio': '07', 'agosto': '08', 'septiembre': '09', 'setiembre': '09', 'octubre': '10',
    'noviembre': '11', 'diciembre': '12'
  };
  const mTexto = str.toLowerCase().match(/(\d{1,2})\s+de\s+([a-z]+)\s+(?:de|del)\s+(\d{4})/);
  if (mTexto) {
    const dia = mTexto[1].padStart(2, '0');
    const mesNombre = mTexto[2];
    const mes = mesesNombres[mesNombre] || '01';
    const anio = mTexto[3];
    return `${dia}/${mes}/${anio}`;
  }

  // Fallback para otros strings o timestamps
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime()) && str.length > 5) {
    const dia = String(parsed.getDate()).padStart(2, '0');
    const mes = String(parsed.getMonth() + 1).padStart(2, '0');
    const anio = parsed.getFullYear();
    return `${dia}/${mes}/${anio}`;
  }

  return str;
}

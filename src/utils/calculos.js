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
      if (val === undefined || val === null || val === '') return 0;
      if (typeof val === 'number') return isNaN(val) ? 0 : val;
      let str = String(val).replace(/\$/g, '').trim();
      if (str.includes(',') && str.includes('.')) {
        if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
          str = str.replace(/\./g, '').replace(',', '.');
        } else {
          str = str.replace(/,/g, '');
        }
      } else if (str.includes(',')) {
        str = str.replace(',', '.');
      }
      return parseFloat(str) || 0;
    };

    // Búsqueda flexible por nombres de columna AFIP/Excel
    const getField = (...keys) => {
      for (const k of keys) {
        if (comp[k] !== undefined && comp[k] !== null && comp[k] !== '') return comp[k];
      }
      // Búsqueda insensibles a mayúsculas
      const lowerKeys = keys.map(k => String(k).toLowerCase());
      for (const prop of Object.keys(comp)) {
        if (lowerKeys.includes(prop.toLowerCase())) return comp[prop];
      }
      return 0;
    };

    const neto = parseImporte(getField('neto', 'Neto Gravado', 'Importe Neto Gravado', 'Imp. Neto Gravado Total', 'Imp. Neto Gravado', 'Neto gravado', 'Gravado'));
    const noGravado = parseImporte(getField('noGravado', 'Importe No Gravado', 'Conceptos No Gravados', 'Imp. Tot. Conc. No Gravados', 'No Gravado'));
    const exento = parseImporte(getField('exento', 'Importe Exento', 'Imp. Op. Exentas', 'Exento'));
    const total = parseImporte(getField('total', 'Total', 'Importe Total', 'Imp. Total'));
    
    // Percepciones e impuestos
    const percNac = parseImporte(getField('percNac', 'Percepciones Nacionales'));
    const percIIBB = parseImporte(getField('percIIBB', 'Percepciones Ingresos Brutos', 'Percepciones IIBB'));
    const percMuni = parseImporte(getField('percMun', 'Percepciones Impuestos Municipales'));
    const impInt = parseImporte(getField('impInt', 'Impuestos Internos'));

    // IVA directo o alícuotas
    let iva21 = parseImporte(getField('IVA 21%', 'iva21', 'Importe IVA 21%'));
    let iva105 = parseImporte(getField('IVA 10,5%', 'iva105', 'Importe IVA 10,5%'));
    let iva27 = parseImporte(getField('IVA 27%', 'iva27', 'Importe IVA 27%'));

    let totalIva = parseImporte(getField('iva', 'IVA', 'Total IVA', 'Imp. Total IVA', 'Importe IVA'));
    const alicSum = iva21 + iva105 + iva27;
    if (totalIva === 0) {
      if (alicSum > 0) {
        totalIva = alicSum;
      } else if (neto > 0 && total > neto) {
        // Cálculo por diferencia si no vino columna de IVA explicita
        const diff = total - neto - noGravado - exento - percNac - percIIBB - percMuni - impInt;
        if (diff > 0 && diff <= neto * 0.28) {
          totalIva = Number(diff.toFixed(2));
        }
      }
    }

    // Si tenemos totalIva pero no vinieron desglosadas alícuotas, intentamos asignar 21% o 10.5%
    if (totalIva > 0 && alicSum === 0) {
      if (neto > 0 && Math.abs(totalIva - (neto * 0.105)) < 2) {
        iva105 = totalIva;
      } else {
        iva21 = totalIva;
      }
    }
    
    // Identificar Notas de Crédito
    const tipoComp = String(comp.tipoComp || comp['Tipo'] || comp['Tipo de Comprobante'] || comp['Tipo Comprobante'] || comp['Comprobante'] || '').toLowerCase();
    const isNC = tipoComp.includes('nota de cr') || tipoComp.includes('nc ') || tipoComp === 'nc' || tipoComp.includes('n.c') || tipoComp.includes('nota crédito');

    if (isNC) {
      resumen.totalIVA_NC += Math.abs(totalIva);
      resumen.totalNetoGravado_NC += Math.abs(neto);
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
      fecha: comp.fecha || comp['Fecha'] || comp['Fecha de Emisión'] || '',
      tipoComp: comp.tipoComp || comp['Tipo'] || comp['Tipo de Comprobante'] || comp['Tipo Comprobante'] || comp['Comprobante'] || '',
      puntoVenta: comp.puntoVenta || comp['Punto de Venta'] || '',
      numero: comp.numero || comp['Número'] || comp['Número Desde'] || '',
      cuit: comp.cuit || comp['Nro. Doc. Receptor'] || comp['Nro. Doc. Emisor'] || comp['CUIT'] || '',
      razon_social: comp.razon_social || comp['Denominación Receptor'] || comp['Denominación Emisor'] || comp['Denominación Comprador'] || comp['Denominación Vendedor'] || comp['Razón Social'] || '',
      neto,
      noGravado,
      exento,
      percNac,
      percIIBB,
      percMun: percMuni,
      impInt,
      iva: totalIva,
      iva21,
      iva105,
      iva27,
      total
    });
  });

  return resumen;
}

const sumarIvaLista = (resumen) => {
  let ivaNormal = 0;
  let ivaNC = 0;
  if (Array.isArray(resumen?.lista) && resumen.lista.length > 0) {
    resumen.lista.forEach(item => {
      const t = String(item.tipoComp || '').toLowerCase();
      const isNC = t.includes('nota de cr') || t.includes('nc') || t.includes('nota crédito');
      const iv = Math.abs(Number(item.iva) || 0);
      if (isNC) ivaNC += iv;
      else ivaNormal += iv;
    });
  }
  return { ivaNormal, ivaNC };
};

export function calcularSaldos(resumenVentas = {}, resumenCompras = {}, saldoAnteriorArrastre = 0) {
  const sumVentas = sumarIvaLista(resumenVentas);
  const sumCompras = sumarIvaLista(resumenCompras);

  const ivaVentasPuro = Math.max(Number(resumenVentas.totalIVA) || 0, sumVentas.ivaNormal);
  const ivaVentasNC = Math.max(Number(resumenVentas.totalIVA_NC) || 0, sumVentas.ivaNC);
  const ivaComprasPuro = Math.max(Number(resumenCompras.totalIVA) || 0, sumCompras.ivaNormal);
  const ivaComprasNC = Math.max(Number(resumenCompras.totalIVA_NC) || 0, sumCompras.ivaNC);

  // AFIP cruza las Notas de Crédito (Restitución):
  // - NC de Compras (Crédito a Restituir) -> Suma al Débito Fiscal
  // - NC de Ventas (Débito a Restituir) -> Suma al Crédito Fiscal
  const ivaVentas = ivaVentasPuro + ivaComprasNC;
  const ivaCompras = ivaComprasPuro + ivaVentasNC;
  
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

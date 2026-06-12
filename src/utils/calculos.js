export function procesarComprobantes(comprobantes) {
  let resumen = {
    totalNetoGravado: 0,
    totalNoGravado: 0,
    totalExento: 0,
    totalIVA: 0,
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
    
    // Percepciones
    const percNac = parseImporte(comp['Percepciones Nacionales']);
    const percIIBB = parseImporte(comp['Percepciones Ingresos Brutos'] || comp['Percepciones IIBB']);
    const percMuni = parseImporte(comp['Percepciones Impuestos Municipales']);
    const impInt = parseImporte(comp['Impuestos Internos']);

    resumen.totalNetoGravado += neto;
    resumen.totalNoGravado += noGravado;
    resumen.totalExento += exento;
    resumen.totalIVA += totalIva;
    resumen.totalGeneral += total;
    resumen.totalPercepcionesNacionales += percNac;
    resumen.totalPercepcionesIIBB += percIIBB;
    resumen.totalPercepcionesMunicipales += percMuni;
    resumen.totalImpuestosInternos += impInt;
  });

  return resumen;
}

export function calcularSaldos(resumenVentas, resumenCompras, saldoAnteriorArrastre = 0) {
  const ivaVentas = resumenVentas.totalIVA || 0;
  const ivaCompras = resumenCompras.totalIVA || 0;
  
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

// Función principal.
function multipleLineChart(datos, excluidos) {
  // Preparación de datos.
  const filtroDatos = filterData(datos, excluidos);
  const lineChartData = prepareLineChartData(filtroDatos);

  // Dimensiones generales del objeto.
  let screenWidth = 1200,
    screenHeight = 700;

  const margin = {
    top: 40,
    right: 120,
    bottom: 60,
    left: 40
  };
  const width = screenWidth - margin.right - margin.left;
  const height = screenHeight - margin.top - margin.bottom;

  // AÑADIR ELEMENTOS BASICOS ////////////////////////////////////////////////////////////////////////////////////
  const svg = d3
    .select('.line-chart-container')
    .append('svg')
    .attr('width', screenWidth)
    .attr('height', screenHeight)
    .attr('width', width + margin.right + margin.left)
    .attr('height', height + margin.top + margin.bottom)
  const grafico = svg
    .append('g')
    .attr('transform', `translate(${margin.left}, ${margin.top})`)
    .attr('class', 'line-chart');
  const grupoLineas = grafico
    .append('g')
    .attr('class', 'svg-paths');
  var grupoEtiquetas = grafico
    .append('g')
    .attr('class', 'grupo-etiquetas');
  const header = d3
    .select('.grafico-cabecera')
    .append('tspan')
    .text('Facturado por comercial en cada mes en EUR (miles)');
  const subheader = d3
    .select('.line-chart-subheader')
    .append('tspan')
    .attr('x', 0)
    .text('Total facturado comercial/mes en 2019');
  const ejeY = grafico // Solo añade grupo para eje Y, que es dinámico. X e Y se dibujan en funcion 'dibujarLineas'.
    .append('g')
    .attr('class', 'y axis');
  // FIN DE ELEMENTOS BÁSICOS ////////////////////////////////////////////////////////////////////////////////////

  // DIBUJAR EJE X ///////////////////////////////////////////////////////////////////////////////////////////////
  // EJE Y dibujado dinámicamente según comerciales seleccionados, en funcion 'dibujarLineas'.
  const xScale = d3
    .scaleLinear()
    .domain(d3.extent(lineChartData.rangoMeses))
    .range([0, width]);
  const xAxis = d3
    .axisBottom(xScale)
    .ticks(lineChartData.rangoMeses.length)
    .tickFormat(formatTicksEjeX)
    .tickSizeOuter(0);
  const xAxisDraw = grafico
    .append('g')
    .attr('transform', `translate(0, ${height})`)
    .attr('class', 'x axis')
    .call(xAxis);
  // FIN DIBUJO EJE X ////////////////////////////////////////////////////////////////////////////////////////////

  // LINEA DE BOTONES CON COMERCIALES PARA FILTRADO //////////////////////////////////////////////////////////////
  // 1.- Rellenar array de comerciales.
  var comerciales = new Array;
  for (let index = 0; index < lineChartData.series.length; index++) {
    comerciales.push(lineChartData.series[index].key);
  }
  // 2.- Función para asignar colores a comerciales.
  color = d3.scaleOrdinal()
    .domain(comerciales)
    .range(d3.schemeCategory10)

  // 3.- Añadir botones en DOM con comerciales para filtrado.
  const filtrosComerciales = d3
    .select('.grafico-filtros')
    .selectAll('.OpcionFiltrado')
    .data(lineChartData["series"], d => d.key)
    .enter()
    .append('div')
    .attr('class', 'OpcionFiltrado')
    .html(d => d.key)
    .style('color', d => color(d.key));

  d3
    .select('.grafico-filtros')
    .append('div')
    .attr('class', 'OpcionFiltrado_deseleccionar')
    .html('X')
    .style('color', 'black');


  // 4.- Escuchando eventos click en botones con nombre de comerciales.
  d3.selectAll('.OpcionFiltrado').on('click', click_opciones);
  d3.selectAll('.OpcionFiltrado_deseleccionar').on('click', click_deseleccionar);
  // FIN LINEA DE BOTONES CON COMERCIALES PARA FILTRADO //////////////////////////////////////////////////////////

  dibujarLineas(lineChartData);

  // Preparar estructura de datos idonea para representación visual.
  function prepareLineChartData(data) {
    let arrayMeses = new Array;
    let rangoMeses = new Array;

    // Ordenamos por mes ascendentemente para que los puntos del eje X ya estén ordenados.
    const dataOrdenadoFecha = data.slice().sort((a, b) => d3.ascending(a.fecha, b.fecha));

    // Agrupamos por comercial y año-mes. Así tendrémos un array de objetos por comercial con el total de cada mes.
    // Se utiliza año mes en la variable d.yearmonth para los casos en los que se consulten meses de un año y del anterior.
    var dataPorComercial = d3
      .nest()
      .key(d => d.comercial)
      .key(d => d.yearmonth)
      .rollup(v => parseInt(d3.sum(v, leaf => leaf.neto)))
      .entries(dataOrdenadoFecha);

    // Separamos en un array aparte todos los meses encontrados en el rango de datos.
    // Esto nos permitirá añadir un valor de 0 en el caso de que un comercial no tenga ventas en un determinado mes.
    // El array 'arrayMeses' tendrá una lista de valores del tipo ["1912" (para diciembre de 2019), "2001" (para enero de 2020), etc]
    var meses = d3
      .nest()
      .key(d => d.yearmonth)
      .entries(dataOrdenadoFecha);
    for (let index = 0; index < meses.length; index++) {
      arrayMeses.push(+meses[index].key);
    }

    // Repasamos todos los arrays de valores con los meses para rellenar con 0 aquellos meses
    // que no existan en algún comercial, de entre los meses existentes en el rango de búsqueda.
    // Se tiene en cuenta cualquier rango de meses, Ene-Dic, Sep-Nov, etc.
    for (let i = 0; i < dataPorComercial.length; i++) {
      for (let j = 0; j < dataPorComercial[i].values.length; j++) {
        for (let z = 0; z < arrayMeses.length; z++) {
          if (dataPorComercial[i].values[z] != undefined) {
            if (dataPorComercial[i].values[z].key != arrayMeses[z]) {
              dataPorComercial[i].values.splice(z, 0, {
                "key": arrayMeses[z].toString(),
                "value": 0
              });
            }
          } else {
            dataPorComercial[i].values.splice(z, 0, {
              "key": arrayMeses[z].toString(),
              "value": 0
            });
          }
          // El campo mes de este array será un contador de todos los meses. Esto ayudará en el escalado en el eje X.
          dataPorComercial[i].values[z].mes = z;
        }
      }
    }

    // Rango de meses de uno de los comerciales, el primero por si solo hay uno, ya que todos tienen que tener la lista completa de meses
    // aunque algunos tendrán valor 0 en algún mes
    for (let index = 0; index < dataPorComercial[0].values.length; index++) {
      rangoMeses.push(dataPorComercial[0].values[index].mes);
    }

    // Máxima cantidad en cualquier mes de todos los comerciales.
    // Esto servirá para establecer el dominio máximo del eje Y.
    let maximos = new Array;
    for (let i = 0; i < dataPorComercial.length; i++) {
      maximos.push(d3.max(dataPorComercial[i].values, d => d.value));
    }
    const yMax = d3.max(maximos);

    // Producción de datos finales para su posterior dibujo.
    const lineData = {
      series: dataPorComercial,
      yMax: yMax,
      meses: arrayMeses,
      rangoMeses: rangoMeses
    };

    return lineData;
  }

  // La función de filtrado nos permite eliminar del array de datos aquello que no queramos mostrar,
  // como ciertos comerciales, o aquellos que estén por debajo de un valor determinado, etc.
  function filterData(data, excluidos) {
    return data.filter(d => {
      return (
        !excluidos.includes(d.comercial)
      );
    });
  }

  // Utilidades de dibujo
  // Para cambiar la etiqueta del eje X, y no poner los meses del 0 al 11 sino con las tres primeras letras del mes.
  function formatTicksEjeX(numeroMes) {

    // Controlamos que el mes pasado se encuentre en los meses posibles 
    // para evitar una salida por error.
    let mesIncluido = lineChartData.rangoMeses.includes(numeroMes);

    if (mesIncluido) {
      let year = lineChartData.meses[numeroMes].toString().substr(0, 2);
      let month = lineChartData.meses[numeroMes].toString().substr(2, 2);
      switch (month) {
        case '01':
          return 'Ene ' + year;
          break;
        case '02':
          return 'Feb ' + year;
          break;
        case '03':
          return 'Mar ' + year;
          break;
        case '04':
          return 'Abr ' + year;
          break;
        case '05':
          return 'May ' + year;
          break;
        case '06':
          return 'Jun ' + year;
          break;
        case '07':
          return 'Jul ' + year;
          break;
        case '08':
          return 'Ago ' + year;
          break;
        case '09':
          return 'Sep ' + year;
          break;
        case '10':
          return 'Oct ' + year;
          break;
        case '11':
          return 'Nov ' + year;
          break;
        case '12':
          return 'Dic ' + year;
          break;
        default:
          break;
      }
    }
  }

  // Cambio en los textos predefinidos por D3 para los ticks de los ejes del gráfico.
  // En el caso de miles utiliza la letra k, en este caso la ocultamos.
  function formatTicksEjeY(d) {
    return d3
      .format('~s')(d)
      .replace('M', ' M')
      .replace('G', ' bil')
      .replace('T', ' tril')
      .replace('k', ' mil');
  }

  // Dibujar líneas.
  function dibujarLineas(data) {
    const TIEMPO_UPDATE_EJEY = 600
      TIEMPO_ENTER_LINEAS = 600,
      TIEMPO_UPDATE_LINEAS = 600,
      TIEMPO_REMOVE_LINEAS = 400,
      TIEMPO_ENTER_PUNTOS = 600,
      TIEMPO_UPDATE_PUNTOS = 600,
      TIEMPO_REMOVE_PUNTOS = 400,
      TIEMPO_ENTER_ETIQUETAS = 600,
      TIEMPO_UPDATE_ETIQUETAS = 600,
      TIEMPO_REMOVE_ETIQUETAS = 400,
      RADIO_PUNTOS = 3,
      TICKS_EJEY=15;

    // ESCALA Y DIBUJO EJE Y //////////////////////////////////////////////////////////
    yScale = d3
      .scaleLinear()
      .domain([0, data.yMax])
      .range([height, 0]);

    yAxis = d3
      .axisLeft(yScale)
      .ticks(TICKS_EJEY )
      .tickFormat(formatTicksEjeY)
      .tickSizeOuter(0)
      .tickSizeInner(-width);

    yAxisDraw = grafico
      .select('.y.axis')
      .join(
        enter => {
          enter
            .call(yAxis)
        },
        update => {
          update
            .transition()
            .duration(TIEMPO_UPDATE_EJEY)
            .call(yAxis)
        });
    // FIN ESCALA Y DIBUJO EJE Y //////////////////////////////////////////////////////

    // DIBUJO DE LINEAS ///////////////////////////////////////////////////////////////
    lineGen = d3
      .line()
      .x(d => xScale(parseInt(d.mes)))
      .y(d => yScale(d.value));

    var lineas = grafico
      .select('.svg-paths')
      .selectAll('.line-series')
      .data(data.series, d => d.key)
      .join(
        enter => {
          enter
            .append('path')
            .attr('class', 'line-series')
            .attr('d', d => lineGen(d.values))
            .style('fill', 'none')
            .style('stroke', d => color(d.key))
            .style('opacity', 0)
            .transition()
            .duration(TIEMPO_ENTER_LINEAS)
            .style('opacity', 1)
        },
        update => {
          update
            .transition()
            .duration(TIEMPO_UPDATE_LINEAS)
            .attr('d', d => lineGen(d.values))
            .style('fill', 'none')
            .style('stroke', d => color(d.key))
        },
        exit => {
          exit
            .transition()
            .duration(TIEMPO_REMOVE_LINEAS)
            .style('opacity', 0)
            .remove();
        });
    // FIN DIBUJO DE LINEAS ///////////////////////////////////////////////////////////

    // DIBUJO DE PUNTOS SOBRE LAS LINEAS //////////////////////////////////////////////
    var puntos = grafico
      .selectAll('.puntos')
      .data(data.series, d => d.key)
      .join(
        enter => {
          enter
            .append('g')
            .attr('class', 'puntos')
            .style('fill', d => color(d.key))
            .selectAll('circle')
            .data(d => d.values)
            .join('circle')
            .attr('cx', d => xScale(parseInt(d.mes)))
            .attr('cy', d => yScale(d.value))
            .attr('r', d => RADIO_PUNTOS)
            .style('opacity', 0)
            .transition()
            .duration(TIEMPO_ENTER_PUNTOS)
            .style('opacity', 1)
        },
        update => {
          update
            //.style('fill', d => color(d.key))
            .selectAll('circle')
            .data(d => d.values)
            .join('circle')
            .transition()
            .duration(TIEMPO_UPDATE_PUNTOS)
            .attr('cx', d => xScale(parseInt(d.mes)))
            .attr('cy', d => yScale(d.value))
            .attr('r', d => RADIO_PUNTOS)
        },
        exit => {
          exit
            .transition()
            .duration(TIEMPO_REMOVE_PUNTOS)
            .style('opacity', 0)
            .remove()
        });
    // FIN DIBUJO DE PUNTOS SOBRE LAS LINEAS ///////////////////////////////////////////

    // DIBUJO DE ETIQUETAS EN FIN DE LAS LINEAS ////////////////////////////////////////
    var etiquetas = grafico
      .select('.grupo-etiquetas')
      .selectAll('.texto-etiqueta')
      .data(data.series, d => d.key)
      .join(
        enter => {
          enter
            .append('text')
            .attr('class', 'texto-etiqueta')
            .attr('x', screenWidth)
            .attr('y', d => yScale(d.values[d.values.length - 1].value))
            .text(d => d.key)
            .style('dominant-baseline', 'central')
            .style('fill', d => color(d.key))
            .transition()
            .duration(TIEMPO_ENTER_ETIQUETAS)
            .attr('x', d => xScale(parseInt(d.values[d.values.length - 1].mes) + 0.1))
        },
        update => {
          update
            .transition()
            .duration(TIEMPO_UPDATE_ETIQUETAS)
            .attr('y', d => yScale(d.values[d.values.length - 1].value))
            .text(d => d.key)
            .style('dominant-baseline', 'central')
            .style('fill', d => color(d.key))
            .attr('x', d => xScale(parseInt(d.values[d.values.length - 1].mes) + 0.1))
        },
        exit => {
          exit
            .transition()
            .duration(TIEMPO_REMOVE_ETIQUETAS)
            .attr('x', screenWidth + margin.right)
            .remove()
        });
    // FIN DIBUJO DE ETIQUETAS EN FIN DE LAS LINEAS /////////////////////////////////////
  }

  function click_opciones() {
    let data = new Array;

    const seleccionado = d3.select(this).classed('OpcionFiltrado--selected')
    d3.select(this).classed('OpcionFiltrado--selected', !seleccionado);

    // Consultar comerciales seleccionados para conformar array.
    let arrayComerciales = new Array;

    salida = d3
      .selectAll('.OpcionFiltrado--selected');
    salida.each(function (d, i) {
      arrayComerciales.push(this.innerHTML);
    });

    if (arrayComerciales.length > 0) {
      for (let i = 0; i < arrayComerciales.length; i++) {
        checkArrayComerciales = arrayComerciales[i];
        for (let j = 0; j < lineChartData.series.length; j++) {
          checkLineChartData = lineChartData.series[j].key;
          if (checkLineChartData == checkArrayComerciales) {
            elto = lineChartData.series[j];
            data.push(elto);
          }
        }
      }

      let maximos = new Array;
      for (let i = 0; i < data.length; i++) {
        maximos.push(d3.max(data[i].values, d => d.value));
      }
      const yMax = d3.max(maximos);

      // Producción de datos finales para su posterior dibujo.
      const newlineChartData = {
        series: data,
        yMax: yMax,
      };
      dibujarLineas(newlineChartData);
    } else {
      dibujarLineas(lineChartData);
    }
  }

  function click_deseleccionar() {
    const seleccionado = d3.selectAll('.OpcionFiltrado--selected');

    if (!seleccionado.empty()) {
      seleccionado.classed('OpcionFiltrado--selected', false);
      dibujarLineas(lineChartData);
    }
  }
}

// Comerciales a excluir.
const arrayExcluidos = ["INACTIVOS"];

// Tipeado de valores.
function type(d) {

  const parseDate = string => d3.utcParse('%d/%m/%y')(string);
  const parseDate2 = d3.utcParse('%d/%m/%y');
  const formatYear = d3.timeFormat("%y%m");
  const parseNA = string => (string === 'NA' ? undefined : string);
  return {
    documento: +d.documento,
    neto: +d.neto,
    year: +parseDate(d.fecha).getUTCFullYear().toString().substr(2, 2),
    mes: parseDate(d.fecha).getMonth(), // Asigna los meses con números del 0 al 11
    dia: parseDate(d.fecha).getDate(),
    fecha: parseDate(d.fecha),
    yearmonth: formatYear(parseDate2(d.fecha)),
    comercial: parseNA(d.comercial)
  };
}

// Cargar datos y mostrar gráfico.
d3.csv('data/facturacion.csv', type).then(res => {
  multipleLineChart(res, arrayExcluidos);
});
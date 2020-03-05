// Función principal.
function multipleLineChart(datos, params) {
  // Preparación de datos.
  const filtroDatos = filterData(datos, params.arrayExcluidos);
  const lineChartData = prepareLineChartData(filtroDatos);
  let tooltipInfoSeleccionada = false;
  let mediaInfoSeleccionada = false;

  // Dimensiones generales del objeto.
  const screenWidth = 1400,
    screenHeight = 900;

  const margin = {
    top: 40,
    right: 250,
    bottom: 120,
    left: 40
  };
  const width = screenWidth - margin.right - margin.left;
  const height = screenHeight - margin.top - margin.bottom;

  // AÑADIR ELEMENTOS BASICOS ////////////////////////////////////////////////////////////////////////////////////
  const svg = d3
    .select('.grafico-contenedor')
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
  const grupoEtiquetas = grafico
    .append('g')
    .attr('class', 'grupo-etiquetas');
  const header = d3
    .select('.grafico-cabecera')
    .append('tspan')
    .text('Facturado por comercial en cada mes en EUR (miles)');
  const subheader = d3
    .select('.grafico-subcabecera')
    .append('tspan')
    .attr('x', 0)
    .text('Total facturado comercial/mes en 2019');
  const ejeY = grafico // Solo añade grupo para eje Y, que es dinámico. X e Y se dibujan en funcion 'dibujarLineas'.
    .append('g')
    .attr('class', 'y axis');
  // FIN DE ELEMENTOS BÁSICOS ////////////////////////////////////////////////////////////////////////////////////

  // DIBUJAR EJE X ///////////////////////////////////////////////////////////////////////////////////////////////
  // EJE Y dibujado dinámicamente según elementos del grupo1 seleccionados, en funcion 'dibujarLineas'.
  const xScale = d3
    .scaleLinear()
    .domain(d3.extent(lineChartData.rangoMeses))
    .range([0, width]);
  const xAxis = d3
    .axisBottom(xScale)
    .ticks(lineChartData.rangoMeses.length)
    .tickFormat(formatTicksEjeX)
    .tickSize(6)
    .tickSizeOuter(0);
  const xAxisDraw = grafico
    .append('g')
    .attr('transform', `translate(0, ${height})`)
    .attr('class', 'x axis')
    .call(xAxis);
  // FIN DIBUJO EJE X ////////////////////////////////////////////////////////////////////////////////////////////

  // LINEA DE BOTONES CON ELEMENTOS GRUPO1 PARA FILTRADO /////////////////////////////////////////////////////////
  // 1.- Rellenar array de elementos del grupo1.
  var elementosGrupo1 = new Array;
  for (let index = 0; index < lineChartData.series.length; index++) {
    elementosGrupo1.push(lineChartData.series[index].key);
  }
  // 2.- Función para asignar colores a campo de grupo1.
  color = d3.scaleOrdinal()
    .domain(elementosGrupo1)
    .range(d3.schemeCategory10)

  // 3.- Añadir botones en DOM con elementos de grupo1 para filtrado.
  const graficoFiltros = d3
    .select('.grafico-filtros');

  const filtrosGrupo1 = graficoFiltros
    .selectAll('.OpcionFiltrado')
    .data(lineChartData["series"], d => d.key)
    .enter()
    .append('div')
    .attr('class', 'OpcionFiltrado')
    .attr('id', d => borrarEspacios(d.key))
    .html(d => d.key)
    .style('color', d => color(d.key));

  // Boton para media, tootips y para deseleccionar todos los filtros marcados.
  graficoFiltros
    .append('div')
    .attr('class', 'OpcionFiltrado_media')
    .html('MEDIA')

  graficoFiltros
    .append('div')
    .attr('class', 'OpcionFiltrado_tooltips')
    .html('info')

  graficoFiltros
    .append('div')
    .attr('class', 'OpcionFiltrado_deseleccionar')
    .html('X')

  // 4.- Escuchando eventos click en botones con nombre de elementos del grupo1.
  d3.selectAll('.OpcionFiltrado').on('click', click_opciones);
  d3.selectAll('.OpcionFiltrado').on('mouseenter', mouseenter);
  d3.selectAll('.OpcionFiltrado').on('mouseleave', mouseleave);
  d3.selectAll('.OpcionFiltrado_deseleccionar').on('click', click_deseleccionar);
  d3.selectAll('.OpcionFiltrado_tooltips').on('click', click_tooltips);
  d3.selectAll('.OpcionFiltrado_media').on('click', click_media);
  // FIN LINEA DE BOTONES CON ELEMENTOS DE GRUPO1 PARA FILTRADO ///////////////////////////////////////////////////

  // INICIO DE CONTENEDORES DE ZONA FINAL CON SUMAS PARCIALES EN CADA MES DE LO FILTRADO Y SUMA TOTAL DE CADA MES //
  const grupoSumasMesesParcial = grafico
    .select('.x.axis')
    .append('g')
    .attr('class', 'grupo-sumas-meses-parcial')
    .attr('transform', `translate(0, 0)`);
  const grupoSumasMesesTotales = grafico
    .select('.x.axis')
    .append('g')
    .attr('class', 'grupo-sumas-meses-totales')
    .attr('transform', `translate(0, 0)`);
  // FIN DE CONTENEDORES DE ZONA FINAL CON SUMAS PARCIALES EN CADA MES DE LO FILTRADO Y SUMA TOTAL DE CADA MES /////

  dibujarLineas(lineChartData);

  // Preparar estructura de datos idonea para representación visual.
  function prepareLineChartData(datos) {
    let arrayMeses = new Array;
    let rangoMeses = new Array;

    // IMPORTANTE,
    // A veces, en la recuperacion de las facturas, hay comerciales que usan dos nombres distintos
    // Digamos en un pedido 1 aparece JUAN DOMICILIADO, y en un pedido 2 aparece JUAN.
    // Si los pedidos 1 y 2 se facturan en la factura 100, entonces, tras cambiar en el CSV el nombre JUAN DOMICILIADO por JUAN
    // tendremos dos lineas para la factura 100 que serán idénticas. Esto provocará que aparezca doble el importe en la estadistica.
    // Para evitar esto usamos la función de abajo sobre el array con todo 'datos'.
    // La clave aqui es Set, que es una estructura que no acepta duplicados.  
    // En el caso de estadisticas de facturas, tiene sentido ya que la factura debe ser única.
    const data = Array.from(new Set(datos.map(a => a.documento)))
      .map(id => {
        return datos.find(a => a.documento === id)
      })

    // Ordenamos por mes ascendentemente para que los puntos del eje X ya estén ordenados.
    const dataOrdenadoFecha = data.slice().sort((a, b) => d3.ascending(a.fecha, b.fecha));

    // Agrupamos por grupo1 y año-mes. Así tendrémos un array de objetos por elementos del grupo1 con el total de cada mes.
    // Se utiliza año mes en la variable d.yearmonth para los casos en los que se consulten meses de un año y del anterior.
    var datosGrupo1 = d3
      .nest()
      .key(d => d.grupo1)
      .key(d => d.yearmonth)
      .rollup(v => parseInt(d3.sum(v, leaf => leaf.numero.toFixed(0)))) // IGNORAMOS DECIMALES DESDE EL PRINCIPIO
      .entries(dataOrdenadoFecha);

    var sumasPorMes = d3
      .nest()
      .key(d => d.yearmonth)
      .rollup(v => parseInt(d3.sum(v, leaf => leaf.numero.toFixed(0)))) // IGNORAMOS DECIMALES DESDE EL PRINCIPIO
      .entries(dataOrdenadoFecha);

    var totalPeriodoCompleto = d3
      .sum(sumasPorMes, d => d.value);

    // Separamos en un array aparte todos los meses encontrados en el rango de datos.
    // Esto nos permitirá añadir un valor de 0 en el caso de que un elemento del grupo1 no tenga valores en un determinado mes.
    // El array 'arrayMeses' tendrá una lista de valores del tipo ["1912" (para diciembre de 2019), "2001" (para enero de 2020), etc]
    var meses = d3
      .nest()
      .key(d => d.yearmonth)
      .entries(dataOrdenadoFecha);
    for (let index = 0; index < meses.length; index++) {
      arrayMeses.push(+meses[index].key);
    }

    // Repasamos todos los arrays de valores con los meses para rellenar con 0 aquellos meses
    // que no existan en algún elemento de grupo1, de entre los meses existentes en el rango de búsqueda.
    // Se tiene en cuenta cualquier rango de meses, Ene-Dic, Sep-Nov, etc.
    for (let i = 0; i < datosGrupo1.length; i++) {
      for (let j = 0; j < datosGrupo1[i].values.length; j++) {
        for (let z = 0; z < arrayMeses.length; z++) {
          if (datosGrupo1[i].values[z] != undefined) {
            if (datosGrupo1[i].values[z].key != arrayMeses[z]) {
              datosGrupo1[i].values.splice(z, 0, {
                "key": arrayMeses[z].toString(),
                "value": 0,
              });
            }
          } else {
            datosGrupo1[i].values.splice(z, 0, {
              "key": arrayMeses[z].toString(),
              "value": 0,
            });
          }
          // El campo mes de este array será un contador de todos los meses. Esto ayudará en el escalado en el eje X.
          datosGrupo1[i].values[z].mes = z;
        }
      }
    }

    // Asignar media a cada mes, por comodidad en recuperacion de datos.
    for (let i = 0; i < datosGrupo1.length; i++) {
      media = parseInt(d3.mean(datosGrupo1[i].values, d => d.value).toFixed(0));
      for (let j = 0; j < datosGrupo1[i].values.length; j++) {
        datosGrupo1[i].values[j].media = media;
      }
    }

    // Rango de meses de uno de los elementos del grupo1, el primero por si solo hay uno, ya que todos tienen que tener la lista completa de meses
    // aunque algunos tendrán valor 0 en algún mes
    for (let index = 0; index < datosGrupo1[0].values.length; index++) {
      rangoMeses.push(datosGrupo1[0].values[index].mes);
    }

    // Máxima cantidad en cualquier mes de todos los elementos del grupo1.
    // Esto servirá para establecer el dominio máximo del eje Y.
    // También se calcula el sumatorio de valores del mes, y la media.
    let maximos = new Array;
    for (let i = 0; i < datosGrupo1.length; i++) {
      maximos.push(d3.max(datosGrupo1[i].values, d => d.value));
      datosGrupo1[i].values.suma = d3.sum(datosGrupo1[i].values, d => d.value);
      datosGrupo1[i].values.media = parseInt(d3.mean(datosGrupo1[i].values, d => d.value).toFixed(0));
    }
    const limiteEjeY = d3.max(maximos);

    var totalMediasPorMes = parseInt(totalPeriodoCompleto / datosGrupo1.length).toFixed(0);

    // Datos ordenados de mayor a menor.
    datosGrupo1 = datosGrupo1.slice().sort((a, b) => d3.descending(a.values.suma, b.values.suma));

    // Producción de datos finales para su posterior dibujo.
    const lineData = {
      series: datosGrupo1,
      limiteEjeY: limiteEjeY,
      meses: arrayMeses,
      rangoMeses: rangoMeses,
      sumasPorMes: sumasPorMes,
      totalPeriodoCompleto: totalPeriodoCompleto,
      totalMediasPorMes: totalMediasPorMes,
      sumasMensualesLineasSelec: sumasPorMes
    };

    return lineData;
  }

  // La función de filtrado nos permite eliminar del array de datos aquello que no queramos mostrar.
  function filterData(data, excluidos) {
    return data.filter(d => {
      return (
        !excluidos.includes(d.grupo1)
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

  function formatComa(d) {
    return d3.format(",")(d).replace(/,/g, '.')
  }

  function borrarEspacios(d) {
    return d.replace(/ /g, '');
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
      TIEMPO_ENTER_ETIQUETAS_PUNTOS = 600,
      TIEMPO_UPDATE_ETIQUETAS_PUNTOS = 600,
      TIEMPO_REMOVE_ETIQUETAS_PUNTOS = 400,
      TIEMPO_ENTER_ETIQUETAS = 600,
      TIEMPO_UPDATE_ETIQUETAS = 600,
      TIEMPO_REMOVE_ETIQUETAS = 400,
      RADIO_PUNTOS = 3,
      TICKS_EJEY = 7;

    let arraySumaPuntosMesSeleccionado = new Array;

    // ESCALA Y DIBUJO EJE Y //////////////////////////////////////////////////////////
    if (mediaInfoSeleccionada)
      limiteEjeY = d3.max(data.series, d => d.values.media)
    else limiteEjeY = data.limiteEjeY;

    yScale = d3
      .scaleLinear()
      .domain([0, limiteEjeY])
      .range([height, 0]);

    yAxis = d3
      .axisLeft(yScale)
      .ticks(TICKS_EJEY)
      .tickFormat(formatTicksEjeY)
      .tickSizeOuter(0)
      .tickSizeInner(-width)
      .tickPadding(6);

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
    let xLineGenAccessor = d => xScale(parseInt(d.mes))
    let yLineGenAccessor = mediaInfoSeleccionada ? d => yScale(parseInt(d.media)) : d => yScale(parseInt(d.value));

    lineGen = d3
      .line()
      .x(xLineGenAccessor)
      .y(yLineGenAccessor);

    var lineas = grafico
      .select('.svg-paths')
      .selectAll('.line-series')
      .data(data.series, d => d.key)
      .join(
        enter => {
          enter
            .append('path')
            .attr('class', 'line-series')
            .attr('id', d => borrarEspacios(d.key))
            .attr('d', d => lineGen(d.values))
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
            .attr('d', d => lineGen(d.values));
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
    let xPuntosAccessor = d => xScale(parseInt(d.mes));
    let yPuntosAccessor = mediaInfoSeleccionada ? d => yScale(d.media) : d => yScale(d.value);

    var puntos = grafico
      .selectAll('.puntos')
      .data(data.series, d => d.key)
      .join(
        enter => {
          enter
            .append('g')
            .attr('class', 'puntos')
            .attr('id', d => borrarEspacios(d.key))
            .style('fill', d => color(d.key))
            .selectAll('circle')
            .data(d => d.values)
            .join('circle')
            .attr('cx', xPuntosAccessor)
            .attr('cy', yPuntosAccessor)
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
            .attr('cx', xPuntosAccessor)
            .attr('cy', yPuntosAccessor)
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

    // DIBUJO DE ETIQUETAS SOBRE LOS PUNTOS ////////////////////////////////////////////
    if (!mediaInfoSeleccionada) {
      claseGrupoTooltip = tooltipInfoSeleccionada ? "tooltip tooltip--seleccion" : "tooltip"
      var tooltip = grafico
        .selectAll('.tooltip')
        .data(data.series, d => d.key)
        .join(
          enter => {
            enter
              .append('g')
              .attr('class', claseGrupoTooltip)
              .attr('id', d => borrarEspacios(d.key))
              .selectAll('text')
              .data(d => d.values)
              .join('text')
              .attr('class', (d, i) => `textopuntos i${i}`)
              .attr('x', d => xScale(parseInt(d.mes)) + 4)
              .attr('y', d => yScale(d.value) - 7)
              .text(d => formatComa(d.value))
              .style('opacity', 0)
              .transition()
              .duration(TIEMPO_ENTER_ETIQUETAS_PUNTOS)
              .style('opacity', 1)


          },
          update => {
            update
              .attr('class', claseGrupoTooltip)
              .selectAll('text')
              .data(d => d.values)
              .join('text')
              .transition()
              .duration(TIEMPO_UPDATE_ETIQUETAS_PUNTOS)
              .attr('x', d => xScale(parseInt(d.mes)) + 4)
              .attr('y', d => yScale(d.value) - 7)
              .text(d => formatComa(d.value))
          },
          exit => {
            exit
              .transition()
              .duration(TIEMPO_REMOVE_ETIQUETAS_PUNTOS)
              .style('opacity', 0)
              .remove();


          });
    }
    // FIN DIBUJO DE ETIQUETAS SOBRE LOS PUNTOS ////////////////////////////////////

    // DIBUJO DE ETIQUETAS EN FIN DE LAS LINEAS ////////////////////////////////////
    let xEtiquetasListAccessor = d => xScale(parseInt(d.values[d.values.length - 1].mes) + 0.5);
    let yEtiquetasListAccessor = (d, i) => (i * 45) + 2;

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
            .attr('y', yEtiquetasListAccessor)
            .text(d => d.key)
            .style('dominant-baseline', 'central')
            .style('fill', d => color(d.key))
            .transition()
            .duration(TIEMPO_ENTER_ETIQUETAS)
            .attr('x', xEtiquetasListAccessor)
        },
        update => {
          update
            .transition()
            .duration(TIEMPO_UPDATE_ETIQUETAS)
            .attr('x', xEtiquetasListAccessor)
            .attr('y', yEtiquetasListAccessor)
        },
        exit => {
          exit
            .transition()
            .duration(TIEMPO_REMOVE_ETIQUETAS)
            .attr('x', screenWidth + margin.right)
            .remove()
        });
    // FIN DIBUJO DE ETIQUETAS EN FIN DE LAS LINEAS ////////////////////////////////

    // DIBUJO DE SUMATORIO ETIQUETAS EN FIN DE LAS LINEAS //////////////////////////
    let xSumatorioAccessor = d => xScale(parseInt(d.values[d.values.length - 1].mes) + 0.5);
    let ySumatorioAccessor = (d, i) => (i * 45) + 17;
    let textoSuma = mediaInfoSeleccionada ? d => formatComa(d.values.media) : d => formatComa(d.values.suma);

    var totalEtiqueta = grafico
      .select('.grupo-etiquetas')
      .selectAll('.total-etiqueta')
      .data(data.series, d => d.key)
      .join(
        enter => {
          enter
            .append('text')
            .attr('class', 'total-etiqueta')
            .attr('x', screenWidth)
            .attr('y', ySumatorioAccessor)
            .text(textoSuma)
            .style('dominant-baseline', 'central')
            .style('fill', d => color(d.key))
            .transition()
            .duration(TIEMPO_ENTER_ETIQUETAS)
            .attr('x', xSumatorioAccessor)
        },
        update => {
          update
            .attr('class', 'total-etiqueta')
            .transition()
            .duration(TIEMPO_UPDATE_ETIQUETAS)
            .attr('y', ySumatorioAccessor)
            .attr('x', xSumatorioAccessor)
            .text(textoSuma)
        },
        exit => {
          exit
            .transition()
            .duration(TIEMPO_REMOVE_ETIQUETAS)
            .attr('x', screenWidth + margin.right)
            .remove()
        });
    // FIN DIBUJO DE SUMATORIO ETIQUETAS SOBRE LOS PUNTOS //////////////////////////

    // INICIO DIBUJO DE RECTÁNGULOS Y TEXTOS CON SUMAS MENSUALES DE ELEMENTOS GRUPO SELECCIONADOS ///////
    const rectSumasParcialesMeses = grafico
      .select('.grupo-sumas-meses-parcial')
      .selectAll('.rect-sumas-mes')
      .data(lineChartData.rangoMeses)
      .join('rect')
      .attr('class', 'rect-sumas-mes')
      .attr('x', (d, i) => xScale(i) - 25)
      .attr('y', 28)
      .attr('width', width / (lineChartData.rangoMeses.length) - 20)
      .attr('height', 15)
      .style('fill', '#2d9e91');


    const textSumasParcialesMeses = grafico
      .select('.grupo-sumas-meses-parcial')
      .selectAll('.textos-sumas-mes')
      .data(lineChartData.sumasMensualesLineasSelec)
      .join(
        enter => {
          enter
            .append('text')
            .attr('class', 'textos-sumas-mes')
            .attr('x', (d, i) => xScale(i) + 5)
            .attr('y', 40)
            .text(d => formatComa(d.value))
            .style('fill', 'white')
            .style('text-anchor', 'middle')

        },
        update => {
          update
            .attr('x', (d, i) => xScale(i) + 5)
            .attr('y', 40)
            .text(d => formatComa(d.value))
        },
        exit => {
          exit
            .remove()
        }
      );

    // ULTIMO CAMPO DESPUES DE LOS MESES PARA MOSTRAR EL TOTAL PARCIAL SELECCIONADO
    const rectTotalSumasParcialesMeses = grafico
      .select('.grupo-sumas-meses-parcial')
      .append('rect')
      .attr('class', 'rect-total-selec-sumas-mes')
      .attr('x', d => xScale(lineChartData.rangoMeses.length) - 25)
      .attr('y', 28)
      .attr('width', width / (lineChartData.rangoMeses.length) - 20)
      .attr('height', 15)
      .style('fill', '#59cabd');

    const textTotalSumasParcialesMeses = grafico
      .select('.grupo-sumas-meses-parcial')
      .append('text')
      .attr('class', 'texto-total-selec-sumas-mes')
      .attr('x', d => xScale(lineChartData.rangoMeses.length) + 5)
      .attr('y', 40)
      .text(formatComa(d3.sum(lineChartData.sumasMensualesLineasSelec, d => d.value)))
      .style('fill', 'white')
      .style('text-anchor', 'middle');

    // FIN DIBUJO DE RECTÁNGULOS Y TEXTOS CON SUMAS MENSUALES DE ELEMENTOS GRUPO SELECCIONADOS    ///////

    // INICIO DIBUJO DE RECTÁNGULOS Y TEXTOS CON SUMAS TOTALES DE ELEMENTOS GRUPO SELECCIONADOS   ///////
    const rectSumasTotalesMeses = grafico
      .select('.grupo-sumas-meses-totales')
      .selectAll('.rect-sumas-totales-mes')
      .data(lineChartData.rangoMeses)
      .join('rect')
      .attr('class', 'rect-sumas-totales-mes')
      .attr('x', (d, i) => xScale(i) - 25)
      .attr('y', 48)
      .attr('width', width / (lineChartData.rangoMeses.length) - 20)
      .attr('height', 15)
      .style('fill', 'purple');

    const textSumasTotalesMeses = grafico
      .select('.grupo-sumas-meses-totales')
      .selectAll('.textos-sumas-totales-mes', )
      .data(lineChartData.sumasPorMes)
      .join(
        enter => {
          enter
            .append('text')
            .attr('class', 'textos-sumas-totales-mes')
            .attr('x', (d, i) => xScale(i) + 5)
            .attr('y', 60)
            .text(d => formatComa(d.value))
            .style('fill', 'white')
            .style('text-anchor', 'middle')
        }
      );

    // ULTIMO CAMPO DESPUES DE LOS MESES PARA MOSTRAR LA SUMA TOTAL DE TODOS LOS MESES
    const rectTotalSumasTotalesMeses = grafico
      .select('.grupo-sumas-meses-totales')
      .append('rect')
      .attr('class', 'rect-total')
      .attr('x', (d, i) => xScale(lineChartData.rangoMeses.length) - 25)
      .attr('y', 48)
      .attr('width', width / (lineChartData.rangoMeses.length) - 20)
      .attr('height', 15)
      .style('fill', '#d046d0');

    const textTotalSumasTotalesMeses = grafico
      .select('.grupo-sumas-meses-totales')
      .append('text')
      .attr('class', 'texto-total')
      .attr('x', d => xScale(lineChartData.rangoMeses.length) + 5)
      .attr('y', 60)
      .text(formatComa(lineChartData.totalPeriodoCompleto))
      .style('fill', 'white')
      .style('text-anchor', 'middle');
    // FIN DIBUJO DE RECTÁNGULOS Y TEXTOS CON SUMAS TOTALES DE ELEMENTOS GRUPO SELECCIONADOS    ///////

    d3.selectAll('.OpcionFiltrado_tooltips').on('click', click_tooltips);
  }

  function click_opciones() {
    let data = new Array;
    let maximos = new Array;

    const seleccionado = d3.select(this).classed('OpcionFiltrado--seleccion')
    d3.select(this).classed('OpcionFiltrado--seleccion', !seleccionado);

    // Consultar elementos de grupo1 seleccionados para conformar array.
    let arrayElementosGrupo1 = new Array;

    filtrosOpcionFiltrado = d3
      .select('.grafico-filtros')
      .selectAll('.OpcionFiltrado');
    filtrosOpcionFiltrado.each(function (d, i) {
      selec = d3.select(this).classed('OpcionFiltrado--seleccion');
      if (selec) data.push(lineChartData.series[i]); // IMPORTANTE, preparar orden de elemento grupo1 en lineChartData igual al orden 
      // en que se muestran en los botones para filtrar.
    });

    let sumasMensualesLineasSelec = new Array;
    let arraySuma = new Array;
    for (let index = 0; index < lineChartData.meses.length; index++) {
      sumasMensualesLineasSelec[index] = 0;
    }

    filtrosSeleccionados = d3
      .select('.grafico-filtros')
      .selectAll('.OpcionFiltrado--seleccion');
    filtrosSeleccionados.each(function (d, i) {
      for (let index = 0; index < lineChartData.meses.length; index++) {
        sumasMensualesLineasSelec[index] = sumasMensualesLineasSelec[index] + d.values[index].value;
      }
    });

    if (filtrosSeleccionados.empty()) {
      arraySuma = lineChartData.sumasPorMes;
    } else {
      for (let index = 0; index < lineChartData.meses.length; index++) {
        arraySuma.push({
          key: lineChartData.meses[index],
          value: sumasMensualesLineasSelec[index]
        })
      }
    }

    lineChartData.sumasMensualesLineasSelec = arraySuma;

    if (data.length > 0) {
      for (let i = 0; i < data.length; i++) {
        maximos.push(d3.max(data[i].values, d => d.value));
      }
      const limiteEjeY = d3.max(maximos);

      // Producción de datos finales para su posterior dibujo.
      const newlineChartData = {
        series: data,
        limiteEjeY: limiteEjeY,
      };

      dibujarLineas(newlineChartData);
    } else {
      dibujarLineas(lineChartData);
    }
  }

  function click_deseleccionar() {
    const seleccionado = d3.selectAll('.OpcionFiltrado--seleccion');

    if (!seleccionado.empty()) {
      seleccionado.classed('OpcionFiltrado--seleccion', false);
      lineChartData.sumasMensualesLineasSelec = lineChartData.sumasPorMes;
      dibujarLineas(lineChartData);
    }
  }

  function click_tooltips() {
    tooltipInfoSeleccionada = !tooltipInfoSeleccionada;
    let newArray = Array;

    if (tooltipInfoSeleccionada) {
      if (mediaInfoSeleccionada)
        d3.selectAll('.tooltip').classed('tooltip--seleccion', false);
      else
        d3.selectAll('.tooltip').classed('tooltip--seleccion', true);

      d3.selectAll('.OpcionFiltrado_tooltips').classed('OpcionFiltrado_tooltips--seleccion', true);
    } else {
      d3.selectAll('.tooltip').classed('tooltip--seleccion', false);
      d3.selectAll('.OpcionFiltrado_tooltips').classed('OpcionFiltrado_tooltips--seleccion', false);
    }
  }

  function click_media() {
    mediaInfoSeleccionada = !mediaInfoSeleccionada;

    if (mediaInfoSeleccionada) {
      d3.selectAll('.tooltip').classed('tooltip--seleccion', false);
    }
    tooltipInfoSeleccionada = false;
    d3.selectAll('.OpcionFiltrado_tooltips--seleccion').classed('OpcionFiltrado_tooltips--seleccion', false);
    d3.selectAll('.OpcionFiltrado--seleccion').classed('OpcionFiltrado--seleccion', false);
    d3.selectAll('.OpcionFiltrado_media').classed('OpcionFiltrado_media--seleccion', mediaInfoSeleccionada);

    dibujarLineas(lineChartData);
  }

  function mouseenter() {
    _this = this
    const id = _this.id;

    const visible = d3.select(`.line-series#${id}`).empty();

    if (!visible) {
      const lineas = grafico
        .select('.svg-paths')
        .selectAll(`path:not(#${id})`)
        .style('opacity', '0.1');
      const puntos = grafico
        .selectAll(`.puntos:not(#${id})`)
        .style('opacity', '0.1');
      const textos = grafico
        .selectAll(`.tooltip:not(#${id})`)
        .style('opacity', '0.1');
    }
  }

  function mouseleave() {
    _this = this;
    const id = _this.id;

    const test = grafico
      .select('.svg-paths')
      .selectAll(`path:not(#${id})`)
      .style('opacity', '1');
    const puntos = grafico
      .selectAll(`.puntos:not(#${id})`)
      .style('opacity', '1');
    const textos = grafico
      .selectAll(`.tooltip:not(#${id})`)
      .style('opacity', '1');
  }
}

// Elementos del grupo1 a excluir.
const parametros = {
  arrayExcluidos: ["OFICINA 3", "SIN ASIGNAR"],
  documentoUnico: 1,
}

// Tipeado de valores.
function type(d) {
  const parseDate = string => d3.utcParse('%d/%m/%y')(string);
  const parseDate2 = d3.utcParse('%d/%m/%y');
  const formatYear = d3.timeFormat("%y%m");
  const parseNA = string => (string === 'NA' ? undefined : string);
  return {
    documento: +d.documento,
    numero: +d.numero,
    year: +parseDate(d.fecha).getUTCFullYear().toString().substr(2, 2),
    mes: parseDate(d.fecha).getMonth(), // Asigna los meses con números del 0 al 11
    dia: parseDate(d.fecha).getDate(),
    fecha: parseDate(d.fecha),
    yearmonth: formatYear(parseDate(d.fecha)),
    grupo1: parseNA(d.grupo1)
  };
}

// Cargar datos y mostrar gráfico.
d3.csv('data/recargos_2019_ene_dic_con_clientes.csv', type).then(res => {
  multipleLineChart(res, parametros);
});
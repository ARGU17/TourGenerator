(function () {
  'use strict';

  let chart = null;
  let currentStage = null;
  let hoverCallback = null;

  const gradePieces = [
    { lte: -5, color: '#2d80ff' },
    { gt: -5, lte: -1.5, color: '#48a6ff' },
    { gt: -1.5, lte: 2, color: '#67dc91' },
    { gt: 2, lte: 5, color: '#e9d75a' },
    { gt: 5, lte: 8, color: '#ffad45' },
    { gt: 8, lte: 12, color: '#ff665a' },
    { gt: 12, color: '#d92f4f' }
  ];

  function init(elementId, onHover) {
    const element = document.getElementById(elementId);
    if (!element || !window.echarts) return;
    chart = echarts.init(element, null, { renderer: 'canvas' });
    hoverCallback = onHover || null;

    chart.on('showTip', (event) => {
      if (!currentStage || !hoverCallback) return;
      const index = Number(event.dataIndex);
      if (Number.isFinite(index) && currentStage.points[index]) hoverCallback(currentStage.points[index]);
    });

    chart.on('globalout', () => {
      if (hoverCallback) hoverCallback(null);
    });

    chart.getZr().on('mousemove', (event) => {
      if (!currentStage || !hoverCallback || !chart) return;
      const pixel = [event.offsetX, event.offsetY];
      if (!chart.containPixel({ gridIndex: 0 }, pixel)) return;
      const value = chart.convertFromPixel({ gridIndex: 0 }, pixel);
      if (!value || !Number.isFinite(value[0])) return;
      const targetKm = value[0];
      let low = 0;
      let high = currentStage.points.length - 1;
      while (low < high) {
        const mid = Math.floor((low + high) / 2);
        if (currentStage.points[mid].distanceKm < targetKm) low = mid + 1;
        else high = mid;
      }
      hoverCallback(currentStage.points[low]);
    });

    window.addEventListener('resize', () => chart?.resize());
  }

  function climbMarkData(stage) {
    return (stage.climbs || []).map((climb) => ({
      name: `${climb.name} · Cat. ${climb.category}`,
      coord: [climb.summitKm, climb.summitEle],
      value: climb.category,
      symbol: 'pin',
      symbolSize: 34,
      itemStyle: { color: climb.category === 'HC' || climb.category === '1' ? '#ff5c5c' : '#ff9f43' },
      label: {
        show: true,
        formatter: climb.category,
        color: '#071018',
        fontWeight: 900,
        fontSize: 9
      }
    }));
  }

  function render(stage) {
    if (!chart || !stage?.points?.length) return;
    currentStage = stage;
    const data = stage.points.map((point) => [
      Number(point.distanceKm.toFixed(3)),
      Number(point.ele.toFixed(1)),
      Number(point.grade.toFixed(2))
    ]);
    const minimum = Math.max(0, Math.floor((stage.minEleM - 80) / 100) * 100);
    const maximum = Math.ceil((stage.maxEleM + 130) / 100) * 100;
    const marks = climbMarkData(stage);
    if (stage.sprint) {
      marks.push({
        name: stage.sprint.label,
        coord: [stage.sprint.km, stage.sprint.ele],
        value: 'S',
        symbol: 'diamond',
        symbolSize: 23,
        itemStyle: { color: '#72f0a8' },
        label: { show: true, formatter: 'S', color: '#071018', fontWeight: 900, fontSize: 9 }
      });
    }

    chart.setOption({
      animationDurationUpdate: 350,
      backgroundColor: 'transparent',
      grid: { left: 55, right: 25, top: 31, bottom: 52 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: 'rgba(255,255,255,.52)', width: 1 } },
        backgroundColor: 'rgba(5, 12, 18, .95)',
        borderColor: 'rgba(142,180,205,.28)',
        textStyle: { color: '#f1f6f9', fontSize: 11 },
        formatter(params) {
          const item = params?.[0];
          if (!item) return '';
          const [km, elevation, grade] = item.value;
          const remaining = Math.max(0, stage.distanceKm - km);
          return [
            `<strong>km ${Number(km).toFixed(1)}</strong>`,
            `Altitud: <b>${Math.round(elevation)} m</b>`,
            `Pendiente: <b>${Number(grade).toFixed(1)} %</b>`,
            `A meta: <b>${remaining.toFixed(1)} km</b>`
          ].join('<br>');
        }
      },
      xAxis: {
        type: 'value',
        min: 0,
        max: Math.ceil(stage.distanceKm),
        name: 'DISTANCIA (KM)',
        nameLocation: 'middle',
        nameGap: 34,
        nameTextStyle: { color: '#607586', fontSize: 9, fontWeight: 700 },
        axisLine: { lineStyle: { color: 'rgba(142,180,205,.25)' } },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: 'rgba(142,180,205,.08)' } },
        axisLabel: { color: '#8ba1b2', fontSize: 9, formatter: '{value}' }
      },
      yAxis: {
        type: 'value',
        min: minimum,
        max: maximum,
        name: 'M',
        nameLocation: 'end',
        nameGap: 8,
        nameTextStyle: { color: '#607586', fontSize: 9 },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: 'rgba(142,180,205,.08)' } },
        axisLabel: { color: '#8ba1b2', fontSize: 9 }
      },
      dataZoom: [
        { type: 'inside', xAxisIndex: 0, filterMode: 'none', zoomOnMouseWheel: true, moveOnMouseMove: true },
        {
          type: 'slider',
          xAxisIndex: 0,
          filterMode: 'none',
          height: 16,
          bottom: 8,
          borderColor: 'rgba(142,180,205,.16)',
          backgroundColor: 'rgba(255,255,255,.018)',
          fillerColor: 'rgba(114,240,168,.11)',
          handleStyle: { color: '#72f0a8', borderColor: '#72f0a8' },
          textStyle: { color: '#607586', fontSize: 8 },
          showDetail: false
        }
      ],
      visualMap: {
        show: false,
        dimension: 2,
        seriesIndex: 0,
        pieces: gradePieces
      },
      series: [{
        name: 'Perfil',
        type: 'line',
        data,
        showSymbol: false,
        smooth: 0.16,
        sampling: 'lttb',
        lineStyle: { width: 3 },
        areaStyle: {
          opacity: 0.42,
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(114,240,168,.50)' },
              { offset: 1, color: 'rgba(0,194,255,.03)' }
            ]
          }
        },
        emphasis: { disabled: true },
        markPoint: { silent: true, data: marks },
        markLine: {
          silent: true,
          symbol: ['none', 'none'],
          lineStyle: { color: 'rgba(255,255,255,.16)', type: 'dashed' },
          label: { color: '#8ba1b2', fontSize: 8 },
          data: [
            { xAxis: 0, label: { formatter: 'SALIDA', position: 'insideStartTop' } },
            { xAxis: stage.distanceKm, label: { formatter: 'META', position: 'insideEndTop' } }
          ]
        }
      }]
    }, true);
  }

  function resize() { chart?.resize(); }

  window.ProfileView = { init, render, resize };
})();

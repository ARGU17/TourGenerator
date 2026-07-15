(function () {
  'use strict';

  const CATALOG = window.CYCLING_CATALOG;
  const DEG = Math.PI / 180;
  const EARTH_KM = 6371.0088;

  class RNG {
    constructor(seed) {
      this.state = (Number(seed) || Date.now()) >>> 0;
      if (this.state === 0) this.state = 0x6d2b79f5;
    }
    next() {
      let t = this.state += 0x6d2b79f5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    float(min, max) { return min + this.next() * (max - min); }
    int(min, max) { return Math.floor(this.float(min, max + 1)); }
    bool(probability) { return this.next() < probability; }
    pick(array) { return array[Math.floor(this.next() * array.length)]; }
    shuffle(array) {
      const out = array.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(this.next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    }
  }

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(t) { return t * t * (3 - 2 * t); }
  function round(value, digits) {
    const f = 10 ** (digits || 0);
    return Math.round(value * f) / f;
  }

  function haversine(a, b) {
    const lat1 = a.lat * DEG;
    const lat2 = b.lat * DEG;
    const dLat = (b.lat - a.lat) * DEG;
    const dLon = (b.lon - a.lon) * DEG;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_KM * Math.asin(Math.sqrt(s));
  }

  function bearing(a, b) {
    const lat1 = a.lat * DEG;
    const lat2 = b.lat * DEG;
    const dLon = (b.lon - a.lon) * DEG;
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    return (Math.atan2(y, x) / DEG + 360) % 360;
  }

  function angleDelta(a, b) {
    let d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  }

  function typeCompatible(region, type) {
    const terrain = region.terrain;
    if (type === 'flat' || type === 'itt') return terrain.includes('flat') || terrain.includes('rolling');
    if (type === 'rolling') return terrain.includes('rolling') || terrain.includes('punchy');
    if (type === 'punchy') return terrain.includes('punchy') || terrain.includes('rolling') || terrain.includes('medium_mountain');
    if (type === 'medium_mountain') return terrain.includes('medium_mountain') || terrain.includes('high_mountain');
    if (type === 'high_mountain') return terrain.includes('high_mountain');
    return true;
  }

  function hasRole(anchor, role) { return Array.isArray(anchor.roles) && anchor.roles.includes(role); }

  function buildTypePool(config, rng) {
    const total = clamp(Number(config.stageCount) || 21, 1, 30);
    const counts = {
      flat: Math.max(0, Number(config.flatCount) || 0),
      rolling: Math.max(0, Number(config.rollingCount) || 0),
      medium_mountain: Math.max(0, Number(config.mediumCount) || 0),
      high_mountain: Math.max(0, Number(config.highCount) || 0),
      itt: Math.max(0, Number(config.ittCount) || 0)
    };

    let pool = [];
    Object.entries(counts).forEach(([type, count]) => {
      for (let i = 0; i < count; i++) {
        pool.push(type === 'rolling' && rng.bool(0.34) ? 'punchy' : type);
      }
    });

    const fillers = ['flat', 'rolling', 'flat', 'medium_mountain', 'flat', 'punchy', 'high_mountain'];
    while (pool.length < total) pool.push(rng.pick(fillers));
    while (pool.length > total) {
      const removable = pool.findIndex((type) => type !== 'itt');
      pool.splice(removable >= 0 ? removable : pool.length - 1, 1);
    }

    return scheduleTypes(pool, rng);
  }

  function scheduleTypes(pool, rng) {
    const total = pool.length;
    const result = new Array(total).fill(null);
    const itts = pool.filter((t) => t === 'itt');
    let others = pool.filter((t) => t !== 'itt');

    const ittSlots = [];
    if (itts.length >= 1) ittSlots.push(total <= 5 ? 0 : Math.max(0, Math.round(total * 0.28) - 1));
    if (itts.length >= 2) ittSlots.push(Math.max(0, Math.round(total * 0.82) - 1));
    for (let i = 2; i < itts.length; i++) ittSlots.push(Math.round(((i + 1) / (itts.length + 1)) * (total - 1)));
    ittSlots.forEach((slot) => {
      let pos = clamp(slot, 0, total - 1);
      while (result[pos] && pos < total - 1) pos++;
      while (result[pos] && pos > 0) pos--;
      result[pos] = 'itt';
    });

    const scored = others.map((type) => ({ type, salt: rng.next() }));
    scored.sort((a, b) => {
      const weight = (type) => ({ flat: 0, rolling: 1, punchy: 2, medium_mountain: 3, high_mountain: 4 }[type] || 0);
      return weight(a.type) - weight(b.type) || a.salt - b.salt;
    });

    const emptySlots = result.map((v, i) => v ? null : i).filter((v) => v !== null);
    const slotPriority = emptySlots.slice().sort((a, b) => {
      const phaseA = a / Math.max(1, total - 1);
      const phaseB = b / Math.max(1, total - 1);
      return phaseA - phaseB;
    });

    const flats = scored.filter((x) => x.type === 'flat');
    const rolling = scored.filter((x) => ['rolling', 'punchy'].includes(x.type));
    const medium = scored.filter((x) => x.type === 'medium_mountain');
    const high = scored.filter((x) => x.type === 'high_mountain');

    const assign = (items, desiredFractions) => {
      items.forEach((item, index) => {
        const target = desiredFractions[index % desiredFractions.length] * (total - 1);
        const candidates = slotPriority.filter((slot) => !result[slot]);
        if (!candidates.length) return;
        candidates.sort((a, b) => Math.abs(a - target) - Math.abs(b - target));
        const chosen = candidates[0];
        result[chosen] = item.type;
      });
    };

    assign(high, [0.45, 0.57, 0.69, 0.79, 0.9, 0.96]);
    assign(medium, [0.27, 0.52, 0.72, 0.86]);
    assign(rolling, [0.12, 0.34, 0.62, 0.76, 0.88]);
    assign(flats, [0.02, 0.08, 0.18, 0.38, 0.48, 0.66, 0.94, 1.0]);

    const leftovers = scored.filter((item) => !result.includes(item.type) || true);
    result.forEach((value, index) => {
      if (!value) result[index] = leftovers.shift()?.type || 'flat';
    });

    if (result.length > 3 && pool.includes('flat') && result[result.length - 1] !== 'flat') {
      const flatIndex = result.findIndex((type, index) => type === 'flat' && index !== result.length - 1);
      if (flatIndex >= 0) [result[flatIndex], result[result.length - 1]] = [result[result.length - 1], result[flatIndex]];
    }
    if (result[0] === 'high_mountain') {
      const swap = result.findIndex((t) => t === 'flat' || t === 'rolling' || t === 'punchy');
      if (swap > 0) [result[0], result[swap]] = [result[swap], result[0]];
    }

    return result;
  }

  function assignTargetDistances(types, config, rng) {
    const maxStage = Math.max(30, Number(config.maxStageDistance) || 225);
    const targets = types.map((type) => {
      const typeConfig = CATALOG.stageTypes[type];
      const max = Math.min(typeConfig.distance[1], maxStage);
      const min = Math.min(typeConfig.distance[0], max);
      return rng.float(min, max);
    });

    const targetTotal = Math.max(100, Number(config.totalDistance) || targets.reduce((a, b) => a + b, 0));
    for (let iteration = 0; iteration < 7; iteration++) {
      const current = targets.reduce((a, b) => a + b, 0);
      const factor = targetTotal / current;
      for (let i = 0; i < targets.length; i++) {
        const typeConfig = CATALOG.stageTypes[types[i]];
        const max = Math.min(typeConfig.distance[1], maxStage);
        const min = Math.min(typeConfig.distance[0], max);
        targets[i] = clamp(targets[i] * factor, min, max);
      }
    }
    return targets.map((v) => round(v, 1));
  }

  function countriesForTour(mode, total, rng) {
    if (mode !== 'europe') return new Array(total).fill(mode);
    const order = rng.bool(0.5) ? ['france', 'spain', 'italy'] : ['italy', 'france', 'spain'];
    const allocation = [Math.floor(total / 3), Math.floor(total / 3), Math.floor(total / 3)];
    for (let i = 0; i < total % 3; i++) allocation[i]++;
    const countries = [];
    order.forEach((country, index) => {
      for (let i = 0; i < allocation[index]; i++) countries.push(country);
    });
    return countries.slice(0, total);
  }

  function chooseRegion(countryKey, type, rng, recentRegionIds) {
    const regions = CATALOG.countries[countryKey].regions;
    let candidates = regions.filter((region) => typeCompatible(region, type));
    if (!candidates.length) candidates = regions.slice();
    const fresh = candidates.filter((region) => !recentRegionIds.includes(region.id));
    return rng.pick(fresh.length ? fresh : candidates);
  }

  function sequenceLength(sequence) {
    let total = 0;
    for (let i = 1; i < sequence.length; i++) total += haversine(sequence[i - 1], sequence[i]);
    return total;
  }

  function backtrackingPenalty(sequence) {
    let penalty = 0;
    for (let i = 1; i < sequence.length - 1; i++) {
      const incoming = bearing(sequence[i - 1], sequence[i]);
      const outgoing = bearing(sequence[i], sequence[i + 1]);
      const turn = angleDelta(incoming, outgoing);
      if (turn > 145) penalty += (turn - 145) / 35;
    }
    return penalty;
  }

  function directDistanceFactor(type) {
    return ({ flat: 0.96, rolling: 0.95, punchy: 0.93, medium_mountain: 0.86, high_mountain: 0.82, itt: 0.95 }[type] || 0.88);
  }

  function chooseWaypoints(region, type, targetKm, summitFinish, rng) {
    const anchors = region.anchors;
    const towns = anchors.filter((a) => hasRole(a, 'town') || !hasRole(a, 'climb'));
    const climbs = anchors.filter((a) => hasRole(a, 'climb'));
    const summits = anchors.filter((a) => hasRole(a, 'summit'));
    const viaCountByType = { flat: 2, rolling: 2, punchy: 3, medium_mountain: 3, high_mountain: 3, itt: 0 };
    const climbNeedByType = { flat: 0, rolling: 0, punchy: 1, medium_mountain: 1, high_mountain: 2, itt: 0 };
    const viaCount = viaCountByType[type] ?? 3;
    const climbNeed = Math.min(climbNeedByType[type] || 0, climbs.length);
    let best = null;
    const targetDirect = targetKm * directDistanceFactor(type);

    for (let attempt = 0; attempt < 420; attempt++) {
      const start = rng.pick(towns.length ? towns : anchors);
      let finishPool = summitFinish && summits.length ? summits : (towns.length ? towns : anchors);
      finishPool = finishPool.filter((a) => a !== start);
      const finish = rng.pick(finishPool.length ? finishPool : anchors.filter((a) => a !== start));
      const selected = [];
      const climbSelection = rng.shuffle(climbs.filter((a) => a !== start && a !== finish)).slice(0, climbNeed);
      selected.push(...climbSelection);
      const routingPool = (type === 'flat' || type === 'itt')
        ? anchors.filter((anchor) => !hasRole(anchor, 'climb'))
        : type === 'rolling'
          ? anchors.filter((anchor) => !hasRole(anchor, 'summit'))
          : anchors;
      const remainingPool = rng.shuffle(routingPool.filter((a) => a !== start && a !== finish && !selected.includes(a)));
      selected.push(...remainingPool.slice(0, Math.max(0, viaCount - selected.length)));
      const middle = rng.shuffle(selected);
      const sequence = [start, ...middle, finish];
      const length = sequenceLength(sequence);
      const lengthError = Math.abs(length - targetDirect) / Math.max(targetDirect, 1);
      const turnPenalty = backtrackingPenalty(sequence) * 0.08;
      const duplicatePenalty = new Set(sequence.map((a) => a.name)).size < sequence.length ? 3 : 0;
      const score = lengthError + turnPenalty + duplicatePenalty;
      if (!best || score < best.score) best = { sequence, score, length };
    }

    return best.sequence;
  }

  function pruneWaypointsToTarget(sequence, type, targetKm) {
    const requiredClimbs = { flat: 0, rolling: 0, punchy: 1, medium_mountain: 1, high_mountain: 2, itt: 0 }[type] || 0;
    const targetDirect = targetKm * directDistanceFactor(type);
    let current = sequence.slice();
    let currentError = Math.abs(sequenceLength(current) - targetDirect);
    let improved = true;

    while (improved && current.length > 2) {
      improved = false;
      let best = null;
      for (let index = 1; index < current.length - 1; index++) {
        const candidate = current.filter((_, candidateIndex) => candidateIndex !== index);
        const climbCount = candidate.filter((anchor) => hasRole(anchor, 'climb')).length;
        if (climbCount < requiredClimbs) continue;
        const error = Math.abs(sequenceLength(candidate) - targetDirect);
        if (!best || error < best.error) best = { candidate, error };
      }
      if (best && best.error + 0.5 < currentError) {
        current = best.candidate;
        currentError = best.error;
        improved = true;
      }
    }
    return current;
  }

  function catmullRom(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  }

  function buildSyntheticGeometry(waypoints, type, seed) {
    const rng = new RNG(seed);
    const points = [];
    const undulationByType = { flat: 9, rolling: 44, punchy: 68, medium_mountain: 78, high_mountain: 92, itt: 5 };
    const undulation = undulationByType[type] || 12;

    for (let segment = 0; segment < waypoints.length - 1; segment++) {
      const p0 = waypoints[Math.max(0, segment - 1)];
      const p1 = waypoints[segment];
      const p2 = waypoints[segment + 1];
      const p3 = waypoints[Math.min(waypoints.length - 1, segment + 2)];
      const segmentKm = haversine(p1, p2);
      const samples = clamp(Math.ceil(segmentKm / 0.42), 18, 180);
      const phase = rng.float(0, Math.PI * 2);
      const frequency = rng.float(1.5, 3.8);

      for (let i = 0; i < samples; i++) {
        if (segment > 0 && i === 0) continue;
        const t = i / samples;
        const lat = catmullRom(p0.lat, p1.lat, p2.lat, p3.lat, t);
        const lon = catmullRom(p0.lon, p1.lon, p2.lon, p3.lon, t);
        const baseEle = lerp(p1.ele || 0, p2.ele || 0, smoothstep(t));
        const envelope = Math.sin(Math.PI * t) ** 2;
        const ripple = Math.sin((t * frequency * Math.PI * 2) + phase) * undulation * envelope;
        const fine = Math.sin((t * 11 + phase) * Math.PI) * undulation * 0.12 * envelope;
        points.push({ lat, lon, ele: Math.max(0, baseEle + ripple + fine), source: 'included' });
      }
    }
    const last = waypoints[waypoints.length - 1];
    points.push({ lat: last.lat, lon: last.lon, ele: last.ele || 0, source: 'included' });
    return points;
  }

  function tuneSyntheticAscent(rawPoints, type, seed) {
    if (!rawPoints || rawPoints.length < 3) return rawPoints;
    const typeConfig = CATALOG.stageTypes[type];
    const rng = new RNG(seed);
    const cumulative = [0];
    for (let i = 1; i < rawPoints.length; i++) {
      cumulative.push(cumulative[i - 1] + haversine(rawPoints[i - 1], rawPoints[i]));
    }
    const totalKm = cumulative[cumulative.length - 1];
    const scaleByDistance = clamp(Math.pow(totalKm / 165, 0.72), type === 'itt' ? 0.18 : 0.58, 1.28);
    const desiredAscent = rng.float(typeConfig.gain[0], typeConfig.gain[1]) * scaleByDistance;
    const cycleRanges = {
      flat: [2.2, 4.2],
      rolling: [5.5, 8.5],
      punchy: [7.0, 11.0],
      medium_mountain: [5.0, 8.0],
      high_mountain: [4.0, 7.0],
      itt: [1.0, 2.2]
    };
    const [minCycles, maxCycles] = cycleRanges[type] || [4, 7];
    const cycles = rng.float(minCycles, maxCycles);
    const phaseA = rng.float(0, Math.PI * 2);
    const phaseB = rng.float(0, Math.PI * 2);
    const phaseC = rng.float(0, Math.PI * 2);
    const wave = cumulative.map((distanceKm) => {
      const x = totalKm > 0 ? distanceKm / totalKm : 0;
      const envelope = Math.pow(Math.sin(Math.PI * x), 0.7);
      const value =
        0.66 * Math.sin(2 * Math.PI * cycles * x + phaseA) +
        0.25 * Math.sin(2 * Math.PI * cycles * 2.17 * x + phaseB) +
        0.09 * Math.sin(2 * Math.PI * cycles * 4.61 * x + phaseC);
      return value * envelope;
    });

    const ascentForAmplitude = (amplitude) => {
      const candidate = rawPoints.map((point, index) => ({ ...point, ele: point.ele + wave[index] * amplitude }));
      const smooth = smoothElevations(candidate, 7);
      let ascent = 0;
      for (let i = 1; i < smooth.length; i++) {
        const delta = smooth[i] - smooth[i - 1];
        if (delta > 0.35) ascent += delta;
      }
      return ascent;
    };

    const originalAscent = ascentForAmplitude(0);
    if (originalAscent >= desiredAscent * 0.96) return rawPoints;

    let low = 0;
    let high = type === 'high_mountain' ? 280 : type === 'medium_mountain' ? 230 : type === 'punchy' ? 180 : type === 'rolling' ? 150 : type === 'itt' ? 70 : 85;
    while (ascentForAmplitude(high) < desiredAscent && high < 520) high *= 1.35;
    for (let iteration = 0; iteration < 24; iteration++) {
      const mid = (low + high) / 2;
      if (ascentForAmplitude(mid) < desiredAscent) low = mid;
      else high = mid;
    }

    const amplitude = (low + high) / 2;
    const tuned = rawPoints.map((point, index) => ({ ...point, ele: point.ele + wave[index] * amplitude }));
    const minimum = Math.min(...tuned.map((point) => point.ele));
    if (minimum < 0) {
      const shift = Math.abs(minimum) + 3;
      tuned.forEach((point) => { point.ele += shift; });
    }
    return tuned;
  }

  function smoothElevations(points, windowSize) {
    const radius = Math.floor(windowSize / 2);
    const source = points.map((p) => p.ele);
    return source.map((_, index) => {
      let sum = 0;
      let weight = 0;
      for (let offset = -radius; offset <= radius; offset++) {
        const i = clamp(index + offset, 0, source.length - 1);
        const w = radius + 1 - Math.abs(offset);
        sum += source[i] * w;
        weight += w;
      }
      return sum / weight;
    });
  }

  function calculatePointMetrics(rawPoints) {
    if (!rawPoints || rawPoints.length < 2) return [];
    const points = rawPoints.map((point) => ({ ...point }));
    const smooth = smoothElevations(points, 7);
    let cumulative = 0;
    points[0].distanceKm = 0;
    points[0].ele = smooth[0];
    for (let i = 1; i < points.length; i++) {
      cumulative += haversine(points[i - 1], points[i]);
      points[i].distanceKm = cumulative;
      points[i].ele = smooth[i];
    }

    const windowKm = 0.35;
    for (let i = 0; i < points.length; i++) {
      let before = i;
      let after = i;
      while (before > 0 && points[i].distanceKm - points[before].distanceKm < windowKm / 2) before--;
      while (after < points.length - 1 && points[after].distanceKm - points[i].distanceKm < windowKm / 2) after++;
      const horizontalM = Math.max(1, (points[after].distanceKm - points[before].distanceKm) * 1000);
      points[i].grade = clamp(((points[after].ele - points[before].ele) / horizontalM) * 100, -25, 25);
      points[i].index = i;
    }
    return points;
  }

  function calculateAscent(points) {
    let ascent = 0;
    let descent = 0;
    for (let i = 1; i < points.length; i++) {
      const delta = points[i].ele - points[i - 1].ele;
      if (delta > 0.35) ascent += delta;
      if (delta < -0.35) descent += Math.abs(delta);
    }
    return { ascent, descent };
  }

  function classifyClimb(lengthKm, avgGrade, gainM) {
    const score = lengthKm * avgGrade * avgGrade;
    if (gainM >= 900 || score >= 760) return 'HC';
    if (gainM >= 600 || score >= 470) return '1';
    if (gainM >= 350 || score >= 255) return '2';
    if (gainM >= 180 || score >= 120) return '3';
    return '4';
  }

  function detectClimbs(points) {
    const climbs = [];
    let start = null;
    let lowCount = 0;
    for (let i = 1; i < points.length; i++) {
      if (points[i].grade >= 2.1) {
        if (start === null) start = Math.max(0, i - 1);
        lowCount = 0;
      } else if (start !== null) {
        lowCount++;
        if (lowCount >= 5 || points[i].grade < -1.2) {
          const end = Math.max(start + 1, i - lowCount + 1);
          const lengthKm = points[end].distanceKm - points[start].distanceKm;
          const gainM = points[end].ele - points[start].ele;
          const avgGrade = lengthKm > 0 ? gainM / (lengthKm * 10) : 0;
          if (lengthKm >= 1.4 && gainM >= 70 && avgGrade >= 2.4) {
            const maxGrade = Math.max(...points.slice(start, end + 1).map((p) => p.grade));
            climbs.push({
              startIndex: start,
              endIndex: end,
              startKm: points[start].distanceKm,
              endKm: points[end].distanceKm,
              summitKm: points[end].distanceKm,
              summitEle: points[end].ele,
              lengthKm,
              gainM,
              avgGrade,
              maxGrade,
              category: classifyClimb(lengthKm, avgGrade, gainM)
            });
          }
          start = null;
          lowCount = 0;
        }
      }
    }
    return climbs
      .sort((a, b) => b.gainM - a.gainM)
      .slice(0, 8)
      .sort((a, b) => a.startKm - b.startKm)
      .map((climb, index) => ({ ...climb, name: `Puerto ${index + 1}` }));
  }

  function createSprint(stage) {
    if (stage.type === 'itt') return null;
    const ratio = stage.type === 'flat' ? 0.62 : 0.56;
    const km = stage.distanceKm * ratio;
    let nearest = stage.points[0];
    for (const point of stage.points) {
      if (Math.abs(point.distanceKm - km) < Math.abs(nearest.distanceKm - km)) nearest = point;
    }
    return { km: nearest.distanceKm, ele: nearest.ele, lat: nearest.lat, lon: nearest.lon, label: 'Sprint intermedio' };
  }

  function enrichStage(stage, rawPoints) {
    const points = calculatePointMetrics(rawPoints);
    const elevation = calculateAscent(points);
    const maxEle = Math.max(...points.map((p) => p.ele));
    const minEle = Math.min(...points.map((p) => p.ele));
    const maxGrade = Math.max(...points.map((p) => p.grade));
    const distanceKm = points[points.length - 1]?.distanceKm || 0;
    const climbs = detectClimbs(points);
    const enriched = {
      ...stage,
      points,
      distanceKm,
      ascentM: elevation.ascent,
      descentM: elevation.descent,
      maxEleM: maxEle,
      minEleM: minEle,
      maxGrade,
      climbs
    };
    enriched.sprint = createSprint(enriched);
    return enriched;
  }

  function stageTitle(stageIndex, waypoints) {
    const start = waypoints[0].name;
    const finish = waypoints[waypoints.length - 1].name;
    return { title: `Etapa ${stageIndex + 1}`, routeLabel: `${start} → ${finish}`, startName: start, finishName: finish };
  }

  function buildStage(stageIndex, type, countryKey, region, targetKm, summitFinish, seed) {
    const typeConfig = CATALOG.stageTypes[type];
    let best = null;

    for (let attempt = 0; attempt < 8; attempt++) {
      const attemptSeed = seed + attempt * 15485863;
      const rng = new RNG(attemptSeed);
      const waypoints = pruneWaypointsToTarget(chooseWaypoints(region, type, targetKm, summitFinish, rng), type, targetKm);
      const geometry = tuneSyntheticAscent(buildSyntheticGeometry(waypoints, type, attemptSeed + 91), type, attemptSeed + 313);
      const names = stageTitle(stageIndex, waypoints);
      const base = {
        id: `stage-${stageIndex + 1}-${seed}`,
        number: stageIndex + 1,
        type,
        typeLabel: typeConfig.label,
        countryKey,
        country: CATALOG.countries[countryKey].label,
        flag: CATALOG.countries[countryKey].flag,
        regionId: region.id,
        regionName: region.name,
        targetDistanceKm: targetKm,
        summitFinish,
        seed,
        generationAttempt: attempt,
        waypoints: waypoints.map((point, index) => ({ ...point, type: index === 0 || index === waypoints.length - 1 ? 'break' : 'through' })),
        source: 'included',
        routeStatus: 'included',
        ...names
      };
      const candidate = enrichStage(base, geometry);
      const ratio = candidate.distanceKm / Math.max(targetKm, 1);
      const distanceError = Math.abs(candidate.distanceKm - targetKm) / Math.max(targetKm, 1);
      const oversizePenalty = ratio > 1.12 ? (ratio - 1.12) * 7 : 0;
      const undersizePenalty = ratio < 0.72 ? (0.72 - ratio) * 3 : 0;
      const score = distanceError + oversizePenalty + undersizePenalty;
      if (!best || score < best.score) best = { candidate, score };
      if (distanceError < 0.055 && ratio <= 1.08) break;
    }

    return best.candidate;
  }

  function normalizeConfig(input) {
    return {
      mode: ['france', 'spain', 'italy', 'europe'].includes(input.mode) ? input.mode : 'europe',
      stageCount: clamp(Number(input.stageCount) || 21, 1, 30),
      seed: Math.max(1, Number(input.seed) || 20260714),
      totalDistance: Math.max(100, Number(input.totalDistance) || 3350),
      flatCount: Math.max(0, Number(input.flatCount) || 0),
      rollingCount: Math.max(0, Number(input.rollingCount) || 0),
      mediumCount: Math.max(0, Number(input.mediumCount) || 0),
      highCount: Math.max(0, Number(input.highCount) || 0),
      ittCount: Math.max(0, Number(input.ittCount) || 0),
      summitCount: Math.max(0, Number(input.summitCount) || 0),
      maxStageDistance: Math.max(30, Number(input.maxStageDistance) || 225)
    };
  }

  function generateTour(inputConfig) {
    const config = normalizeConfig(inputConfig);
    const rng = new RNG(config.seed);
    const types = buildTypePool(config, rng);
    const targetDistances = assignTargetDistances(types, config, rng);
    const countries = countriesForTour(config.mode, config.stageCount, rng);
    const mountainIndices = types
      .map((type, index) => ['medium_mountain', 'high_mountain'].includes(type) ? index : null)
      .filter((index) => index !== null)
      .sort((a, b) => b - a);
    const summitIndices = new Set(mountainIndices.slice(0, Math.min(config.summitCount, mountainIndices.length)));
    const stages = [];
    const recentRegions = [];

    for (let i = 0; i < config.stageCount; i++) {
      const stageSeed = config.seed + (i + 1) * 104729;
      const localRng = new RNG(stageSeed);
      const allRegions = CATALOG.countries[countries[i]].regions;
      let compatibleRegions = allRegions.filter((region) => typeCompatible(region, types[i]));
      if (!compatibleRegions.length) compatibleRegions = allRegions.slice();
      const freshRegions = compatibleRegions.filter((region) => !recentRegions.slice(-2).includes(region.id));
      const orderedRegions = localRng.shuffle([...(freshRegions.length ? freshRegions : compatibleRegions)]);
      const remainingRegions = localRng.shuffle(compatibleRegions.filter((region) => !orderedRegions.includes(region)));
      orderedRegions.push(...remainingRegions);

      let bestStage = null;
      let bestScore = Infinity;
      const maximumRegionTrials = Math.min(5, orderedRegions.length);
      for (let regionTrial = 0; regionTrial < maximumRegionTrials; regionTrial++) {
        const region = orderedRegions[regionTrial];
        const candidate = buildStage(
          i,
          types[i],
          countries[i],
          region,
          targetDistances[i],
          summitIndices.has(i),
          stageSeed + regionTrial * 32452843
        );
        const ratio = candidate.distanceKm / Math.max(targetDistances[i], 1);
        const distanceError = Math.abs(candidate.distanceKm - targetDistances[i]) / Math.max(targetDistances[i], 1);
        const maximumError = candidate.distanceKm > config.maxStageDistance
          ? (candidate.distanceKm - config.maxStageDistance) / config.maxStageDistance
          : 0;
        const repeatPenalty = recentRegions.slice(-2).includes(region.id) ? 0.12 : 0;
        const score = distanceError + maximumError * 12 + repeatPenalty + (ratio < 0.68 ? (0.68 - ratio) * 3 : 0);
        if (score < bestScore) {
          bestScore = score;
          bestStage = candidate;
        }
        if (distanceError < 0.06 && maximumError === 0) break;
      }

      recentRegions.push(bestStage.regionId);
      stages.push(bestStage);
    }

    return {
      id: `tour-${config.seed}`,
      title: config.mode === 'europe' ? 'Gran Vuelta Europea' : `Gran Vuelta de ${CATALOG.countries[config.mode].label}`,
      createdAt: new Date().toISOString(),
      config,
      stages
    };
  }

  function yieldToBrowser() {
    return new Promise((resolve) => {
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
      else setTimeout(resolve, 0);
    });
  }

  async function generateTourAsync(inputConfig, onProgress, shouldCancel) {
    const config = normalizeConfig(inputConfig);
    const report = typeof onProgress === 'function' ? onProgress : () => {};
    const cancelled = typeof shouldCancel === 'function' ? shouldCancel : () => false;

    report({ phase: 'planning', completed: 0, total: config.stageCount, percent: 2, detail: 'Validando condicionantes y construyendo el calendario deportivo…' });
    await yieldToBrowser();
    if (cancelled()) throw new Error('Generación cancelada por el usuario.');

    const rng = new RNG(config.seed);
    const types = buildTypePool(config, rng);
    const targetDistances = assignTargetDistances(types, config, rng);
    const countries = countriesForTour(config.mode, config.stageCount, rng);
    const mountainIndices = types
      .map((type, index) => ['medium_mountain', 'high_mountain'].includes(type) ? index : null)
      .filter((index) => index !== null)
      .sort((a, b) => b - a);
    const summitIndices = new Set(mountainIndices.slice(0, Math.min(config.summitCount, mountainIndices.length)));
    const stages = [];
    const recentRegions = [];

    report({ phase: 'planning', completed: 0, total: config.stageCount, percent: 7, detail: `Plan preparado: ${config.stageCount} etapas, ${Math.round(config.totalDistance)} km objetivo.` });
    await yieldToBrowser();

    for (let i = 0; i < config.stageCount; i++) {
      if (cancelled()) throw new Error('Generación cancelada por el usuario.');
      const typeLabel = CATALOG.stageTypes[types[i]]?.label || types[i];
      report({
        phase: 'stage',
        completed: i,
        total: config.stageCount,
        percent: 8 + (i / Math.max(1, config.stageCount)) * 82,
        stageNumber: i + 1,
        detail: `Etapa ${i + 1}/${config.stageCount}: buscando una ${typeLabel.toLowerCase()} coherente en ${CATALOG.countries[countries[i]].label}…`
      });
      await yieldToBrowser();

      const stageSeed = config.seed + (i + 1) * 104729;
      const localRng = new RNG(stageSeed);
      const allRegions = CATALOG.countries[countries[i]].regions;
      let compatibleRegions = allRegions.filter((region) => typeCompatible(region, types[i]));
      if (!compatibleRegions.length) compatibleRegions = allRegions.slice();
      const freshRegions = compatibleRegions.filter((region) => !recentRegions.slice(-2).includes(region.id));
      const orderedRegions = localRng.shuffle([...(freshRegions.length ? freshRegions : compatibleRegions)]);
      const remainingRegions = localRng.shuffle(compatibleRegions.filter((region) => !orderedRegions.includes(region)));
      orderedRegions.push(...remainingRegions);

      let bestStage = null;
      let bestScore = Infinity;
      const maximumRegionTrials = Math.min(5, orderedRegions.length);
      for (let regionTrial = 0; regionTrial < maximumRegionTrials; regionTrial++) {
        if (cancelled()) throw new Error('Generación cancelada por el usuario.');
        const region = orderedRegions[regionTrial];
        const candidate = buildStage(
          i,
          types[i],
          countries[i],
          region,
          targetDistances[i],
          summitIndices.has(i),
          stageSeed + regionTrial * 32452843
        );
        const ratio = candidate.distanceKm / Math.max(targetDistances[i], 1);
        const distanceError = Math.abs(candidate.distanceKm - targetDistances[i]) / Math.max(targetDistances[i], 1);
        const maximumError = candidate.distanceKm > config.maxStageDistance
          ? (candidate.distanceKm - config.maxStageDistance) / config.maxStageDistance
          : 0;
        const repeatPenalty = recentRegions.slice(-2).includes(region.id) ? 0.12 : 0;
        const score = distanceError + maximumError * 12 + repeatPenalty + (ratio < 0.68 ? (0.68 - ratio) * 3 : 0);
        if (score < bestScore) {
          bestScore = score;
          bestStage = candidate;
        }
        if (distanceError < 0.06 && maximumError === 0) break;
      }

      recentRegions.push(bestStage.regionId);
      stages.push(bestStage);
      report({
        phase: 'stage-complete',
        completed: i + 1,
        total: config.stageCount,
        percent: 8 + ((i + 1) / Math.max(1, config.stageCount)) * 82,
        stageNumber: i + 1,
        stage: bestStage,
        detail: `Etapa ${i + 1} lista: ${bestStage.routeLabel} · ${bestStage.distanceKm.toFixed(1)} km · ${Math.round(bestStage.ascentM)} m+.`
      });
      await yieldToBrowser();
    }

    report({ phase: 'finalizing', completed: config.stageCount, total: config.stageCount, percent: 94, detail: 'Calculando resumen, puertos, sprints y preparando los GPX…' });
    await yieldToBrowser();

    const tour = {
      id: `tour-${config.seed}`,
      title: config.mode === 'europe' ? 'Gran Vuelta Europea' : `Gran Vuelta de ${CATALOG.countries[config.mode].label}`,
      createdAt: new Date().toISOString(),
      config,
      stages
    };

    report({ phase: 'complete', completed: config.stageCount, total: config.stageCount, percent: 100, detail: `${tour.title} preparada con ${tour.stages.length} etapas.` });
    return tour;
  }

  function regenerateStage(tour, index, seedOffset) {
    const previous = tour.stages[index];
    const seed = previous.seed + (seedOffset || 1) * 7919;
    const rng = new RNG(seed);
    const countryKey = previous.countryKey;
    const candidates = CATALOG.countries[countryKey].regions.filter((region) => typeCompatible(region, previous.type));
    const region = rng.pick(candidates.length ? candidates : CATALOG.countries[countryKey].regions);
    return buildStage(index, previous.type, countryKey, region, previous.targetDistanceKm, previous.summitFinish, seed);
  }

  function decodePolyline6(encoded) {
    let index = 0;
    let lat = 0;
    let lon = 0;
    const coordinates = [];
    while (index < encoded.length) {
      let result = 0;
      let shift = 0;
      let byte;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const dLat = (result & 1) ? ~(result >> 1) : (result >> 1);
      lat += dLat;

      result = 0;
      shift = 0;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const dLon = (result & 1) ? ~(result >> 1) : (result >> 1);
      lon += dLon;
      coordinates.push({ lat: lat / 1e6, lon: lon / 1e6 });
    }
    return coordinates;
  }

  function interpolateElevationForCoordinates(coords, elevations, intervalM) {
    if (!elevations || !elevations.length) return coords.map((coord) => ({ ...coord, ele: 0 }));
    const distances = [0];
    for (let i = 1; i < coords.length; i++) distances.push(distances[i - 1] + haversine(coords[i - 1], coords[i]) * 1000);
    return coords.map((coord, index) => {
      const position = distances[index] / intervalM;
      const lower = clamp(Math.floor(position), 0, elevations.length - 1);
      const upper = clamp(lower + 1, 0, elevations.length - 1);
      const fraction = position - Math.floor(position);
      return { ...coord, ele: lerp(Number(elevations[lower]), Number(elevations[upper]), fraction), source: 'valhalla' };
    });
  }

  function downsample(points, maximum) {
    if (points.length <= maximum) return points;
    const step = Math.ceil(points.length / maximum);
    const sampled = points.filter((_, index) => index % step === 0);
    if (sampled[sampled.length - 1] !== points[points.length - 1]) sampled.push(points[points.length - 1]);
    return sampled;
  }

  async function fetchWithTimeout(url, options, timeoutMs) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      return await fetch(url, { ...options, signal: controller?.signal });
    } catch (error) {
      if (error?.name === 'AbortError') {
        const timeoutError = new Error(`Tiempo de espera agotado tras ${Math.round(timeoutMs / 1000)} s.`);
        timeoutError.code = 'SERVER_UNAVAILABLE';
        throw timeoutError;
      }
      const networkError = new Error(error?.message || 'Error de red o CORS.');
      networkError.code = 'SERVER_UNAVAILABLE';
      throw networkError;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function responseError(response) {
    let detail = '';
    try {
      const body = await response.clone().json();
      detail = body?.error || body?.error_code || body?.message || '';
    } catch (_) {
      try { detail = (await response.clone().text()).slice(0, 220); } catch (_) { /* noop */ }
    }
    const error = new Error(`HTTP ${response.status}${detail ? ` · ${detail}` : ''}`);
    if (response.status === 429) error.code = 'RATE_LIMIT';
    else if (response.status >= 500) error.code = 'SERVER_UNAVAILABLE';
    else error.code = 'ROUTE_REJECTED';
    return error;
  }

  async function fetchValhalla(endpoint, payload, options = {}) {
    const headers = { 'Accept': 'application/json' };
    if (window.APP_CONFIG?.valhallaClientId) headers['X-Client-Id'] = window.APP_CONFIG.valhallaClientId;
    const timeoutMs = Math.max(8000, Number(window.APP_CONFIG?.routeRequestTimeoutMs) || 22000);
    const requestRetries = Math.max(1, Number(options.requestRetries) || 2);
    let lastError = null;

    for (let requestAttempt = 1; requestAttempt <= requestRetries; requestAttempt++) {
      options.onRequest?.({ requestAttempt, requestRetries, transport: 'POST' });
      try {
        const response = await fetchWithTimeout(endpoint, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }, timeoutMs);
        if (!response.ok) throw await responseError(response);
        return await response.json();
      } catch (postError) {
        lastError = postError;
        // GET solventa servidores que bloquean POST/CORS. No se duplica una
        // petición que ya agotó el tiempo de espera.
        const useGetFallback = (
          (postError.code === 'SERVER_UNAVAILABLE' && !/Tiempo de espera/i.test(postError.message || '')) ||
          /HTTP\s+(405|415|501)/i.test(postError.message || '')
        );
        if (useGetFallback) {
          options.onRequest?.({ requestAttempt, requestRetries, transport: 'GET' });
          try {
            const url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}json=${encodeURIComponent(JSON.stringify(payload))}`;
            const response = await fetchWithTimeout(url, { headers }, timeoutMs);
            if (!response.ok) throw await responseError(response);
            return await response.json();
          } catch (getError) {
            lastError = getError;
          }
        }
      }

      const transient = ['RATE_LIMIT', 'SERVER_UNAVAILABLE'].includes(lastError?.code);
      if (!transient || requestAttempt >= requestRetries) break;
      const backoff = (lastError.code === 'RATE_LIMIT' ? 2600 : 900) * requestAttempt;
      options.onRequest?.({ requestAttempt, requestRetries, transport: 'WAIT', waitMs: backoff, error: lastError });
      await wait(backoff);
    }

    const error = new Error(`Valhalla no respondió correctamente (${lastError?.message || 'error desconocido'}).`);
    error.code = lastError?.code || 'SERVER_UNAVAILABLE';
    error.cause = lastError;
    throw error;
  }

  function compactWaypoints(waypoints, maximum) {
    if (!Array.isArray(waypoints) || waypoints.length <= maximum) return (waypoints || []).slice();
    if (maximum <= 2) return [waypoints[0], waypoints[waypoints.length - 1]];
    const result = [waypoints[0]];
    for (let i = 1; i < maximum - 1; i++) {
      const index = Math.round((i / (maximum - 1)) * (waypoints.length - 1));
      const point = waypoints[index];
      if (point && result[result.length - 1] !== point) result.push(point);
    }
    if (result[result.length - 1] !== waypoints[waypoints.length - 1]) result.push(waypoints[waypoints.length - 1]);
    return result;
  }

  function routingVariants(stage, recoveryMode) {
    const all = Array.isArray(stage.waypoints) ? stage.waypoints : [];
    const variants = [
      { label: 'precisa', points: all, allBreaks: false, radius: 3500, reachability: 20, relaxed: false },
      { label: 'anclajes amplios', points: all, allBreaks: true, radius: 7000, reachability: 8, relaxed: true },
      { label: 'waypoints simplificados', points: compactWaypoints(all, 7), allBreaks: true, radius: 10000, reachability: 5, relaxed: true },
      { label: 'corredor simplificado', points: compactWaypoints(all, 5), allBreaks: true, radius: 14000, reachability: 3, relaxed: true },
      { label: 'salida y meta', points: compactWaypoints(all, 2), allBreaks: true, radius: 20000, reachability: 1, relaxed: true }
    ];
    if (recoveryMode) {
      variants.unshift({ label: 'recuperación ampliada', points: compactWaypoints(all, 6), allBreaks: true, radius: 18000, reachability: 1, relaxed: true });
    }
    const seen = new Set();
    return variants.filter((variant) => {
      const coordinatesKey = variant.points.map((point) => `${Number(point.lat).toFixed(5)},${Number(point.lon).toFixed(5)}`).join('|');
      const key = `${variant.allBreaks ? 'B' : 'T'}-${variant.radius}-${variant.reachability}-${coordinatesKey}`;
      if (variant.points.length < 2 || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function buildValhallaPayload(stage, variant) {
    const typeConfig = CATALOG.stageTypes[stage.type];
    return {
      locations: variant.points.map((point, index) => ({
        lat: Number(point.lat),
        lon: Number(point.lon),
        type: variant.allBreaks || index === 0 || index === variant.points.length - 1 ? 'break' : 'through',
        radius: variant.radius,
        search_cutoff: Math.max(variant.radius, 5000),
        minimum_reachability: variant.reachability
      })),
      costing: 'bicycle',
      costing_options: {
        bicycle: {
          bicycle_type: 'road',
          cycling_speed: 35,
          use_roads: variant.relaxed ? 0.96 : 0.88,
          use_hills: typeConfig.useHills,
          avoid_bad_surfaces: variant.relaxed ? 0.75 : 1,
          use_ferry: 0,
          use_living_streets: variant.relaxed ? 0.3 : 0.15,
          shortest: false
        }
      },
      units: 'kilometers',
      directions_type: 'none',
      shape_format: 'polyline6',
      elevation_interval: window.APP_CONFIG?.elevationIntervalM || 30,
      id: `${stage.id}-${variant.label}`
    };
  }

  function routedStageFromResponse(stage, response, variant) {
    if (!response.trip || !Array.isArray(response.trip.legs)) {
      const error = new Error(response.error || response.error_code || 'La respuesta no contiene una ruta válida.');
      error.code = 'ROUTE_REJECTED';
      throw error;
    }
    if (response.trip.summary?.has_ferry) {
      const error = new Error('La ruta propuesta contiene ferry y se ha rechazado.');
      error.code = 'ROUTE_REJECTED';
      throw error;
    }

    let rawPoints = [];
    const interval = window.APP_CONFIG?.elevationIntervalM || 30;
    response.trip.legs.forEach((leg, legIndex) => {
      if (!leg?.shape) return;
      const coords = decodePolyline6(leg.shape);
      let legPoints = interpolateElevationForCoordinates(coords, leg.elevation, leg.elevation_interval || interval);
      if (legIndex > 0) legPoints = legPoints.slice(1);
      rawPoints.push(...legPoints);
    });

    rawPoints = downsample(rawPoints, 2400);
    if (rawPoints.length < 2) {
      const error = new Error('Valhalla devolvió una geometría vacía.');
      error.code = 'ROUTE_REJECTED';
      throw error;
    }

    const noElevation = rawPoints.every((point) => !Number.isFinite(point.ele) || point.ele === 0);
    if (noElevation) {
      const synthetic = buildSyntheticGeometry(stage.waypoints, stage.type, stage.seed + 991);
      rawPoints = rawPoints.map((point, index) => ({
        ...point,
        ele: synthetic[Math.round((index / Math.max(1, rawPoints.length - 1)) * (synthetic.length - 1))].ele
      }));
    }

    const routed = enrichStage({ ...stage, source: 'valhalla', routeStatus: 'real' }, rawPoints);
    routed.apiSummary = response.trip.summary || null;
    routed.routingMode = variant.label;
    routed.routeAdapted = variant.points.length !== stage.waypoints.length || variant.allBreaks;
    routed.routedWaypointCount = variant.points.length;
    routed.distanceDifferencePct = stage.targetDistanceKm
      ? ((routed.distanceKm - stage.targetDistanceKm) / stage.targetDistanceKm) * 100
      : 0;
    return routed;
  }

  async function routeStage(stage, endpoint, options = {}) {
    const variants = routingVariants(stage, Boolean(options.recovery));
    const errors = [];

    for (let index = 0; index < variants.length; index++) {
      const variant = variants[index];
      options.onAttempt?.({
        attempt: index + 1,
        totalAttempts: variants.length,
        label: variant.label,
        waypointCount: variant.points.length
      });
      try {
        const payload = buildValhallaPayload(stage, variant);
        const response = await fetchValhalla(endpoint, payload, {
          requestRetries: options.recovery ? 2 : 1,
          onRequest: options.onRequest
        });
        return routedStageFromResponse(stage, response, variant);
      } catch (error) {
        errors.push(`${variant.label}: ${error.message}`);
        options.onAttemptError?.({
          attempt: index + 1,
          totalAttempts: variants.length,
          label: variant.label,
          error
        });
        // Un rechazo geométrico se resuelve probando menos waypoints. Un fallo
        // transitorio de servidor se vuelve a intentar en la pasada de recuperación.
        if (['RATE_LIMIT', 'SERVER_UNAVAILABLE'].includes(error.code) && !options.recovery) {
          const wrapped = new Error(error.message);
          wrapped.code = error.code;
          wrapped.attemptErrors = errors;
          throw wrapped;
        }
      }
    }

    const finalError = new Error(`No se encontró una ruta ciclable tras ${variants.length} estrategias. ${errors.slice(-2).join(' | ')}`);
    finalError.code = 'ROUTE_REJECTED';
    finalError.attemptErrors = errors;
    throw finalError;
  }

  function parseNaturalConditions(text, currentConfig) {
    const config = { ...currentConfig };
    const normalized = String(text || '').toLowerCase().replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ñ/g, 'n');
    const get = (regex) => {
      const match = normalized.match(regex);
      return match ? Number(match[1]) : null;
    };

    const stages = get(/(\d+)\s*etapas?/);
    const flat = get(/(\d+)\s*(?:etapas?\s*)?(?:llanas?|de\s+llano)/);
    const rolling = get(/(\d+)\s*(?:etapas?\s*)?(?:quebradas?|de\s+media\s+dificultad|de\s+muros?)/);
    const medium = get(/(\d+)\s*(?:etapas?\s*)?(?:de\s+)?media\s+montana/);
    const high = get(/(\d+)\s*(?:etapas?\s*)?(?:de\s+)?alta\s+montana/);
    const itt = get(/(\d+)\s*(?:etapas?\s*)?(?:cri|contrarreloj(?:es)?(?:\s+individuales)?)/);
    const summit = get(/(\d+)\s*final(?:es)?\s+en\s+alto/);
    const maxStage = get(/(?:maximo|max\.?)\s*(?:de\s*)?(\d+)\s*km/);
    const totalBefore = get(/(?:total(?:es)?|recorrido\s+total|distancia\s+total)(?:\s+de)?\s*(\d+)\s*km/);
    const totalAfter = get(/(?:^|[,;\s])(?:de\s+)?(\d+)\s*km\s*(?:totales?|en\s+total)/);
    const total = totalBefore ?? totalAfter;
    const seed = get(/semilla(?:\s+de)?\s*(\d+)/);

    if (stages !== null) config.stageCount = stages;
    if (flat !== null) config.flatCount = flat;
    if (rolling !== null) config.rollingCount = rolling;
    if (medium !== null) config.mediumCount = medium;
    if (high !== null) config.highCount = high;
    if (itt !== null) config.ittCount = itt;
    if (summit !== null) config.summitCount = summit;
    if (maxStage !== null) config.maxStageDistance = maxStage;
    if (total !== null) config.totalDistance = total;
    if (seed !== null) config.seed = seed;

    if (/francia|francesa|tour\s+de\s+france/.test(normalized)) config.mode = 'france';
    if (/espana|espanola|vuelta\s+a\s+espana/.test(normalized)) config.mode = 'spain';
    if (/italia|italiana|giro/.test(normalized)) config.mode = 'italy';
    if (/francia.*espana.*italia|europea|tres\s+paises|3\s+paises/.test(normalized)) config.mode = 'europe';

    return normalizeConfig(config);
  }

  function tourStats(tour) {
    const stages = tour.stages || [];
    return {
      distanceKm: stages.reduce((sum, stage) => sum + stage.distanceKm, 0),
      ascentM: stages.reduce((sum, stage) => sum + stage.ascentM, 0),
      realStages: stages.filter((stage) => stage.routeStatus === 'real').length,
      mountainStages: stages.filter((stage) => ['medium_mountain', 'high_mountain'].includes(stage.type)).length,
      countries: [...new Set(stages.map((stage) => stage.countryKey))].length
    };
  }

  window.StageGenerator = {
    RNG,
    generateTour,
    generateTourAsync,
    regenerateStage,
    routeStage,
    parseNaturalConditions,
    tourStats,
    normalizeConfig,
    haversine,
    clamp,
    round
  };
})();

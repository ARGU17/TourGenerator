(function () {
  const A = (name, lat, lon, ele, roles) => ({ name, lat, lon, ele, roles: roles || ['town'] });

  window.CYCLING_CATALOG = {
    countries: {
      france: {
        label: 'Francia', flag: '🇫🇷',
        regions: [
          {
            id: 'fr_nord', name: 'Norte y Picardía', terrain: ['flat'],
            anchors: [
              A('Lille', 50.6292, 3.0573, 27), A('Roubaix', 50.6927, 3.1778, 35),
              A('Arras', 50.2910, 2.7775, 72), A('Cambrai', 50.1760, 3.2350, 60),
              A('Saint-Quentin', 49.8489, 3.2876, 90), A('Amiens', 49.8941, 2.2958, 33),
              A('Beauvais', 49.4295, 2.0807, 65), A('Compiègne', 49.4179, 2.8261, 37)
            ]
          },
          {
            id: 'fr_loire', name: 'Valle del Loira', terrain: ['flat', 'rolling'],
            anchors: [
              A('Tours', 47.3941, 0.6848, 49), A('Blois', 47.5861, 1.3359, 73),
              A('Orléans', 47.9030, 1.9093, 90), A('Châteauroux', 46.8114, 1.6917, 154),
              A('Bourges', 47.0810, 2.3988, 144), A('Saumur', 47.2601, -0.0760, 30),
              A('Angers', 47.4784, -0.5632, 20), A('Le Mans', 48.0061, 0.1996, 68)
            ]
          },
          {
            id: 'fr_brittany', name: 'Bretaña', terrain: ['rolling', 'punchy'],
            anchors: [
              A('Brest', 48.3904, -4.4861, 55), A('Quimper', 47.9960, -4.1025, 22),
              A('Carhaix-Plouguer', 48.2757, -3.5732, 132), A('Lorient', 47.7483, -3.3702, 15),
              A('Vannes', 47.6582, -2.7608, 25), A('Saint-Brieuc', 48.5142, -2.7658, 95),
              A('Mûr-de-Bretagne', 48.2005, -2.9858, 275, ['climb', 'summit']), A('Dinan', 48.4555, -2.0508, 76)
            ]
          },
          {
            id: 'fr_normandy', name: 'Normandía', terrain: ['flat', 'rolling'],
            anchors: [
              A('Caen', 49.1829, -0.3707, 20), A('Lisieux', 49.1459, 0.2256, 49),
              A('Rouen', 49.4432, 1.0993, 20), A('Dieppe', 49.9229, 1.0775, 10),
              A('Le Havre', 49.4944, 0.1079, 16), A('Évreux', 49.0270, 1.1514, 70),
              A('Alençon', 48.4329, 0.0913, 135), A('Honfleur', 49.4199, 0.2320, 12)
            ]
          },
          {
            id: 'fr_vosges', name: 'Vosgos', terrain: ['medium_mountain', 'high_mountain'],
            anchors: [
              A('Nancy', 48.6921, 6.1844, 212), A('Épinal', 48.1740, 6.4494, 335),
              A('Gérardmer', 48.0731, 6.8770, 670), A('Col de la Schlucht', 48.0637, 7.0225, 1139, ['climb']),
              A('Grand Ballon', 47.9014, 7.0980, 1343, ['climb', 'summit']), A('Belfort', 47.6397, 6.8638, 370),
              A('Mulhouse', 47.7508, 7.3359, 240), A('La Planche des Belles Filles', 47.7675, 6.7739, 1140, ['climb', 'summit'])
            ]
          },
          {
            id: 'fr_massif', name: 'Macizo Central', terrain: ['medium_mountain', 'high_mountain'],
            anchors: [
              A('Clermont-Ferrand', 45.7772, 3.0870, 358), A('Issoire', 45.5442, 3.2496, 376),
              A('Le Mont-Dore', 45.5766, 2.8086, 1046), A('Col de la Croix Saint-Robert', 45.5651, 2.8453, 1451, ['climb']),
              A('Puy Mary', 45.1103, 2.6766, 1589, ['climb', 'summit']), A('Aurillac', 44.9309, 2.4449, 622),
              A('Le Lioran', 45.0829, 2.7514, 1238, ['climb', 'summit']), A('Saint-Flour', 45.0344, 3.0926, 900)
            ]
          },
          {
            id: 'fr_pyrenees', name: 'Pirineos franceses', terrain: ['high_mountain', 'medium_mountain'],
            anchors: [
              A('Pau', 43.2951, -0.3708, 210), A('Laruns', 42.9880, -0.4260, 525),
              A('Col d’Aubisque', 42.9770, -0.3387, 1709, ['climb']), A('Argelès-Gazost', 43.0023, -0.0991, 463),
              A('Col du Tourmalet', 42.9080, 0.1456, 2115, ['climb']), A('Saint-Lary-Soulan', 42.8176, 0.3219, 830),
              A('Col de Peyresourde', 42.7966, 0.4630, 1569, ['climb']), A('Bagnères-de-Luchon', 42.7900, 0.5920, 630)
            ]
          },
          {
            id: 'fr_alps', name: 'Alpes franceses', terrain: ['high_mountain'],
            anchors: [
              A('Grenoble', 45.1885, 5.7245, 212), A('Albertville', 45.6755, 6.3927, 345),
              A('Bourg-Saint-Maurice', 45.6186, 6.7690, 815), A('Col de la Madeleine', 45.4350, 6.3661, 1993, ['climb']),
              A('Col du Galibier', 45.0642, 6.4077, 2642, ['climb']), A('Alpe d’Huez', 45.0916, 6.0693, 1850, ['climb', 'summit']),
              A('Annecy', 45.8992, 6.1294, 448), A('Morzine', 46.1790, 6.7080, 980, ['summit'])
            ]
          },
          {
            id: 'fr_provence', name: 'Provenza', terrain: ['rolling', 'medium_mountain', 'high_mountain'],
            anchors: [
              A('Nîmes', 43.8367, 4.3601, 39), A('Avignon', 43.9493, 4.8055, 23),
              A('Carpentras', 44.0558, 5.0489, 95), A('Mont Ventoux', 44.1741, 5.2783, 1909, ['climb', 'summit']),
              A('Sisteron', 44.1900, 5.9464, 485), A('Manosque', 43.8346, 5.7825, 380),
              A('Aix-en-Provence', 43.5297, 5.4474, 173), A('Gap', 44.5596, 6.0786, 735)
            ]
          },
          {
            id: 'fr_jura', name: 'Jura', terrain: ['rolling', 'medium_mountain'],
            anchors: [
              A('Besançon', 47.2378, 6.0241, 250), A('Pontarlier', 46.9038, 6.3554, 837),
              A('Métabief', 46.7736, 6.3507, 1000, ['climb']), A('Champagnole', 46.7442, 5.9135, 540),
              A('Lons-le-Saunier', 46.6753, 5.5558, 255), A('Saint-Claude', 46.3868, 5.8647, 440),
              A('Col de la Faucille', 46.3672, 6.0188, 1323, ['climb', 'summit']), A('Oyonnax', 46.2573, 5.6578, 540)
            ]
          }
        ]
      },

      spain: {
        label: 'España', flag: '🇪🇸',
        regions: [
          {
            id: 'es_castilla_n', name: 'Meseta Norte', terrain: ['flat', 'rolling'],
            anchors: [
              A('Burgos', 42.3439, -3.6969, 859), A('Palencia', 42.0096, -4.5288, 749),
              A('Valladolid', 41.6523, -4.7245, 698), A('León', 42.5987, -5.5671, 838),
              A('Zamora', 41.5035, -5.7446, 652), A('Salamanca', 40.9701, -5.6635, 802),
              A('Segovia', 40.9429, -4.1088, 1005), A('Aranda de Duero', 41.6713, -3.6892, 798)
            ]
          },
          {
            id: 'es_castilla_s', name: 'Castilla-La Mancha', terrain: ['flat', 'rolling'],
            anchors: [
              A('Toledo', 39.8628, -4.0273, 529), A('Aranjuez', 40.0311, -3.6047, 495),
              A('Cuenca', 40.0704, -2.1374, 946), A('Albacete', 38.9943, -1.8585, 686),
              A('Ciudad Real', 38.9861, -3.9273, 628), A('Talavera de la Reina', 39.9635, -4.8308, 373),
              A('Guadalajara', 40.6333, -3.1669, 685), A('Alcalá de Henares', 40.4819, -3.3640, 588)
            ]
          },
          {
            id: 'es_galicia', name: 'Galicia', terrain: ['rolling', 'punchy', 'medium_mountain'],
            anchors: [
              A('A Coruña', 43.3623, -8.4115, 20), A('Santiago de Compostela', 42.8782, -8.5448, 260),
              A('Lugo', 43.0097, -7.5568, 465), A('Ourense', 42.3358, -7.8639, 130),
              A('Pontevedra', 42.4299, -8.6446, 20), A('Vigo', 42.2406, -8.7207, 55),
              A('Mirador de Ézaro', 42.9118, -9.1262, 270, ['climb', 'summit']), A('Manzaneda', 42.3101, -7.2292, 1450, ['climb', 'summit'])
            ]
          },
          {
            id: 'es_basque', name: 'País Vasco y Navarra', terrain: ['rolling', 'punchy', 'medium_mountain'],
            anchors: [
              A('Bilbao', 43.2630, -2.9350, 19), A('San Sebastián', 43.3183, -1.9812, 12),
              A('Vitoria-Gasteiz', 42.8467, -2.6716, 525), A('Pamplona', 42.8125, -1.6458, 450),
              A('Durango', 43.1714, -2.6338, 110), A('Otxandio', 43.0395, -2.6540, 560, ['climb']),
              A('Jaizkibel', 43.3459, -1.8561, 543, ['climb']), A('Arrate', 43.1843, -2.4477, 556, ['climb', 'summit'])
            ]
          },
          {
            id: 'es_asturias', name: 'Asturias y Cantabria', terrain: ['medium_mountain', 'high_mountain'],
            anchors: [
              A('Oviedo', 43.3619, -5.8494, 232), A('Gijón', 43.5322, -5.6611, 18),
              A('Cangas de Onís', 43.3502, -5.1290, 87), A('Lagos de Covadonga', 43.2703, -4.9854, 1134, ['climb', 'summit']),
              A('Pola de Lena', 43.1602, -5.8288, 330), A('Alto del Angliru', 43.2218, -5.9422, 1570, ['climb', 'summit']),
              A('Puerto de San Lorenzo', 43.1677, -6.1838, 1347, ['climb']), A('Santander', 43.4623, -3.8099, 15)
            ]
          },
          {
            id: 'es_pyrenees', name: 'Pirineos españoles', terrain: ['high_mountain'],
            anchors: [
              A('Jaca', 42.5700, -0.5490, 820), A('Sabiñánigo', 42.5192, -0.3663, 780),
              A('Formigal', 42.7758, -0.3617, 1500, ['climb', 'summit']), A('Aínsa', 42.4154, 0.1401, 589),
              A('Cerler', 42.5920, 0.5390, 1530, ['climb', 'summit']), A('Vielha', 42.7015, 0.7957, 974),
              A('Baqueira', 42.6981, 0.9354, 1500, ['climb']), A('La Seu d’Urgell', 42.3574, 1.4610, 691)
            ]
          },
          {
            id: 'es_valencia', name: 'Comunidad Valenciana', terrain: ['flat', 'rolling', 'medium_mountain'],
            anchors: [
              A('Valencia', 39.4699, -0.3763, 15), A('Castellón', 39.9864, -0.0513, 30),
              A('Alicante', 38.3452, -0.4810, 10), A('Alcoy', 38.6987, -0.4732, 562),
              A('Xorret de Catí', 38.5373, -0.6804, 1097, ['climb', 'summit']), A('Morella', 40.6197, -0.1004, 984, ['climb']),
              A('Requena', 39.4883, -1.1004, 692), A('Cullera', 39.1650, -0.2550, 5)
            ]
          },
          {
            id: 'es_andalucia', name: 'Andalucía', terrain: ['flat', 'rolling', 'high_mountain'],
            anchors: [
              A('Sevilla', 37.3891, -5.9845, 12), A('Córdoba', 37.8882, -4.7794, 106),
              A('Málaga', 36.7213, -4.4214, 11), A('Granada', 37.1773, -3.5986, 680),
              A('Monachil', 37.1321, -3.5370, 792), A('Sierra Nevada', 37.0955, -3.3984, 2500, ['climb', 'summit']),
              A('Jaén', 37.7796, -3.7849, 573), A('Cádiz', 36.5271, -6.2886, 11)
            ]
          },
          {
            id: 'es_catalonia', name: 'Cataluña', terrain: ['flat', 'rolling', 'medium_mountain'],
            anchors: [
              A('Barcelona', 41.3874, 2.1686, 12), A('Girona', 41.9794, 2.8214, 70),
              A('Tarragona', 41.1189, 1.2445, 68), A('Lleida', 41.6176, 0.6200, 155),
              A('Montjuïc', 41.3640, 2.1540, 173, ['climb', 'summit']), A('Montserrat', 41.5933, 1.8370, 720, ['climb']),
              A('Vic', 41.9301, 2.2549, 484), A('Olot', 42.1822, 2.4882, 443)
            ]
          },
          {
            id: 'es_madrid', name: 'Madrid y Sistema Central', terrain: ['flat', 'rolling', 'medium_mountain'],
            anchors: [
              A('Madrid', 40.4168, -3.7038, 657), A('Alcalá de Henares', 40.4819, -3.3640, 588),
              A('San Lorenzo de El Escorial', 40.5914, -4.1474, 1032), A('Navacerrada', 40.7290, -4.0167, 1200),
              A('Puerto de Navacerrada', 40.7888, -4.0037, 1858, ['climb', 'summit']), A('Rascafría', 40.9041, -3.8785, 1163),
              A('Ávila', 40.6566, -4.6812, 1132), A('Aranjuez', 40.0311, -3.6047, 495)
            ]
          }
        ]
      },

      italy: {
        label: 'Italia', flag: '🇮🇹',
        regions: [
          {
            id: 'it_po_west', name: 'Llanura del Po occidental', terrain: ['flat'],
            anchors: [
              A('Torino', 45.0703, 7.6869, 239), A('Novara', 45.4469, 8.6218, 162),
              A('Vercelli', 45.3230, 8.4230, 130), A('Alessandria', 44.9073, 8.6117, 95),
              A('Asti', 44.9008, 8.2064, 123), A('Pavia', 45.1847, 9.1582, 77),
              A('Milano', 45.4642, 9.1900, 122), A('Cuneo', 44.3845, 7.5427, 534)
            ]
          },
          {
            id: 'it_po_east', name: 'Llanura del Po oriental', terrain: ['flat', 'rolling'],
            anchors: [
              A('Parma', 44.8015, 10.3279, 57), A('Reggio Emilia', 44.6989, 10.6297, 58),
              A('Modena', 44.6471, 10.9252, 34), A('Bologna', 44.4949, 11.3426, 54),
              A('Ferrara', 44.8381, 11.6198, 9), A('Mantova', 45.1564, 10.7914, 19),
              A('Verona', 45.4384, 10.9916, 59), A('Padova', 45.4064, 11.8768, 12)
            ]
          },
          {
            id: 'it_tuscany', name: 'Toscana', terrain: ['rolling', 'punchy', 'medium_mountain'],
            anchors: [
              A('Firenze', 43.7696, 11.2558, 50), A('Siena', 43.3188, 11.3308, 322),
              A('Pisa', 43.7228, 10.4017, 4), A('Lucca', 43.8429, 10.5027, 19),
              A('Volterra', 43.4023, 10.8610, 531, ['climb']), A('Arezzo', 43.4633, 11.8796, 296),
              A('Montalcino', 43.0577, 11.4890, 567, ['climb', 'summit']), A('Viareggio', 43.8657, 10.2513, 2)
            ]
          },
          {
            id: 'it_liguria', name: 'Liguria', terrain: ['rolling', 'medium_mountain'],
            anchors: [
              A('Genova', 44.4056, 8.9463, 20), A('Savona', 44.3075, 8.4810, 10),
              A('Sanremo', 43.8159, 7.7761, 15), A('La Spezia', 44.1025, 9.8241, 10),
              A('Passo del Turchino', 44.5377, 8.7355, 588, ['climb']), A('Passo del Bocco', 44.4177, 9.4445, 956, ['climb']),
              A('Imperia', 43.8897, 8.0395, 12), A('Rapallo', 44.3496, 9.2300, 5)
            ]
          },
          {
            id: 'it_apennines', name: 'Apeninos centrales', terrain: ['medium_mountain', 'high_mountain'],
            anchors: [
              A('Perugia', 43.1107, 12.3908, 493), A('Assisi', 43.0707, 12.6196, 424),
              A('Spoleto', 42.7350, 12.7387, 396), A('Rieti', 42.4045, 12.8567, 405),
              A('Monte Terminillo', 42.4727, 12.9947, 1675, ['climb', 'summit']), A('L’Aquila', 42.3498, 13.3995, 714),
              A('Campo Imperatore', 42.4420, 13.5590, 1800, ['climb', 'summit']), A('Terni', 42.5636, 12.6427, 130)
            ]
          },
          {
            id: 'it_dolomites', name: 'Dolomitas', terrain: ['high_mountain'],
            anchors: [
              A('Bolzano', 46.4983, 11.3548, 262), A('Cortina d’Ampezzo', 46.5405, 12.1357, 1224),
              A('Passo Gardena', 46.5490, 11.8085, 2121, ['climb']), A('Passo Sella', 46.5092, 11.7607, 2218, ['climb']),
              A('Passo Pordoi', 46.4887, 11.8113, 2239, ['climb']), A('Passo Giau', 46.4832, 12.0514, 2236, ['climb']),
              A('Canazei', 46.4767, 11.7714, 1465, ['summit']), A('Arabba', 46.4970, 11.8750, 1602, ['summit'])
            ]
          },
          {
            id: 'it_alps_west', name: 'Alpes occidentales', terrain: ['high_mountain'],
            anchors: [
              A('Torino', 45.0703, 7.6869, 239), A('Susa', 45.1377, 7.0506, 503),
              A('Sestriere', 44.9587, 6.8777, 2035, ['climb', 'summit']), A('Colle delle Finestre', 45.0724, 7.0527, 2178, ['climb']),
              A('Bardonecchia', 45.0780, 6.7036, 1312, ['summit']), A('Pinerolo', 44.8853, 7.3320, 376),
              A('Cuneo', 44.3845, 7.5427, 534), A('Colle dell’Agnello', 44.6841, 6.9790, 2744, ['climb'])
            ]
          },
          {
            id: 'it_lombardy', name: 'Lombardía y lagos', terrain: ['rolling', 'medium_mountain', 'high_mountain'],
            anchors: [
              A('Milano', 45.4642, 9.1900, 122), A('Como', 45.8081, 9.0852, 201),
              A('Bergamo', 45.6983, 9.6773, 249), A('Lecco', 45.8566, 9.3977, 214),
              A('Madonna del Ghisallo', 45.9237, 9.2671, 754, ['climb']), A('Bormio', 46.4678, 10.3780, 1225),
              A('Passo dello Stelvio', 46.5287, 10.4532, 2757, ['climb', 'summit']), A('Livigno', 46.5386, 10.1359, 1816, ['summit'])
            ]
          },
          {
            id: 'it_adriatic', name: 'Costa Adriática', terrain: ['flat', 'rolling'],
            anchors: [
              A('Rimini', 44.0678, 12.5695, 5), A('Pesaro', 43.9125, 12.9155, 11),
              A('Ancona', 43.6158, 13.5189, 16), A('Pescara', 42.4618, 14.2161, 4),
              A('Fano', 43.8403, 13.0197, 12), A('San Benedetto del Tronto', 42.9495, 13.8781, 7),
              A('Ascoli Piceno', 42.8536, 13.5749, 154), A('Urbino', 43.7263, 12.6363, 485, ['climb'])
            ]
          },
          {
            id: 'it_south', name: 'Sur de Italia', terrain: ['flat', 'rolling', 'medium_mountain'],
            anchors: [
              A('Napoli', 40.8518, 14.2681, 17), A('Salerno', 40.6824, 14.7681, 4),
              A('Benevento', 41.1298, 14.7826, 135), A('Potenza', 40.6404, 15.8056, 819),
              A('Matera', 40.6664, 16.6043, 401), A('Bari', 41.1171, 16.8719, 5),
              A('Monte Vulture', 40.9490, 15.6300, 1280, ['climb', 'summit']), A('Foggia', 41.4622, 15.5446, 76)
            ]
          }
        ]
      }
    },

    stageTypes: {
      flat: { label: 'Llano', short: 'LLANA', distance: [145, 225], gain: [250, 1100], useHills: 0.05, color: '#65e892' },
      rolling: { label: 'Quebrada', short: 'QUEBRADA', distance: [145, 215], gain: [1200, 2600], useHills: 0.38, color: '#f5cf5b' },
      punchy: { label: 'Muros', short: 'MUROS', distance: [135, 205], gain: [1700, 3100], useHills: 0.62, color: '#ff9f43' },
      medium_mountain: { label: 'Media montaña', short: 'MEDIA MONTAÑA', distance: [130, 195], gain: [2400, 3900], useHills: 0.76, color: '#ff7b54' },
      high_mountain: { label: 'Alta montaña', short: 'ALTA MONTAÑA', distance: [115, 180], gain: [3400, 5600], useHills: 0.96, color: '#ff5c5c' },
      itt: { label: 'Contrarreloj individual', short: 'CRI', distance: [22, 48], gain: [100, 900], useHills: 0.18, color: '#6ecbff' }
    }
  };
})();

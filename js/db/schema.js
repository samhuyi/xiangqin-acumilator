/* =========================================================
 * 数据库 Schema 定义
 * ---------------------------------------------------------
 * 单一定义点：既供运行时 repository 做「集合名 + 归一化规则」，
 * 也供 db/import.js 决定把种子数据灌进哪些集合、用什么主键。
 * ========================================================= */

'use strict';

/**
 * 集合清单。
 *  name      —— 集合名（云开发 / 后端表名）
 *  shape     —— 运行时形状
 *     'array'  多条记录，每条含 id（events/backgrounds/...）
 *     'object' 单条配置（constants/materials）
 *     'map'    多条记录 [{id,value}] → {id: value}（texts）
 */
const COLLECTIONS = [
  { name: 'events',        shape: 'array'  },
  { name: 'backgrounds',   shape: 'array'  },
  { name: 'goals',         shape: 'array'  },
  { name: 'difficulties',  shape: 'array'  },
  { name: 'channels',      shape: 'array'  },
  { name: 'date_types',    shape: 'array'  },
  { name: 'court_styles',  shape: 'array'  },
  { name: 'style_events',  shape: 'array'  },
  { name: 'chats',         shape: 'array'  },
  { name: 'partners',      shape: 'array'  },
  { name: 'personalities', shape: 'array'  },
  { name: 'endings',       shape: 'array'  },
  { name: 'constants',     shape: 'object' },
  { name: 'materials',     shape: 'object' },
  { name: 'texts',         shape: 'map'    }
];

const COLLECTION_NAMES = COLLECTIONS.map(function (c) { return c.name; });

function shapeOf(name) {
  for (var i = 0; i < COLLECTIONS.length; i++) {
    if (COLLECTIONS[i].name === name) return COLLECTIONS[i].shape;
  }
  return 'array';
}

module.exports = {
  COLLECTIONS: COLLECTIONS,
  COLLECTION_NAMES: COLLECTION_NAMES,
  shapeOf: shapeOf
};

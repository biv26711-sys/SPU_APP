// public/db/sqlite-readonly.cjs
let db;

function openDB(dbPath) {
  const Database = require('better-sqlite3');
  db = new Database(dbPath, { readonly: true });
}

function searchTemplates(q = '') {
  const text = (q || '').trim();
  const like = `%${text}%`;
  const stmt = db.prepare(`
    SELECT
      wt.id,
      wt.code,
      wt.title AS name,
      wt.description,
      wt.base_duration_minutes,

      wn.id    AS node_id,
      wn.code  AS node_code,
      wn.title AS node_title,

      wp.id    AS phase_id,
      wp.code  AS phase_code,
      wp.title AS phase_title,

      wt.base_duration_minutes,
      wt.required_level
    FROM work_templates wt
    JOIN wbs_node  wn ON wn.id  = wt.wbs_node_id
    JOIN wbs_phase wp ON wp.id  = wn.phase_id
    WHERE
      @text = '' OR
      wt.title       LIKE @like OR
      wt.code        LIKE @like OR
      wt.description LIKE @like OR
      wn.title       LIKE @like OR
      wp.title       LIKE @like
    ORDER BY wp.id ASC, wn.id ASC, wt.id ASC
    LIMIT 400
  `);
  return stmt.all({ text, like });
}

function getTemplate(idOrCode) {
  const isCode = typeof idOrCode === 'string' && isNaN(+idOrCode);
  const stmt = db.prepare(`
    SELECT wt.*,
           wn.id    AS node_id,
           wn.title AS node_title,
           wp.id    AS phase_id,
           wp.title AS phase_title
    FROM work_templates wt
    JOIN wbs_node  wn ON wn.id = wt.wbs_node_id
    JOIN wbs_phase wp ON wp.id = wn.phase_id
    WHERE ${isCode ? 'wt.code = ?' : 'wt.id = ?'}
    LIMIT 1
  `);
  return stmt.get(idOrCode);
}

/**
 * Вернёт список предшественников (по таблице template_deps).
 * @param {number|string} idOrCode - id или code шаблона, для которого ищем зависимости
 * @param {Object} [opts]
 * @param {'all'|'required'} [opts.level='all'] - вернуть все зависимости или только те, у которых required_level = 'required'
 */
function getRequiredPredecessors(idOrCode, opts = {}) {
  const level = opts.level || 'all';

  // если передали code — получим id
  let templateId = idOrCode;
  if (typeof idOrCode === 'string' && isNaN(+idOrCode)) {
    const row = db.prepare(`SELECT id FROM work_templates WHERE code = ?`).get(idOrCode);
    if (!row) return [];
    templateId = row.id;
  }

  const whereLevel = level === 'required' ? `AND pred.required_level = 'required'` : '';

  const stmt = db.prepare(`
    SELECT
      pred.id,
      pred.code,
      pred.title  AS name,
      pred.description,
      pred.base_duration_minutes,
      pred.required_level,

      wn.id       AS node_id,
      wn.code     AS node_code,
      wn.title    AS node_title,

      wp.id       AS phase_id,
      wp.code     AS phase_code,
      wp.title    AS phase_title
    FROM template_deps td
    JOIN work_templates pred ON pred.id = td.pred_template_id
    JOIN wbs_node wn  ON wn.id  = pred.wbs_node_id
    JOIN wbs_phase wp ON wp.id  = wn.phase_id
    WHERE td.template_id = ?
      ${whereLevel}
    ORDER BY wp.id ASC, wn.id ASC, pred.id ASC
  `);

  return stmt.all(templateId);
}

function getAllRequiredTemplates() {
  const stmt = db.prepare(`
    SELECT
      wt.id,
      wt.code,
      wt.title  AS name,
      wt.description,
      wt.base_duration_minutes,
      wt.required_level,

      wn.id     AS node_id,
      wn.code   AS node_code,
      wn.title  AS node_title,

      wp.id     AS phase_id,
      wp.code   AS phase_code,
      wp.title  AS phase_title
    FROM work_templates wt
    JOIN wbs_node  wn ON wn.id = wt.wbs_node_id
    JOIN wbs_phase wp ON wp.id = wn.phase_id
    WHERE wt.required_level = 'required'
    ORDER BY wp.id ASC, wn.id ASC, wt.id ASC
  `);
  return stmt.all();
}

function getAllRequiredTemplates() {
  // сначала — сами обязательные шаблоны в правильном порядке
  const templates = db.prepare(`
    SELECT
      wt.id,
      wt.code,
      wt.title  AS name,
      wt.description,
      wt.base_duration_minutes,
      wt.required_level,

      wn.id     AS node_id,
      wn.code   AS node_code,
      wn.title  AS node_title,

      wp.id     AS phase_id,
      wp.code   AS phase_code,
      wp.title  AS phase_title
    FROM work_templates wt
    JOIN wbs_node  wn ON wn.id = wt.wbs_node_id
    JOIN wbs_phase wp ON wp.id = wn.phase_id
    WHERE wt.required_level = 'required'
    ORDER BY wp.id ASC, wn.id ASC, wt.id ASC
  `).all();

  // затем — зависимости по id для каждой работы
  const depsStmt = db.prepare(`
    SELECT pred_template_id
    FROM template_deps
    WHERE template_id = ?
  `);

  return templates.map(t => ({
    ...t,
    // массив числовых id предшественников (как строки, если удобнее — решай в рендерере)
    pred_ids: depsStmt.all(t.id).map(r => r.pred_template_id),
  }));
}

module.exports = {
  openDB,
  searchTemplates,
  getTemplate,
  getRequiredPredecessors,
  getAllRequiredTemplates,
};
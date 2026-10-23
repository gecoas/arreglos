import express from 'express';
import pg from 'pg';
import fs from 'node:fs';

const { Pool } = pg;
const app = express();
const sourcePool = new Pool({ connectionString: process.env.INTRANET_DATABASE_URL || process.env.DATABASE_URL });
let pool;
const intranetUrl = process.env.INTRANET_API_URL || 'http://intranet:80';
app.use(express.json({ limit: '1mb' }));

async function init() {
  const sourceUrl = new URL(process.env.INTRANET_DATABASE_URL || process.env.DATABASE_URL);
  await sourcePool.query("SELECT 1");
  const database = await sourcePool.query("SELECT 1 FROM pg_database WHERE datname = 'arreglos'");
  if (!database.rows.length) await sourcePool.query('CREATE DATABASE arreglos');
  sourceUrl.pathname = '/arreglos';
  pool = new Pool({ connectionString: sourceUrl.toString() });
  await pool.query(fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  await migrateLegacyData();
  await rebalanceClassrooms();
  const manager = await sourcePool.query("SELECT id, school_id FROM public.users WHERE LOWER(email) = 'gbailly@alcaste-lasfuentes.com'");
  for (const user of manager.rows) await pool.query("INSERT INTO arreglos.user_profiles (school_id,user_id,profile) VALUES ($1,$2,'gestor') ON CONFLICT (school_id,user_id) DO UPDATE SET profile='gestor',active=TRUE", [user.school_id, user.id]);
  app.listen(process.env.PORT || 3001, '0.0.0.0', () => console.log('Arreglos API listening'));
}

async function rebalanceClassrooms() {
  const courses = ["1º Primaria", "2º Primaria", "3º Primaria", "4º Primaria", "5º Primaria", "6º Primaria", "1º ESO", "2º ESO", "3º ESO", "4º ESO", "1º Bachillerato", "2º Bachillerato"];
  const classes = courses.flatMap(course => [`${course} A`, `${course} B`]);
  const targetCampus = name => name.includes('Primaria') ? 'alcaste' : 'las-fuentes';
  for (const name of classes) {
    const campusId = targetCampus(name);
    await pool.query("INSERT INTO arreglos.places (school_id,campus_id,name,sort_order,active) VALUES ('alcaste',$1,$2,$3,TRUE) ON CONFLICT (school_id,campus_id,name) DO NOTHING", [campusId,name,classes.indexOf(name)]);
    const canonical = await pool.query('SELECT id FROM arreglos.places WHERE school_id=$1 AND campus_id=$2 AND name=$3', ['alcaste',campusId,name]);
    await pool.query(`UPDATE arreglos.repairs r SET place_id=$1,campus_id=$2
      FROM arreglos.places old WHERE r.place_id=old.id AND old.school_id=$3 AND old.name=$4 AND old.campus_id<>$2`, [canonical.rows[0].id,campusId,'alcaste',name]);
    await pool.query('UPDATE arreglos.places SET active=FALSE WHERE school_id=$1 AND name=$2 AND campus_id<>$3', ['alcaste',name,campusId]);
  }
}

async function migrateLegacyData() {
  const campuses = await sourcePool.query("SELECT id, school_id, name, sort_order, active FROM public.repair_campuses").catch(() => ({ rows: [] }));
  for (const campus of campuses.rows) await pool.query("INSERT INTO arreglos.campuses (id,school_id,name,sort_order,active) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING", [campus.id,campus.school_id,campus.name,campus.sort_order,campus.active]);
  const legacyPlaces = await sourcePool.query("SELECT id,school_id,campus_id,name,sort_order,active FROM public.repair_places").catch(() => ({ rows: [] }));
  for (const place of legacyPlaces.rows) await pool.query("INSERT INTO arreglos.places (school_id,campus_id,name,sort_order,active) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (school_id,campus_id,name) DO NOTHING", [place.school_id,place.campus_id,place.name,place.sort_order,place.active]);
  const profiles = await sourcePool.query("SELECT school_id,user_id,profile,active,updated_at FROM public.repair_profiles").catch(() => ({ rows: [] }));
  for (const profile of profiles.rows) await pool.query("INSERT INTO arreglos.user_profiles (school_id,user_id,profile,active,updated_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (school_id,user_id) DO NOTHING", [profile.school_id,profile.user_id,profile.profile,profile.active,profile.updated_at]);
  const repairs = await sourcePool.query("SELECT id,school_id,title,description,place,campus_id,place_id,urgency,status,author_id,assignee_id,created_at,updated_at,completed_at FROM public.repair_requests").catch(() => ({ rows: [] }));
  for (const item of repairs.rows) {
    const campusId = item.campus_id || 'alcaste';
    let place = await pool.query("SELECT id FROM arreglos.places WHERE school_id=$1 AND campus_id=$2 AND (id=$3 OR name=$4) ORDER BY (id=$3) DESC LIMIT 1", [item.school_id,campusId,item.place_id,item.place]);
    if (!place.rows.length) {
      const campus = await pool.query("SELECT id FROM arreglos.campuses WHERE id=$1 AND school_id=$2", [campusId,item.school_id]);
      if (!campus.rows.length) await pool.query("INSERT INTO arreglos.campuses (id,school_id,name,sort_order) VALUES ($1,$2,$3,99) ON CONFLICT (id) DO NOTHING", [campusId,item.school_id,campusId]);
      place = await pool.query("INSERT INTO arreglos.places (school_id,campus_id,name,sort_order) VALUES ($1,$2,$3,999) ON CONFLICT (school_id,campus_id,name) DO UPDATE SET active=TRUE RETURNING id", [item.school_id,campusId,item.place || 'Lugar sin especificar']);
    }
    await pool.query("INSERT INTO arreglos.repairs (id,school_id,title,description,campus_id,place_id,urgency,status,author_id,assignee_id,created_at,updated_at,completed_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (id) DO NOTHING", [item.id,item.school_id,item.title,item.description,campusId,place.rows[0].id,item.urgency,item.status,item.author_id,item.assignee_id,item.created_at,item.updated_at,item.completed_at]);
  }
  const comments = await sourcePool.query("SELECT id,repair_id,author_id,body,created_at FROM public.repair_comments").catch(() => ({ rows: [] }));
  for (const comment of comments.rows) await pool.query("INSERT INTO arreglos.comments (id,repair_id,author_id,body,created_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING", [comment.id,comment.repair_id,comment.author_id,comment.body,comment.created_at]);
  await pool.query("SELECT setval(pg_get_serial_sequence('arreglos.repairs','id'), GREATEST(COALESCE((SELECT MAX(id) FROM arreglos.repairs),1),1))");
  await pool.query("SELECT setval(pg_get_serial_sequence('arreglos.comments','id'), GREATEST(COALESCE((SELECT MAX(id) FROM arreglos.comments),1),1))");
}

async function session(req, res, next) {
  try {
    const response = await fetch(`${intranetUrl}/api/auth/session`, { headers: { cookie: req.headers.cookie || '' } });
    if (!response.ok) return res.status(401).json({ error: 'Inicia sesión con tu cuenta del colegio' });
    const payload = await response.json();
    req.user = payload.user;
    req.schoolId = payload.user.school_id || payload.user.schoolId || 'alcaste';
    const profile = await pool.query('SELECT profile FROM arreglos.user_profiles WHERE school_id = $1 AND user_id = $2 AND active = TRUE', [req.schoolId, req.user.id]);
    req.repairProfile = req.user.role === 'admin' ? 'gestor' : (profile.rows[0]?.profile || 'profesor');
    next();
  } catch (error) {
    console.error('Session validation failed:', error);
    res.status(502).json({ error: 'No se pudo validar la sesión de la intranet' });
  }
}
app.use('/api', session);

const canManage = req => ['gestor', 'direccion'].includes(req.repairProfile);
app.get('/api/profile', (req, res) => res.json({ profile: req.repairProfile }));
const text = (value, max) => String(value ?? '').trim().slice(0, max);
async function directory(req) {
  const response = await fetch(`${intranetUrl}/api/directory/users`, { headers: { cookie: req.headers.cookie || '' } });
  if (!response.ok) throw new Error(`Directory request failed (${response.status})`);
  return (await response.json()).users || [];
}
async function userNames(req) {
  const users = await directory(req);
  return new Map(users.map(user => [String(user.id), user]));
}
async function loadRepair(id, req) {
  const result = await pool.query(
    `SELECT r.*, p.name AS place_name, c.name AS campus_name,
            (SELECT COUNT(*)::integer FROM arreglos.comments cm WHERE cm.repair_id = r.id) AS comment_count
       FROM arreglos.repairs r JOIN arreglos.places p ON p.id = r.place_id
       JOIN arreglos.campuses c ON c.id = r.campus_id
      WHERE r.id = $1 AND r.school_id = $2
        AND ($3::boolean OR r.author_id = $4 OR r.assignee_id = $4)`,
    [id, req.schoolId, canManage(req), req.user.id]
  );
  const repair = result.rows[0];
  if (!repair) return null;
  const names = await userNames(req);
  repair.author_name = names.get(String(repair.author_id))?.name || req.user.name;
  repair.assignee_name = names.get(String(repair.assignee_id))?.name || null;
  return repair;
}

app.get('/api/repairs', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, p.name AS place_name, c.name AS campus_name,
              (SELECT COUNT(*)::integer FROM arreglos.comments cm WHERE cm.repair_id = r.id) AS comment_count
         FROM arreglos.repairs r JOIN arreglos.places p ON p.id = r.place_id
         JOIN arreglos.campuses c ON c.id = r.campus_id
        WHERE r.school_id = $1 AND ($2::boolean OR r.author_id = $3 OR r.assignee_id = $3)
        ORDER BY r.updated_at DESC`, [req.schoolId, canManage(req), req.user.id]);
    const names = await userNames(req);
    res.json({ repairs: result.rows.map(item => ({ ...item, author_name: names.get(String(item.author_id))?.name || '', assignee_name: names.get(String(item.assignee_id))?.name || null })) });
  } catch (error) { console.error(error); res.status(500).json({ error: 'No se pudieron cargar las fichas' }); }
});

app.get('/api/repair-users', async (req, res) => {
  try {
    const users = await directory(req);
    const result = await pool.query('SELECT user_id, profile, active FROM arreglos.user_profiles WHERE school_id = $1', [req.schoolId]);
    const profiles = new Map(result.rows.map(row => [String(row.user_id), row]));
    res.json({ users: users.map(user => ({ ...user, profile: profiles.get(String(user.id))?.profile || 'profesor', active: profiles.get(String(user.id))?.active ?? true })) });
  } catch (error) { console.error(error); res.status(502).json({ error: 'No se pudo cargar el directorio de usuarios' }); }
});

app.put('/api/repair-users/:id', async (req, res) => {
  if (!canManage(req)) return res.status(403).json({ error: 'Solo los gestores pueden gestionar perfiles' });
  const users = await directory(req);
  if (!users.some(user => String(user.id) === String(req.params.id))) return res.status(404).json({ error: 'Usuario no encontrado en el colegio' });
  const profile = ['profesor', 'mantenimiento', 'gestor', 'direccion'].includes(req.body?.profile) ? req.body.profile : 'profesor';
  const result = await pool.query(
    `INSERT INTO arreglos.user_profiles (school_id, user_id, profile, active, updated_at) VALUES ($1, $2, $3, TRUE, CURRENT_TIMESTAMP)
     ON CONFLICT (school_id, user_id) DO UPDATE SET profile = EXCLUDED.profile, active = TRUE, updated_at = CURRENT_TIMESTAMP RETURNING user_id, profile, active`,
    [req.schoolId, req.params.id, profile]);
  res.json({ user: result.rows[0] });
});

app.get('/api/repair-places', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id AS campus_id, c.name AS campus_name, c.sort_order AS campus_order,
              p.id AS place_id, p.name AS place_name, p.sort_order AS place_order
         FROM arreglos.campuses c LEFT JOIN arreglos.places p ON p.campus_id = c.id AND p.school_id = c.school_id AND p.active = TRUE
        WHERE c.school_id = $1 AND c.active = TRUE ORDER BY c.sort_order, p.sort_order, p.name`, [req.schoolId]);
    const campuses = [];
    for (const row of result.rows) {
      let campus = campuses.find(item => item.id === row.campus_id);
      if (!campus) { campus = { id: row.campus_id, name: row.campus_name, places: [] }; campuses.push(campus); }
      if (row.place_id) campus.places.push({ id: row.place_id, name: row.place_name });
    }
    res.json({ campuses });
  } catch (error) { console.error(error); res.status(500).json({ error: 'No se pudieron cargar las sedes y aulas' }); }
});

app.post('/api/repair-places', async (req, res) => {
  if (!canManage(req)) return res.status(403).json({ error: 'Solo los gestores pueden añadir lugares' });
  const campusId = text(req.body?.campus_id, 64), name = text(req.body?.name, 128);
  if (!campusId || !name) return res.status(400).json({ error: 'La sede y el nombre son obligatorios' });
  if (isClassroom(name) && classCampus(name) !== campusId) return res.status(400).json({ error: 'Primaria pertenece a Alcaste; ESO y Bachillerato pertenecen a Las Fuentes' });
  const result = await pool.query(
    `INSERT INTO arreglos.places (school_id, campus_id, name, sort_order)
     SELECT $1, id, $3, COALESCE((SELECT MAX(sort_order) + 1 FROM arreglos.places WHERE school_id = $1 AND campus_id = id), 1)
       FROM arreglos.campuses WHERE school_id = $1 AND id = $2 AND active = TRUE
     ON CONFLICT (school_id, campus_id, name) DO UPDATE SET active=TRUE RETURNING id, campus_id, name`,
    [req.schoolId, campusId, name]);
  if (!result.rows.length) return res.status(404).json({ error: 'Sede no encontrada' });
  res.status(201).json({ place: result.rows[0] });
});

app.patch('/api/repair-places/:id', async (req, res) => {
  if (!canManage(req)) return res.status(403).json({ error: 'Solo los gestores pueden editar lugares' });
  const name = text(req.body?.name, 128);
  if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });
  if (isClassroom(name) && classCampus(name) !== (await pool.query('SELECT campus_id FROM arreglos.places WHERE id=$1 AND school_id=$2', [req.params.id, req.schoolId])).rows[0]?.campus_id) return res.status(400).json({ error: 'Primaria pertenece a Alcaste; ESO y Bachillerato pertenecen a Las Fuentes' });
  const result = await pool.query('UPDATE arreglos.places SET name = $1 WHERE id = $2 AND school_id = $3 RETURNING id, campus_id, name', [name, req.params.id, req.schoolId]);
  if (!result.rows.length) return res.status(404).json({ error: 'Lugar no encontrado' });
  res.json({ place: result.rows[0] });
});

app.delete('/api/repair-places/:id', async (req, res) => {
  if (!canManage(req)) return res.status(403).json({ error: 'Solo los gestores pueden eliminar lugares' });
  const result = await pool.query('UPDATE arreglos.places SET active = FALSE WHERE id = $1 AND school_id = $2 RETURNING id', [req.params.id, req.schoolId]);
  if (!result.rows.length) return res.status(404).json({ error: 'Lugar no encontrado' });
  res.status(204).end();
});

function isClassroom(name) { return /^(?:[1-6]º Primaria|[1-4]º ESO|[1-2]º Bachillerato)\s+[AB]$/.test(name); }
function classCampus(name) { return name.includes('Primaria') ? 'alcaste' : 'las-fuentes'; }

app.post('/api/repairs', async (req, res) => {
  const title = text(req.body?.title, 255), description = text(req.body?.description, 5000);
  const campusId = text(req.body?.campus_id, 64), placeId = Number(req.body?.place_id);
  const urgency = ['Urgente', 'Alta', 'Media', 'Baja'].includes(req.body?.urgency) ? req.body.urgency : 'Media';
  const place = await pool.query('SELECT name FROM arreglos.places WHERE id = $1 AND campus_id = $2 AND school_id = $3 AND active = TRUE', [placeId, campusId, req.schoolId]);
  if (!title || !place.rows.length) return res.status(400).json({ error: 'Indica título, sede y aula válidos' });
  const result = await pool.query(
    `INSERT INTO arreglos.repairs (school_id, title, description, campus_id, place_id, urgency, author_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [req.schoolId, title, description, campusId, placeId, urgency, req.user.id]);
  res.status(201).json({ repair: await loadRepair(result.rows[0].id, req) });
});

app.patch('/api/repairs/:id', async (req, res) => {
  const current = await loadRepair(req.params.id, req);
  if (!current) return res.status(404).json({ error: 'Ficha no encontrada' });
  const manager = canManage(req), author = String(current.author_id) === String(req.user.id), assignee = String(current.assignee_id || '') === String(req.user.id);
  if (!manager && !author && !assignee) return res.status(403).json({ error: 'No tienes permiso para editar esta ficha' });
  const canEditDetails = manager || (author && current.status === 'Recibida');
  if (!canEditDetails && ['title', 'description', 'campus_id', 'place_id', 'urgency'].some(key => key in (req.body || {}))) return res.status(403).json({ error: 'Solo puedes editar los detalles antes de asignar la ficha' });
  const campusId = req.body?.campus_id || current.campus_id, placeId = Number(req.body?.place_id || current.place_id);
  const place = await pool.query('SELECT name FROM arreglos.places WHERE id = $1 AND campus_id = $2 AND school_id = $3 AND active = TRUE', [placeId, campusId, req.schoolId]);
  if (!place.rows.length) return res.status(400).json({ error: 'Sede o aula no válida' });
  let assigneeId = current.assignee_id;
  if (manager && 'assignee_id' in (req.body || {})) {
    assigneeId = req.body.assignee_id || null;
    if (assigneeId) {
      if (!(await directory(req)).some(user => String(user.id) === String(assigneeId))) return res.status(400).json({ error: 'Solo se pueden asignar empleados activos del colegio' });
      const profile = await pool.query("SELECT profile FROM arreglos.user_profiles WHERE school_id = $1 AND user_id = $2 AND active = TRUE", [req.schoolId, assigneeId]);
      if ((profile.rows[0]?.profile || 'profesor') !== 'mantenimiento') return res.status(400).json({ error: 'La persona asignada debe tener perfil de Mantenimiento' });
    }
  }
  const allowed = ['Recibida', 'Asignada', 'En progreso', 'Realizada'];
  const status = allowed.includes(req.body?.status) ? req.body.status : current.status;
  const finalStatus = assigneeId && status === 'Recibida' ? 'Asignada' : status;
  await pool.query(
    `UPDATE arreglos.repairs SET title=$1, description=$2, campus_id=$3, place_id=$4, urgency=$5, status=$6, assignee_id=$7, updated_at=CURRENT_TIMESTAMP,
      completed_at=CASE WHEN $6='Realizada' THEN COALESCE(completed_at,CURRENT_TIMESTAMP) ELSE NULL END WHERE id=$8 AND school_id=$9`,
    [canEditDetails ? text(req.body?.title ?? current.title,255) : current.title, canEditDetails ? text(req.body?.description ?? current.description,5000) : current.description, campusId, placeId,
      canEditDetails && ['Urgente','Alta','Media','Baja'].includes(req.body?.urgency) ? req.body.urgency : current.urgency, finalStatus, assigneeId, req.params.id, req.schoolId]);
  res.json({ repair: await loadRepair(req.params.id, req) });
});

app.delete('/api/repairs/:id', async (req, res) => {
  const current = await loadRepair(req.params.id, req);
  if (!current) return res.status(404).json({ error: 'Ficha no encontrada' });
  if (!canManage(req) && (String(current.author_id) !== String(req.user.id) || current.status !== 'Recibida')) return res.status(403).json({ error: 'Solo puedes eliminar tus fichas recibidas' });
  await pool.query('DELETE FROM arreglos.repairs WHERE id=$1 AND school_id=$2', [req.params.id, req.schoolId]);
  res.status(204).end();
});

app.get('/api/repairs/:id/comments', async (req, res) => {
  if (!await loadRepair(req.params.id, req)) return res.status(404).json({ error: 'Ficha no encontrada' });
  const result = await pool.query('SELECT c.id, c.body, c.created_at, c.author_id FROM arreglos.comments c WHERE c.repair_id=$1 ORDER BY c.created_at', [req.params.id]);
  const names = await userNames(req);
  res.json({ comments: result.rows.map(item => ({ ...item, author_name: names.get(String(item.author_id))?.name || '', author_initials: names.get(String(item.author_id))?.initials || '' })) });
});

app.post('/api/repairs/:id/comments', async (req, res) => {
  if (!await loadRepair(req.params.id, req)) return res.status(404).json({ error: 'Ficha no encontrada' });
  const body = text(req.body?.body, 2000);
  if (!body) return res.status(400).json({ error: 'El comentario no puede estar vacío' });
  const result = await pool.query('INSERT INTO arreglos.comments (repair_id, author_id, body) VALUES ($1,$2,$3) RETURNING id,body,created_at,author_id', [req.params.id, req.user.id, body]);
  res.status(201).json({ comment: { ...result.rows[0], author_name: req.user.name, author_initials: req.user.initials } });
});

app.get('/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true }); }
  catch { res.status(503).json({ ok: false }); }
});
init().catch(error => { console.error('Arreglos API startup failed:', error); process.exit(1); });

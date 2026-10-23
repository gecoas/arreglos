import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Bell, Building2, CalendarDays, Check, ChevronDown, ChevronRight, Clock3, FilePlus2, Filter, Hammer, LayoutDashboard, MapPin, Menu, MessageCircle, MoreHorizontal, Plus, Search, Settings, SlidersHorizontal, UserRound, Users, X } from 'lucide-react';
import './styles.css';

const initialRepairs = [
  { id: 'AR-1048', title: 'Grifo gotea en el baño', description: 'El grifo del lavabo no cierra bien y pierde agua continuamente.', place: 'Baño planta baja · Edificio A', date: '18 oct 2024', urgency: 'Alta', author: 'Marta Sánchez', role: 'Profesora', status: 'En progreso', assignee: 'Jordi Ferrer', updated: 'Hace 12 min', comments: 4 },
  { id: 'AR-1047', title: 'Persiana rota en aula 2º B', description: 'La persiana se ha quedado atascada a media altura.', place: 'Aula 2º B · Edificio B', date: '18 oct 2024', urgency: 'Media', author: 'Pau Ramis', role: 'Mantenimiento', status: 'Asignada', assignee: 'Nuria Costa', updated: 'Hace 1 h', comments: 2 },
  { id: 'AR-1046', title: 'Bombilla fundida', description: 'Hay poca luz en el pasillo del primer piso.', place: 'Pasillo 1ª planta · Edificio A', date: '17 oct 2024', urgency: 'Baja', author: 'Clara Vila', role: 'Profesora', status: 'Recibida', assignee: null, updated: 'Ayer', comments: 0 },
  { id: 'AR-1045', title: 'Puerta de emergencia no cierra', description: 'La puerta queda abierta y no encaja el pestillo.', place: 'Gimnasio · Edificio C', date: '16 oct 2024', urgency: 'Urgente', author: 'Joan Soler', role: 'Dirección', status: 'En progreso', assignee: 'Jordi Ferrer', updated: 'Ayer', comments: 6 },
  { id: 'AR-1044', title: 'Radiador sin calor', description: 'El radiador del aula no calienta desde esta mañana.', place: 'Aula infantil 3 · Edificio A', date: '15 oct 2024', urgency: 'Media', author: 'Laura Puig', role: 'Profesora', status: 'Realizada', assignee: 'Nuria Costa', updated: '15 oct', comments: 3 },
];

const statusMeta = { Recibida: { cls: 'received', label: 'Recibida' }, Asignada: { cls: 'assigned', label: 'Asignada' }, 'En progreso': { cls: 'progress', label: 'En progreso' }, Realizada: { cls: 'done', label: 'Realizada' } };
const urgencyMeta = { Urgente: 'urgent', Alta: 'high', Media: 'medium', Baja: 'low' };

async function apiRequest(path, options = {}) {
  const response = await fetch(`/api${path}`, { credentials: 'include', cache: 'no-store', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  if (!response.ok) { const body = await response.json().catch(() => ({})); const error = new Error(body.error || `Error ${response.status}`); error.status = response.status; throw error; }
  return response.status === 204 ? null : response.json();
}

function normalizeRepair(item) {
  const created = new Date(item.created_at);
  const updated = new Date(item.updated_at);
  return { ...item, id: String(item.id), date: created.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }), author: item.author_name, assignee: item.assignee_name || null, assigneeId: item.assignee_id || '', updated: updated.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }), comments: Number(item.comment_count || 0) };
}

function IconButton({ children, label, onClick, className = '' }) { return <button type="button" className={`icon-button ${className}`} aria-label={label} title={label} onClick={onClick}>{children}</button>; }
function StatusPill({ status }) { const meta = statusMeta[status]; return <span className={`status-pill ${meta.cls}`}><span className="status-dot" />{meta.label}</span>; }
function Urgency({ value }) { return <span className={`urgency ${urgencyMeta[value]}`}><span />{value}</span>; }

function App() {
  const [repairs, setRepairs] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todas');
  const [showNew, setShowNew] = useState(false);
  const [role, setRole] = useState('Gestor');
  const [toast, setToast] = useState('');
  const [assignees, setAssignees] = useState([]);
  const selected = repairs.find(item => item.id === selectedId) || repairs[0];
  const filtered = repairs.filter(item => (statusFilter === 'Todas' || item.status === statusFilter) && `${item.title} ${item.place} ${item.id}`.toLowerCase().includes(search.toLowerCase()));
  const count = status => repairs.filter(r => r.status === status).length;

  useEffect(() => {
    (async () => {
      try {
        const session = await apiRequest('/auth/session');
        setUser(session.user);
        const data = await apiRequest('/repairs');
        const loaded = data.repairs.map(normalizeRepair);
        setRepairs(loaded);
        setSelectedId(loaded[0]?.id || null);
        setRole(session.user.role === 'admin' ? 'Gestor' : 'Mantenimiento');
        if (session.user.role === 'admin') setAssignees((await apiRequest('/repair-users')).users || []);
      } catch (error) { if (error.status !== 401) setAuthError(error.message); }
      finally { setAuthLoading(false); }
    })();
  }, []);

  const notify = (message) => { setToast(message); window.setTimeout(() => setToast(''), 2800); };
  const changeStatus = async (status) => { const data = await apiRequest(`/repairs/${selected.id}`, { method: 'PATCH', body: JSON.stringify({ status, assignee_id: selected.assigneeId || null }) }); const updated = normalizeRepair(data.repair); setRepairs(items => items.map(item => item.id === selected.id ? { ...item, ...updated } : item)); notify(`Ficha ${selected.id} actualizada`); };
  const assignRepair = async (assigneeId) => { const data = await apiRequest(`/repairs/${selected.id}`, { method: 'PATCH', body: JSON.stringify({ status: assigneeId ? 'Asignada' : 'Recibida', assignee_id: assigneeId || null }) }); const updated = normalizeRepair(data.repair); setRepairs(items => items.map(item => item.id === selected.id ? { ...item, ...updated } : item)); notify('Responsable actualizado'); };
  const addRepair = async (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const result = await apiRequest('/repairs', { method: 'POST', body: JSON.stringify({ title: data.get('title'), description: data.get('description'), place: data.get('place'), urgency: data.get('urgency') }) }); const newRepair = normalizeRepair(result.repair); setRepairs(items => [newRepair, ...items]); setSelectedId(newRepair.id); setShowNew(false); notify('Nueva ficha creada correctamente'); };

  if (authLoading) return <div className="auth-screen"><div className="auth-card"><div className="brand-mark"><Hammer size={19} /></div><h1>arreglos</h1><p>Comprobando tu sesión...</p></div></div>;
  if (!user) return <div className="auth-screen"><div className="auth-card"><div className="brand-mark"><Hammer size={19} /></div><span className="eyebrow">COLEGIO SAN MARCOS</span><h1>arreglos</h1><p>Gestiona y sigue los arreglos del centro desde un solo lugar.</p><button className="google-button" onClick={() => window.location.assign(`/api/auth/google?returnTo=${encodeURIComponent(window.location.origin + window.location.pathname)}`)}><span>G</span> Continuar con Google</button>{authError && <div className="auth-error">{authError}</div>}<small>Accede con tu cuenta autorizada del colegio.</small></div></div>;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Hammer size={19} /></div><div><strong>arreglos</strong><small>COLEGIO SAN MARCOS</small></div></div>
      <div className="school-switch"><Building2 size={16} /><span>Centro escolar</span><ChevronDown size={14} /></div>
      <nav><p className="nav-label">GESTIÓN</p><a className="active"><LayoutDashboard size={18} />Panel general</a><a><FilePlus2 size={18} />Mis fichas <span className="nav-count">3</span></a><a><Users size={18} />Equipo</a><p className="nav-label second">CENTRO</p><a><Building2 size={18} />Espacios</a><a><Settings size={18} />Configuración</a></nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><MessageCircle size={17} /></div><strong>¿Necesitas ayuda?</strong><span>Consulta cómo funciona arreglos.</span><button>Ver guía <ChevronRight size={14} /></button></div><div className="user-mini"><div className="avatar avatar-green">{user.initials || user.name?.slice(0, 2).toUpperCase()}</div><div><strong>{user.name}</strong><span>{role}</span></div><MoreHorizontal size={18} /></div></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><div className="mobile-brand"><IconButton label="Abrir menú"><Menu size={21} /></IconButton><span>arreglos</span></div><div className="breadcrumb"><span>Panel general</span><ChevronRight size={14} /><strong>Fichas de arreglos</strong></div><div className="top-actions"><div className="role-select"><UserRound size={15} /><select value={role} onChange={e => setRole(e.target.value)} aria-label="Rol activo"><option>Gestor</option><option>Mantenimiento</option><option>Dirección</option><option>Profesor</option></select><ChevronDown size={13} /></div><IconButton label="Notificaciones" className="notification"><Bell size={19} /><i /></IconButton><div className="avatar avatar-green top-avatar">{user.initials || user.name?.slice(0, 2).toUpperCase()}</div></div></header>
      <div className="page-wrap">
        <div className="page-heading"><div><div className="eyebrow">MIÉRCOLES, 23 DE OCTUBRE DE 2024</div><h1>Fichas de arreglos</h1><p>Organiza, asigna y haz seguimiento de los arreglos del centro.</p></div><button className="primary-button" onClick={() => setShowNew(true)}><Plus size={18} />Nueva ficha</button></div>
        <section className="stats-grid"><div className="stat-card"><div className="stat-icon all"><FilePlus2 size={19} /></div><div><span>Total de fichas</span><strong>{repairs.length}</strong><small>+2 esta semana</small></div></div><div className="stat-card"><div className="stat-icon orange"><Clock3 size={19} /></div><div><span>Por atender</span><strong>{count('Recibida') + count('Asignada')}</strong><small>Requieren atención</small></div></div><div className="stat-card"><div className="stat-icon blue"><Hammer size={19} /></div><div><span>En progreso</span><strong>{count('En progreso')}</strong><small>En manos del equipo</small></div></div><div className="stat-card"><div className="stat-icon green"><Check size={19} /></div><div><span>Realizadas</span><strong>{count('Realizada')}</strong><small>Este mes</small></div></div></section>
        <div className="content-grid"><section className="list-panel"><div className="panel-head"><div><h2>Todas las fichas <span>{filtered.length}</span></h2><p>Últimas solicitudes registradas en el centro</p></div><IconButton label="Más opciones"><MoreHorizontal size={20} /></IconButton></div><div className="toolbar"><div className="search-box"><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por título, lugar o código..." /></div><div className="filter-select"><Filter size={15} /><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Filtrar por estado"><option>Todas</option><option>Recibida</option><option>Asignada</option><option>En progreso</option><option>Realizada</option></select><ChevronDown size={14} /></div><IconButton label="Más filtros"><SlidersHorizontal size={17} /></IconButton></div><div className="table-wrap"><table><thead><tr><th>FICHA</th><th>LUGAR</th><th>URGENCIA</th><th>ESTADO</th><th>ASIGNADA A</th><th>ACTUALIZADA</th></tr></thead><tbody>{filtered.map(item => <tr key={item.id} className={selectedId === item.id ? 'selected-row' : ''} onClick={() => setSelectedId(item.id)}><td><div className="repair-title"><strong>{item.title}</strong><span>{item.id} · {item.author}</span></div></td><td><div className="place"><MapPin size={14} />{item.place}</div></td><td><Urgency value={item.urgency} /></td><td><StatusPill status={item.status} /></td><td><div className="assignee">{item.assignee ? <><div className="avatar avatar-purple">{item.assignee.split(' ').map(x => x[0]).join('')}</div>{item.assignee}</> : <span className="unassigned">Sin asignar</span>}</div></td><td><span className="updated">{item.updated}</span>{item.comments > 0 && <span className="comment-count"><MessageCircle size={13} />{item.comments}</span>}</td></tr>)}</tbody></table>{filtered.length === 0 && <div className="empty">No hay fichas que coincidan con la búsqueda.</div>}</div><div className="table-footer"><span>Mostrando {filtered.length} de {repairs.length} fichas</span><div><button disabled>Anterior</button><button className="current-page">1</button><button disabled>Siguiente</button></div></div></section>
          {selected ? <DetailPanel repair={selected} role={role} assignees={assignees} onStatus={changeStatus} onAssign={assignRepair} onNotify={notify} /> : <div className="detail-panel empty-detail">Selecciona una ficha para ver sus detalles.</div>}
        </div>
      </div>
    </main>
    {showNew && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setShowNew(false)}><form className="modal" onSubmit={addRepair}><div className="modal-head"><div><span className="eyebrow">NUEVA SOLICITUD</span><h2>Crear ficha de arreglo</h2></div><IconButton label="Cerrar" onClick={() => setShowNew(false)}><X size={19} /></IconButton></div><label>Título<input name="title" required placeholder="Ej. Ventana no cierra bien" /></label><label>Descripción<textarea name="description" required placeholder="Describe qué ocurre y cualquier detalle útil..." /></label><label>Lugar<input name="place" required placeholder="Ej. Aula 1º A · Edificio principal" /></label><div className="form-row"><label>Urgencia<select name="urgency" defaultValue="Media"><option>Urgente</option><option>Alta</option><option>Media</option><option>Baja</option></select></label><label>Quién la escribe<input value={`${user.name} · ${role}`} readOnly /></label></div><div className="modal-actions"><button type="button" className="text-button" onClick={() => setShowNew(false)}>Cancelar</button><button className="primary-button" type="submit"><Plus size={17} />Crear ficha</button></div></form></div>}
    {toast && <div className="toast"><Check size={17} />{toast}</div>}
  </div>;
}

function DetailPanel({ repair, role, assignees, onStatus, onAssign, onNotify }) {
  const [comment, setComment] = useState('');
  const [assigned, setAssigned] = useState(repair.assigneeId || '');
  const [messages, setMessages] = useState([]);
  useEffect(() => { setAssigned(repair.assigneeId || ''); apiRequest(`/repairs/${repair.id}/comments`).then(data => setMessages((data.comments || []).map(item => ({ author: item.author_name, initials: item.author_initials || item.author_name?.slice(0, 2).toUpperCase(), text: item.body, time: new Date(item.created_at).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }), mine: item.author_id === repair.author_id })))).catch(() => setMessages([])); }, [repair.id, repair.assigneeId, repair.author_id]);
  const sendComment = async (e) => { e.preventDefault(); if (!comment.trim()) return; const data = await apiRequest(`/repairs/${repair.id}/comments`, { method: 'POST', body: JSON.stringify({ body: comment }) }); const item = data.comment; setMessages([...messages, { author: item.author_name, initials: item.author_initials, text: item.body, time: 'Ahora', mine: true }]); setComment(''); onNotify('Comentario añadido'); };
  return <aside className="detail-panel"><div className="detail-top"><div><span className="detail-id">{repair.id}</span><StatusPill status={repair.status} /></div><div><IconButton label="Compartir"><Users size={17} /></IconButton><IconButton label="Más opciones"><MoreHorizontal size={19} /></IconButton></div></div><h2>{repair.title}</h2><div className="detail-location"><MapPin size={15} />{repair.place}</div><div className="detail-meta"><div><span>Creada por</span><strong>{repair.author}</strong><small>{repair.date}</small></div><div><span>Urgencia</span><Urgency value={repair.urgency} /></div></div><div className="detail-section"><div className="section-title"><h3>Progreso</h3><span>{repair.status === 'Realizada' ? '100' : repair.status === 'En progreso' ? '65' : repair.status === 'Asignada' ? '25' : '0'}%</span></div><div className="progress-track"><i className={`bar ${repair.status === 'Realizada' ? 'full' : repair.status === 'En progreso' ? 'mid' : repair.status === 'Asignada' ? 'low' : ''}`} /></div><div className="steps"><span className={repair.status !== 'Recibida' ? 'done-step' : 'active-step'}>Recibida</span><span className={['En progreso', 'Realizada'].includes(repair.status) ? 'done-step' : ''}>En progreso</span><span className={repair.status === 'Realizada' ? 'done-step' : ''}>Realizada</span></div></div><div className="detail-section description"><h3>Descripción</h3><p>{repair.description}</p></div><div className="detail-section assignment"><div className="section-title"><h3>Asignación</h3><span className="edit-label">Editar</span></div><label>PERSONA RESPONSABLE<select value={assigned} onChange={e => { setAssigned(e.target.value); onAssign(e.target.value); }}><option value="">Sin asignar</option>{assignees.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select><ChevronDown size={14} /></label></div><div className="detail-section activity"><div className="section-title"><h3>Comentarios <span className="comment-bubble">{messages.length}</span></h3><span>Actividad</span></div><div className="messages">{messages.map((message, index) => <div className={`message ${message.mine ? 'mine' : ''}`} key={index}><div className={`avatar ${message.mine ? 'avatar-green' : 'avatar-purple'}`}>{message.initials}</div><div><div className="message-name"><strong>{message.author}</strong><small>{message.time}</small></div><p>{message.text}</p></div></div>)}</div><form className="comment-form" onSubmit={sendComment}><div className="avatar avatar-green">AM</div><input value={comment} onChange={e => setComment(e.target.value)} placeholder="Escribe un comentario..." /><button aria-label="Enviar comentario"><ChevronRight size={18} /></button></form></div><div className="detail-actions">{repair.status !== 'Realizada' && <button className="primary-button" onClick={() => onStatus(repair.status === 'En progreso' ? 'Realizada' : 'En progreso')}>{repair.status === 'En progreso' ? <><Check size={16} />Marcar como realizada</> : <><Hammer size={16} />Comenzar arreglo</>}</button>}<button className="outline-button" onClick={() => onNotify('Notificación enviada por email y push')}><Bell size={16} />Notificar</button></div></aside>;
}

createRoot(document.getElementById('root')).render(<App />);

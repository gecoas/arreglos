import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Bell, Building2, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, FilePlus2, Filter, Hammer, LayoutDashboard, MapPin, Menu, MessageCircle, MoreHorizontal, Pencil, Plus, Search, Settings, SlidersHorizontal, Trash2, UserRound, Users, X } from 'lucide-react';
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
  return { ...item, id: String(item.id), place: item.place_name || item.place, date: created.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }), author: item.author_name, assignee: item.assignee_name || null, assigneeId: item.assignee_id || '', updated: updated.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }), comments: Number(item.comment_count || 0) };
}

function formatSchoolDate() {
  return new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' }).format(new Date()).toLocaleUpperCase('es-ES');
}

function IconButton({ children, label, onClick, className = '' }) { return <button type="button" className={`icon-button ${className}`} aria-label={label} title={label} onClick={onClick}>{children}</button>; }
function StatusPill({ status }) { const meta = statusMeta[status]; return <span className={`status-pill ${meta.cls}`}><span className="status-dot" />{meta.label}</span>; }
function Urgency({ value }) { return <span className={`urgency ${urgencyMeta[value]}`}><span />{value}</span>; }

function App() {
  const [repairs, setRepairs] = useState([]);
  const [todayDate, setTodayDate] = useState(formatSchoolDate);
  const [selectedId, setSelectedId] = useState(null);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todas');
  const [showNew, setShowNew] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [editingRepair, setEditingRepair] = useState(null);
  const [activeView, setActiveView] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.localStorage.getItem('arreglos.sidebar.collapsed') === 'true');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [role, setRole] = useState('Gestor');
  const [toast, setToast] = useState('');
  const [assignees, setAssignees] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [notificationAvailability, setNotificationAvailability] = useState({ emailConfigured: false, pushConfigured: false });
  const [pushEnabled, setPushEnabled] = useState(false);
  const [schools, setSchools] = useState([]);
  const [branding, setBranding] = useState({ school_id: 'alcaste', school_name: 'Colegio', primary_color: '#811a1d', secondary_color: '#a13232', logo_data_url: null });
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const detailPanelRef = useRef(null);
  const selected = repairs.find(item => item.id === selectedId) || repairs[0];
  const filtered = repairs.filter(item => (activeView !== 'mine' || item.author_id === user?.id) && (statusFilter === 'Todas' || item.status === statusFilter) && `${item.title} ${item.place} ${item.id}`.toLowerCase().includes(search.toLowerCase()));
  const count = status => repairs.filter(r => r.status === status).length;
  const canManageRepairs = user?.role === 'admin' || ['gestor', 'direccion'].includes(user?.repair_profile);
  const canUpdateSelectedStatus = canManageRepairs || String(selected?.assignee_id || '') === String(user?.id || '');
  const openRepair = (repair) => {
    setSelectedId(repair.id);
    if (window.matchMedia('(max-width: 800px)').matches) {
      window.setTimeout(() => detailPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    }
  };
  const openEditRepair = (repair) => { setSelectedId(repair.id); setEditingRepair(repair); setShowNew(true); };
  const toggleSidebar = () => setSidebarCollapsed(collapsed => { const next = !collapsed; window.localStorage.setItem('arreglos.sidebar.collapsed', String(next)); return next; });

  useEffect(() => {
    (async () => {
      try {
        const session = await apiRequest('/auth/session');
        const profile = await apiRequest('/profile');
        const authenticatedUser = { ...session.user, repair_profile: profile.profile };
        setUser(authenticatedUser);
        setSchools(session.schools || []);
        try { setBranding(await apiRequest('/branding')); } catch (error) { setAuthError(error.message); }
        const data = await apiRequest('/repairs');
        const loaded = data.repairs.map(normalizeRepair);
        setRepairs(loaded);
        const linkedRepair = new URLSearchParams(window.location.search).get('repair');
        setSelectedId(loaded.find(item => item.id === linkedRepair)?.id || loaded[0]?.id || null);
        try { setCampuses((await apiRequest('/repair-places')).campuses || []); } catch (error) { setAuthError(error.message); }
        setRole({ gestor: 'Gestor', direccion: 'Dirección', mantenimiento: 'Mantenimiento', profesor: 'Profesor' }[profile.profile] || 'Profesor');
        try { setAssignees((await apiRequest('/repair-users')).users || []); } catch (error) { setAuthError(error.message); }
        try { setNotificationAvailability(await apiRequest('/notifications/availability')); } catch { setNotificationAvailability({ emailConfigured: false, pushConfigured: false }); }
        if ('serviceWorker' in navigator && 'PushManager' in window) {
          try { const registration = await navigator.serviceWorker.register('/sw.js'); setPushEnabled(Boolean(await registration.pushManager.getSubscription())); } catch { setPushEnabled(false); }
        }
      } catch (error) { if (error.status !== 401) setAuthError(error.message); }
      finally { setAuthLoading(false); }
    })();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--brand', branding.primary_color || '#811a1d');
    root.style.setProperty('--brand-dark', branding.secondary_color || '#a13232');
    root.style.setProperty('--brand-soft', `color-mix(in srgb, ${branding.primary_color || '#811a1d'} 11%, white)`);
    document.title = branding.school_name ? `Arreglos · ${branding.school_name}` : 'Arreglos · Gestión escolar';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', branding.primary_color || '#811a1d');
  }, [branding.primary_color, branding.secondary_color]);

  useEffect(() => {
    const timer = window.setInterval(() => setTodayDate(formatSchoolDate()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user?.id) return undefined;
    let active = true;
    const loadNotifications = async () => {
      try { const data = await apiRequest('/notifications'); if (active) { setNotifications(data.notifications || []); setUnreadNotifications(data.unreadCount || 0); } } catch {}
    };
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [user?.id]);

  const notify = (message) => { setToast(message); window.setTimeout(() => setToast(''), 2800); };
  const changeStatus = async (status) => { const data = await apiRequest(`/repairs/${selected.id}`, { method: 'PATCH', body: JSON.stringify({ status, assignee_id: selected.assigneeId || null }) }); const updated = normalizeRepair(data.repair); setRepairs(items => items.map(item => item.id === selected.id ? { ...item, ...updated } : item)); notify(`Ficha ${selected.id} actualizada`); };
  const assignRepair = async (assigneeId) => { const data = await apiRequest(`/repairs/${selected.id}`, { method: 'PATCH', body: JSON.stringify({ status: assigneeId ? 'Asignada' : 'Recibida', assignee_id: assigneeId || null }) }); const updated = normalizeRepair(data.repair); setRepairs(items => items.map(item => item.id === selected.id ? { ...item, ...updated } : item)); notify('Responsable actualizado'); };
  const saveRepair = async (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const payload = { title: data.get('title'), description: data.get('description'), campus_id: data.get('campus_id'), place_id: data.get('place_id'), urgency: data.get('urgency') }; try { if (editingRepair) { const result = await apiRequest(`/repairs/${editingRepair.id}`, { method: 'PATCH', body: JSON.stringify(payload) }); const updated = normalizeRepair(result.repair); setRepairs(items => items.map(item => item.id === updated.id ? { ...item, ...updated } : item)); notify('Ficha actualizada correctamente'); } else { const result = await apiRequest('/repairs', { method: 'POST', body: JSON.stringify(payload) }); const newRepair = normalizeRepair(result.repair); setRepairs(items => [newRepair, ...items]); setSelectedId(newRepair.id); notify('Nueva ficha creada correctamente'); } setShowNew(false); setEditingRepair(null); return ''; } catch (error) { return error.message || 'No se pudieron guardar los cambios'; } };
  const deleteRepair = async (repair) => { if (!window.confirm(`¿Eliminar la ficha "${repair.title}"?`)) return; try { await apiRequest(`/repairs/${repair.id}`, { method: 'DELETE' }); setRepairs(items => items.filter(item => item.id !== repair.id)); setSelectedId(repairs.find(item => item.id !== repair.id)?.id || null); setShowNew(false); setEditingRepair(null); notify('Ficha eliminada'); } catch (error) { notify(error.message || 'No se pudo eliminar la ficha'); } };
  const updateProfile = async (id, profile) => { await apiRequest(`/repair-users/${id}`, { method: 'PUT', body: JSON.stringify({ profile }) }); setAssignees(items => items.map(item => item.id === id ? { ...item, profile } : item)); notify('Perfil actualizado'); };
  const addPlace = async (campusId, name) => { const result = await apiRequest('/repair-places', { method: 'POST', body: JSON.stringify({ campus_id: campusId, name }) }); setCampuses(items => items.map(campus => campus.id === campusId ? { ...campus, places: [...campus.places, { id: result.place.id, name: result.place.name }] } : campus)); notify('Lugar añadido'); };
  const renamePlace = async (placeId, name) => { const result = await apiRequest(`/repair-places/${placeId}`, { method: 'PATCH', body: JSON.stringify({ name }) }); setCampuses(items => items.map(campus => ({ ...campus, places: campus.places.map(place => place.id === placeId ? { ...place, name: result.place.name } : place) }))); notify('Lugar actualizado'); };
  const deletePlace = async (campusId, place) => { if (!window.confirm(`¿Eliminar el lugar "${place.name}"?`)) return; await apiRequest(`/repair-places/${place.id}`, { method: 'DELETE' }); setCampuses(items => items.map(campus => campus.id === campusId ? { ...campus, places: campus.places.filter(item => item.id !== place.id) } : campus)); notify('Lugar eliminado'); };
  const openNotification = async (notification) => {
    if (!notification.read_at) {
      try { await apiRequest(`/notifications/${notification.id}/read`, { method: 'PATCH' }); setNotifications(items => items.map(item => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item)); setUnreadNotifications(count => Math.max(0, count - 1)); }
      catch (error) { notify(error.message || 'No se pudo marcar como leída'); }
    }
    setNotificationsOpen(false);
    setActiveView('dashboard');
    const repair = repairs.find(item => item.id === String(notification.repair_id));
    if (repair) openRepair(repair);
  };
  const markAllNotificationsRead = async () => {
    try { await apiRequest('/notifications/read-all', { method: 'PATCH' }); const now = new Date().toISOString(); setNotifications(items => items.map(item => ({ ...item, read_at: item.read_at || now }))); setUnreadNotifications(0); }
    catch (error) { notify(error.message || 'No se pudieron marcar como leídas'); }
  };
  const saveBranding = async (event) => { event.preventDefault(); try { const saved = await apiRequest('/branding', { method: 'PUT', body: JSON.stringify({ primary_color: branding.primary_color, secondary_color: branding.secondary_color, logo_data_url: branding.logo_data_url || null, remove_logo: branding.logo_data_url === null && branding.logo_removed === true }) }); setBranding(current => ({ ...current, ...saved, logo_removed: false })); notify('Identidad del colegio guardada'); } catch (error) { notify(error.message || 'No se pudo guardar la identidad del colegio'); } };
  const switchSchool = async (schoolId) => { if (!schoolId || schoolId === user.school_id) return; try { await apiRequest('/auth/school', { method: 'POST', body: JSON.stringify({ school_id: schoolId }) }); window.location.reload(); } catch (error) { notify(error.message || 'No se pudo cambiar de colegio'); } };
  const togglePush = async () => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Este navegador no permite notificaciones push.');
      const registration = await navigator.serviceWorker.register('/sw.js');
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        await apiRequest('/notifications/push/subscriptions', { method: 'DELETE', body: JSON.stringify({ endpoint: existing.endpoint }) });
        await existing.unsubscribe();
        setPushEnabled(false);
        notify('Notificaciones push desactivadas');
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Permite las notificaciones en el navegador para activarlas.');
      const { publicKey } = await apiRequest('/notifications/push/vapid-public-key');
      const base64Key = publicKey.replace(/-/g, '+').replace(/_/g, '/');
      const applicationServerKey = Uint8Array.from(atob(base64Key.padEnd(Math.ceil(base64Key.length / 4) * 4, '=')), character => character.charCodeAt(0));
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
      await apiRequest('/notifications/push/subscriptions', { method: 'POST', body: JSON.stringify(subscription) });
      setPushEnabled(true);
      notify('Notificaciones push activadas');
    } catch (error) { notify(error.message || 'No se pudieron cambiar las notificaciones push'); }
  };
  const logout = async () => { try { const registration = await navigator.serviceWorker?.getRegistration('/'); const subscription = await registration?.pushManager?.getSubscription(); if (subscription) { await apiRequest('/notifications/push/subscriptions', { method: 'DELETE', body: JSON.stringify({ endpoint: subscription.endpoint }) }).catch(() => {}); await subscription.unsubscribe(); } } catch {} try { await apiRequest('/auth/logout', { method: 'POST' }); } finally { setUser(null); setAccountOpen(false); } };

  if (authLoading) return <div className="auth-screen"><div className="auth-card"><div className="brand-mark"><Hammer size={19} /></div><h1>arreglos</h1><p>Comprobando tu sesión...</p></div></div>;
  if (!user) return <div className="auth-screen"><div className="auth-card"><div className="brand-mark"><Hammer size={19} /></div><span className="eyebrow">CENTRO ESCOLAR</span><h1>arreglos</h1><p>Gestiona y sigue los arreglos del centro desde un solo lugar.</p><button className="google-button" onClick={() => window.location.assign(`/api/auth/google?returnTo=${encodeURIComponent(window.location.origin + window.location.pathname)}`)}><span>G</span> Continuar con Google</button>{authError && <div className="auth-error">{authError}</div>}<small>Accede con tu cuenta autorizada del colegio.</small></div></div>;

  return <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${mobileSidebarOpen ? 'mobile-menu-open' : ''}`}>
    <aside className={`sidebar ${sidebarCollapsed && !mobileSidebarOpen ? 'collapsed' : ''}`}>
      <div className="brand"><div className={`brand-mark ${branding.logo_data_url ? 'has-school-logo' : ''}`}>{branding.logo_data_url ? <img src={branding.logo_data_url} alt={`Logo de ${branding.school_name}`} /> : <Hammer size={19} />}</div><div><strong>arreglos</strong><small>{branding.school_name || 'COLEGIO'}</small></div></div>
      <div className="school-switch"><Building2 size={16} /><span>{branding.school_name || 'Centro escolar'}</span><ChevronDown size={14} /></div>
       <nav><p className="nav-label">GESTIÓN</p><a title="Panel general" aria-label="Panel general" className={activeView === 'dashboard' ? 'active' : ''} onClick={() => { setActiveView('dashboard'); setMobileSidebarOpen(false); }}><LayoutDashboard size={18} />Panel general</a><a title="Mis fichas" aria-label="Mis fichas" className={activeView === 'mine' ? 'active' : ''} onClick={() => { setActiveView('mine'); setMobileSidebarOpen(false); }}><FilePlus2 size={18} />Mis fichas <span className="nav-count">{repairs.filter(item => item.author_id === user.id).length}</span></a><a title="Usuarios" aria-label="Usuarios" className={activeView === 'team' ? 'active' : ''} onClick={() => { setActiveView('team'); setMobileSidebarOpen(false); }}><Users size={18} />Usuarios</a><p className="nav-label second">CENTRO</p><a title="Sedes y aulas" aria-label="Sedes y aulas" className={activeView === 'spaces' ? 'active' : ''} onClick={() => { setActiveView('spaces'); setMobileSidebarOpen(false); }}><Building2 size={18} />Sedes y aulas</a><a title="Configuración" aria-label="Configuración" className={activeView === 'settings' ? 'active' : ''} onClick={() => { setActiveView('settings'); setMobileSidebarOpen(false); }}><Settings size={18} />Configuración</a></nav>
      <div className="help-card"><button type="button" className="help-icon" aria-label="Abrir guía de arreglos" title="Guía de arreglos" onClick={() => { setMobileSidebarOpen(false); setHelpOpen(true); }}><MessageCircle size={17} /></button><strong>¿Necesitas ayuda?</strong><span>Consulta cómo funciona arreglos.</span><button type="button" onClick={() => { setMobileSidebarOpen(false); setHelpOpen(true); }}>Ver guía <ChevronRight size={14} /></button></div>
    </aside>
    {mobileSidebarOpen && <button className="mobile-sidebar-backdrop" type="button" aria-label="Cerrar menú" onClick={() => setMobileSidebarOpen(false)} />}
    <main className="main-content">
       <header className="topbar"><div className="mobile-brand"><IconButton label="Abrir menú" onClick={() => setMobileSidebarOpen(true)}><Menu size={21} /></IconButton>{branding.logo_data_url ? <img className="mobile-school-logo" src={branding.logo_data_url} alt={`Logo de ${branding.school_name}`} /> : <span className="mobile-school-logo fallback"><Hammer size={15} /></span>}<span>arreglos</span></div><IconButton label={sidebarCollapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'} className="sidebar-toggle" onClick={toggleSidebar}>{sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}</IconButton><div className="breadcrumb"><span>{branding.school_name || 'Centro escolar'}</span><ChevronRight size={14} /><strong>Fichas de arreglos</strong></div><div className="top-actions"><div className="role-select"><UserRound size={15} /><span>{role}</span></div><button type="button" className={`icon-button notification ${notificationsOpen ? 'is-open' : ''}`} onClick={() => { setNotificationsOpen(open => !open); setAccountOpen(false); }} aria-label={`Notificaciones${unreadNotifications ? `, ${unreadNotifications} sin leer` : ''}`} aria-expanded={notificationsOpen}><Bell size={19} />{unreadNotifications > 0 && <i />}</button><button type="button" className="avatar avatar-green top-avatar account-trigger" onClick={() => { setAccountOpen(open => !open); setNotificationsOpen(false); }} aria-label="Abrir menú de cuenta">{user.initials || user.name?.slice(0, 2).toUpperCase()}</button></div></header>{notificationsOpen && <NotificationsMenu items={notifications} unreadCount={unreadNotifications} onOpen={openNotification} onReadAll={markAllNotificationsRead} onClose={() => setNotificationsOpen(false)} />}{accountOpen && <AccountMenu user={user} role={role} schools={schools} currentSchoolId={user.school_id} onSwitchSchool={switchSchool} onLogout={logout} />}
       <div className={`page-wrap ${activeView}`}>
         <div className="page-heading"><div><div className="eyebrow">{todayDate}</div><h1>Fichas de arreglos</h1><p>Organiza, asigna y haz seguimiento de los arreglos del centro.</p></div><button className="primary-button" onClick={() => setShowNew(true)}><Plus size={18} />Nueva ficha</button></div>
         <section className="stats-grid"><div className="stat-card"><div className="stat-icon all"><FilePlus2 size={19} /></div><div><span>Total de fichas</span><strong>{repairs.length}</strong><small>+2 esta semana</small></div></div><div className="stat-card"><div className="stat-icon orange"><Clock3 size={19} /></div><div><span>Por atender</span><strong>{count('Recibida') + count('Asignada')}</strong><small>Requieren atención</small></div></div><div className="stat-card"><div className="stat-icon blue"><Hammer size={19} /></div><div><span>En progreso</span><strong>{count('En progreso')}</strong><small>En manos del equipo</small></div></div><div className="stat-card"><div className="stat-icon green"><Check size={19} /></div><div><span>Realizadas</span><strong>{count('Realizada')}</strong><small>Este mes</small></div></div></section>
         {activeView === 'team' && <TeamView assignees={assignees} onProfile={updateProfile} canManage={user.role === 'admin' || ['gestor', 'direccion'].includes(user.repair_profile)} />}
           {activeView === 'spaces' && <SpacesView repairs={repairs} campuses={campuses} canManage={user.role === 'admin' || ['gestor', 'direccion'].includes(user.repair_profile)} onAdd={addPlace} onRename={renamePlace} onDelete={deletePlace} />}
           {activeView === 'settings' && <SettingsView availability={notificationAvailability} pushEnabled={pushEnabled} branding={branding} canEditBranding={canManageRepairs} onBrandingChange={setBranding} onSaveBranding={saveBranding} onTogglePush={togglePush} />}
          <RepairDashboard repairs={filtered} total={repairs.length} search={search} onSearch={setSearch} statusFilter={statusFilter} onStatusFilter={setStatusFilter} selected={selected && { ...selected, currentUserId: user.id }} detailRef={detailPanelRef} onSelect={openRepair} onEdit={openEditRepair} canManage={canManageRepairs} canUpdateStatus={canUpdateSelectedStatus} assignees={assignees.filter(person => ['mantenimiento', 'gestor'].includes(person.profile))} onStatus={changeStatus} onAssign={assignRepair} onNotify={notify} />
         <div className="content-grid"><section className="list-panel"><div className="panel-head"><div><h2>Todas las fichas <span>{filtered.length}</span></h2><p>Últimas solicitudes registradas en el centro</p></div><IconButton label="Más opciones"><MoreHorizontal size={20} /></IconButton></div><div className="toolbar"><div className="search-box"><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por título, lugar o código..." /></div><div className="filter-select"><Filter size={15} /><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Filtrar por estado"><option>Todas</option><option>Recibida</option><option>Asignada</option><option>En progreso</option><option>Realizada</option></select><ChevronDown size={14} /></div><IconButton label="Más filtros"><SlidersHorizontal size={17} /></IconButton></div><div className="table-wrap"><table><thead><tr><th>FICHA</th><th>LUGAR</th><th>URGENCIA</th><th>ESTADO</th><th>ASIGNADA A</th><th>ACTUALIZADA</th></tr></thead><tbody>{filtered.map(item => <tr key={item.id} tabIndex={0} aria-label={`Abrir ficha ${item.title}`} className={selectedId === item.id ? 'selected-row' : ''} onClick={() => openRepair(item)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openRepair(item); } }}><td><div className="repair-title"><strong>{item.title}</strong><span>{item.id} · {item.author}</span></div></td><td><div className="place"><MapPin size={14} />{item.place}</div></td><td><Urgency value={item.urgency} /></td><td><StatusPill status={item.status} /></td><td><div className="assignee">{item.assignee ? <><div className="avatar avatar-purple">{item.assignee.split(' ').map(x => x[0]).join('')}</div>{item.assignee}</> : <span className="unassigned">Sin asignar</span>}</div></td><td><span className="updated">{item.updated}</span>{item.comments > 0 && <span className="comment-count"><MessageCircle size={13} />{item.comments}</span>}</td></tr>)}</tbody></table>{filtered.length === 0 && <div className="empty">No hay fichas que coincidan con la búsqueda.</div>}</div><div className="table-footer"><span>Mostrando {filtered.length} de {repairs.length} fichas</span><div><button disabled>Anterior</button><button className="current-page">1</button><button disabled>Siguiente</button></div></div></section>
            {selected ? <div className={`${canManageRepairs ? '' : 'repair-readonly-assignment'} ${canUpdateSelectedStatus ? '' : 'repair-readonly-progress'} selected-repair-detail`}><DetailPanel repair={selected} role={role} assignees={assignees} canManage={canManageRepairs} canUpdateStatus={canUpdateSelectedStatus} onStatus={changeStatus} onAssign={assignRepair} onNotify={notify} /></div> : <div className="detail-panel empty-detail">Selecciona una ficha para ver sus detalles.</div>}
        </div>
      </div>
    </main>
    {helpOpen && <HelpGuide onClose={() => setHelpOpen(false)} />}
      {showNew && <RepairFormModal repair={editingRepair} campuses={campuses} user={user} role={role} canDelete={canManageRepairs || String(editingRepair?.author_id || '') === String(user.id)} onClose={() => { setShowNew(false); setEditingRepair(null); }} onDelete={() => editingRepair && deleteRepair(editingRepair)} onSubmit={saveRepair} />}
    {toast && <div className="toast"><Check size={17} />{toast}</div>}
  </div>;
}

function NotificationsMenu({ items, unreadCount, onOpen, onReadAll, onClose }) {
  return <section className="notifications-menu" aria-label="Notificaciones"><div className="notifications-menu-head"><div><strong>Notificaciones</strong><span>{unreadCount ? `${unreadCount} sin leer` : 'Todo al día'}</span></div><div>{unreadCount > 0 && <button type="button" onClick={onReadAll}>Marcar todas como leídas</button>}<IconButton label="Cerrar notificaciones" onClick={onClose}><X size={16} /></IconButton></div></div><div className="notifications-list">{items.map(item => <button type="button" className={`notification-item ${item.read_at ? '' : 'unread'}`} key={item.id} onClick={() => onOpen(item)}><span className="notification-item-icon"><Hammer size={16} /></span><span className="notification-item-content"><strong>{item.title}</strong><span>{item.body}</span><small>{new Date(item.created_at).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></span>{!item.read_at && <i aria-label="Sin leer" />}</button>)}{items.length === 0 && <div className="notifications-empty"><Bell size={20} /><span>No tienes notificaciones todavía.</span></div>}</div></section>;
}

function HelpGuide({ onClose }) {
  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}><section className="modal help-guide" role="dialog" aria-modal="true" aria-labelledby="help-guide-title"><div className="modal-head"><div><span className="eyebrow">GUÍA RÁPIDA</span><h2 id="help-guide-title">Cómo usar Arreglos</h2></div><IconButton label="Cerrar guía" onClick={onClose}><X size={19} /></IconButton></div><ol className="guide-steps"><li><strong>Crea una ficha</strong><span>Pulsa <b>Nueva ficha</b>, describe el problema y elige primero la sede y después el aula.</span></li><li><strong>Consulta el progreso</strong><span>Pulsa una fila para ver el detalle. La ficha pasa por Recibida, Asignada, En progreso y Realizada.</span></li><li><strong>Asigna y coordina</strong><span>Gestores y dirección pueden asignar personal de mantenimiento o gestores desde el detalle.</span></li><li><strong>Habla en los comentarios</strong><span>Usa el campo de comentarios para coordinar el arreglo. Se notificará a la otra persona relacionada con la asignación.</span></li></ol><div className="guide-roles"><h3>Según tu perfil</h3><p><b>Profesor o empleado:</b> crea fichas y edita o elimina las que hayas creado.</p><p><b>Mantenimiento:</b> consulta las fichas asignadas, actualiza el progreso y comenta.</p><p><b>Gestor o dirección:</b> gestiona todas las fichas, asignaciones, usuarios, sedes y aulas.</p></div><div className="guide-foot"><Bell size={16} /><span>La campana muestra avisos pendientes. En <b>Configuración</b> puedes activar las notificaciones push y personalizar la identidad del colegio.</span></div><div className="modal-actions"><button type="button" className="primary-button" onClick={onClose}>Entendido</button></div></section></div>;
}

function AccountMenu({ user, role, schools, currentSchoolId, onSwitchSchool, onLogout }) {
  return <div className="account-menu"><div className="account-summary"><div className="avatar avatar-green">{user.initials || user.name?.slice(0, 2).toUpperCase()}</div><div><strong>{user.name}</strong><span>{user.email}</span></div></div>{schools.length > 1 && <label className="account-school"><span>Colegio activo</span><select value={currentSchoolId} onChange={event => onSwitchSchool(event.target.value)}>{schools.map(school => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>}<div className="account-role"><UserRound size={14} />{role}</div><button type="button" onClick={onLogout}><ChevronRight size={15} />Cerrar sesión</button></div>;
}

function RepairFormModal({ repair, campuses, user, role, canDelete, onClose, onDelete, onSubmit }) {
  const initialCampus = campuses.find(campus => campus.id === repair?.campus_id) || campuses[0];
  const [campusId, setCampusId] = useState(initialCampus?.id || '');
  const campus = campuses.find(item => item.id === campusId) || initialCampus;
  const initialPlace = campus?.places.find(place => String(place.id) === String(repair?.place_id)) || campus?.places[0];
  const [placeId, setPlaceId] = useState(String(initialPlace?.id || ''));
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (!campus?.places.some(place => String(place.id) === String(placeId))) setPlaceId(String(campus?.places[0]?.id || '')); }, [campusId, campuses.length]);
  const submit = async event => { event.preventDefault(); setSaving(true); setFormError(''); const error = await onSubmit(event); setSaving(false); if (error) setFormError(error); };
  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}><form className="modal" onSubmit={submit}><div className="modal-head"><div><span className="eyebrow">{repair ? 'EDITAR FICHA' : 'NUEVA SOLICITUD'}</span><h2>{repair ? 'Editar ficha de arreglo' : 'Crear ficha de arreglo'}</h2></div><IconButton label="Cerrar" onClick={onClose}><X size={19} /></IconButton></div><label>Título<input name="title" required defaultValue={repair?.title || ''} placeholder="Ej. Ventana no cierra bien" /></label><label>Descripción<textarea name="description" required defaultValue={repair?.description || ''} placeholder="Describe qué ocurre y cualquier detalle útil..." /></label><div className="form-row"><label>Sede<select name="campus_id" value={campusId} onChange={event => { setCampusId(event.target.value); setPlaceId(''); }} required><option value="">Selecciona una sede</option>{campuses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Aula<select name="place_id" value={placeId} onChange={event => setPlaceId(event.target.value)} required disabled={!campusId}><option value="">Selecciona un aula</option>{(campus?.places || []).map(place => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label></div><div className="form-row"><label>Urgencia<select name="urgency" defaultValue={repair?.urgency || 'Media'}><option>Urgente</option><option>Alta</option><option>Media</option><option>Baja</option></select></label><label>Quién la escribe<input value={`${user.name} · ${role}`} readOnly /></label></div>{formError && <div className="form-error" role="alert">{formError}</div>}<div className="modal-actions">{repair && canDelete && <button type="button" className="outline-button danger-button" onClick={onDelete}><Trash2 size={15} />Eliminar ficha</button>}<span className="modal-action-spacer" /><button type="button" className="outline-button" onClick={onClose}>Cerrar</button><button className="primary-button" type="submit" disabled={saving}><Check size={17} />{saving ? 'Guardando…' : repair ? 'Guardar cambios' : 'Crear ficha'}</button></div></form></div>;
}

function RepairDashboard({ repairs, total, search, onSearch, statusFilter, onStatusFilter, selected, detailRef, onSelect, onEdit, canManage, canUpdateStatus, assignees, onStatus, onAssign, onNotify }) {
  return <div className="content-grid repair-dashboard-grid"><section className="list-panel"><div className="panel-head"><div><h2>Todas las fichas <span>{repairs.length}</span></h2><p>Últimas solicitudes registradas en el centro</p></div></div><div className="toolbar"><div className="search-box"><Search size={17} /><input value={search} onChange={event => onSearch(event.target.value)} placeholder="Buscar por título, lugar o código..." /></div><div className="filter-select"><Filter size={15} /><select value={statusFilter} onChange={event => onStatusFilter(event.target.value)} aria-label="Filtrar por estado"><option>Todas</option><option>Recibida</option><option>Asignada</option><option>En progreso</option><option>Realizada</option></select><ChevronDown size={14} /></div></div><div className="table-wrap"><table><thead><tr><th>FICHA</th><th>LUGAR</th><th>URGENCIA</th><th>ESTADO</th><th>ASIGNADA A</th><th>ACTUALIZADA</th><th>ACCIÓN</th></tr></thead><tbody>{repairs.map(item => <tr key={item.id} tabIndex={0} aria-label={`Ver ficha ${item.title}`} className={selected?.id === item.id ? 'selected-row' : ''} onClick={() => onSelect(item)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(item); } }}><td><div className="repair-title"><strong>{item.title}</strong><span>{item.id} · {item.author}</span></div></td><td><div className="place"><MapPin size={14} />{item.place}</div></td><td><Urgency value={item.urgency} /></td><td><StatusPill status={item.status} /></td><td><div className="assignee">{item.assignee ? <><div className="avatar avatar-purple">{item.assignee.split(' ').map(part => part[0]).join('')}</div>{item.assignee}</> : <span className="unassigned">Sin asignar</span>}</div></td><td><span className="updated">{item.updated}</span>{item.comments > 0 && <span className="comment-count"><MessageCircle size={13} />{item.comments}</span>}</td><td>{(canManage || String(item.author_id) === String(selected?.currentUserId || '')) && <button className="row-edit-button" type="button" aria-label={`Editar ${item.title}`} onClick={event => { event.stopPropagation(); onEdit(item); }} onKeyDown={event => event.stopPropagation()}><Pencil size={14} />Editar</button>}</td></tr>)}</tbody></table>{repairs.length === 0 && <div className="empty">No hay fichas que coincidan con la búsqueda.</div>}</div><div className="table-footer"><span>Mostrando {repairs.length} de {total} fichas</span><div><button disabled>Anterior</button><button className="current-page">1</button><button disabled>Siguiente</button></div></div></section>{selected ? <div ref={detailRef} className={`${canManage ? '' : 'repair-readonly-assignment'} ${canUpdateStatus ? '' : 'repair-readonly-progress'} selected-repair-detail`}><DetailPanel repair={selected} assignees={assignees} canManage={canManage} canUpdateStatus={canUpdateStatus} onStatus={onStatus} onAssign={onAssign} onNotify={onNotify} /></div> : <div ref={detailRef} className="detail-panel empty-detail">Selecciona una ficha para ver su progreso.</div>}</div>;
}

function TeamView({ assignees, onProfile, canManage }) {
  return <section className="management-card"><div className="management-head"><div><span className="eyebrow">USUARIOS DEL CENTRO</span><h2>Usuarios y perfiles</h2><p>{canManage ? 'Asigna el perfil operativo de cada persona.' : 'Consulta los perfiles asignados. Solo los gestores pueden modificarlos.'}</p></div><Users size={22} /></div><div className="team-list">{assignees.map(person => <div className="team-row" key={person.id}><div className="avatar avatar-purple">{person.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</div><div className="team-person"><strong>{person.name}</strong><span>{person.email}</span></div><select disabled={!canManage} value={person.profile || 'profesor'} onChange={event => onProfile(person.id, event.target.value)}><option value="profesor">Profesor / empleado</option><option value="mantenimiento">Mantenimiento</option><option value="gestor">Gestor de arreglos</option><option value="direccion">Dirección</option></select></div>)}</div>{!assignees.length && <div className="empty-detail">No hay empleados activos en el colegio.</div>}</section>;
}

function SpacesView({ repairs, campuses, canManage, onAdd, onRename, onDelete }) {
  const [newCampus, setNewCampus] = useState(campuses[0]?.id || '');
  const [newName, setNewName] = useState('');
  const add = async event => { event.preventDefault(); if (!newName.trim()) return; await onAdd(newCampus, newName.trim()); setNewName(''); };
  return <section className="management-card"><div className="management-head"><div><span className="eyebrow">CENTRO ESCOLAR</span><h2>Espacios y aulas</h2><p>Primaria en Alcaste · ESO y Bachillerato en Las Fuentes.</p></div><Building2 size={22} /></div><div className="campus-list">{campuses.map(campus => <div className="campus-block" key={campus.id}><h3>{campus.name}</h3><div className="space-grid">{campus.places.map(place => <div className="space-item" key={place.id}><MapPin size={17} /><strong>{place.name}</strong><span>{repairs.filter(item => String(item.place_id) === String(place.id)).length} fichas registradas</span>{canManage && <div className="place-actions"><button className="text-button edit-place" onClick={() => { const name = window.prompt('Nuevo nombre del aula', place.name); if (name?.trim()) onRename(place.id, name.trim()); }}><Pencil size={13} />Editar</button><button className="text-button delete-place" onClick={() => onDelete(campus.id, place)}><Trash2 size={13} />Eliminar</button></div>}</div>)}</div></div>)}</div>{canManage && <form className="add-place-form" onSubmit={add}><select value={newCampus} onChange={event => setNewCampus(event.target.value)}>{campuses.map(campus => <option key={campus.id} value={campus.id}>{campus.name}</option>)}</select><input value={newName} onChange={event => setNewName(event.target.value)} placeholder="Nuevo lugar o aula" /><button className="primary-button" type="submit"><Plus size={16} />Añadir lugar</button></form>}</section>;
}

function SettingsView({ availability, pushEnabled, onTogglePush, branding, canEditBranding, onBrandingChange, onSaveBranding }) {
  const chooseLogo = event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 3 * 1024 * 1024) { window.alert('Elige un logo PNG, JPEG o WebP de hasta 3 MB.'); event.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => onBrandingChange(current => ({ ...current, logo_data_url: String(reader.result), logo_removed: false }));
    reader.readAsDataURL(file);
  };
  const removeLogo = () => onBrandingChange(current => ({ ...current, logo_data_url: null, logo_removed: true }));
  return <><section className="management-card brand-settings-card"><div className="management-head"><div><span className="eyebrow">{branding.school_name || 'COLEGIO'}</span><h2>Identidad del colegio</h2><p>Personaliza el color y el logo que aparecen en arreglos para este colegio.</p></div><Building2 size={22} /></div><form className="branding-form" onSubmit={onSaveBranding}><div className="branding-color-fields"><label><span>Color corporativo principal</span><input type="color" value={branding.primary_color} disabled={!canEditBranding} onChange={event => onBrandingChange(current => ({ ...current, primary_color: event.target.value }))} /></label><label><span>Color secundario</span><input type="color" value={branding.secondary_color} disabled={!canEditBranding} onChange={event => onBrandingChange(current => ({ ...current, secondary_color: event.target.value }))} /></label></div><div className="branding-logo-row"><div className="branding-logo-preview">{branding.logo_data_url ? <img src={branding.logo_data_url} alt={`Logo de ${branding.school_name}`} /> : <div className="brand-mark"><Hammer size={19} /></div>}</div><div className="branding-logo-controls"><strong>Logo del colegio</strong><small>PNG, JPEG o WebP · máximo 3 MB. Aparecerá pequeño en la cabecera.</small>{canEditBranding && <div className="branding-logo-buttons"><label className="outline-button upload-logo-button">Subir logo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseLogo} /></label>{branding.logo_data_url && <button className="text-button delete-place" type="button" onClick={removeLogo}>Quitar logo</button>}</div>}</div></div>{!canEditBranding && <p className="branding-permission-note">Solo gestores y dirección pueden cambiar la imagen y los colores.</p>}{canEditBranding && <div className="branding-actions"><button className="primary-button" type="submit"><Check size={16} />Guardar identidad</button></div>}</form></section><section className="management-card"><div className="management-head"><div><span className="eyebrow">CONFIGURACIÓN</span><h2>Notificaciones</h2><p>Avisos para fichas nuevas, asignaciones, comentarios y cierres.</p></div><Settings size={22} /></div><div className="settings-list"><div className="notification-setting"><span><strong>Notificaciones por correo</strong><small>{availability.emailConfigured ? 'Correo SMTP configurado. Se enviarán avisos a los destinatarios de cada ficha.' : 'El correo SMTP todavía no está configurado para el colegio.'}</small></span><span className={`setting-status ${availability.emailConfigured ? 'ready' : ''}`}>{availability.emailConfigured ? 'Activas' : 'Sin configurar'}</span></div><div className="notification-setting"><span><strong>Notificaciones push</strong><small>{availability.pushConfigured ? 'Recibe avisos en este navegador cuando haya actividad en arreglos.' : 'El servicio push no está configurado en el servidor.'}</small></span><button className={pushEnabled ? 'outline-button' : 'primary-button'} type="button" onClick={onTogglePush} disabled={!availability.pushConfigured}>{pushEnabled ? 'Desactivar' : 'Activar push'}</button></div></div></section></>;
}

 function DetailPanel({ repair, role, assignees, canManage, canUpdateStatus, onStatus, onAssign, onEdit, onDelete, onNotify }) {
  const [comment, setComment] = useState('');
  const [commentSending, setCommentSending] = useState(false);
  const [assigned, setAssigned] = useState(repair.assigneeId || '');
  const [messages, setMessages] = useState([]);
  useEffect(() => { setAssigned(repair.assigneeId || ''); apiRequest(`/repairs/${repair.id}/comments`).then(data => setMessages((data.comments || []).map(item => ({ author: item.author_name, initials: item.author_initials || item.author_name?.slice(0, 2).toUpperCase(), text: item.body, time: new Date(item.created_at).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }), mine: item.author_id === repair.author_id })))).catch(() => setMessages([])); }, [repair.id, repair.assigneeId, repair.author_id]);
  const sendComment = async (e) => { e.preventDefault(); const body = comment.trim(); if (!body || commentSending) return; setCommentSending(true); try { const data = await apiRequest(`/repairs/${repair.id}/comments`, { method: 'POST', body: JSON.stringify({ body }) }); const item = data.comment; setMessages(current => [...current, { author: item.author_name, initials: item.author_initials, text: item.body, time: 'Ahora', mine: true }]); setComment(''); onNotify('Comentario añadido'); } catch (error) { onNotify(`No se pudo enviar el comentario: ${error.message}`); } finally { setCommentSending(false); } };
  return <aside className="detail-panel"><div className="detail-top"><div><span className="detail-id">{repair.id}</span><StatusPill status={repair.status} /></div><div><IconButton label="Compartir"><Users size={17} /></IconButton><IconButton label="Más opciones"><MoreHorizontal size={19} /></IconButton></div></div><h2>{repair.title}</h2><div className="detail-location"><MapPin size={15} />{repair.place}</div><div className="detail-meta"><div><span>Creada por</span><strong>{repair.author}</strong><small>{repair.date}</small></div><div><span>Urgencia</span><Urgency value={repair.urgency} /></div></div><div className="detail-section"><div className="section-title"><h3>Progreso</h3><span>{repair.status === 'Realizada' ? '100' : repair.status === 'En progreso' ? '65' : repair.status === 'Asignada' ? '25' : '0'}%</span></div><div className="progress-track"><i className={`bar ${repair.status === 'Realizada' ? 'full' : repair.status === 'En progreso' ? 'mid' : repair.status === 'Asignada' ? 'low' : ''}`} /></div><div className="steps"><span className={repair.status !== 'Recibida' ? 'done-step' : 'active-step'}>Recibida</span><span className={['En progreso', 'Realizada'].includes(repair.status) ? 'done-step' : ''}>En progreso</span><span className={repair.status === 'Realizada' ? 'done-step' : ''}>Realizada</span></div></div><div className="detail-section description"><h3>Descripción</h3><p>{repair.description}</p></div><div className="detail-section assignment"><div className="section-title"><h3>Asignación</h3><span className="edit-label">Editar</span></div><label>PERSONA RESPONSABLE<select value={assigned} onChange={e => { setAssigned(e.target.value); onAssign(e.target.value); }}><option value="">Sin asignar</option>{assignees.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select><ChevronDown size={14} /></label></div><div className="detail-section activity"><div className="section-title"><h3>Comentarios <span className="comment-bubble">{messages.length}</span></h3><span>Actividad</span></div><div className="messages">{messages.map((message, index) => <div className={`message ${message.mine ? 'mine' : ''}`} key={index}><div className={`avatar ${message.mine ? 'avatar-green' : 'avatar-purple'}`}>{message.initials}</div><div><div className="message-name"><strong>{message.author}</strong><small>{message.time}</small></div><p>{message.text}</p></div></div>)}</div><form className="comment-form" onSubmit={sendComment}><div className="avatar avatar-green">AM</div><input value={comment} onChange={e => setComment(e.target.value)} placeholder="Escribe un comentario..." /><button aria-label="Enviar comentario"><ChevronRight size={18} /></button></form></div><div className="detail-actions">{repair.status !== 'Realizada' && <button className="primary-button" onClick={() => onStatus(repair.status === 'En progreso' ? 'Realizada' : 'En progreso')}>{repair.status === 'En progreso' ? <><Check size={16} />Marcar como realizada</> : <><Hammer size={16} />Comenzar arreglo</>}</button>}<button className="outline-button" onClick={() => onNotify('Notificación enviada por email y push')}><Bell size={16} />Notificar</button></div></aside>;
}

createRoot(document.getElementById('root')).render(<App />);

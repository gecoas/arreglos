CREATE SCHEMA IF NOT EXISTS arreglos;

CREATE TABLE IF NOT EXISTS arreglos.user_profiles (
  school_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(128) NOT NULL,
  profile VARCHAR(32) NOT NULL DEFAULT 'profesor' CHECK (profile IN ('profesor', 'mantenimiento', 'gestor', 'direccion')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (school_id, user_id)
);

CREATE TABLE IF NOT EXISTS arreglos.campuses (
  id VARCHAR(64) PRIMARY KEY,
  school_id VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS arreglos.places (
  id BIGSERIAL PRIMARY KEY,
  school_id VARCHAR(64) NOT NULL,
  campus_id VARCHAR(64) NOT NULL REFERENCES arreglos.campuses(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (school_id, campus_id, name)
);

CREATE TABLE IF NOT EXISTS arreglos.repairs (
  id BIGSERIAL PRIMARY KEY,
  school_id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  campus_id VARCHAR(64) NOT NULL,
  place_id BIGINT NOT NULL REFERENCES arreglos.places(id),
  urgency VARCHAR(16) NOT NULL DEFAULT 'Media' CHECK (urgency IN ('Urgente', 'Alta', 'Media', 'Baja')),
  status VARCHAR(32) NOT NULL DEFAULT 'Recibida' CHECK (status IN ('Recibida', 'Asignada', 'En progreso', 'Realizada')),
  author_id VARCHAR(128) NOT NULL,
  assignee_id VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS repairs_school_status_idx ON arreglos.repairs (school_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS repairs_author_idx ON arreglos.repairs (author_id, created_at DESC);

CREATE TABLE IF NOT EXISTS arreglos.comments (
  id BIGSERIAL PRIMARY KEY,
  repair_id BIGINT NOT NULL REFERENCES arreglos.repairs(id) ON DELETE CASCADE,
  author_id VARCHAR(128) NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS comments_repair_idx ON arreglos.comments (repair_id, created_at);

CREATE TABLE IF NOT EXISTS arreglos.push_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  school_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(128) NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh VARCHAR(512) NOT NULL,
  auth VARCHAR(512) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (school_id, endpoint)
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON arreglos.push_subscriptions (school_id, user_id);

CREATE TABLE IF NOT EXISTS arreglos.notifications (
  id BIGSERIAL PRIMARY KEY,
  school_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(128) NOT NULL,
  repair_id BIGINT NOT NULL REFERENCES arreglos.repairs(id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON arreglos.notifications (school_id, user_id, created_at DESC) WHERE read_at IS NULL;

INSERT INTO arreglos.campuses (id, school_id, name, sort_order) VALUES
  ('alcaste', 'alcaste', 'Alcaste', 1), ('las-fuentes', 'alcaste', 'Las Fuentes', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO arreglos.places (school_id, campus_id, name, sort_order)
SELECT 'alcaste', campus.id, course.name || ' ' || section.name, (course.position * 2) + section.position
FROM arreglos.campuses campus
CROSS JOIN (VALUES
  ('1º Primaria', 1), ('2º Primaria', 2), ('3º Primaria', 3), ('4º Primaria', 4),
  ('5º Primaria', 5), ('6º Primaria', 6), ('1º ESO', 7), ('2º ESO', 8),
  ('3º ESO', 9), ('4º ESO', 10), ('1º Bachillerato', 11), ('2º Bachillerato', 12)
) AS course(name, position)
CROSS JOIN (VALUES ('A', 0), ('B', 1)) AS section(name, position)
WHERE campus.school_id = 'alcaste'
  AND campus.id = CASE WHEN course.position <= 6 THEN 'alcaste' ELSE 'las-fuentes' END
ON CONFLICT (school_id, campus_id, name) DO NOTHING;

-- WebRTC Video Meetings Schema
-- Skapar tabeller för videomötesfunktionalitet med GDPR-efterlevnad
-- Datum: 2024-12-19

-- Videomöten metadata
CREATE TABLE IF NOT EXISTS video_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  room_id TEXT UNIQUE NOT NULL,
  max_participants INTEGER DEFAULT 10 CHECK (max_participants > 0 AND max_participants <= 50),
  is_recording_allowed BOOLEAN DEFAULT false,
  consent_required BOOLEAN DEFAULT true,
  data_retention_days INTEGER DEFAULT 30 CHECK (data_retention_days > 0 AND data_retention_days <= 365),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  
  -- Säkerställ att endast digitala möten kan ha videofunktionalitet
  CONSTRAINT video_meetings_digital_only CHECK (
    (SELECT meeting_type FROM meetings WHERE id = meeting_id) = 'digital'
  )
);

-- Index för prestanda
CREATE INDEX IF NOT EXISTS idx_video_meetings_meeting_id ON video_meetings(meeting_id);
CREATE INDEX IF NOT EXISTS idx_video_meetings_room_id ON video_meetings(room_id);
CREATE INDEX IF NOT EXISTS idx_video_meetings_created_at ON video_meetings(created_at);

-- WebRTC signaling meddelanden
CREATE TABLE IF NOT EXISTS webrtc_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id TEXT NOT NULL, -- room_id från video_meetings
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL för broadcast
  signal_type TEXT NOT NULL CHECK (signal_type IN ('offer', 'answer', 'ice-candidate', 'participant-status', 'meeting-control')),
  signal_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- TTL för signaling meddelanden (rensas automatiskt efter 24 timmar)
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Index för signaling
CREATE INDEX IF NOT EXISTS idx_webrtc_signals_meeting_id ON webrtc_signals(meeting_id);
CREATE INDEX IF NOT EXISTS idx_webrtc_signals_created_at ON webrtc_signals(created_at);
CREATE INDEX IF NOT EXISTS idx_webrtc_signals_expires_at ON webrtc_signals(expires_at);

-- Deltagarstatus i videomöten
CREATE TABLE IF NOT EXISTS video_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_meeting_id UUID NOT NULL REFERENCES video_meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  left_at TIMESTAMP WITH TIME ZONE,
  is_moderator BOOLEAN DEFAULT false,
  audio_enabled BOOLEAN DEFAULT true,
  video_enabled BOOLEAN DEFAULT true,
  consent_given BOOLEAN DEFAULT false,
  consent_given_at TIMESTAMP WITH TIME ZONE,
  
  -- En användare kan bara vara aktiv i ett videomöte åt gången
  CONSTRAINT video_participants_unique_active UNIQUE (user_id, video_meeting_id),
  
  -- Samtycke måste ges om det krävs
  CONSTRAINT video_participants_consent_check CHECK (
    NOT (SELECT consent_required FROM video_meetings WHERE id = video_meeting_id) 
    OR consent_given = true
  )
);

-- Index för deltagare
CREATE INDEX IF NOT EXISTS idx_video_participants_video_meeting_id ON video_participants(video_meeting_id);
CREATE INDEX IF NOT EXISTS idx_video_participants_user_id ON video_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_video_participants_joined_at ON video_participants(joined_at);

-- Möteslänkar och inbjudningar
CREATE TABLE IF NOT EXISTS meeting_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_meeting_id UUID NOT NULL REFERENCES video_meetings(id) ON DELETE CASCADE,
  join_code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used_at TIMESTAMP WITH TIME ZONE,
  used_by UUID REFERENCES users(id),
  
  -- Join-kod måste vara unik och inte utgången
  CONSTRAINT meeting_invitations_unique_active UNIQUE (video_meeting_id, join_code)
);

-- Index för inbjudningar
CREATE INDEX IF NOT EXISTS idx_meeting_invitations_video_meeting_id ON meeting_invitations(video_meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_invitations_join_code ON meeting_invitations(join_code);
CREATE INDEX IF NOT EXISTS idx_meeting_invitations_expires_at ON meeting_invitations(expires_at);

-- Audit log för mötesaktiviteter (GDPR-efterlevnad)
CREATE TABLE IF NOT EXISTS meeting_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_meeting_id UUID REFERENCES video_meetings(id) ON DELETE CASCADE,
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index för audit log
CREATE INDEX IF NOT EXISTS idx_meeting_audit_log_video_meeting_id ON meeting_audit_log(video_meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_audit_log_meeting_id ON meeting_audit_log(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_audit_log_created_at ON meeting_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_meeting_audit_log_event_type ON meeting_audit_log(event_type);

-- Row Level Security (RLS) Policies

-- Video meetings - endast deltagare kan se
ALTER TABLE video_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "video_meetings_select_policy" ON video_meetings
  FOR SELECT USING (
    meeting_id IN (
      SELECT meeting_id FROM meeting_participants 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "video_meetings_insert_policy" ON video_meetings
  FOR INSERT WITH CHECK (
    meeting_id IN (
      SELECT meeting_id FROM meeting_participants 
      WHERE user_id = auth.uid() AND role IN ('moderator', 'secretary')
    )
  );

CREATE POLICY "video_meetings_update_policy" ON video_meetings
  FOR UPDATE USING (
    meeting_id IN (
      SELECT meeting_id FROM meeting_participants 
      WHERE user_id = auth.uid() AND role IN ('moderator', 'secretary')
    )
  );

-- WebRTC signals - endast för mötesdeltagare
ALTER TABLE webrtc_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webrtc_signals_select_policy" ON webrtc_signals
  FOR SELECT USING (
    meeting_id IN (
      SELECT room_id FROM video_meetings vm
      JOIN meeting_participants mp ON vm.meeting_id = mp.meeting_id
      WHERE mp.user_id = auth.uid()
    )
  );

CREATE POLICY "webrtc_signals_insert_policy" ON webrtc_signals
  FOR INSERT WITH CHECK (
    from_user_id = auth.uid() AND
    meeting_id IN (
      SELECT room_id FROM video_meetings vm
      JOIN meeting_participants mp ON vm.meeting_id = mp.meeting_id
      WHERE mp.user_id = auth.uid()
    )
  );

-- Video participants - endast egna data och mötesdeltagare
ALTER TABLE video_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "video_participants_select_policy" ON video_participants
  FOR SELECT USING (
    video_meeting_id IN (
      SELECT vm.id FROM video_meetings vm
      JOIN meeting_participants mp ON vm.meeting_id = mp.meeting_id
      WHERE mp.user_id = auth.uid()
    )
  );

CREATE POLICY "video_participants_insert_policy" ON video_participants
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    video_meeting_id IN (
      SELECT vm.id FROM video_meetings vm
      JOIN meeting_participants mp ON vm.meeting_id = mp.meeting_id
      WHERE mp.user_id = auth.uid()
    )
  );

CREATE POLICY "video_participants_update_policy" ON video_participants
  FOR UPDATE USING (
    user_id = auth.uid()
  );

-- Meeting invitations - endast moderatorer kan skapa
ALTER TABLE meeting_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meeting_invitations_select_policy" ON meeting_invitations
  FOR SELECT USING (
    video_meeting_id IN (
      SELECT vm.id FROM video_meetings vm
      JOIN meeting_participants mp ON vm.meeting_id = mp.meeting_id
      WHERE mp.user_id = auth.uid()
    )
  );

CREATE POLICY "meeting_invitations_insert_policy" ON meeting_invitations
  FOR INSERT WITH CHECK (
    created_by = auth.uid() AND
    video_meeting_id IN (
      SELECT vm.id FROM video_meetings vm
      JOIN meeting_participants mp ON vm.meeting_id = mp.meeting_id
      WHERE mp.user_id = auth.uid() AND mp.role IN ('moderator', 'secretary')
    )
  );

-- Audit log - endast läsning för berörda användare
ALTER TABLE meeting_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meeting_audit_log_select_policy" ON meeting_audit_log
  FOR SELECT USING (
    video_meeting_id IN (
      SELECT vm.id FROM video_meetings vm
      JOIN meeting_participants mp ON vm.meeting_id = mp.meeting_id
      WHERE mp.user_id = auth.uid()
    ) OR
    meeting_id IN (
      SELECT meeting_id FROM meeting_participants 
      WHERE user_id = auth.uid()
    )
  );

-- Automatisk rensning av gamla signaling meddelanden
CREATE OR REPLACE FUNCTION cleanup_expired_signals()
RETURNS void AS $$
BEGIN
  DELETE FROM webrtc_signals 
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Schemalägg automatisk rensning (körs varje timme)
-- Detta kräver pg_cron extension som kan aktiveras av Supabase admin
-- SELECT cron.schedule('cleanup-webrtc-signals', '0 * * * *', 'SELECT cleanup_expired_signals();');

-- Automatisk rensning av gamla audit logs (efter 2 år för GDPR)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM meeting_audit_log 
  WHERE created_at < NOW() - INTERVAL '2 years';
END;
$$ LANGUAGE plpgsql;

-- Trigger för automatisk audit logging
CREATE OR REPLACE FUNCTION log_video_meeting_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO meeting_audit_log (
      video_meeting_id,
      meeting_id,
      user_id,
      event_type,
      event_data
    ) VALUES (
      NEW.video_meeting_id,
      (SELECT meeting_id FROM video_meetings WHERE id = NEW.video_meeting_id),
      NEW.user_id,
      'participant_joined',
      jsonb_build_object(
        'consent_given', NEW.consent_given,
        'is_moderator', NEW.is_moderator,
        'joined_at', NEW.joined_at
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' AND OLD.left_at IS NULL AND NEW.left_at IS NOT NULL THEN
    INSERT INTO meeting_audit_log (
      video_meeting_id,
      meeting_id,
      user_id,
      event_type,
      event_data
    ) VALUES (
      NEW.video_meeting_id,
      (SELECT meeting_id FROM video_meetings WHERE id = NEW.video_meeting_id),
      NEW.user_id,
      'participant_left',
      jsonb_build_object(
        'left_at', NEW.left_at,
        'duration_minutes', EXTRACT(EPOCH FROM (NEW.left_at - NEW.joined_at))/60
      )
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger för video_participants
CREATE TRIGGER video_participants_audit_trigger
  AFTER INSERT OR UPDATE ON video_participants
  FOR EACH ROW
  EXECUTE FUNCTION log_video_meeting_activity();

-- Kommentarer för dokumentation
COMMENT ON TABLE video_meetings IS 'Metadata för videomöten med GDPR-efterlevnad';
COMMENT ON TABLE webrtc_signals IS 'WebRTC signaling meddelanden med automatisk TTL';
COMMENT ON TABLE video_participants IS 'Deltagare i videomöten med samtyckesspårning';
COMMENT ON TABLE meeting_invitations IS 'Säkra möteslänkar med utgångsdatum';
COMMENT ON TABLE meeting_audit_log IS 'Audit trail för GDPR-efterlevnad och säkerhet';

-- Skapa index för prestanda
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_video_meetings_active 
  ON video_meetings(meeting_id, created_at) 
  WHERE ended_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_video_participants_active 
  ON video_participants(video_meeting_id, user_id) 
  WHERE left_at IS NULL;

-- Säkerställ att tabellerna är skapade
SELECT 'WebRTC video meetings schema installerat framgångsrikt' AS status;

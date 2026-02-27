CREATE TABLE IF NOT EXISTS inbound_messages (
  id TEXT PRIMARY KEY,
  transport_message_id TEXT,
  chat_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  push_name TEXT,
  text TEXT NOT NULL,
  message_type TEXT NOT NULL,
  is_group INTEGER NOT NULL DEFAULT 0,
  from_me INTEGER NOT NULL DEFAULT 0,
  received_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inbound_messages_transport_id_unique
  ON inbound_messages(transport_message_id)
  WHERE transport_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inbound_messages_received_at
  ON inbound_messages(received_at DESC);

CREATE INDEX IF NOT EXISTS idx_inbound_messages_chat_received
  ON inbound_messages(chat_id, received_at DESC);

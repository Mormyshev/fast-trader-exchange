export type ChatMessage = {
  id: string;
  created_at: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  sender?: {
    role?: string | null;
    operator_pseudonym?: string | null;
    email?: string;
  };
};

export type ChatConversation = {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  operator_id: string | null;
  status: string;
  user?: {
    email?: string;
    first_name?: string | null;
    last_name?: string | null;
  };
  operator?: {
    operator_pseudonym?: string | null;
  } | null;
  assigned_operator?: {
    id: string;
    operator_pseudonym?: string | null;
  } | null;
  last_message?: ChatMessage | null;
  unread?: boolean;
};

export const MAX_CHAT_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const ALLOWED_CHAT_ATTACHMENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "video/mp4",
  "video/webm",
  "video/quicktime",
];
